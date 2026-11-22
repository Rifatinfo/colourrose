/**
 * Product editor model: options, variants, SKUs and stock.
 *
 * Everything here is pure — the editor keeps one `VariantState` object and
 * every change goes through these functions, so the table, the counters, the
 * preview and the saved payload can never disagree.
 *
 * Colour, Size and Measurement are only presets: nothing below refers to an
 * option by its name. Options are identified by a stable id, so renaming
 * "Colour" to "Color" changes labels only — never values, codes or SKUs.
 */

export type ProductType = "SINGLE" | "VARIANTS";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type VariantOption = {
  id: string;
  name: string;
  enabled: boolean;
  values: string[];
  /** Whether "None" is currently an allowed value. */
  allowNone: boolean;
  /** Whether "None" can be allowed at all (Colour can't). */
  supportsNone: boolean;
  /** Values carry a colour swatch; this option feeds the storefront colour. */
  swatch: boolean;
  /** value → short code used in variant SKUs. Stable once assigned. */
  codes: Record<string, string>;
  swatches: Record<string, string>;
};

export type EditorVariant = {
  /** Local key for React and the editor; not the database id. */
  key: string;
  /** Database id for variants that already exist, kept across saves. */
  dbId?: string;
  /** optionId → value, or "None". Disabled options keep their value. */
  sel: Record<string, string>;
  sku: string;
  quantity: number;
  /** Typed by an admin; generated SKUs follow the main SKU. */
  manual: boolean;
};

export type VariantState = {
  options: VariantOption[];
  variants: EditorVariant[];
  /** SINGLE products: optionId → value. */
  singleAttrs: Record<string, string>;
};

export const NONE = "None";

export const low = (s: unknown) => String(s ?? "").toLowerCase();
export const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
export const isNone = (v: unknown) => v == null || v === "" || low(v) === "none";
export const clampQty = (n: unknown) => Math.max(0, Math.min(999999, Math.floor(Number(n) || 0)));
export const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");
export const plural = (n: number, one: string, many = `${one}s`) => `${fmtNum(n)} ${n === 1 ? one : many}`;

let uidN = 0;
export const uid = (p = "v") => `${p}_${Date.now().toString(36)}${(uidN++).toString(36)}`;

/* ---------------------------------------------------------------- swatches */

