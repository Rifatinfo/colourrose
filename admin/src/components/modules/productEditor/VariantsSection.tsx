"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, Info, Lock, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import Swal from "sweetalert2";

import { cn } from "@/lib/utils";

import {
  NONE,
  SUGGESTED_OPTIONS,
  addValues,
  baseSelFrom,
  canNone,
  canon,
  clampQty,
  clean,
  defaultGenSelection,
  displayValue,
  dupInfo,
  enabledOpts,
  firstFreeCombo,
  fmtNum,
  freeFromSource,
  genSku,
  isNone,
  low,
  makeOption,
  normSku,
  patchOption,
  plural,
  presetFor,
  uid,
  type EditorVariant,
  type GenSelection,
  type ProductType,
  type SkuRules,
  type VariantOption,
  type VariantState,
} from "./model";
import { GenerateDialog, VariantFormDialog, type VariantFormInit } from "./VariantDialogs";
import { Menu, Section, btn, confirmBox, inputClass, toast } from "./ui";

export type UpdateVariants = (next: VariantState, opts?: { toast?: string; undo?: boolean }) => void;

type Props = {
  type: ProductType;
  onTypeChange: (t: ProductType) => void;
  state: VariantState;
  update: UpdateVariants;
  rules: SkuRules;
  error?: string;
  /** Single products: stock shared with Total Stock Quantity above. */
  singleStock: number;
  onSingleStockChange: (n: number) => void;
};

const noneTip = (o: VariantOption) =>
  `Lets a variant have no ${o.name.toLowerCase()}. Its SKU skips the ${o.name.toLowerCase()} code.`;

