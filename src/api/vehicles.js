import { supabase } from '../lib/supabaseClient.js'

// Переводим строку из Supabase (snake_case) в форму, которую ждут компоненты
// (camelCase, как раньше было в src/data/vehicles.js).
function mapVehicle(row) {
  const stages = (row.vehicle_stages || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => s.category)

  return {
    id: row.id,
    category: row.category_id,
    brand: row.brand,
    model: row.model,
    class: row.class,
    priceDay: row.price_day,
    priceWeek: row.price_week,
    seats: row.seats,
    topSpeed: row.top_speed,
    accel: row.accel,
    rating: row.rating,
    rents: row.rents,
    location: row.location,
    badge: row.badge,
    features: row.features || [],
    images: row.images || [],
    stages,
  }
}

export async function fetchVehiclesByCategory(categoryId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, vehicle_stages(position, category)')
    .eq('category_id', categoryId)
  if (error) throw error
  return (data || []).map(mapVehicle)
}

export async function fetchVehicle(id) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, vehicle_stages(position, category)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapVehicle(data) : null
}

export async function fetchVehicleCountsByCategory() {
  const { data, error } = await supabase.from('vehicles').select('category_id')
  if (error) throw error
  const counts = {}
  for (const row of data || []) {
    counts[row.category_id] = (counts[row.category_id] || 0) + 1
  }
  return counts
}