const COLOUR_WORDS: Record<string, string> = {
  black: "#1f1f22", white: "#f4f4f3", grey: "#8a8a90", gray: "#8a8a90", silver: "#b8b8bd", ash: "#a5a6ab",
  graphite: "#2f3034", charcoal: "#36363b", midnight: "#3d3f45", navy: "#1f2a4a", blue: "#5f7fb8",
  sky: "#8fb8e0", horizon: "#6b86c2", indigo: "#4b4f9c", denim: "#4a6a95", green: "#3f8f5a",
  forest: "#2f5d3a", olive: "#6b6b3a", sage: "#9caf88", mint: "#9fd8c0", teal: "#2f8f8f",
  beige: "#d8c8a8", sand: "#d4bf94", cream: "#efe6d2", khaki: "#b9a878", stone: "#8c877f",
  brown: "#7a5536", tan: "#b98c5a", camel: "#c19a6b", red: "#c0392b", maroon: "#6d1f2a",
  burgundy: "#6b1f35", wine: "#722f37", pink: "#e8a0b4", rose: "#d98a9a", purple: "#7b4fa0",
  lavender: "#b7a6d8", yellow: "#e0c14a", mustard: "#c9a227", orange: "#e07b39", rust: "#a7502b",
};
const FALLBACK_SWATCHES = ["#6b7280", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#64748b"];

export function guessSwatch(value: string, option: VariantOption) {
  for (const w of low(value).split(/[^a-z]+/)) if (COLOUR_WORDS[w]) return COLOUR_WORDS[w];
  return FALLBACK_SWATCHES[Object.keys(option.swatches).length % FALLBACK_SWATCHES.length];
}

/* ------------------------------------------------------------ value codes */

/** Short, unique code for a value: "M" → M, "Blue Horizon" → BH, "Denim" → DEN. */
export function makeCode(value: string, taken: string[]) {
  const v = clean(value);
  const words = v.split(" ").filter(Boolean);
  let code: string;
  if (/^[A-Za-z0-9]{1,3}$/.test(v)) code = v.toUpperCase();
  else if (words.length > 1) {
    code = words
      .filter((w) => !["of", "and", "the"].includes(low(w)))
      .map((w) => w.replace(/[^A-Za-z0-9]/g, "")[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 4);
  } else code = v.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  if (!code) code = "X";
  const used = new Set(taken.map(low));
  let out = code;
  let n = 2;
  while (used.has(low(out))) out = code + n++;
  return out;
}

/* ---------------------------------------------------------------- presets */

type Preset = { swatch?: boolean; supportsNone: boolean; allowNone: boolean };
export const PRESETS: Record<string, Preset> = {
  Colour: { swatch: true, supportsNone: false, allowNone: false },
  Size: { supportsNone: true, allowNone: true },
  Measurement: { supportsNone: true, allowNone: true },
  Fit: { supportsNone: true, allowNone: false },
  Length: { supportsNone: true, allowNone: false },
  Material: { supportsNone: true, allowNone: false },
  Pack: { supportsNone: true, allowNone: false },
  Style: { supportsNone: true, allowNone: false },
};
export const SUGGESTED_OPTIONS = ["Fit", "Length", "Material", "Pack", "Style"];
export const presetFor = (name: string) => Object.keys(PRESETS).find((k) => low(k) === low(name));

function slugId(name: string, options: VariantOption[]) {
  const base = "opt_" + (low(name).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "option");
  const ids = new Set(options.map((o) => o.id));
  let id = base;
  let n = 2;
  while (ids.has(id)) id = `${base}_${n++}`;
  return id;
}

export function makeOption(name: string, options: VariantOption[], enabled = true): VariantOption {
  const key = presetFor(name);
  const p = key ? PRESETS[key] : { supportsNone: true, allowNone: false };
  return {
    id: slugId(key ?? name, options),
    name: key ?? name,
    enabled,
    supportsNone: p.supportsNone,
    allowNone: p.supportsNone && p.allowNone,
    swatch: !!p.swatch,
    values: [],
    codes: {},
    swatches: {},
  };
}

/** A new product starts with Colour and Size on, and Measurement ready but off. */
export function initialVariantState(): VariantState {
  const options: VariantOption[] = [];
  options.push(makeOption("Colour", options));
  options.push(makeOption("Size", options));
  options.push(makeOption("Measurement", options, false));
  return { options, variants: [], singleAttrs: {} };
}

/* ---------------------------------------------------------------- queries */

export const enabledOpts = (s: VariantState) => s.options.filter((o) => o.enabled);
export const canNone = (o: VariantOption) => o.supportsNone && o.allowNone;
export const colourOpt = (s: VariantState) => s.options.find((o) => o.swatch && o.enabled);

export function canon(o: VariantOption, value: string) {
  const l = low(value);
  return o.values.find((v) => low(v) === l);
}

export function comboKeySel(s: VariantState, sel: Record<string, string>) {
  return enabledOpts(s)
    .map((o) => (isNone(sel[o.id]) ? "none" : low(sel[o.id])))
    .join("|");
}
export const comboExists = (s: VariantState, sel: Record<string, string>, exceptKey?: string) =>
  s.variants.some((v) => v.key !== exceptKey && comboKeySel(s, v.sel) === comboKeySel(s, sel));

export function displayValue(o: VariantOption, raw: string | undefined) {
  return isNone(raw) ? NONE : canon(o, raw as string) ?? (raw as string);
}

/* -------------------------------------------------------------------- SKU */

export type SkuRules = { mainSku: string; separator: string };

function codeOf(o: VariantOption, value: string) {
  const c = canon(o, value);
  return c ? o.codes[c] : makeCode(value, []);
}

/** `[main][sep][code per enabled option]`, skipping options set to None. */
export function genSku(s: VariantState, sel: Record<string, string>, rules: SkuRules) {
  const parts = [clean(rules.mainSku)];
  for (const o of enabledOpts(s)) {
    const r = sel[o.id];
    if (isNone(r)) continue;
    parts.push(codeOf(o, r));
  }
  return parts.filter(Boolean).join(rules.separator).toUpperCase();
}

export function normSku(raw: string, separator: string) {
  return clean(raw).replace(/ /g, separator).toUpperCase();
}

/** Regenerates every SKU that wasn't typed by hand. */
export function syncSkus(s: VariantState, rules: SkuRules): VariantState {
  let changed = false;
  const variants = s.variants.map((v) => {
    if (v.manual) return v;
    const sku = genSku(s, v.sel, rules);
    if (sku === v.sku) return v;
    changed = true;
    return { ...v, sku };
  });
  return changed ? { ...s, variants } : s;
}

/* ------------------------------------------------------------------ stock */

export function totalStock(s: VariantState, type: ProductType, singleStock: number) {
  if (type === "SINGLE") return clampQty(singleStock);
  if (!enabledOpts(s).length) return 0;
  return s.variants.reduce((a, v) => a + clampQty(v.quantity), 0);
}

export function suggestedStatus(total: number, threshold: number): StockStatus {
  if (total <= 0) return "OUT_OF_STOCK";
  return total <= threshold ? "LOW_STOCK" : "IN_STOCK";
}

export const STATUS_META: Record<StockStatus, { label: string; dot: string }> = {
  IN_STOCK: { label: "In Stock", dot: "bg-emerald-500" },
  LOW_STOCK: { label: "Low Stock", dot: "bg-amber-500" },
  OUT_OF_STOCK: { label: "Out of Stock", dot: "bg-rose-500" },
};

/* ------------------------------------------------------------- duplicates */

/** Duplicates are flagged for the admin to fix, never silently merged. */
export function dupInfo(s: VariantState) {
  const keys = new Map<string, number>();
  const skus = new Map<string, number>();
  const active = enabledOpts(s).length > 0;
  for (const v of s.variants) {
    if (active) {
      const k = comboKeySel(s, v.sel);
      keys.set(k, (keys.get(k) ?? 0) + 1);
    }
    const sk = low(clean(v.sku));
    if (sk) skus.set(sk, (skus.get(sk) ?? 0) + 1);
  }
  const dupKeys = new Set([...keys].filter(([, n]) => n > 1).map(([k]) => k));
  const dupSkus = new Set([...skus].filter(([, n]) => n > 1).map(([k]) => k));
  const isDupCombo = (v: EditorVariant) => active && dupKeys.has(comboKeySel(s, v.sel));
  const isDupSku = (v: EditorVariant) => dupSkus.has(low(clean(v.sku)));
  return {
    isDupCombo,
    isDupSku,
    comboRows: s.variants.filter(isDupCombo).length,
    skuRows: s.variants.filter(isDupSku).length,
  };
}

/* ------------------------------------------------------------- mutations */

/** Adds values typed or pasted into an option. Returns the new state and what happened. */
export function addValues(s: VariantState, optId: string, list: string[]) {
  const options = s.options.map((o) => ({ ...o, values: [...o.values], codes: { ...o.codes }, swatches: { ...o.swatches } }));
  const o = options.find((x) => x.id === optId)!;
  let added = 0;
  let error = "";
  let keep = "";
  for (const raw of list) {
    const v = clean(raw).slice(0, 30);
    if (!v) continue;
    if (low(v) === "none") {
      if (o.supportsNone) o.allowNone = true;
      else if (!error) {
        error = `${o.name} can't be “None”. Turn it off instead.`;
        keep = v;
      }
      continue;
    }
    const existing = canon(o, v);
    if (existing) {
      if (!error) {
        error = `“${existing}” is already in ${o.name}.`;
        keep = v;
      }
      continue;
    }
    o.values.push(v);
    o.codes[v] = makeCode(v, Object.values(o.codes));
    if (o.swatch) o.swatches[v] = guessSwatch(v, o);
    added++;
  }
  return { state: { ...s, options }, added, error, keep };
}

export function patchOption(s: VariantState, optId: string, patch: Partial<VariantOption>): VariantState {
  return { ...s, options: s.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)) };
}

