import { useEffect, useState } from 'react'
import { callAdminApi } from '../../api/admin.js'

const EXTRA_CATEGORIES = ['Баланс', 'Скорость', 'Управление']

const EMPTY = {
  id: '', category_id: '', brand: '', model: '', class: '',
  price_day: '', price_week: '', seats: '', top_speed: '', accel: '',
  rating: '5', rents: '0', location: '', badge: '',
  featuresText: '', imagesText: '',
  stageCount: '0', slot2: 'Баланс', slot3: 'Баланс', slot4: 'Баланс',
}

export default function VehiclesAdmin() {
  const [vehicles, setVehicles] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [v, c] = await Promise.all([
        callAdminApi('vehicles', 'list'),
        callAdminApi('categories', 'list'),
      ])
      setVehicles(v)
      setCategories(c)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(v) {
    setEditingId(v.id)
    const stages = (v.vehicle_stages || []).slice().sort((a, b) => a.position - b.position)
    setForm({
      id: v.id,
      category_id: v.category_id,
      brand: v.brand,
      model: v.model,
      class: v.class || '',
      price_day: v.price_day ?? '',
      price_week: v.price_week ?? '',
      seats: v.seats ?? '',
      top_speed: v.top_speed ?? '',
      accel: v.accel ?? '',
      rating: v.rating ?? '5',
      rents: v.rents ?? '0',
      location: v.location || '',
      badge: v.badge || '',
      featuresText: (v.features || []).join(', '),
      imagesText: (v.images || []).join('\n'),
      stageCount: String(stages.length),
      slot2: stages[1]?.category || 'Баланс',
      slot3: stages[2]?.category || 'Баланс',
      slot4: stages[3]?.category || 'Баланс',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY)
  }

  // Стейджи: 0 — стоковая; либо непрерывно 2–4 подряд, слот 1 всегда
  // "База", слоты 2+ — любая из Баланс/Скорость/Управление, повторы
  // разрешены. Без базы не бывает слота 2, без слота 2 — слота 3 и т.д.
  // — это как раз и обеспечивает выбор "Количество стейджей".
  function buildStagesPayload() {
    const count = Number(form.stageCount)
    if (count === 0) return []
    const stages = [{ position: 1, category: 'База' }]
    if (count >= 2) stages.push({ position: 2, category: form.slot2 })
    if (count >= 3) stages.push({ position: 3, category: form.slot3 })
    if (count >= 4) stages.push({ position: 4, category: form.slot4 })
    return stages
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const vehiclePayload = {
      id: form.id,
      category_id: form.category_id,
      brand: form.brand,
      model: form.model,
      class: form.class,
      price_day: Number(form.price_day),
      price_week: form.price_week === '' ? null : Number(form.price_week),
      seats: form.seats === '' ? null : Number(form.seats),
      top_speed: form.top_speed === '' ? null : Number(form.top_speed),
      accel: form.accel === '' ? null : Number(form.accel),
      rating: form.rating === '' ? null : Number(form.rating),
      rents: form.rents === '' ? 0 : Number(form.rents),
      location: form.location,
      badge: form.badge || null,
      features: form.featuresText.split(',').map((s) => s.trim()).filter(Boolean),
      images: form.imagesText.split('\n').map((s) => s.trim()).filter(Boolean),
    }

    try {
      const vehicleId = editingId || form.id
      if (editingId) {
        const { id, ...changes } = vehiclePayload
        await callAdminApi('vehicles', 'update', { id: editingId, changes })
      } else {
        await callAdminApi('vehicles', 'create', vehiclePayload)
      }
      await callAdminApi('stages', 'replaceForVehicle', { vehicleId, stages: buildStagesPayload() })
      resetForm()
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Удалить машину из каталога?')) return
    try {
      await callAdminApi('vehicles', 'delete', { id })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const stageCount = Number(form.stageCount)

  return (
    <div className="admin-section">
      <form onSubmit={handleSubmit} className="admin-form admin-form--wide">
        <input
          placeholder="ID (латиницей, напр. straton-comet)"
          value={form.id}
          disabled={!!editingId}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
          required
        />
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
          <option value="">Категория…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input placeholder="Бренд" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
        <input placeholder="Модель" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <input placeholder="Класс" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
        <input type="number" placeholder="Цена / сутки, ₽" value={form.price_day} onChange={(e) => setForm({ ...form, price_day: e.target.value })} required />
        <input type="number" placeholder="Цена / неделя, ₽" value={form.price_week} onChange={(e) => setForm({ ...form, price_week: e.target.value })} />
        <input type="number" placeholder="Мест" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        <input type="number" placeholder="Макс. скорость, км/ч" value={form.top_speed} onChange={(e) => setForm({ ...form, top_speed: e.target.value })} />
        <input type="number" step="0.1" placeholder="Разгон до 100, с" value={form.accel} onChange={(e) => setForm({ ...form, accel: e.target.value })} />
        <input type="number" step="0.1" placeholder="Рейтинг" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
        <input placeholder="Точка выдачи" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <input placeholder="Бейдж (необязательно)" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
        <textarea
          placeholder="Оснащение через запятую"
          value={form.featuresText}
          onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
        />
        <textarea
          placeholder="Ссылки на фото Cloudinary — каждая с новой строки, первая станет обложкой"
          value={form.imagesText}
          onChange={(e) => setForm({ ...form, imagesText: e.target.value })}
        />

        <fieldset className="admin-stages">
          <legend>Стейджи</legend>

          <label className="admin-stages__count">
            Количество стейджей
            <select value={form.stageCount} onChange={(e) => setForm({ ...form, stageCount: e.target.value })}>
              <option value="0">Стоковая (0)</option>
              <option value="2">2 (База + 1)</option>
              <option value="3">3 (База + 2)</option>
              <option value="4">4 (База + 3)</option>
            </select>
          </label>

          {stageCount >= 2 && (
            <div className="admin-stages__slots">
              <span className="admin-stages__slot-label">1. База</span>

              <label className="admin-stages__slot-label">
                2.
                <select value={form.slot2} onChange={(e) => setForm({ ...form, slot2: e.target.value })}>
                  {EXTRA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              {stageCount >= 3 && (
                <label className="admin-stages__slot-label">
                  3.
                  <select value={form.slot3} onChange={(e) => setForm({ ...form, slot3: e.target.value })}>
                    {EXTRA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}

              {stageCount >= 4 && (
                <label className="admin-stages__slot-label">
                  4.
                  <select value={form.slot4} onChange={(e) => setForm({ ...form, slot4: e.target.value })}>
                    {EXTRA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </fieldset>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary">{editingId ? 'Сохранить' : 'Добавить'}</button>
          {editingId && <button type="button" className="btn btn-outline" onClick={resetForm}>Отмена</button>}
        </div>
      </form>

      {error && <p className="admin-error">{error}</p>}

      {loading ? (
        <p className="mono">Загрузка…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Машина</th>
              <th>Категория</th>
              <th>Цена/сутки</th>
              <th>Стейджи</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.brand} {v.model}</td>
                <td>{categories.find((c) => c.id === v.category_id)?.label || v.category_id}</td>
                <td className="mono">{v.price_day}</td>
                <td>
                  {(v.vehicle_stages || []).length === 0
                    ? 'Стоковая'
                    : (v.vehicle_stages || [])
                        .slice()
                        .sort((a, b) => a.position - b.position)
                        .map((s) => s.category)
                        .join(' → ')}
                </td>
                <td>
                  <button type="button" className="btn btn-outline" onClick={() => startEdit(v)}>Изменить</button>
                  <button type="button" className="btn btn-outline" onClick={() => handleDelete(v.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
