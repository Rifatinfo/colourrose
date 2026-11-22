"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/* =========================================================================
   Small pieces the Story Composer is built from: an anchored popover, a
   modal, segmented buttons, field chrome, and a toast that can carry an
   Undo action (the dashboard's Swal toasts cannot).
   ========================================================================= */

export const FIELD =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-3 focus:ring-slate-900/5";

export const SMALL_FIELD =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[12px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400";

export const CARD = "rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgb(16_24_40/0.04)]";

/* --------------------------------- Popover -------------------------------- */

/**
 * A panel anchored under (or, without room, over) an element. Closes on an
 * outside press or Escape, and gives focus back to the anchor.
 */
export function Popover({
  anchor,
  open,
  onClose,
  align = "left",
  className,
  children,
  label,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: "left" | "right" | "center";
  className?: string;
  children: ReactNode;
  label: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current;
      if (!a || !p) return;
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      let left = align === "right" ? a.right - w : align === "center" ? a.left + a.width / 2 - w / 2 : a.left;
      left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
      let top = a.bottom + 6;
      if (top + h > window.innerHeight - 12 && a.top - h - 6 > 12) top = a.top - h - 6;
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
      anchor.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchor]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className={cn(
        "fixed z-[80] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18),0_2px_6px_rgba(16,24,40,0.06)]",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150",
        className
      )}
      style={position ?? { left: -9999, top: -9999 }}
    >
      {children}
    </div>,
    document.body
  );
}

/* ---------------------------------- Modal --------------------------------- */

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  headerExtra,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "full";
  headerExtra?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input,textarea,select,button:not([data-close])")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-5 animate-in fade-in-0 duration-150"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex max-h-[calc(100vh-40px)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-150",
          size === "md" && "max-w-[640px]",
          size === "lg" && "max-w-[980px]",
          size === "full" && "h-[calc(100vh-40px)] max-w-[1320px]"
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="truncate text-[12px] text-slate-500">{subtitle}</p>}
          </div>
          {headerExtra}
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* --------------------------------- Buttons -------------------------------- */

export function Btn({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "ghost" | "primary" | "danger" | "outline";
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b0b0b] disabled:cursor-not-allowed disabled:opacity-45",
        size === "md" ? "h-9 px-3.5 text-[13px]" : "h-7 px-2.5 text-[12px]",
        variant === "ghost" && "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
        variant === "outline" && "border-slate-900 bg-white text-slate-900 hover:bg-slate-50",
        variant === "primary" && "border-[#0b0b0b] bg-[#0b0b0b] text-white hover:bg-[#232323]",
        variant === "danger" && "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
        className
      )}
    />
  );
}

export function IconBtn({
  label,
  active,
  danger,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-slate-500 transition-colors",
        "hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0b0b0b]",
        active && "bg-blue-50 text-blue-600",
        danger && "text-rose-500 hover:bg-rose-50 hover:text-rose-600",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Segmented control: one of a few views. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12px] font-medium transition-colors",
            value === option.value ? "bg-[#0b0b0b] text-white" : "text-slate-600 hover:text-slate-900"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Label, optional counter and hint around a field. */
export function Field({
  label,
  htmlFor,
  required,
  count,
  max,
  aside,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  /** Characters typed, shown against `max`. */
  count?: number;
  max?: number;
  aside?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-slate-800">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
        {count !== undefined && max !== undefined ? (
          <span className={cn("text-[11px] tabular-nums", count > max ? "text-amber-600" : "text-slate-400")}>
            {count}/{max}
          </span>
        ) : (
          aside
        )}
      </div>
      {children}
      {hint && <div className="mt-1.5 text-[11.5px] leading-[1.45] text-slate-500">{hint}</div>}
    </div>
  );
}

/** A textarea that grows with what is typed. */
export function AutoTextarea({ className, value, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} value={value} rows={1} {...props} className={cn("resize-none", className)} />;
}

/* --------------------------------- Toasts --------------------------------- */

type ToastAction = { label: string; run: () => void };
type ToastItem = { id: number; message: string; action?: ToastAction };

const ToastContext = createContext<(message: string, action?: ToastAction) => void>(() => undefined);

export const useComposerToast = () => useContext(ToastContext);

/** Bottom-centre toasts; an action (Undo) keeps one on screen a little longer. */
export function ComposerToasts({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);

  const push = useCallback((message: string, action?: ToastAction) => {
    const id = ++next.current;
    setItems((current) => [...current.slice(-2), { id, message, action }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), action ? 5200 : 2600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2"
          >
            {items.map((item) => (
              <div
                key={item.id}
                className="pointer-events-auto flex items-center gap-3 rounded-lg bg-[#0b0b0b] py-2 pl-3.5 pr-2 text-[12.5px] text-white shadow-[0_10px_24px_-6px_rgba(0,0,0,0.3)] animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
              >
                <span>{item.message}</span>
                {item.action && (
                  <button
                    type="button"
                    onClick={() => {
                      item.action!.run();
                      setItems((current) => current.filter((entry) => entry.id !== item.id));
                    }}
                    className="h-6 cursor-pointer rounded-md bg-white/15 px-2.5 text-[12px] font-semibold hover:bg-white/25"
                  >
                    {item.action.label}
                  </button>
                )}
                {!item.action && <span className="w-1" />}
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
