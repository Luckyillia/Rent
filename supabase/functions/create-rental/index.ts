// supabase/functions/create-rental/index.ts
// Публичная точка приёма заявок на аренду (без токена — доступна всем
// посетителям сайта). Проверяет антиспам по IP, проверяет что машина
// не занята другой активной арендой, и сама считает итоговую цену по
// датам и тарифам машины (vehicle_price_tiers) — цене из браузера не
// доверяет.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, serviceRoleKey)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Минимальный промежуток между заявками с одного IP.
const RATE_LIMIT_MINUTES = 10
const MS_IN_DAY = 24 * 60 * 60 * 1000

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// Подбирает цену за сутки по количеству суток аренды среди тарифов
// машины. Если тарифов нет, или ни один диапазон не подошёл — берём
// обычную price_day. Если подошло несколько (диапазоны в базе не
// обязаны быть непересекающимися) — берём тариф с наибольшим min_days,
// как более специфичный.
function resolvePricePerDay(days: number, tiers: any[], fallbackPriceDay: number) {
  const matched = tiers
    .filter((t) => days >= t.min_days && (t.max_days == null || days <= t.max_days))
    .sort((a, b) => a.min_days - b.min_days)
  if (matched.length > 0) return matched[matched.length - 1].price_per_day
  return fallbackPriceDay
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { vehicleId, vkLink, gameNickname, contactName, startDate, endDate } = await req.json()

    if (!vehicleId || !vkLink?.trim() || !gameNickname?.trim() || !contactName?.trim()) {
      return json({ error: "Заполните все поля формы" }, 400)
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return json({ error: "Некорректный период аренды" }, 400)
    }
    // Считаем сутки включительно: с 10 по 10 число — это 1 сутки, с 10 по 12 — 3.
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_IN_DAY) + 1)

    const clientIp = getClientIp(req)

    // --- Антиспам: не больше одной заявки с одного IP за N минут ---
    const since = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString()
    const { data: recent, error: recentError } = await supabase
      .from("rentals")
      .select("id")
      .eq("client_ip", clientIp)
      .gte("created_at", since)
      .limit(1)

    if (recentError) throw recentError
    if (recent && recent.length > 0) {
      return json(
        { error: "Вы уже отправляли заявку недавно. Попробуйте ещё раз через несколько минут." },
        429
      )
    }

    // --- Машина не должна быть уже занята активной арендой ---
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("price_day, is_rented")
      .eq("id", vehicleId)
      .maybeSingle()

    if (vehicleError) throw vehicleError
    if (!vehicle) return json({ error: "Машина не найдена" }, 404)
    if (vehicle.is_rented) {
      return json({ error: "Эта машина сейчас в аренде и временно недоступна для брони" }, 409)
    }

    // --- Тарифы машины ---
    const { data: tiers, error: tiersError } = await supabase
      .from("vehicle_price_tiers")
      .select("min_days, max_days, price_per_day")
      .eq("vehicle_id", vehicleId)

    if (tiersError) throw tiersError

    const pricePerDay = resolvePricePerDay(days, tiers || [], vehicle.price_day)
    const price = pricePerDay * days

    const { data, error } = await supabase
      .from("rentals")
      .insert({
        vehicle_id: vehicleId,
        vk_link: vkLink.trim(),
        game_nickname: gameNickname.trim(),
        contact_name: contactName.trim(),
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        price,
        client_ip: clientIp,
        status: "active",
      })
      .select()
      .single()

    if (error) throw error

    // Помечаем машину занятой сразу после успешной заявки — до тех
    // пор, пока админ не переведёт статус в completed/cancelled.
    const { error: updateError } = await supabase
      .from("vehicles")
      .update({ is_rented: true })
      .eq("id", vehicleId)
    if (updateError) throw updateError

    return json({ ok: true, rental: data })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