export function VariantsSection({ type, onTypeChange, state, update, rules, error, singleStock, onSingleStockChange }: Props) {
  const [gen, setGen] = useState<GenSelection | null>(null);
  const [form, setForm] = useState<VariantFormInit | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const en = enabledOpts(state);
  const dups = dupInfo(state);
  const total = state.variants.reduce((a, v) => a + clampQty(v.quantity), 0);

  // Selection only ever refers to rows that still exist.
  const liveSelected = new Set([...selected].filter((k) => state.variants.some((v) => v.key === k)));

  useEffect(() => {
    if (!fresh.size) return;
    const t = window.setTimeout(() => setFresh(new Set()), 2400);
    return () => window.clearTimeout(t);
  }, [fresh]);

  /* ------------------------------------------------------------- type */

  const chooseType = async (t: ProductType) => {
    if (t === type) return;
    if (t === "SINGLE" && state.variants.length) {
      const ok = await confirmBox({
        title: "Switch to a single product?",
        body: `The ${plural(state.variants.length, "variant")} in the table won't be saved. Switch back before saving to keep them.`,
        ok: "Switch",
      });
      if (!ok) return;
    }
    onTypeChange(t);
  };

  /* ---------------------------------------------------------- options */

  const addOption = (rawName: string): string | null => {
    const name = clean(rawName).slice(0, 24);
    if (!name) return "Enter a name for the option.";
    if (state.options.some((o) => low(o.name) === low(name))) return `“${name}” already exists.`;
    const o = makeOption(presetFor(name) ?? name, state.options);
    // Existing variants read the new option as None, so their identity and SKU stay put.
    if (state.variants.length && o.supportsNone) o.allowNone = true;
    update({ ...state, options: [...state.options, o] }, { toast: `Added ${o.name}.` });
    return null;
  };

  const removeOption = async (o: VariantOption) => {
    const used = state.variants.filter((v) => !isNone(v.sel[o.id]));
    if (used.length) {
      const ok = await confirmBox({
        title: `Remove ${o.name}?`,
        body: `${o.name} will be cleared from ${plural(used.length, "variant")}. Variants that end up with the same combination are flagged so you can fix them.`,
        ok: "Remove option",
      });
      if (!ok) return;
    }
    const singleAttrs = { ...state.singleAttrs };
    delete singleAttrs[o.id];
    update(
      {
        options: state.options.filter((x) => x.id !== o.id),
        variants: state.variants.map((v) => {
          const sel = { ...v.sel };
          delete sel[o.id];
          return { ...v, sel };
        }),
        singleAttrs,
      },
      { toast: `Removed ${o.name}.`, undo: true },
    );
  };

  const renameOption = (o: VariantOption, raw: string): boolean => {
    const name = clean(raw);
    if (name === o.name) return true;
    let problem = "";
    if (!name) problem = "An option needs a name.";
    else if (name.length > 24) problem = "Keep option names to 24 characters.";
    else if (state.options.some((x) => x.id !== o.id && low(x.name) === low(name))) problem = `“${name}” already exists.`;
    if (problem) {
      toast(problem);
      return false;
    }
    update(patchOption(state, o.id, { name }), { toast: `Renamed to ${name}. SKUs are unchanged.` });
    return true;
  };

  const toggleEnabled = (o: VariantOption, on: boolean) => {
    update(patchOption(state, o.id, { enabled: on }), { toast: on ? `${o.name} is on.` : `${o.name} is off. Its values are kept.`, undo: !on });
  };

  const toggleNone = async (o: VariantOption, on: boolean) => {
    if (on) return update(patchOption(state, o.id, { allowNone: true }));
    const used = state.variants.filter((v) => isNone(v.sel[o.id]));
    if (!used.length) return update(patchOption(state, o.id, { allowNone: false }));
    const units = used.reduce((a, v) => a + clampQty(v.quantity), 0);
    const ok = await confirmBox({
      title: `Stop allowing “None” for ${o.name}?`,
      body: `${plural(used.length, "variant")} use “None” for ${o.name}, holding ${plural(units, "unit")}. Turning it off deletes those variants.`,
      ok: "Delete variants",
    });
    if (!ok) return;
    const ids = new Set(used.map((v) => v.key));
    const next = patchOption(state, o.id, { allowNone: false });
    update({ ...next, variants: next.variants.filter((v) => !ids.has(v.key)) }, { toast: `Deleted ${plural(used.length, "variant")} that used “None”.`, undo: true });
  };

  const addOptionValues = (o: VariantOption, list: string[]) => {
    const r = addValues(state, o.id, list);
    if (r.added || r.state.options.find((x) => x.id === o.id)!.allowNone !== o.allowNone) update(r.state);
    return r;
  };

  const removeValue = async (o: VariantOption, value: string) => {
    const c = canon(o, value);
    if (!c) return;
    const used = state.variants.filter((v) => low(v.sel[o.id]) === low(c));
    const codes = { ...o.codes };
    const swatches = { ...o.swatches };
    delete codes[c];
    delete swatches[c];
    const next = patchOption(state, o.id, { values: o.values.filter((x) => x !== c), codes, swatches });
    if (!used.length) return update(next);
    const units = used.reduce((a, v) => a + clampQty(v.quantity), 0);
    const ok = await confirmBox({
      title: `Remove “${c}” from ${o.name}?`,
      body: `${plural(used.length, "variant")} use it, holding ${plural(units, "unit")}. Removing the value deletes those variants.`,
      ok: "Remove value",
    });
    if (!ok) return;
    const ids = new Set(used.map((v) => v.key));
    update({ ...next, variants: next.variants.filter((v) => !ids.has(v.key)) }, { toast: `Removed “${c}” and ${plural(used.length, "variant")}.`, undo: true });
  };

  const setSwatch = (o: VariantOption, value: string, hex: string) =>
    update(patchOption(state, o.id, { swatches: { ...o.swatches, [value]: hex } }));

  /* --------------------------------------------------------- variants */

  const needOptions = () => {
    if (!en.length) {
      toast("Turn on at least one option first.");
      return true;
    }
    const empty = en.find((o) => !o.values.length && !canNone(o));
    if (empty) {
      toast(`Add a value to ${empty.name} first.`);
      return true;
    }
    return false;
  };

  const openGenerate = () => {
    if (needOptions()) return;
    setGen(defaultGenSelection(state));
  };

  const runGenerate = (combos: Record<string, string>[], quantity: number) => {
    const created: EditorVariant[] = combos.map((sel) => ({ key: uid(), sel, sku: genSku(state, sel, rules), quantity, manual: false }));
    setGen(null);
    setFresh(new Set(created.map((v) => v.key)));
    update({ ...state, variants: [...state.variants, ...created] }, { toast: `Added ${plural(created.length, "variant")}.`, undo: true });
  };

  const openForm = (mode: VariantFormInit["mode"], v?: EditorVariant) => {
    if (needOptions()) return;
    let init: VariantFormInit | null = null;
    if (mode === "edit" && v) init = { mode, target: v, sel: baseSelFrom(state, v), quantity: v.quantity, sku: v.sku, skuManual: v.manual };
    else {
      const sel = mode === "dup" && v ? freeFromSource(state, v) : firstFreeCombo(state);
      if (sel) init = { mode, sel, quantity: mode === "dup" && v ? v.quantity : 0, sku: "", skuManual: false };
    }
    if (!init) return toast("Every combination of these options already exists.");
    setForm(init);
  };

  const saveForm = (r: { sel: Record<string, string>; quantity: number; sku: string; manual: boolean }) => {
    const f = form!;
    setForm(null);
    if (f.mode === "edit" && f.target) {
      const key = f.target.key;
      update(
        { ...state, variants: state.variants.map((v) => (v.key === key ? { ...v, sel: { ...v.sel, ...r.sel }, quantity: r.quantity, sku: r.sku, manual: r.manual } : v)) },
        { toast: "Variant updated.", undo: true },
      );
    } else {
      const v: EditorVariant = { key: uid(), sel: r.sel, quantity: r.quantity, sku: r.sku, manual: r.manual };
      setFresh(new Set([v.key]));
      update({ ...state, variants: [...state.variants, v] }, { toast: f.mode === "dup" ? "Variant duplicated." : "Variant added." });
    }
  };

  const patchVariant = (key: string, patch: Partial<EditorVariant>) =>
    update({ ...state, variants: state.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) });

  const commitRowSku = (v: EditorVariant, raw: string) => {
    const generated = genSku(state, v.sel, rules);
    const val = normSku(raw, rules.separator);
    if (!val || val === generated) patchVariant(v.key, { sku: generated, manual: false });
    else if (val !== v.sku) patchVariant(v.key, { sku: val, manual: true });
  };

  const deleteVariants = (keys: Set<string>, message: string) => {
    setSelected(new Set());
    update({ ...state, variants: state.variants.filter((v) => !keys.has(v.key)) }, { toast: message, undo: true });
  };

  const regenerate = (keys: Set<string> | null, message: string) =>
    update(
      { ...state, variants: state.variants.map((v) => (keys && !keys.has(v.key) ? v : { ...v, manual: false })) },
      { toast: message, undo: true },
    );

  const setQtyForSelected = async () => {
    const r = await Swal.fire({
      title: `Set quantity for ${plural(liveSelected.size, "variant")}`,
      input: "number",
      inputValue: "0",
      inputAttributes: { min: "0", max: "999999", step: "1" },
      showCancelButton: true,
      confirmButtonText: "Set quantity",
      buttonsStyling: false,
      customClass: {
        confirmButton: "bg-black text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer ml-2",
        cancelButton: "border border-slate-200 px-5 py-2 rounded-lg text-sm font-medium cursor-pointer",
      },
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    const q = clampQty(r.value);
    update(
      { ...state, variants: state.variants.map((v) => (liveSelected.has(v.key) ? { ...v, quantity: q } : v)) },
      { toast: `Set ${plural(liveSelected.size, "variant")} to ${fmtNum(q)}.`, undo: true },
    );
  };

  const allSelected = state.variants.length > 0 && liveSelected.size === state.variants.length;

  return (
    <Section
      title="Product Variants"
      description="Choose if this is a single product or has variants. Add and manage options like colour, size, measurement etc."
      action={
        type === "VARIANTS" && (
          <button type="button" className={btn.outline} onClick={() => openForm("add")}>
            <Plus className="h-3.5 w-3.5" />
            Add Variant
          </button>
        )
      }
    >
      <div role="radiogroup" aria-label="Product type" className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["SINGLE", "Single product", "No variations (e.g. a cap, belt, wallet)"],
            ["VARIANTS", "Has variants", "Manage colours, sizes, measurements, etc."],
          ] as const
        ).map(([value, title, sub]) => {
          const on = type === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => chooseType(value)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                on ? "border-sky-400 bg-sky-50 dark:border-sky-500/60 dark:bg-sky-950/30" : "border-border hover:bg-secondary/60",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                  on ? "border-sky-500" : "border-muted-foreground/50",
                )}
              >
                {on && <span className="h-2 w-2 rounded-full bg-sky-500" />}
              </span>
              <span>
                <span className={cn("block text-[13px] font-medium", on && "text-sky-700 dark:text-sky-300")}>{title}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------------------------------------------------- options */}
      {type === "VARIANTS" && (
      <div className="mt-5 rounded-xl border border-border">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-[13px] font-semibold">Variant Options</h3>
            <p className="text-xs text-muted-foreground">Select and customize the options you want to use for this product.</p>
          </div>
          <AddOptionMenu existing={state.options.map((o) => o.name)} onAdd={addOption} />
        </div>

        {state.options.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No options yet. Use Add Option to create one.</p>}

        <ul className="divide-y divide-border">
          {state.options.map((o) => (
            <OptionRow
              key={`${o.id}:${o.name}`}
              option={o}
              onToggle={(on) => toggleEnabled(o, on)}
              onRename={(name) => renameOption(o, name)}
              onRemove={() => removeOption(o)}
              onAddValues={(list) => addOptionValues(o, list)}
              onRemoveValue={(v) => removeValue(o, v)}
              onSwatch={(v, hex) => setSwatch(o, v, hex)}
            />
          ))}
        </ul>
      </div>
      )}

      {state.options.some((o) => o.supportsNone && o.enabled) && type === "VARIANTS" && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {state.options
            .filter((o) => o.supportsNone && o.enabled)
            .map((o) => (
              <label key={o.id} className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" className="h-4 w-4 accent-foreground" checked={o.allowNone} onChange={(e) => toggleNone(o, e.target.checked)} />
                Allow “None” option for {o.name}
                <span title={noneTip(o)} aria-label={noneTip(o)} className="text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                </span>
              </label>
            ))}
        </div>
      )}

      {/* ------------------------------------------------ single product */}
      {type === "SINGLE" && (
        <SingleDetails
          state={state}
          onChange={(singleAttrs) => update({ ...state, singleAttrs })}
          stock={singleStock}
          onStockChange={onSingleStockChange}
          mainSku={rules.mainSku}
        />
      )}

      {/* -------------------------------------------------- variant table */}
      {type === "VARIANTS" && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold">Variant Table</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.outline} onClick={openGenerate}>
                <Wand2 className="h-3.5 w-3.5" />
                Generate variants
              </button>
              <Menu
                label={liveSelected.size ? `Bulk Actions (${liveSelected.size})` : "Bulk Actions"}
                items={[
                  { label: "Set quantity…", disabled: !liveSelected.size, onSelect: setQtyForSelected },
                  { label: "Regenerate SKUs", hint: "selected", disabled: !liveSelected.size, onSelect: () => regenerate(liveSelected, `Regenerated ${plural(liveSelected.size, "SKU")}.`) },
                  { label: "Delete selected", danger: true, disabled: !liveSelected.size, onSelect: () => deleteVariants(liveSelected, `Deleted ${plural(liveSelected.size, "variant")}.`) },
                  "divider",
                  {
                    label: "Select duplicates",
                    disabled: !dups.comboRows && !dups.skuRows,
                    onSelect: () => setSelected(new Set(state.variants.filter((v) => dups.isDupCombo(v) || dups.isDupSku(v)).map((v) => v.key))),
                  },
                  { label: "Regenerate all SKUs", disabled: !state.variants.length, onSelect: () => regenerate(null, "Regenerated all SKUs.") },
                ]}
              />
            </div>
          </div>

          {(dups.comboRows > 0 || dups.skuRows > 0) && (
            <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {dups.comboRows > 0 && `${plural(dups.comboRows, "variant")} share a combination. `}
                {dups.skuRows > 0 && `${plural(dups.skuRows, "variant")} share a SKU. `}
                Edit or delete the highlighted rows before saving.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mb-3 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all variants"
                      className="h-4 w-4 accent-foreground"
                      checked={allSelected}
                      disabled={!state.variants.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(state.variants.map((v) => v.key)) : new Set())}
                    />
                  </th>
                  {en.map((o) => (
                    <th key={o.id} className="px-3 py-2.5 font-medium">
                      {o.name}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium">SKU</th>
                  <th className="w-28 px-3 py-2.5 font-medium">Quantity</th>
                  <th className="w-28 px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.variants.length === 0 && (
                  <tr>
                    <td colSpan={en.length + 4} className="px-3 py-8 text-center text-muted-foreground">
                      No variants yet. Add values to your options, then use Generate variants or Add Variant.
                    </td>
                  </tr>
                )}
                {state.variants.map((v) => {
                  const dupCombo = dups.isDupCombo(v);
                  const dupSku = dups.isDupSku(v);
                  return (
                    <tr
                      key={v.key}
                      className={cn(
                        "transition-colors",
                        (dupCombo || dupSku) && "bg-amber-50/70 dark:bg-amber-950/25",
                        fresh.has(v.key) && "bg-sky-50 dark:bg-sky-950/30",
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select variant"
                          className="h-4 w-4 accent-foreground"
                          checked={liveSelected.has(v.key)}
                          onChange={(e) =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (e.target.checked) n.add(v.key);
                              else n.delete(v.key);
                              return n;
                            })
                          }
                        />
                      </td>
                      {en.map((o) => {
                        const val = displayValue(o, v.sel[o.id]);
                        return (
                          <td key={o.id} className={cn("px-3 py-2", dupCombo && "text-amber-800 dark:text-amber-300")}>
                            {val === NONE ? (
                              <span className="italic text-muted-foreground">None</span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                {o.swatch && (
                                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-black/15 dark:border-white/30" style={{ background: o.swatches[val] ?? "#999" }} />
                                )}
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <input
                          key={v.sku}
                          aria-label="Variant SKU"
                          defaultValue={v.sku}
                          title={v.manual ? "Custom SKU" : "Generated SKU"}
                          aria-invalid={dupSku}
                          onBlur={(e) => commitRowSku(v, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className={cn(
                            "h-8 w-full min-w-[150px] rounded-md border border-transparent bg-transparent px-2 font-mono text-[12px] outline-none hover:border-border focus:border-ring",
                            dupSku && "border-amber-400",
                            v.manual && "text-sky-700 dark:text-sky-300",
                          )}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          aria-label="Quantity"
                          inputMode="numeric"
                          value={String(v.quantity)}
                          onChange={(e) => patchVariant(v.key, { quantity: clampQty(e.target.value.replace(/\D/g, "")) })}
                          className={cn(inputClass, "h-8 w-20 tabular-nums")}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex">
                          <button type="button" className={btn.ghostIcon} aria-label="Edit variant" title="Edit" onClick={() => openForm("edit", v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className={btn.ghostIcon} aria-label="Duplicate variant" title="Duplicate" onClick={() => openForm("dup", v)}>
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className={cn(btn.ghostIcon, "hover:text-rose-600")}
                            aria-label="Delete variant"
                            title="Delete"
                            onClick={() => deleteVariants(new Set([v.key]), "Variant deleted.")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
              <span>{plural(state.variants.length, "variant")}</span>
              <span>
                Total stock <b className="tabular-nums text-foreground">{fmtNum(en.length ? total : 0)}</b> units
              </span>
            </div>
          </div>
        </div>
      )}

      {gen && <GenerateDialog state={state} initial={gen} onClose={() => setGen(null)} onGenerate={runGenerate} />}
      {form && <VariantFormDialog state={state} rules={rules} init={form} onClose={() => setForm(null)} onSave={saveForm} />}
    </Section>
  );
}

/* ================================================================ option row */

function OptionRow({
  option: o,
  onToggle,
  onRename,
  onRemove,
  onAddValues,
  onRemoveValue,
  onSwatch,
}: {
  option: VariantOption;
  onToggle: (on: boolean) => void;
  onRename: (name: string) => boolean;
  onRemove: () => void;
  onAddValues: (list: string[]) => { added: number; error: string; keep: string };
  onRemoveValue: (v: string) => void;
  onSwatch: (v: string, hex: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [name, setName] = useState(o.name);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (list: string[]) => {
    const r = onAddValues(list);
    setErr(r.error);
    setDraft(r.keep);
  };

  return (
    <li className={cn("grid gap-3 px-4 py-3.5 sm:grid-cols-[180px_1fr_auto] sm:items-start", !o.enabled && "opacity-60")}>
      <div className="flex items-center gap-2.5 pt-1">
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-foreground" aria-label={`Use ${o.name}`} checked={o.enabled} onChange={(e) => onToggle(e.target.checked)} />
        <input
          ref={nameRef}
          aria-label="Option name"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !onRename(name) && setName(o.name)}
          onKeyDown={(e) => {
            if (e.key === "Enter") nameRef.current?.blur();
            if (e.key === "Escape") {
              setName(o.name);
              window.setTimeout(() => nameRef.current?.blur(), 0);
            }
          }}
          title="Click to rename"
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] font-medium outline-none hover:border-border focus:border-ring"
        />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {canNone(o) && <span className="inline-flex h-7 items-center rounded-md border border-dashed border-border px-2.5 text-xs italic text-muted-foreground">None</span>}
          {o.values.map((v) => (
            <span key={v} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary/50 pl-2 pr-1 text-xs">
              {o.swatch && (
                <label className="relative inline-flex cursor-pointer" title={`Change the swatch for ${v}`}>
                  <span aria-hidden="true" className="h-3 w-3 rounded-full border border-black/15 dark:border-white/30" style={{ background: o.swatches[v] }} />
                  <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Swatch for ${v}`} value={o.swatches[v] ?? "#888888"} onChange={(e) => onSwatch(v, e.target.value)} />
                </label>
              )}
              {v}
              <button type="button" className="grid h-5 w-5 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${v}`} onClick={() => onRemoveValue(v)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="inline-flex h-7 items-center rounded-md border border-border bg-background pl-2 pr-1 focus-within:border-ring">
            <input
              aria-label={`Add a value to ${o.name}`}
              value={draft}
              disabled={!o.enabled}
              placeholder="+ Add value"
              onChange={(e) => {
                setErr("");
                const v = e.target.value;
                if (v.includes(",")) {
                  const parts = v.split(",");
                  submit(parts.slice(0, -1));
                  setDraft((d) => d || parts[parts.length - 1]);
                } else setDraft(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (draft.trim()) submit([draft]);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/[,\n]/.test(text)) {
                  e.preventDefault();
                  submit(text.split(/[,\n]/));
                }
              }}
              className="w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            <button type="button" className="grid h-5 w-5 cursor-pointer place-items-center rounded text-muted-foreground hover:text-foreground" aria-label={`Add value to ${o.name}`} disabled={!o.enabled} onClick={() => draft.trim() && submit([draft])}>
              <Plus className="h-3 w-3" />
            </button>
          </span>
        </div>
        {err && (
          <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
            {err}
          </p>
        )}
      </div>

      <button type="button" className={cn(btn.ghostIcon, "justify-self-end hover:text-rose-600")} aria-label={`Remove option ${o.name}`} title="Remove option" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/* ============================================================ add option */

function AddOptionMenu({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => string | null }) {
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const have = new Set(existing.map(low));
  const presets = ["Colour", "Size", "Measurement", ...SUGGESTED_OPTIONS].filter((n) => !have.has(low(n)));

  return (
    <Menu
      label="Add Option"
      items={presets.map((n) => ({ label: n, onSelect: () => onAdd(n) }))}
      header={(close) => (
        <form
          className="border-b border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = onAdd(custom);
            if (problem) setErr(problem);
            else {
              setCustom("");
              setErr("");
              close();
            }
          }}
        >
          <div className="flex gap-1.5">
            <input
              autoFocus
              aria-label="Custom option name"
              value={custom}
              maxLength={24}
              placeholder="Custom option, e.g. Sleeve"
              onChange={(e) => {
                setCustom(e.target.value);
                setErr("");
              }}
              className={cn(inputClass, "h-8 text-[13px]")}
            />
            <button type="submit" className={cn(btn.primary, "h-8 px-2.5")}>
              Add
            </button>
          </div>
          {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
          {presets.length > 0 && <p className="mt-2 px-0.5 text-xs text-muted-foreground">Or pick a preset</p>}
        </form>
      )}
    />
  );
}

/* ========================================================= single product */

/** Single products describe themselves with one fixed value per option. */
function SingleDetails({
  state,
  onChange,
  stock,
  onStockChange,
  mainSku,
}: {
  state: VariantState;
  onChange: (attrs: Record<string, string>) => void;
  stock: number;
  onStockChange: (n: number) => void;
  mainSku: string;
}) {
  const colour = state.options.find((o) => o.swatch);
  return (
    <div className="mt-4 rounded-xl border border-border">
      <div className="px-4 pb-4 pt-3.5">
        <h3 className="text-[15px] font-semibold tracking-tight">Single Product Details</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Sold as one item, so stock and SKU are managed for the whole product.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="sd-stock" className="text-[13px] font-medium">
              Stock Quantity
            </label>
            <input
              id="sd-stock"
              inputMode="numeric"
              className={cn(inputClass, "h-10 tabular-nums")}
              value={String(stock)}
              onChange={(e) => onStockChange(Math.min(999999, Number(e.target.value.replace(/D/g, "")) || 0))}
            />
            <p className="text-xs text-muted-foreground">Same as Total Stock Quantity above.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sd-sku" className="text-[13px] font-medium">
              SKU
            </label>
            <div className="relative">
              <input id="sd-sku" readOnly className={cn(inputClass, "h-10 pr-9")} value={mainSku} placeholder="Generate the main SKU above" />
              <Lock aria-hidden="true" className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Uses the main SKU. No variant SKUs.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 pb-4 pt-3.5">
        <h4 className="text-[13px] font-medium">Product attributes</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional. One fixed value each, shown as plain details on the product page.
          {colour && ` The ${colour.name} value is used when Color Name above is blank.`}
        </p>
        <div className="mt-3.5 grid gap-2.5">
          {state.options.map((o) => (
            <div key={o.id} className="grid items-center gap-1.5 sm:grid-cols-[112px_1fr] sm:gap-3">
              <label htmlFor={`sa-${o.id}`} className="text-[13px] font-medium break-words">
                {o.name}
              </label>
              <input
                id={`sa-${o.id}`}
                list={`sa-list-${o.id}`}
                maxLength={40}
                className={cn(inputClass, "h-10")}
                placeholder={o.swatch ? `e.g. ${o.values[0] ?? "Black"}` : `Add ${o.name.toLowerCase()}`}
                value={state.singleAttrs[o.id] ?? ""}
                onChange={(e) => onChange({ ...state.singleAttrs, [o.id]: e.target.value })}
              />
              <datalist id={`sa-list-${o.id}`}>
                {o.values.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
