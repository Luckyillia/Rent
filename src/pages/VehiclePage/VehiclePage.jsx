import { useEffect, useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs/Breadcrumbs.jsx'
import Gallery from '../../components/Gallery/Gallery.jsx'
import StagesList from '../../components/StagesList/StagesList.jsx'
import SkeletonVehiclePage from '../../components/SkeletonVehiclePage/SkeletonVehiclePage.jsx'
import { fetchVehicle } from '../../api/vehicles.js'
import { fetchCategoryById } from '../../api/categories.js'
import { formatMoney, seatsLabel } from '../../utils/format.js'
import './VehiclePage.css'

export default function VehiclePage() {
  const { vehicleId } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [category, setCategory] = useState(null)
  const [period, setPeriod] = useState('day')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
      <section className="container vehicle-page">
        <div className="vehicle-page__loading">
          <SkeletonVehiclePage />
        </div>
      </section>
    )
  }

  const price = period === 'day' ? vehicle.priceDay : vehicle.priceWeek

  return (
    <section className="container vehicle-page">
      <Breadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: category?.label, to: `/category/${category?.id}` },
          { label: `${vehicle.brand} ${vehicle.model}` },
        ]}
      />

      <div className="vehicle-page__layout">
        <div className="vehicle-page__gallery">
          <Gallery kind={category?.kind} color={category?.color} images={vehicle.images} />

          <div className="vehicle-page__section">
            <h2>Оснащение</h2>
            <ul className="vehicle-page__features">
              {vehicle.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <div className="vehicle-page__section">
            <h2>Установленные стейджи</h2>
            <StagesList stages={vehicle.stages} />
          </div>
        </div>

        <aside className="vehicle-page__panel">
          <p className="vehicle-page__category" style={{ color: category?.color }}>{category?.label}</p>
          <h1 className="vehicle-page__title">{vehicle.brand} {vehicle.model}</h1>
          <p className="vehicle-page__class">{vehicle.class} · {vehicle.location}</p>

          <div className="vehicle-page__rating">
            <span className="mono">★ {vehicle.rating}</span>
            <span>сдана в аренду {vehicle.rents} раз</span>
          </div>

          <div className="vehicle-page__period">
            <button
              type="button"
              className={period === 'day' ? 'is-active' : ''}
              onClick={() => setPeriod('day')}
            >
              Сутки
            </button>
            <button
              type="button"
              className={period === 'week' ? 'is-active' : ''}
              onClick={() => setPeriod('week')}
            >
              Неделя
            </button>
          </div>

          <p className="vehicle-page__price mono">{formatMoney(price)}</p>

          <Link to={`/book/${vehicle.id}?period=${period}`} className="btn btn-primary vehicle-page__book">
            Забронировать
          </Link>

          <dl className="vehicle-page__specs">
            <div>
              <dt>Макс. скорость</dt>
              <dd className="mono">{vehicle.topSpeed} км/ч</dd>
            </div>
            <div>
              <dt>Разгон до 100</dt>
              <dd className="mono">{vehicle.accel} с</dd>
            </div>
            <div>
              <dt>Вместимость</dt>
              <dd className="mono">{seatsLabel(vehicle.seats)}</dd>
            </div>
            <div>
              <dt>Точка выдачи</dt>
              <dd>{vehicle.location}</dd>
            </div>
          </dl>

          <Link to={`/category/${category?.id}`} className="vehicle-page__back">
            ← Назад к категории «{category?.label}»
          </Link>
        </aside>
      </div>
    </section>
  )
}