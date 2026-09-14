const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL

// Заявка теперь идёт не напрямую в Supabase (у anon-ключа нет прав на
// insert в rentals), а через Edge Function create-rental — там же
// сервер проверяет антиспам по IP и сам считает цену по актуальным
// данным машины.
export async function submitRentalRequest({ vehicleId, vkLink, gameNickname, contactName, period }) {
  const res = await fetch(`${FUNCTIONS_URL}/create-rental`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId, vkLink, gameNickname, contactName, period }),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Не удалось отправить заявку')
  return json
}