export function removeVariantsWhere(s: VariantState, pred: (v: EditorVariant) => boolean): VariantState {
  return { ...s, variants: s.variants.filter((v) => !pred(v)) };
}

/* ------------------------------------------------------------- generator */

export type GenSelection = Record<string, Set<string>>;

/** Defaults: every value for options that can't be None; the first None-able option gets its values, the rest just None. */
export function defaultGenSelection(s: VariantState): GenSelection {
  const sel: GenSelection = {};
  let firstCapable = true;
  for (const o of enabledOpts(s)) {
    if (!canNone(o)) sel[o.id] = new Set(o.values);
    else if (firstCapable) {
      sel[o.id] = new Set(o.values.length ? o.values : [NONE]);
      firstCapable = false;
    } else sel[o.id] = new Set([NONE]);
  }
  return sel;
}

export function genPlan(s: VariantState, picked: GenSelection) {
  let combos: Record<string, string>[] = [{}];
  for (const o of enabledOpts(s)) {
    const p = picked[o.id] ?? new Set<string>();
    const vals = [...(p.has(NONE) ? [NONE] : []), ...o.values.filter((v) => p.has(v))];
    if (!vals.length) return { ready: false, fresh: [] as Record<string, string>[], existing: 0 };
    const next: Record<string, string>[] = [];
    for (const c of combos) for (const v of vals) next.push({ ...c, [o.id]: v });
    combos = next;
  }
  const have = new Set(s.variants.map((v) => comboKeySel(s, v.sel)));
  const seen = new Set<string>();
  const fresh: Record<string, string>[] = [];
  let existing = 0;
  for (const c of combos) {
    const k = comboKeySel(s, c);
    if (have.has(k)) {
      existing++;
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(c);
  }
  return { ready: true, fresh, existing };
}

/* ------------------------------------------------- add / edit / duplicate */

export const candidates = (o: VariantOption) => [...o.values, ...(canNone(o) ? [NONE] : [])];

export function firstFreeCombo(s: VariantState) {
  const en = enabledOpts(s);
  const lists = en.map(candidates);
  if (lists.some((l) => !l.length)) return null;
  const idx = lists.map(() => 0);
  for (;;) {
    const sel: Record<string, string> = {};
    en.forEach((o, i) => (sel[o.id] = lists[i][idx[i]]));
    if (!comboExists(s, sel)) return sel;
    let i = en.length - 1;
    while (i >= 0) {
      idx[i]++;
      if (idx[i] < lists[i].length) break;
      idx[i] = 0;
      i--;
    }
    if (i < 0) return null;
  }
}

export function baseSelFrom(s: VariantState, v: EditorVariant) {
  const sel: Record<string, string> = {};
  for (const o of enabledOpts(s)) {
    const r = v.sel[o.id];
    sel[o.id] = isNone(r) ? (canNone(o) ? NONE : o.values[0]) : canon(o, r) ?? r;
  }
  return sel;
}

/** A free combination closest to `src`: changes the last option first. */
export function freeFromSource(s: VariantState, src: EditorVariant) {
  const en = enabledOpts(s);
  const base = baseSelFrom(s, src);
  for (let i = en.length - 1; i >= 0; i--) {
    for (const val of candidates(en[i])) {
      if (low(val) === low(base[en[i].id])) continue;
      const sel = { ...base, [en[i].id]: val };
      if (!comboExists(s, sel)) return sel;
    }
  }
  return firstFreeCombo(s);
}

/* ------------------------------------------------------ load & save shape */

type ApiVariant = {
  id?: string;
  color?: string | null;
  size?: string | null;
  quantity?: number;
  sku?: string | null;
  options?: Record<string, string> | null;
  manualSku?: boolean;
};

export type ApiProductVariants = {
  sku?: string;
  productType?: ProductType;
  variantOptions?: Partial<VariantOption>[] | null;
  attributes?: { optionId: string; name: string; value: string }[] | null;
  variants?: ApiVariant[];
};

/**
 * Loads a saved product into editor state. Products saved before options
 * existed only have color/size on their variants: Colour and Size options
 * are rebuilt from those, with the same ids the server uses for them.
 */
export function hydrateVariantState(p: ApiProductVariants, rules: SkuRules): { state: VariantState; type: ProductType } {
  const apiVariants = p.variants ?? [];
  let options: VariantOption[];

  if (p.variantOptions?.length) {
    options = p.variantOptions.map((o) => {
      const values = o.values ?? [];
      const codes = { ...(o.codes ?? {}) };
      const swatches = { ...(o.swatches ?? {}) };
      const full: VariantOption = {
        id: o.id!,
        name: o.name ?? "Option",
        enabled: o.enabled ?? true,
        values,
        allowNone: !!o.allowNone,
        supportsNone: o.supportsNone ?? true,
        swatch: !!o.swatch,
        codes,
        swatches,
      };
      for (const v of values) {
        if (!codes[v]) codes[v] = makeCode(v, Object.values(codes));
        if (full.swatch && !swatches[v]) swatches[v] = guessSwatch(v, full);
      }
      return full;
    });
  } else {
    const base = initialVariantState().options;
    const [colour, size, measurement] = base;
    for (const v of apiVariants) {
      if (v.color && !canon(colour, v.color)) {
        colour.values.push(v.color);
        colour.codes[v.color] = makeCode(v.color, Object.values(colour.codes));
        colour.swatches[v.color] = guessSwatch(v.color, colour);
      }
      if (v.size && !canon(size, v.size)) {
        size.values.push(v.size);
        size.codes[v.size] = makeCode(v.size, Object.values(size.codes));
      }
    }
    // Old rows without a colour must survive the first save.
    if (apiVariants.some((v) => !v.color)) {
      colour.supportsNone = true;
      colour.allowNone = true;
    }
    size.allowNone = apiVariants.some((v) => !v.size) || size.allowNone;
    options = [colour, size, measurement];
  }

  const colourId = options.find((o) => o.swatch)?.id;
  const sizeId = options.find((o) => o.id === "opt_size")?.id;
  const draft: VariantState = { options, variants: [], singleAttrs: {} };

  draft.variants = apiVariants.map((v) => {
    const sel: Record<string, string> = {};
    if (v.options) Object.assign(sel, v.options);
    else {
      if (colourId) sel[colourId] = v.color || NONE;
      if (sizeId) sel[sizeId] = v.size || NONE;
    }
    for (const o of options) if (!(o.id in sel)) sel[o.id] = NONE;
    const generated = genSku(draft, sel, rules);
    const sku = clean(v.sku ?? "");
    const manual = p.variantOptions ? !!v.manualSku : !!sku && sku !== generated;
    return { key: uid(), dbId: v.id, sel, quantity: clampQty(v.quantity), sku: sku || generated, manual };
  });

  for (const a of p.attributes ?? []) draft.singleAttrs[a.optionId] = a.value;

  const type: ProductType =
    p.productType === "SINGLE" || (!p.variantOptions && apiVariants.length === 0) ? "SINGLE" : "VARIANTS";
  return { state: draft, type };
}

/** The variant part of the create/update payload. */
export function variantPayload(s: VariantState, type: ProductType) {
  const variantOptions = s.options.map((o) => ({
    id: o.id,
    name: o.name,
    enabled: o.enabled,
    values: o.values,
    allowNone: o.allowNone,
    supportsNone: o.supportsNone,
    swatch: o.swatch,
    codes: o.codes,
    swatches: o.swatches,
  }));

  if (type === "SINGLE") {
    return {
      productType: type,
      variantOptions,
      variants: [],
      attributes: s.options
        .map((o) => ({ optionId: o.id, name: o.name, value: clean(s.singleAttrs[o.id] ?? "").slice(0, 40) }))
        .filter((a) => a.value && !isNone(a.value)),
    };
  }

  return {
    productType: type,
    variantOptions,
    variants: s.variants.map((v) => {
      const options: Record<string, string> = {};
      for (const o of s.options) options[o.id] = isNone(v.sel[o.id]) ? NONE : displayValue(o, v.sel[o.id]);
      return { id: v.dbId, options, quantity: clampQty(v.quantity), sku: clean(v.sku), manualSku: v.manual };
    }),
  };
}
