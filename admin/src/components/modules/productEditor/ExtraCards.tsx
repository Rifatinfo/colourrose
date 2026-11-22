"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import type { InfoItem } from "@/components/modules/addProduct/AdditionalInfoSection";
import { cn } from "@/lib/utils";

import { plural, uid } from "./model";
import { Section, btn, inputClass } from "./ui";

/* ===================================================================== tags */

export function TagsCard({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const add = (list: string[]) => {
    const next = [...tags];
    for (const raw of list) {
      const t = raw.replace(/\s+/g, " ").trim().slice(0, 40);
      if (t && !next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    }
    if (next.length !== tags.length) onChange(next);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-[13px] font-semibold">Tags</h2>
      <input
        aria-label="Add a tag"
        value={draft}
        placeholder="Type and press Enter to add..."
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) {
            const parts = v.split(",");
            add(parts.slice(0, -1));
            setDraft(parts[parts.length - 1]);
          } else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add([draft]);
            setDraft("");
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            add([draft]);
            setDraft("");
          }
        }}
        className={cn(inputClass, "mt-3 h-9 text-[13px]")}
      />
      {tags.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <li key={t} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary pl-2.5 pr-1 text-[13px]">
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="grid h-5 w-5 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2.5 text-xs text-muted-foreground">
        {tags.length ? `${plural(tags.length, "tag")}. Press Enter or comma to add more.` : "Keywords that help shoppers find this product."}
      </p>
    </section>
  );
}

/* ====================================================== additional details */

export function AdditionalInfoCard({ items, onChange }: { items: InfoItem[]; onChange: (items: InfoItem[]) => void }) {
  const patch = (id: string, p: Partial<InfoItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));

  return (
    <Section title="Additional Information" description="Extra details such as material or care instructions, shown on the product page.">
      {items.length > 0 && (
        <div className="mb-3 grid gap-2.5">
          {items.map((i) => (
            <div key={i.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2.5">
              <input
                aria-label="Label"
                value={i.label}
                maxLength={60}
                placeholder="Label (e.g. Material)"
                onChange={(e) => patch(i.id, { label: e.target.value })}
                className={cn(inputClass, "h-10")}
              />
              <input
                aria-label="Value"
                value={i.value}
                maxLength={200}
                placeholder="Value (e.g. 100% cotton)"
                onChange={(e) => patch(i.id, { value: e.target.value })}
                className={cn(inputClass, "h-10")}
              />
              <button
                type="button"
                aria-label={`Remove ${i.label || "field"}`}
                onClick={() => onChange(items.filter((x) => x.id !== i.id))}
                className={cn(btn.ghostIcon, "h-10 w-10 rounded-lg border border-border hover:text-rose-600")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange([...items, { id: uid("f"), label: "", value: "" }])}
        className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-[13px] font-medium transition-colors hover:bg-secondary"
      >
        <Plus className="h-4 w-4" />
        Add Custom Field
      </button>
    </Section>
  );
}
