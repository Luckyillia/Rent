// supabase/functions/create-rental/index.ts
// Публичная точка приёма заявок на аренду (без токена — доступна всем
// посетителям сайта). Сама проверяет антиспам по IP перед вставкой,
// поэтому обходить лимит прямым вызовом REST API бессмысленно: у anon-
// ключа вообще нет прав на insert/select в rentals (см. schema.sql).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, serviceRoleKey)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Минимальный промежуток между заявками с одного IP. Поменяйте, если
// нужно строже/мягче — это единственное место, где хранится значение.
const RATE_LIMIT_MINUTES = 10

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { vehicleId, vkLink, gameNickname, contactName, period } = await req.json()

    if (!vehicleId || !vkLink?.trim() || !gameNickname?.trim() || !contactName?.trim()) {
      return json({ error: "Заполните все поля формы" }, 400)
    }
    if (period !== "day" && period !== "week") {
      return json({ error: "Некорректный срок аренды" }, 400)
    }

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
        { error: `Вы уже отправляли заявку недавно. Попробуйте ещё раз через несколько минут.` },
        429
      )
    }

    // --- Цену считаем на сервере по актуальным данным машины, а не по
    //     тому, что мог прислать браузер ---
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("price_day, price_week")
      .eq("id", vehicleId)
      .maybeSingle()

    if (vehicleError) throw vehicleError
    if (!vehicle) return json({ error: "Машина не найдена" }, 404)

    const price = period === "day" ? vehicle.price_day : vehicle.price_week

    const { data, error } = await supabase
      .from("rentals")
      .insert({
        vehicle_id: vehicleId,
        vk_link: vkLink.trim(),
        game_nickname: gameNickname.trim(),
        contact_name: contactName.trim(),
        period,
        price,
        client_ip: clientIp,
      })
      .select()
      .single()

    if (error) throw error

    return json({ ok: true, rental: data })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
