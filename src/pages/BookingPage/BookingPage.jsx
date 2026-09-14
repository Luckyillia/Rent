import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Navigate, Link } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs/Breadcrumbs.jsx'
import SkeletonBookingForm from '../../components/SkeletonBookingForm/SkeletonBookingForm.jsx'
import { fetchVehicle } from '../../api/vehicles.js'
import { fetchCategoryById } from '../../api/categories.js'
import { submitRentalRequest } from '../../api/rentals.js'
import { formatMoney } from '../../utils/format.js'
import './BookingPage.css'

export default function BookingPage() {
  const { vehicleId } = useParams()
  const [searchParams] = useSearchParams()
  const [vehicle, setVehicle] = useState(null)
  const [category, setCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [vkLink, setVkLink] = useState('')
  const [gameNickname, setGameNickname] = useState('')
  const [contactName, setContactName] = useState('')
  const [period, setPeriod] = useState(searchParams.get('period') === 'week' ? 'week' : 'day')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const v = await fetchVehicle(vehicleId)
        if (!v) {
          if (!cancelled) setNotFound(true)
          return
        }
        const cat = await fetchCategoryById(v.category)
        if (!cancelled) {
          setVehicle(v)
          setCategory(cat)
        }
      } catch (e) {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [vehicleId])

  if (notFound) {
    return <Navigate to="/" replace />
  }

  if (loading || !vehicle) {
    return (
      <section className="container booking-page">
        <div className="booking-page__layout">
          <SkeletonBookingForm />
        </div>
      </section>
    )
  }

  const price = period === 'day' ? vehicle.priceDay : vehicle.priceWeek

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await submitRentalRequest({ vehicleId: vehicle.id, vkLink, gameNickname, contactName, period })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="container booking-page">
        <div className="booking-page__done">
          <h1>Заявка подана</h1>
          <p>
            Ваша заявка на аренду «{vehicle.brand} {vehicle.model}» отправлена и будет
            рассмотрена в течение суток, а часто и быстрее. Мы свяжемся с вами через ВК.
          </p>
          <Link to={`/car/${vehicle.id}`} className="btn btn-outline">Назад к машине</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="container booking-page">
      <Breadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: category?.label, to: `/category/${category?.id}` },
          { label: `${vehicle.brand} ${vehicle.model}`, to: `/car/${vehicle.id}` },
          { label: 'Заявка на аренду' },
        ]}
      />

      <div className="booking-page__layout">
        <form onSubmit={handleSubmit} className="booking-form">
          <h1>Заявка на аренду</h1>
          <p className="booking-form__vehicle">{vehicle.brand} {vehicle.model} · {vehicle.class}</p>

          <label className="booking-form__field">
            Ссылка на ВК
            <input
              type="url"
              required
              placeholder="https://vk.com/id..."
              value={vkLink}
              onChange={(e) => setVkLink(e.target.value)}
            />
          </label>

          <label className="booking-form__field">
            Игровое имя
            <input
              type="text"
              required
              placeholder="Ник в игре"
              value={gameNickname}
              onChange={(e) => setGameNickname(e.target.value)}
            />
          </label>

          <label className="booking-form__field">
            Как к вам обращаться
            <input
              type="text"
              required
              placeholder="Имя"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </label>

          <div className="booking-form__field">
            <span>На какой срок</span>
            <div className="booking-form__period">
              <button type="button" className={period === 'day' ? 'is-active' : ''} onClick={() => setPeriod('day')}>
                Сутки
              </button>
              <button type="button" className={period === 'week' ? 'is-active' : ''} onClick={() => setPeriod('week')}>
                Неделя
              </button>
            </div>
          </div>

          <p className="booking-form__price mono">{formatMoney(price)}</p>

          {error && <p className="booking-form__error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Отправляем…' : 'Отправить заявку'}
          </button>
        </form>
      </div>
    </section>
  )
}
