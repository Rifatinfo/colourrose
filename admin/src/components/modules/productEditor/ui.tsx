"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import Swal from "sweetalert2";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ layout */

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  optional,
  aside,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  aside?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
          {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
        </label>
        {aside && <span className="text-xs tabular-nums text-muted-foreground">{aside}</span>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed read-only:bg-secondary/60 read-only:text-muted-foreground aria-invalid:border-rose-400";

export const btn = {
  primary:
    "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40",
  outline:
    "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40",
  ghostIcon:
    "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
  link: "cursor-pointer text-xs font-medium text-foreground underline-offset-2 hover:underline",
};

/* -------------------------------------------------------------------- menu */

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string };

/** A small dropdown: button + list, closes on outside click and Escape. */
export function Menu({
  label,
  items,
  header,
  align = "right",
  icon,
}: {
  label: string;
  items: (MenuItem | "divider")[];
  header?: (close: () => void) => ReactNode;
  align?: "left" | "right";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={btn.outline} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {header?.(close)}
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={`d${i}`} className="my-1 h-px bg-border" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40",
                  item.danger && "text-rose-600 dark:text-rose-400",
                )}
              >
                {item.label}
                {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
  wide,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          <button type="button" className={btn.ghostIcon} aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- confirm & toast */

export async function confirmBox({ title, body, ok }: { title: string; body: string; ok: string }) {
  const r = await Swal.fire({
    title,
    text: body,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: ok,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    buttonsStyling: false,
    customClass: {
      confirmButton: "bg-rose-600 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer ml-2",
      cancelButton: "border border-slate-200 px-5 py-2 rounded-lg text-sm font-medium cursor-pointer",
    },
  });
  return r.isConfirmed;
}

const EditorToast = Swal.mixin({
  toast: true,
  position: "bottom",
  timer: 5000,
  timerProgressBar: false,
  buttonsStyling: false,
  customClass: {
    popup: "swal-toast",
    confirmButton: "ml-3 rounded-md px-2.5 py-1 text-[13px] font-semibold underline underline-offset-2 cursor-pointer",
  },
});

/** Bottom toast; with `undo`, it carries an Undo button that runs it. */
export function toast(title: string, undo?: () => void) {
  void EditorToast.fire({
    title,
    showConfirmButton: !!undo,
    confirmButtonText: "Undo",
    timer: undo ? 6000 : 2400,
  }).then((r) => {
    if (r.isConfirmed && undo) {
      undo();
      void EditorToast.fire({ title: "Undone.", showConfirmButton: false, timer: 1800 });
    }
  });
}
