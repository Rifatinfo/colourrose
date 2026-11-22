"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  NONE,
  candidates,
  canNone,
  clampQty,
  clean,
  comboExists,
  enabledOpts,
  fmtNum,
  genPlan,
  genSku,
  low,
  normSku,
  type EditorVariant,
  type GenSelection,
  type SkuRules,
  type VariantState,
} from "./model";
import { Field, Modal, btn, inputClass } from "./ui";

/* ---------------------------------------------------------------- generate */

export function GenerateDialog({
  state,
  initial,
  onClose,
  onGenerate,
}: {
  state: VariantState;
  initial: GenSelection;
  onClose: () => void;
  onGenerate: (combos: Record<string, string>[], quantity: number) => void;
}) {
  const [picked, setPicked] = useState<GenSelection>(initial);
  const [qty, setQty] = useState("0");
  const plan = useMemo(() => genPlan(state, picked), [state, picked]);
  const n = plan.fresh.length;

  const toggle = (optId: string, value: string) =>
    setPicked((p) => {
      const next = new Set(p[optId]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...p, [optId]: next };
    });

  return (
    <Modal
      wide
      title="Generate variants"
      description="Pick the values to combine. Combinations that already exist are left as they are."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.outline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={n === 0} onClick={() => onGenerate(plan.fresh, clampQty(qty))}>
            {n ? `Generate ${fmtNum(n)} ${n === 1 ? "variant" : "variants"}` : "Generate variants"}
          </button>
        </>
      }
    >
      <div className="grid gap-5">
        {enabledOpts(state).map((o) => {
          const sel = picked[o.id] ?? new Set<string>();
          const pill = (v: string, isNonePill: boolean) => (
            <button
              key={v}
              type="button"
              aria-pressed={sel.has(v)}
              onClick={() => toggle(o.id, v)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                sel.has(v)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-secondary",
                isNonePill && !sel.has(v) && "italic text-muted-foreground",
              )}
            >
              {o.swatch && !isNonePill && (
                <span aria-hidden="true" className="h-3 w-3 rounded-full border border-black/15 dark:border-white/30" style={{ background: o.swatches[v] }} />
              )}
              {v}
            </button>
          );
          return (
            <div key={o.id}>
              <div className="mb-2 flex items-center gap-3">
                <b className="text-[13px] font-semibold">{o.name}</b>
                <span className="text-xs text-muted-foreground">{fmtNum(sel.size)} selected</span>
                <span className="ml-auto flex gap-3">
                  <button type="button" className="cursor-pointer text-xs font-medium hover:underline" onClick={() => setPicked((p) => ({ ...p, [o.id]: new Set([...(canNone(o) ? [NONE] : []), ...o.values]) }))}>
                    All
                  </button>
                  <button type="button" className="cursor-pointer text-xs font-medium hover:underline" onClick={() => setPicked((p) => ({ ...p, [o.id]: new Set() }))}>
                    Clear
                  </button>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {canNone(o) && pill(NONE, true)}
                {o.values.map((v) => pill(v, false))}
                {!o.values.length && !canNone(o) && <p className="text-xs text-muted-foreground">{o.name} has no values yet.</p>}
              </div>
            </div>
          );
        })}

        <Field label="Quantity for each new variant" htmlFor="gen-qty" className="max-w-[220px]">
          <input id="gen-qty" inputMode="numeric" className={cn(inputClass, "tabular-nums")} value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
        </Field>

        <p className="rounded-lg bg-secondary px-3 py-2.5 text-[13px]" aria-live="polite">
          {!plan.ready ? (
            "Select at least one value for each option."
          ) : (
            <>
              Creates <b>{fmtNum(n)}</b> new {n === 1 ? "variant" : "variants"}.
              {plan.existing > 0 && ` ${fmtNum(plan.existing)} already ${plan.existing === 1 ? "exists and stays as it is" : "exist and stay as they are"}.`}
              {n > 60 && <span className="mt-1 block text-amber-700 dark:text-amber-400">That is a lot of rows. Narrow the selection if you don&apos;t sell every combination.</span>}
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------- add / edit / duplicate */

export type VariantFormInit = {
  mode: "add" | "edit" | "dup";
  /** The variant being edited (edit mode). */
  target?: EditorVariant;
  sel: Record<string, string>;
  quantity: number;
  sku: string;
  skuManual: boolean;
};

const TITLES = { add: "Add variant", edit: "Edit variant", dup: "Duplicate variant" };

export function VariantFormDialog({
  state,
  rules,
  init,
  onClose,
  onSave,
}: {
  state: VariantState;
  rules: SkuRules;
  init: VariantFormInit;
  onClose: () => void;
  onSave: (result: { sel: Record<string, string>; quantity: number; sku: string; manual: boolean }) => void;
}) {
  const [sel, setSel] = useState(init.sel);
  const [qty, setQty] = useState(String(init.quantity));
  const [skuManual, setSkuManual] = useState(init.skuManual);
  const [skuText, setSkuText] = useState(init.sku);

  const generated = genSku(state, sel, rules);
  const sku = skuManual ? normSku(skuText, rules.separator) : generated;
  const selfKey = init.mode === "edit" ? init.target?.key : undefined;

  const errors: string[] = [];
  if (comboExists(state, sel, selfKey)) errors.push("That combination already exists in the table. Change at least one option.");
  if (!sku) errors.push("Enter a SKU, or use Regenerate.");
  else if (state.variants.some((v) => v.key !== selfKey && low(clean(v.sku)) === low(sku))) errors.push("Another variant already uses that SKU.");

  const save = () => {
    if (errors.length) return;
    onSave({ sel, quantity: clampQty(qty), sku, manual: skuManual && sku !== generated });
  };

  return (
    <Modal
      title={TITLES[init.mode]}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.outline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={errors.length > 0} onClick={save}>
            {init.mode === "edit" ? "Save changes" : TITLES[init.mode]}
          </button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {enabledOpts(state).map((o) => (
            <Field key={o.id} label={o.name} htmlFor={`vf-${o.id}`}>
              <select
                id={`vf-${o.id}`}
                className={inputClass}
                value={candidates(o).find((c) => low(c) === low(sel[o.id])) ?? ""}
                onChange={(e) => setSel((s) => ({ ...s, [o.id]: e.target.value }))}
              >
                {[...candidates(o)]
                  .sort((a, b) => (a === NONE ? -1 : b === NONE ? 1 : 0))
                  .map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
        </div>

        <Field
          label="SKU"
          htmlFor="vf-sku"
          hint={skuManual ? "Custom SKU. It won't change when options change." : "Generated from the main SKU and the selected options."}
        >
          <div className="flex gap-2">
            <input
              id="vf-sku"
              className={cn(inputClass, "font-mono text-[13px]")}
              value={skuManual ? skuText : generated}
              onChange={(e) => {
                setSkuManual(true);
                setSkuText(e.target.value);
              }}
            />
            <button
              type="button"
              className={btn.outline}
              title="Regenerate SKU"
              onClick={() => {
                setSkuManual(false);
                setSkuText(generated);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>
        </Field>

        <Field label="Quantity" htmlFor="vf-qty" className="max-w-[200px]">
          <input id="vf-qty" inputMode="numeric" className={cn(inputClass, "tabular-nums")} value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
        </Field>

        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
