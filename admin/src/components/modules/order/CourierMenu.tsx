'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, Loader2Icon, TruckIcon } from 'lucide-react'

import type { CourierOption } from '@/services/courier/courier'
import type { CourierBooking, CourierName, Order } from '@/types/order'

const COURIER_LABEL: Record<CourierName, string> = {
  STEADFAST: 'Steadfast',
  PATHAO: 'Pathao',
}

/** Stages a parcel can still be handed over in, mirroring the server's rule. */
const BOOKABLE = new Set(['placed', 'confirmed', 'processed'])

const formatBdt = (value: number) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(
    value,
  )

type CourierMenuProps = {
  order: Order
  couriers: CourierOption[]
  onBook: (courier: CourierName) => Promise<void>
}

/**
 * The Courier column.
 *
 * Once booked it stops being a control and becomes a record: the courier's
 * name and consignment number, with no way to send the same parcel twice. The
 * server refuses a second booking regardless, but an admin should not be
 * offered an action that cannot succeed.
 *
 * Choosing a courier does not send anything. It opens a confirmation naming
 * the courier, the recipient and the cash the rider will collect, because this
 * is the step that puts a real parcel on a real van.
 */
export function CourierMenu({ order, couriers, onBook }: CourierMenuProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<CourierName | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (order.courier) return <BookedChip booking={order.courier} />

  const bookable = BOOKABLE.has(order.status)

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await onBook(pending)
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send this order.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div ref={ref} className="relative inline-block">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={!bookable}
          onClick={() => setOpen((value) => !value)}
          title={bookable ? undefined : `An order that is ${order.status} can't be sent to a courier`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:border-slate-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TruckIcon className="h-3 w-3" aria-hidden="true" />
          Send
          <ChevronDownIcon className="h-3 w-3 opacity-60" aria-hidden="true" />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Send to courier"
            className="absolute z-30 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
          >
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              Send to courier
            </p>

            {couriers.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-soft">No couriers configured.</p>
            )}

            {couriers.map((courier) => (
              <button
                key={courier.name}
                type="button"
                role="option"
                aria-selected={false}
                disabled={!courier.configured}
                onClick={() => {
                  setOpen(false)
                  setError(null)
                  setPending(courier.name)
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-transparent"
              >
                <span
                  className={`flex items-center justify-between ${
                    courier.configured ? '' : 'text-ink-soft'
                  }`}
                >
                  {courier.label}
                  {!courier.configured && <span className="text-[10px]">not set up</span>}
                </span>

                {/*
                  Named rather than left to a tooltip. "Disabled" on its own
                  sends an admin looking through code; the variable that is
                  missing is the whole answer — and after a credential is added
                  the API has to be restarted before it is read, which is the
                  usual reason a courier that looks configured still isn't.
                */}
                {!courier.configured && courier.missing.length > 0 && (
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink-soft">
                    Missing {courier.missing.join(', ')} — add it and restart the API.
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          order={order}
          courier={pending}
          busy={busy}
          error={error}
          onCancel={() => {
            if (!busy) {
              setPending(null)
              setError(null)
            }
          }}
          onConfirm={confirm}
        />
      )}
    </>
  )
}

/** What the column shows once the parcel is somebody else's problem. */
function BookedChip({ booking }: { booking: CourierBooking }) {
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckIcon className="h-3 w-3" aria-hidden="true" />
        {COURIER_LABEL[booking.name]}
      </span>
      <span className="pl-1 text-[10px] tabular-nums text-ink-soft">
        {booking.trackingCode ?? booking.consignmentId}
      </span>
    </div>
  )
}

/**
 * The step between choosing a courier and a rider being dispatched.
 *
 * It names what is about to happen in full — which courier, which parcel,
 * where it is going and how much cash is collected on arrival — because this
 * cannot be undone from here: once a courier accepts a consignment it is
 * cancelled in their portal, not ours.
 */
function ConfirmDialog({
  order,
  courier,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  order: Order
  courier: CourierName
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const collects = order.payment.state === 'paid' ? 0 : order.total

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        disabled={busy}
        className="absolute inset-0 cursor-default bg-black/40"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="courier-confirm-title"
        className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <TruckIcon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h2 id="courier-confirm-title" className="text-sm font-semibold text-ink">
              Send order #{order.orderNo} to {COURIER_LABEL[courier]}?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              This books the parcel with {COURIER_LABEL[courier]} straight away. It
              can only be cancelled in their portal afterwards, not from here.
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
          <Row label="Recipient" value={order.customer.name} />
          <Row label="Phone" value={order.customer.phone} />
          <Row label="Address" value={order.customer.address ?? '—'} />
          <Row
            label="Rider collects"
            value={collects > 0 ? formatBdt(collects) : 'Nothing — already paid'}
            strong
          />
        </dl>

        {error && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <AlertTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2Icon className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {busy ? 'Sending…' : `Yes, send to ${COURIER_LABEL[courier]}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-soft">{label}</dt>
      <dd className={`min-w-0 text-right ${strong ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
        {value}
      </dd>
    </div>
  )
}
