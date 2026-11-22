"use client";

import { Lock } from "lucide-react";

import { RichTextEditor } from "@/components/shared/richTextEditor/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { SkuField } from "@/components/modules/addProduct/SkuField";
import type { SkuFormatConfig } from "@/lib/sku";
import { cn } from "@/lib/utils";

import { STATUS_META, fmtNum, type StockStatus } from "./model";
import { Field, Section, inputClass } from "./ui";

export type BasicInfo = {
  name: string;
  colourName: string;
  /** Digits only (with an optional decimal part); shown grouped. */
  regularPrice: string;
  salePrice: string;
  sku: string;
  shortDescription: string;
  fullDescription: string;
  fitAndSizing: string;
  shippingInfo: string;
  /** Stock of a single product; variants sum their own. */
  singleStock: number;
  lowStockThreshold: number;
  stockStatusAuto: boolean;
  manualStatus: StockStatus;
};

export type FieldErrors = Partial<Record<keyof BasicInfo | "categories" | "images" | "variants", string>>;

export const NAME_INPUT_ID = "pe-name";

/** "1250.5" → "1,250.5"; keeps a trailing dot while typing. */
function groupPrice(raw: string) {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const grouped = int ? Number(int).toLocaleString("en-US") : "0";
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}
function parsePriceInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [int, ...rest] = cleaned.split(".");
  const dec = rest.join("").slice(0, 2);
  return (int.replace(/^0+(?=\d)/, "") || (cleaned.startsWith(".") ? "0" : "")) + (rest.length ? `.${dec}` : "");
}

type Props = {
  data: BasicInfo;
  set: <K extends keyof BasicInfo>(field: K, value: BasicInfo[K]) => void;
  errors: FieldErrors;
  variantsMode: boolean;
  total: number;
  status: StockStatus;
  suggested: StockStatus;
  colourHint: string;
  skuFormat: SkuFormatConfig;
  onSkuFormatChange: (f: SkuFormatConfig) => void;
  skuManual: boolean;
  onSkuManualChange: (m: boolean) => void;
  categoryName?: string;
};

