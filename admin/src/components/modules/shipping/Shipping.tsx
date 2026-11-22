'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  PackageIcon,
  SearchIcon,
  TruckIcon,
  XIcon,
} from 'lucide-react'

import {
  getShipmentSummary,
  listShipments,
  type Shipment,
  type ShipmentStage,
  type ShipmentSummary,
} from '@/services/courier/shipments'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CourierName } from '@/types/order'

const PAGE_SIZE = 20

const STAGE_META: Record<ShipmentStage, { label: string; chip: string; dot: string }> = {
  AWAITING_DISPATCH: { label: 'Awaiting dispatch', chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  BOOKED: { label: 'Booked', chip: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  IN_TRANSIT: { label: 'In transit', chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  DELIVERED: { label: 'Delivered', chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  CANCELED: { label: 'Cancelled', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

const CARRIER_FILTER_LABEL: Record<string, string> = {
  all: 'All carriers',
  STEADFAST: 'Steadfast',
  PATHAO: 'Pathao',
}

const ZONE_LABEL: Record<string, string> = {
  DHAKA_CITY: 'Dhaka city',
  DHAKA_SUBURB: 'Dhaka suburb',
  OUTSIDE_DHAKA: 'Outside Dhaka',
}

const TABS: { value: ShipmentStage | 'all' | 'late'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'AWAITING_DISPATCH', label: 'Awaiting dispatch' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'late', label: 'Late' },
]

const money = (value: number) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(
    value,
  )

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

/** "in 2 days" / "3 days late" — the shape of the answer people actually want. */
const relativeDays = (value: string) => {
  const day = 24 * 60 * 60 * 1000
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((start(new Date(value)) - start(new Date())) / day)

  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`
}

/**
 * The shipping board.
 *
 * Every parcel between the warehouse and the customer's door, in the order
 * they were placed. It answers one question per row — where is this, and
 * should somebody be worried about it — which is why "late" is a tab and a
 * counter rather than something to work out from two dates.
 *
 * Nothing here dispatches anything. Handing an order to a courier is done on
 * the Orders page, where the confirmation is.
 */
export function Shipping() {
  const [tab, setTab] = useState<ShipmentStage | 'all' | 'late'>('all')
  const [courier, setCourier] = useState<CourierName | 'all'>('all')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<Shipment[]>([])
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0 })
  const [summary, setSummary] = useState<ShipmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  // A request per keystroke would search every order on every letter.
  useEffect(() => {
    const id = setTimeout(() => {
      setTerm(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, meta: next } = await listShipments({
        stage: tab === 'all' || tab === 'late' ? undefined : tab,
        late: tab === 'late',
        courier: courier === 'all' ? undefined : courier,
        search: term,
        page,
        limit: PAGE_SIZE,
      })
      setRows(data)
      setMeta(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load shipments.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tab, courier, term, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    getShipmentSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [])

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard is blocked in some contexts; the number is still on screen.
    }
  }

  const pageCount = Math.max(1, Math.ceil(meta.total / meta.limit))

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <header>
        <p className="text-xs text-ink-soft">Dashboards / Shipping</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">Shipping</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Every parcel on its way to a customer, and who is carrying it.
        </p>
      </header>

      {/*
        One row of five where there is room, wrapping evenly when there isn't.

        A grid with viewport breakpoints was wrong here: the dashboard's own
        sidebar takes ~288px, so `lg:` describes the window rather than the
        space these cards actually have, and they dropped to two per row on
        screens with room for five. Flex sizing measures the row itself.
      */}
      <div className="flex flex-wrap gap-3 *:min-w-[190px] *:flex-1">
        <StatCard
          label="Awaiting dispatch"
          value={summary?.awaitingDispatch}
          hint="Not yet given to a courier"
          icon={<PackageIcon className="h-4 w-4" />}
          tone="amber"
          onClick={() => {
            setTab('AWAITING_DISPATCH')
            setPage(1)
          }}
        />
        <StatCard
          label="Booked"
          value={summary?.booked}
          hint="Waiting for pickup"
          icon={<TruckIcon className="h-4 w-4" />}
          tone="indigo"
          onClick={() => {
            setTab('BOOKED')
            setPage(1)
          }}
        />
        <StatCard
          label="In transit"
          value={summary?.inTransit}
          hint="With the courier"
          icon={<TruckIcon className="h-4 w-4" />}
          tone="sky"
          onClick={() => {
            setTab('IN_TRANSIT')
            setPage(1)
          }}
        />
        <StatCard
          label="Delivered today"
          value={summary?.deliveredToday}
          hint="Since midnight"
          icon={<CheckCircle2Icon className="h-4 w-4" />}
          tone="emerald"
          onClick={() => {
            setTab('DELIVERED')
            setPage(1)
          }}
        />
        <StatCard
          label="Late"
          value={summary?.late}
          hint="Past its delivery window"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
          tone="rose"
          onClick={() => {
            setTab('late')
            setPage(1)
          }}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setTab(option.value)
                  setPage(1)
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  tab === option.value
                    ? 'bg-ink text-white'
                    : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Carrier and search share one row and grow into whatever the tabs
              leave behind, rather than each claiming a line of their own. */}
          {/* The minimum is what makes this drop onto its own line rather than
              squeezing the search box to a stub when the tabs fill the row. */}
          <div className="ml-auto flex min-w-[320px] flex-1 items-center gap-2">
            <Select
              value={courier}
              onValueChange={(value) => {
                setCourier(value as CourierName | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger
                aria-label="Filter by carrier"
                className="h-9 w-[140px] shrink-0 text-xs"
              >
                {/* Base UI renders the raw value unless it is given a
                    formatter, which would show "all" and "PATHAO" in the
                    closed trigger. */}
                <SelectValue>
                  {(value: string) => CARRIER_FILTER_LABEL[value] ?? 'All carriers'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All carriers</SelectItem>
                <SelectItem value="STEADFAST">Steadfast</SelectItem>
                <SelectItem value="PATHAO">Pathao</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative min-w-0 flex-1">
              <SearchIcon
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order no, customer, phone or tracking"
                className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-xs text-ink outline-none transition-colors focus:border-slate-400"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
                >
                  <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {/* Board */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-y border-line bg-slate-50/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                <th scope="col" className="px-5 py-3">Order</th>
                <th scope="col" className="px-3 py-3">Customer</th>
                <th scope="col" className="px-3 py-3">Carrier</th>
                <th scope="col" className="px-3 py-3">Tracking no</th>
                <th scope="col" className="px-3 py-3">Progress</th>
                <th scope="col" className="px-3 py-3">Dispatched</th>
                <th scope="col" className="px-3 py-3">ETA</th>
                <th scope="col" className="px-3 py-3">Zone</th>
                <th scope="col" className="px-5 py-3 text-right">Collect on delivery</th>
              </tr>
            </thead>

            <tbody>
              {loading
                ? Array.from({ length: 5 }, (_, row) => (
                    <tr key={row} className="border-b border-line">
                      <td colSpan={9} className="px-5 py-4">
                        <div className="h-5 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                : rows.map((shipment) => {
                    const stage = STAGE_META[shipment.stage]

                    return (
                      <tr
                        key={shipment.orderId}
                        className="border-b border-line align-middle transition-colors duration-150 hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <p className="text-sm font-semibold tabular-nums text-ink">
                            #{shipment.orderNo}
                          </p>
                          <p className="text-xs text-ink-soft">
                            {shipment.itemCount} item{shipment.itemCount === 1 ? '' : 's'} ·{' '}
                            {shortDate(shipment.placedAt)}
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          <p className="text-sm font-medium text-ink">{shipment.customer.name}</p>
                          <p className="text-xs tabular-nums text-ink-soft">
                            {shipment.customer.phone}
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          {shipment.courier ? (
                            <span className="text-sm text-ink">{shipment.courier.label}</span>
                          ) : (
                            <span className="text-xs text-ink-soft">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {shipment.trackingCode ? (
                            // Copyable: a tracking number's whole purpose is to
                            // be pasted somewhere else.
                            <button
                              type="button"
                              onClick={() => void copy(shipment.trackingCode!)}
                              title="Copy tracking number"
                              className="group inline-flex items-center gap-1.5 text-xs tabular-nums text-ink-muted transition-colors hover:text-ink"
                            >
                              {shipment.trackingCode}
                              {copied === shipment.trackingCode ? (
                                <CheckCircle2Icon className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                              ) : (
                                <CopyIcon
                                  className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-ink-soft">Not dispatched</span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${stage.chip}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                            {stage.label}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-xs text-ink-muted">
                          {shipment.dispatchedAt ? shortDate(shipment.dispatchedAt) : '—'}
                        </td>

                        <td className="px-3 py-3">
                          {shipment.stage === 'DELIVERED' && shipment.deliveredAt ? (
                            <span className="text-xs text-emerald-700">
                              Delivered {shortDate(shipment.deliveredAt)}
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${
                                shipment.isLate ? 'font-medium text-rose-600' : 'text-ink-muted'
                              }`}
                            >
                              {shipment.isLate && (
                                <AlertTriangleIcon className="h-3 w-3" aria-hidden="true" />
                              )}
                              {shortDate(shipment.eta)}
                              <span className="text-ink-soft">
                                ({relativeDays(shipment.eta)})
                              </span>
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-xs text-ink-muted">
                          {shipment.zone ? (ZONE_LABEL[shipment.zone] ?? shipment.zone) : '—'}
                        </td>

                        <td className="px-5 py-3 text-right">
                          {shipment.codAmount > 0 ? (
                            <span className="text-sm font-semibold tabular-nums text-ink">
                              {money(shipment.codAmount)}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-700">Prepaid</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <TruckIcon className="h-6 w-6 text-ink-soft" aria-hidden="true" />
            <p className="text-sm font-medium text-ink">
              {tab === 'late' ? 'Nothing is running late' : 'No shipments in this view'}
            </p>
            <p className="text-xs text-ink-muted">
              {term ? 'Clear the search or switch tabs.' : 'Parcels appear here as orders come in.'}
            </p>
          </div>
        )}

        {meta.total > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="text-xs text-ink-soft">
              Showing {rows.length} of {meta.total} shipments
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="px-2 text-xs tabular-nums text-ink-muted">
                {meta.page} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => setPage((value) => value + 1)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

const TONE: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
}

/** A counter that is also the filter for what it counts. */
function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: number | undefined
  hint: string
  icon: React.ReactNode
  tone: keyof typeof TONE
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-card transition-colors duration-150 hover:border-slate-300"
    >
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${TONE[tone]}`}>{icon}</span>
        <span className="text-xs font-medium text-ink-muted">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
        {value === undefined ? <ClockIcon className="h-5 w-5 text-ink-soft" aria-hidden="true" /> : value}
      </p>
      <p className="text-[11px] text-ink-soft">{hint}</p>
    </button>
  )
}
