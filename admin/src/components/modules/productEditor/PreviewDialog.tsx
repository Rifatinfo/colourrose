"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { NONE, STATUS_META, displayValue, enabledOpts, fmtNum, isNone, low, type ProductType, type StockStatus, type VariantState } from "./model";
import { Modal, btn } from "./ui";

type Props = {
  name: string;
  colourName: string;
  regularPrice: number;
  salePrice: number | null;
  mainSku: string;
  type: ProductType;
  state: VariantState;
  status: StockStatus;
  total: number;
  image: string | null;
  payload: unknown;
  onClose: () => void;
};

/**
 * What a shopper will see, driven by the same data the save sends: option
 * pickers only offer values some variant uses, and the colour line follows
 * the storefront's rule (Color Name, else the chosen variant's colour).
 */
export function PreviewDialog(p: Props) {
  const [tab, setTab] = useState<"store" | "data">("store");
  const en = enabledOpts(p.state);
  const colour = en.find((o) => o.swatch);
  const singleColour = p.state.options.find((o) => o.swatch);

  const pickers =
      p.type === "SINGLE"
        ? []
        : en
            .map((o) => {
              const used = new Set(p.state.variants.map((v) => displayValue(o, v.sel[o.id])).filter((v) => v !== NONE));
              return { o, values: o.values.filter((v) => used.has(v)) };
            })
            .filter((x) => x.values.length);

  const [chosen, setChosen] = useState<Record<string, string>>({});
  const variant =
    pickers.length && pickers.every(({ o }) => chosen[o.id])
      ? p.state.variants.find((v) => pickers.every(({ o }) => low(displayValue(o, v.sel[o.id])) === low(chosen[o.id])))
      : undefined;

  const colourLine =
    p.colourName.trim() ||
    (p.type === "SINGLE"
      ? (singleColour && !isNone(p.state.singleAttrs[singleColour.id]) && p.state.singleAttrs[singleColour.id]) || ""
      : colour && variant
        ? displayValue(colour, variant.sel[colour.id]).replace(NONE, "")
        : colour && pickers.find((x) => x.o.id === colour.id)?.values[0]) ||
    "";

  const price = p.salePrice ?? p.regularPrice;

  return (
    <Modal
      wide
      title="Preview"
      description="How the product page shows this product, and the data that will be saved."
      onClose={p.onClose}
      footer={
        <button type="button" className={btn.primary} onClick={p.onClose}>
          Done
        </button>
      }
    >
      <div role="tablist" className="mb-4 inline-flex rounded-lg bg-secondary p-1">
        {(
          [
            ["store", "Storefront"],
            ["data", "Saved data"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium", tab === id ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "store" ? (
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div className="aspect-[4/5] overflow-hidden rounded-lg bg-secondary">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">No thumbnail yet</div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xl font-light leading-tight">{p.name || "Product name"}</h4>
            {colourLine && <p className="mt-1 text-[15px] font-medium">{colourLine}</p>}
            <p className="mt-1 text-xs text-muted-foreground">SKU: {variant?.sku || p.mainSku || "—"}</p>
            <div className="mt-3 flex items-baseline gap-3">
              {p.salePrice != null && <del className="text-sm text-muted-foreground">৳ {fmtNum(p.regularPrice)}</del>}
              <span className="text-lg font-medium">৳ {fmtNum(price)}</span>
            </div>

            {pickers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {pickers.map(({ o, values }) => (
                  <select
                    key={o.id}
                    aria-label={o.name}
                    value={chosen[o.id] ?? ""}
                    onChange={(e) => setChosen((c) => ({ ...c, [o.id]: e.target.value }))}
                    className="h-9 min-w-[120px] rounded-none border border-border bg-background px-2 text-[13px]"
                  >
                    <option value="">{o.name}</option>
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}

            <p className="mt-4 flex items-center gap-2 text-[13px]">
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", STATUS_META[p.status].dot)} />
              {variant ? (variant.quantity > 0 ? `${fmtNum(variant.quantity)} in stock for this choice` : "This choice is sold out") : `${STATUS_META[p.status].label} · ${fmtNum(p.total)} units`}
            </p>
            {p.type === "SINGLE" && p.state.options.some((o) => p.state.singleAttrs[o.id]) && (
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                {p.state.options
                  .filter((o) => p.state.singleAttrs[o.id])
                  .map((o) => (
                    <div key={o.id} className="contents">
                      <dt className="text-muted-foreground">{o.name}</dt>
                      <dd>{p.state.singleAttrs[o.id]}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        </div>
      ) : (
        <pre className="max-h-[50vh] overflow-auto rounded-lg bg-secondary p-3 text-[11px] leading-relaxed">{JSON.stringify(p.payload, null, 2)}</pre>
      )}
    </Modal>
  );
}
