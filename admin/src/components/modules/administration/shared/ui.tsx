"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* =========================================================================
   The pieces every Administration screen is built from. One page shell, one
   card, one table chrome — so Users & Access, Roles & Permissions, Activity
   Log and Security read as four views of the same product rather than four
   pages that happen to sit next to each other.
   ========================================================================= */

export const CARD =
  "rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgb(16_24_40/0.04)]";

/* --------------------------------- Shell -------------------------------- */

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-full w-full px-4 py-6 lg:px-8">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-6">{children}</div>
    </main>
  );
}

export function PageHeader({
  crumb,
  title,
  description,
  children,
}: {
  /** The trailing crumb; "Administration" is always the one before it. */
  crumb: string;
  title: string;
  description: string;
  /** Primary actions, pinned to the right of the title on wide screens. */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[13px] text-slate-400"
        >
          <Link href="/admin" className="transition-colors hover:text-slate-600">
            Administration
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-slate-600">{crumb}</span>
        </nav>
        <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">
          {title}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

/* -------------------------------- Buttons ------------------------------- */

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#0b0b0b] px-4 text-[13px] font-medium text-white transition-colors",
        "hover:bg-[#232323] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b0b0b]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition-colors",
        "hover:border-slate-300 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b0b0b]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Stat cards ------------------------------ */

export function StatCard({
  icon: Icon,
  label,
  value,
  status,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  /** The headline figure. Omit it for a card that reports a state instead. */
  value?: string | number;
  status?: { label: string; dot: string };
  caption?: string;
}) {
  return (
    <article className={cn(CARD, "flex items-start gap-3.5 px-5 py-4")}>
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-500">{label}</p>
        {value !== undefined && (
          <p className="mt-0.5 text-[26px] leading-8 font-semibold tabular-nums text-slate-900">
            {value}
          </p>
        )}
        {status && (
          <p className="mt-1 flex items-center gap-1.5">
            <span
              className={cn("h-[7px] w-[7px] rounded-full", status.dot)}
              aria-hidden="true"
            />
            <span className="text-[13px] font-medium text-slate-700">{status.label}</span>
          </p>
        )}
        {caption && <p className="mt-1 truncate text-[12px] text-slate-400">{caption}</p>}
      </div>
    </article>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </section>
  );
}

/* ------------------------------ Section card ----------------------------- */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(CARD, "overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0">
            {title && <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* -------------------------------- Bits ---------------------------------- */

export function StatusPill({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
      <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700",
        className
      )}
    >
      {children}
    </span>
  );
}

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Avatars come back as paths on the API host, not as absolute URLs. */
export function resolveAvatarUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http") || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${trimmed}`;
}

export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const dimension = { width: size, height: size };
  const resolved = resolveAvatarUrl(src);
  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolved} alt="" style={dimension} className="shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...dimension, fontSize: Math.round(size * 0.36) }}
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", toneFor(name))}
    >
      {initialsOf(name)}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
      />
    </div>
  );
}

/**
 * The tick used in the users table and the permission matrix: a black mark
 * inside a white box, never a filled block — across 85 cells a grid of solid
 * squares reads as a bar chart rather than as a row of choices.
 *
 * The mark is a background image rather than a mounted icon, because that is
 * 85 fewer elements on the matrix, and it is set from `style` so the data URI
 * never has to survive a class-name parser.
 */
function markUrl(path: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">` +
    `<path d="${path}" stroke="#0b0b0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const TICK = markUrl("M3.4 8.4l3.1 3.1 6.1-6.3");
const DASH = markUrl("M4 8h8");

export function CheckBox({
  checked,
  onChange,
  label,
  indeterminate = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const partial = indeterminate && !checked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      style={{
        backgroundImage: checked ? TICK : partial ? DASH : undefined,
        backgroundSize: "13px 13px",
      }}
      className={cn(
        "h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border bg-white bg-center bg-no-repeat transition-colors",
        checked || partial ? "border-slate-900" : "border-slate-300 hover:border-slate-400",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b0b0b]",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50"
      )}
    />
  );
}

/* ------------------------------- Row menu -------------------------------- */

export type RowMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

const MENU_WIDTH = 184;

/**
 * The "..." on a table row. It renders into `document.body` so the table's own
 * horizontal scroller — which clips vertically too — cannot cut it off.
 */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = items.length * 36 + 12;
    const gap = 6;
    const flipUp = rect.bottom + gap + height > window.innerHeight;
    setPos({
      top: flipUp ? rect.top - gap - height : rect.bottom + gap,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontalIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {pos &&
        createPortal(
          <div
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            onClick={(event) => event.stopPropagation()}
            className="fixed z-[70] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgb(16_24_40/0.22)]"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setPos(null);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  item.tone === "danger"
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-slate-700 hover:bg-slate-100",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------- Pagination ------------------------------ */

export function Pager({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural, e.g. "users" — used in the count line. */
  noun: string;
  onPage: (next: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // First, last, and a window around the current page; anything skipped is
  // one ellipsis, so the row keeps its width however long the list gets.
  const numbers: (number | "gap")[] = [];
  for (let index = 1; index <= pages; index += 1) {
    if (index === 1 || index === pages || Math.abs(index - page) <= 1) {
      numbers.push(index);
    } else if (numbers[numbers.length - 1] !== "gap") {
      numbers.push("gap");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-3.5">
      <p className="text-[13px] text-slate-500">
        Showing {from}&ndash;{to} of {total.toLocaleString()} {noun}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        {numbers.map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[13px] text-slate-400">
              &hellip;
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPage(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 cursor-pointer rounded-lg px-2 text-[13px] font-medium tabular-nums transition-colors",
                entry === page
                  ? "bg-[#0b0b0b] text-white"
                  : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {entry}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- States --------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-medium text-slate-900">{title}</p>
      <p className="max-w-sm text-[13px] text-slate-500">{description}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-100" />
          <span className="h-3 w-40 animate-pulse rounded bg-slate-100" />
          <span className="ml-auto h-3 w-24 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/** Column headings, shared by every table on these screens. */
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-5 py-3 text-left text-[12px] font-medium whitespace-nowrap text-slate-500",
        className
      )}
    >
      {children}
    </th>
  );
}