export function BasicInfoSection({
  data,
  set,
  errors,
  variantsMode,
  total,
  status,
  suggested,
  colourHint,
  skuFormat,
  onSkuFormatChange,
  skuManual,
  onSkuManualChange,
  categoryName,
}: Props) {
  const saleError =
    data.salePrice && data.regularPrice && Number(data.salePrice) >= Number(data.regularPrice)
      ? "Sale price must be lower than the regular price."
      : null;

  const pickStatus = (s: StockStatus) => {
    // Choosing what the total already suggests hands control back to auto.
    if (s === suggested) set("stockStatusAuto", true);
    else {
      set("stockStatusAuto", false);
      set("manualStatus", s);
    }
  };

  return (
    <Section title="Basic Information">
      <div className="grid gap-5">
        <Field label="Product Name" htmlFor={NAME_INPUT_ID} required error={errors.name}>
          <input
            id={NAME_INPUT_ID}
            className={inputClass}
            value={data.name}
            maxLength={120}
            placeholder="e.g. Baggy Denim"
            aria-invalid={!!errors.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field label="Color Name" htmlFor="pe-colour" optional aside={data.colourName ? `${data.colourName.length}/40` : undefined} hint={colourHint}>
          <input
            id="pe-colour"
            className={inputClass}
            value={data.colourName}
            maxLength={40}
            placeholder="e.g. Midnight Grey"
            onChange={(e) => set("colourName", e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Regular Price (BDT)" htmlFor="pe-regular" required error={errors.regularPrice}>
            <input
              id="pe-regular"
              inputMode="decimal"
              className={cn(inputClass, "tabular-nums")}
              value={groupPrice(data.regularPrice)}
              placeholder="0"
              aria-invalid={!!errors.regularPrice}
              onChange={(e) => set("regularPrice", parsePriceInput(e.target.value))}
            />
          </Field>
          <Field label="Sale Price (BDT)" htmlFor="pe-sale" error={saleError ?? errors.salePrice} hint="Leave blank when the product isn't on sale.">
            <input
              id="pe-sale"
              inputMode="decimal"
              className={cn(inputClass, "tabular-nums")}
              value={groupPrice(data.salePrice)}
              placeholder="0"
              aria-invalid={!!saleError}
              onChange={(e) => set("salePrice", parsePriceInput(e.target.value))}
            />
          </Field>
        </div>

        <Field
          label="SKU (Main)"
          required
          error={errors.sku}
          hint={variantsMode ? "Variant SKUs are built from this and each variant's options." : undefined}
        >
          <SkuField
            productName={data.name}
            sku={data.sku}
            onSkuChange={(sku) => set("sku", sku)}
            format={skuFormat}
            onFormatChange={onSkuFormatChange}
            isManual={skuManual}
            onIsManualChange={onSkuManualChange}
            categoryName={categoryName}
            onRequestNameFocus={() => document.getElementById(NAME_INPUT_ID)?.focus()}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Stock Status">
            <Select value={status} onValueChange={(v) => v && pickStatus(v as StockStatus)}>
              <SelectTrigger className="h-9! w-full">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
                  <span className="font-medium">{STATUS_META[status].label}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as StockStatus[]).map((s) => (
                  <SelectItem key={s} value={s} label={STATUS_META[s].label}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                      {STATUS_META[s].label}
                      {s === suggested && <span className="text-xs text-muted-foreground">suggested</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {data.stockStatusAuto ? (
                <>
                  <span>Auto-set from total stock · low at ≤</span>
                  <input
                    aria-label="Low stock threshold"
                    inputMode="numeric"
                    className="h-6 w-14 rounded-md border border-input bg-background px-1.5 text-center text-xs tabular-nums outline-none focus-visible:border-ring"
                    value={data.lowStockThreshold}
                    onChange={(e) => set("lowStockThreshold", Math.min(999999, Number(e.target.value.replace(/\D/g, "")) || 0))}
                  />
                  <span>units</span>
                </>
              ) : (
                <>
                  <span>Set by hand. Stock suggests {STATUS_META[suggested].label}.</span>
                  <button type="button" className="cursor-pointer font-medium text-foreground underline-offset-2 hover:underline" onClick={() => set("stockStatusAuto", true)}>
                    Use automatic
                  </button>
                </>
              )}
            </div>
          </Field>

          <Field
            label="Total Stock Quantity"
            htmlFor="pe-stock"
            hint={variantsMode ? "Total of all variants. Edit quantities in the variant table." : "Units you have of this product."}
          >
            <div className="relative">
              <input
                id="pe-stock"
                inputMode="numeric"
                readOnly={variantsMode}
                className={cn(inputClass, "pr-9 tabular-nums")}
                value={variantsMode ? fmtNum(total) : String(data.singleStock)}
                onChange={(e) => set("singleStock", Math.min(999999, Number(e.target.value.replace(/\D/g, "")) || 0))}
              />
              {variantsMode && <Lock aria-hidden="true" className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />}
            </div>
          </Field>
        </div>

        <Field label="Short Description" htmlFor="pe-short" required aside={`${data.shortDescription.length}/160`} error={errors.shortDescription}>
          <textarea
            id="pe-short"
            rows={3}
            maxLength={160}
            className={cn(inputClass, "h-auto resize-y py-2 leading-relaxed")}
            value={data.shortDescription}
            placeholder="One or two lines shown near the top of the product page."
            onChange={(e) => set("shortDescription", e.target.value)}
          />
        </Field>

        <Field label="Full Description" required error={errors.fullDescription}>
          <RichTextEditor value={data.fullDescription} onChange={(html) => set("fullDescription", html)} minHeight={200} />
        </Field>

        <Field label="Fit & Sizing" hint="Shown in the Fit & Sizing tab on the product page.">
          <RichTextEditor
            value={data.fitAndSizing}
            onChange={(html) => set("fitAndSizing", html)}
            minHeight={120}
            placeholder="Write fit and sizing notes, such as the model's height and size, or how it fits…"
          />
        </Field>

        <Field label="Shipping" hint="Shown in the Shipping tab on the product page.">
          <RichTextEditor
            value={data.shippingInfo}
            onChange={(html) => set("shippingInfo", html)}
            minHeight={120}
            placeholder="Write shipping details, such as delivery time, charges and returns…"
          />
        </Field>
      </div>
    </Section>
  );
}
