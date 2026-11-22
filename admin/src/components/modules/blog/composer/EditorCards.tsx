"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  Loader2Icon,
  PenLineIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { mediaUrl } from "@/services/blog/blog";
import type { BlogAuthorOption, BlogCategory, BlogStatus, BlogVisibility } from "@/types/blog";
import type { SeoCheck } from "@/utils/seoScore";
import { seoBandColor } from "@/utils/seoScore";
import { cn } from "@/lib/utils";
import { AutoTextarea, Btn, CARD, Field, FIELD, IconBtn, Popover, Segmented, SMALL_FIELD } from "./ui";
import type { Device } from "./PreviewFrame";

/* =========================================================================
   The editor's cards. Presentational: the page (PostEditorTab) owns the
   state and passes values and setters in.
   ========================================================================= */

export const STOREFRONT_HOST = (process.env.NEXT_PUBLIC_STOREFRONT_URL || "https://thewindrise.com")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

export type EditorForm = {
  title: string;
  slug: string;
  slugManual: boolean;
  excerpt: string;
  highlight: string;
  deck: string;
  lead: string;
  featuredImage: string | null;
  thumbnailImage: string | null;
  useFeaturedAsThumbnail: boolean;
  useFeaturedForSocial: boolean;
  status: BlogStatus;
  /** YYYY-MM-DD, or "" to publish the moment Publish is pressed. */
  date: string;
  /** HH:MM, 24-hour. */
  time: string;
  visibility: BlogVisibility;
  /** Typed only to set or change it; never loaded from the server. */
  password: string;
  customAuthor: boolean;
  authorId: string;
  customName: string;
  customRole: string;
  customAvatar: string | null;
  categoryIds: string[];
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  keywords: string;
  canonicalUrl: string;
  isFeatured: boolean;
  allowComments: boolean;
  showAds: boolean;
};

export type Patch = (patch: Partial<EditorForm>) => void;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

function CardHead({ icon, title, description, aside }: { icon: ReactNode; title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600">{icon}</span>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[11.5px] text-slate-500">{description}</p>}
      </div>
      {aside && <div className="ml-auto shrink-0">{aside}</div>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-slate-700">{label}</p>
        {hint && <p className="text-[10.5px] text-slate-400">{hint}</p>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/* ------------------------------ Article setup ----------------------------- */

export function ArticleSetupCard({
  form,
  patch,
  onFocusArea,
  onViewSite,
  viewSiteLabel,
}: {
  form: EditorForm;
  patch: Patch;
  onFocusArea: (area: "head" | "lead") => void;
  onViewSite: () => void;
  viewSiteLabel: string;
}) {
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState(form.slug);

  const commitSlug = () => {
    const next = slugify(slugDraft) || slugify(form.title);
    patch({ slug: next, slugManual: true });
    setSlugDraft(next);
    setEditingSlug(false);
  };

  return (
    <section className={cn(CARD, "p-4")}>
      <CardHead
        icon={<PenLineIcon className="h-4 w-4" />}
        title="Article Setup"
        description="Set up the basics for your story. These details are used across the article, SEO and social sharing."
        aside={
          <button type="button" onClick={onViewSite} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-slate-700 hover:underline">
            {viewSiteLabel}
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div className="grid gap-x-5 gap-y-3.5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3.5">
          <Field label="Post Title" htmlFor="f-title" required count={form.title.length} max={120}>
            <input
              id="f-title"
              value={form.title}
              onFocus={() => onFocusArea("head")}
              onChange={(event) =>
                patch({ title: event.target.value, ...(!form.slugManual && { slug: slugify(event.target.value) }) })
              }
              className={FIELD}
            />
          </Field>
          <Field
            label="Excerpt / Meta Summary"
            htmlFor="f-excerpt"
            required
            count={form.excerpt.length}
            max={160}
            hint="Shown on the stories index and used as the meta description until you write one."
          >
            <AutoTextarea id="f-excerpt" value={form.excerpt} onChange={(event) => patch({ excerpt: event.target.value })} className={FIELD} />
          </Field>
          <Field
            label="Blog Highlight"
            htmlFor="f-highlight"
            count={form.highlight.length}
            max={500}
            hint="Optional. Shown under the introduction; leave it blank and readers see nothing."
          >
            <AutoTextarea
              id="f-highlight"
              value={form.highlight}
              onFocus={() => onFocusArea("lead")}
              onChange={(event) => patch({ highlight: event.target.value })}
              className={FIELD}
            />
          </Field>
          <Field label="Permalink" htmlFor="f-slug">
            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
              <span className="shrink-0 whitespace-nowrap border-r border-slate-200 bg-slate-50 px-2.5 py-2 text-[12.5px] text-slate-500">
                {STOREFRONT_HOST}/blog/
              </span>
              <input
                id="f-slug"
                value={editingSlug ? slugDraft : form.slug}
                readOnly={!editingSlug}
                onChange={(event) => setSlugDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && commitSlug()}
                aria-label="Permalink slug"
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[12.5px] text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (editingSlug) commitSlug();
                  else {
                    setSlugDraft(form.slug);
                    setEditingSlug(true);
                  }
                }}
                className="cursor-pointer px-3 text-[12px] font-medium text-blue-600 hover:underline"
              >
                {editingSlug ? "Done" : "Edit"}
              </button>
            </div>
          </Field>
        </div>
        <div className="flex min-w-0 flex-col gap-3.5">
          <Field label="Editorial Subtitle / Deck" htmlFor="f-deck" count={form.deck.length} max={160}>
            <AutoTextarea
              id="f-deck"
              value={form.deck}
              onFocus={() => onFocusArea("lead")}
              onChange={(event) => patch({ deck: event.target.value })}
              className={FIELD}
            />
          </Field>
          <Field label="Lead / Intro" htmlFor="f-lead" count={form.lead.length} max={500}>
            <AutoTextarea
              id="f-lead"
              value={form.lead}
              onFocus={() => onFocusArea("lead")}
              onChange={(event) => patch({ lead: event.target.value })}
              placeholder="Separate paragraphs with a new line"
              className={cn(FIELD, "min-h-[96px]")}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Featured image ---------------------------- */

export function FeaturedImageCard({
  form,
  patch,
  upload,
  pickFromLibrary,
  preview,
  uploading,
  onFocusArea,
}: {
  form: EditorForm;
  patch: Patch;
  upload: (file: File | null, use: (url: string) => void) => void;
  pickFromLibrary: (use: (url: string) => void) => void;
  preview: (url: string) => void;
  uploading: boolean;
  onFocusArea: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const custom = !form.useFeaturedAsThumbnail;
  const setFeatured = (url: string | null) => patch({ featuredImage: url });

  return (
    <section className={cn(CARD, "p-4")} onFocus={onFocusArea}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          upload(event.target.files?.[0] ?? null, setFeatured);
          event.target.value = "";
        }}
      />
      <div className="grid md:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0 border-slate-100 pb-3.5 md:border-r md:pb-0 md:pr-4">
          <CardHead
            icon={<ImageIcon className="h-4 w-4" />}
            title="Featured Image"
            description="The large editorial image between the introduction and the article body."
          />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="group/feat relative aspect-[2/1] overflow-hidden rounded-lg bg-slate-100">
              {form.featuredImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(form.featuredImage) ?? ""} alt="Featured" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-2 bottom-2 flex translate-y-1 gap-1.5 opacity-0 transition-[opacity,transform] group-focus-within/feat:translate-y-0 group-focus-within/feat:opacity-100 group-hover/feat:translate-y-0 group-hover/feat:opacity-100">
                    {[
                      { label: "Preview", icon: EyeIcon, run: () => preview(form.featuredImage!) },
                      { label: "Change", icon: ImageIcon, run: () => pickFromLibrary(setFeatured) },
                    ].map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.run}
                        className="inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-md bg-white/95 px-2 text-[11.5px] font-semibold text-slate-800"
                      >
                        <action.icon className="h-3.5 w-3.5" />
                        {action.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFeatured(null)}
                      className="ml-auto inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-md bg-white/95 px-2 text-[11.5px] font-semibold text-rose-600"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center content-center gap-1.5 text-[12px] text-slate-400">
                  <ImageIcon className="h-5 w-5" />
                  No featured image
                </div>
              )}
            </div>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload featured image"
              onClick={() => fileInput.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInput.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                upload(event.dataTransfer.files[0] ?? null, setFeatured);
              }}
              className={cn(
                "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-3.5 text-center transition-colors",
                over ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50/60 hover:border-blue-500 hover:bg-blue-50"
              )}
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600">
                {uploading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
              </span>
              <p className="text-[12.5px] text-slate-700">
                {form.featuredImage ? "Click to replace or drop a new image" : "Click to upload or choose an image"}
              </p>
              <small className="text-[11px] leading-[1.4] text-slate-400">Recommended size: 1200×630 or larger.</small>
              <div className="mt-0.5 flex gap-3" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => fileInput.current?.click()} className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline">
                  Upload
                </button>
                <button type="button" onClick={() => pickFromLibrary(setFeatured)} className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline">
                  Choose from library
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Toggle
              label="Use Featured Image as Thumbnail"
              checked={form.useFeaturedAsThumbnail}
              onChange={(value) => patch({ useFeaturedAsThumbnail: value })}
            />
            <Toggle
              label="Use for Social Sharing"
              hint="Off: shares use the site’s default image."
              checked={form.useFeaturedForSocial}
              onChange={(value) => patch({ useFeaturedForSocial: value })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-3.5 md:pl-4 md:pt-0">
          <h3 className="mt-1 text-[13px] font-semibold text-slate-900">Thumbnail Image</h3>
          <label
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-lg border p-2.5",
              !custom ? "border-slate-300" : "border-slate-200"
            )}
          >
            <span className="flex items-center gap-2 text-[12px] font-medium text-slate-800">
              <input type="radio" name="thumb-mode" checked={!custom} onChange={() => patch({ useFeaturedAsThumbnail: true })} className="accent-[#0b0b0b]" />
              Use Featured Image
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[34px] w-[52px] shrink-0 overflow-hidden rounded bg-slate-100">
                {form.featuredImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(form.featuredImage) ?? ""} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <small className="text-[10.5px] leading-[1.35] text-slate-500">
                {form.featuredImage
                  ? "The same image is used on story cards (recommended)."
                  : "No featured image yet. Add one, or use a different thumbnail."}
              </small>
            </span>
          </label>
          <div className={cn("flex flex-col gap-2 rounded-lg border p-2.5", custom ? "border-slate-300" : "border-slate-200")}>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-800">
              <input type="radio" name="thumb-mode" checked={custom} onChange={() => patch({ useFeaturedAsThumbnail: false })} className="accent-[#0b0b0b]" />
              Use a Different Thumbnail
            </label>
            {custom && form.thumbnailImage ? (
              <div className="relative aspect-[16/10] overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(form.thumbnailImage) ?? ""} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                  <button type="button" onClick={() => pickFromLibrary((url) => patch({ thumbnailImage: url }))} className="h-5.5 cursor-pointer rounded bg-white/95 px-1.5 text-[11px] font-semibold">
                    Change
                  </button>
                  <button type="button" onClick={() => patch({ thumbnailImage: null })} className="h-5.5 cursor-pointer rounded bg-white/95 px-1.5 text-[11px] font-semibold">
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border border-dashed border-slate-300 p-2.5 text-center text-[11px] text-slate-400 transition-opacity",
                  !custom && "pointer-events-none opacity-45"
                )}
                aria-disabled={!custom}
              >
                <UploadIcon className="h-4 w-4" />
                <span>
                  Upload different thumbnail
                  <br />
                  (optional)
                </span>
                <span className="flex gap-2.5">
                  <ThumbUpload disabled={!custom} onFile={(file) => upload(file, (url) => patch({ thumbnailImage: url }))} />
                  <button
                    type="button"
                    tabIndex={custom ? 0 : -1}
                    onClick={() => pickFromLibrary((url) => patch({ thumbnailImage: url }))}
                    className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline"
                  >
                    Library
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ThumbUpload({ disabled, onFile }: { disabled: boolean; onFile: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => input.current?.click()}
        className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline"
      >
        Upload
      </button>
    </>
  );
}

/* ------------------------------ SEO metafields ---------------------------- */

export function SeoMetaCard({
  form,
  patch,
  generating,
  onGenerate,
  generated,
}: {
  form: EditorForm;
  patch: Patch;
  generating: boolean;
  onGenerate: () => void;
  /** Bumped after a draft, to flash the fields it filled. */
  generated: number;
}) {
  const title = form.metaTitle.trim() || form.title.trim();
  const description = form.metaDescription.trim() || form.excerpt.trim();
  const fallback = [!form.metaTitle.trim() && title && "post title", !form.metaDescription.trim() && description && "excerpt"]
    .filter(Boolean)
    .join(" and ");
  const flash = generated ? "animate-[wrFilled_1.4s_ease-out]" : "";

  return (
    <section className={cn(CARD, "p-5")}>
      <div className="mb-4 flex items-start gap-2.5">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">SEO Metafields</h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500">Optimize how this post appears in Google and social shares</p>
        </div>
        <span className="ml-auto inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 text-[12px] font-medium text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Yoast-style
        </span>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0b0b0b] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#232323] disabled:cursor-progress disabled:bg-slate-700"
      >
        <SparklesIcon className={cn("h-4 w-4", generating && "animate-spin")} />
        {generating ? "Drafting from your post…" : generated ? "Regenerate Meta Title, Description & Keywords" : "Generate Meta Title, Description & Keywords with AI"}
      </button>
      <p className="mb-4 mt-2 text-[11.5px] leading-[1.55] text-slate-500">
        Runs your draft through the AI model configured on the server. Without one it drafts the fields from your post
        instead. Always review before publishing.
      </p>

      <div className="mb-4 rounded-lg bg-slate-50 px-5 py-4">
        <p className="break-all text-[12.5px] text-emerald-700">
          {STOREFRONT_HOST} › blog › {form.slug || "your-post-slug"}
        </p>
        <p className="my-1 break-words text-[18px] text-blue-700">
          {title ? (title.length > 60 ? `${title.slice(0, 58)}…` : title) : "Your post title"}
        </p>
        <p className="break-words text-[12.5px] text-slate-600">
          {description
            ? description.length > 160
              ? `${description.slice(0, 157)}…`
              : description
            : "Your meta description will appear here once you add one — aim for 120–160 characters that summarize the post."}
        </p>
        {fallback && <p className="mt-2 text-[11px] text-slate-400">Showing the {fallback} until the SEO fields are filled.</p>}
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Meta Title (SEO)" htmlFor="s-mt" count={form.metaTitle.length} max={60}>
          <input
            key={`mt-${generated}`}
            id="s-mt"
            value={form.metaTitle}
            onChange={(event) => patch({ metaTitle: event.target.value })}
            placeholder="AI-generated or manual SEO title"
            className={cn(FIELD, "py-2.5", flash)}
          />
        </Field>
        <Field label="Meta Description (SEO)" htmlFor="s-md" count={form.metaDescription.length} max={160}>
          <AutoTextarea
            key={`md-${generated}`}
            id="s-md"
            value={form.metaDescription}
            onChange={(event) => patch({ metaDescription: event.target.value })}
            placeholder="AI-generated or manual SEO description (optional, defaults to excerpt)"
            className={cn(FIELD, "min-h-[72px] py-2.5", flash)}
          />
        </Field>
        <Field label="Focus Keyword" htmlFor="s-fk">
          <input
            key={`fk-${generated}`}
            id="s-fk"
            value={form.focusKeyword}
            onChange={(event) => patch({ focusKeyword: event.target.value })}
            placeholder="e.g. sustainable fashion Bangladesh"
            className={cn(FIELD, "py-2.5", flash)}
          />
        </Field>
        <Field label="Keywords (comma-separated)" htmlFor="s-kw">
          <input
            key={`kw-${generated}`}
            id="s-kw"
            value={form.keywords}
            onChange={(event) => patch({ keywords: event.target.value })}
            placeholder="e.g. windrise, capsule wardrobe, ethical fashion"
            className={cn(FIELD, "py-2.5", flash)}
          />
        </Field>
        <Field label="Canonical URL" htmlFor="s-can" aside={<span className="text-[11px] text-slate-400">optional</span>}>
          <input
            id="s-can"
            value={form.canonicalUrl}
            onChange={(event) => patch({ canonicalUrl: event.target.value })}
            placeholder={`https://${STOREFRONT_HOST}/blog/${form.slug || "…"}`}
            className={cn(FIELD, "py-2.5")}
          />
        </Field>
      </div>
    </section>
  );
}

/* ------------------------------- Live preview ----------------------------- */

export function PreviewCard({
  device,
  onDevice,
  showHidden,
  onShowHidden,
  onOpenFull,
  children,
}: {
  device: Device;
  onDevice: (device: Device) => void;
  showHidden: boolean;
  onShowHidden: (value: boolean) => void;
  onOpenFull: () => void;
  children: ReactNode;
}) {
  return (
    <section className={cn(CARD, "px-3.5 pb-3.5 pt-3")}>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
          <SparklesIcon className="h-3.5 w-3.5" />
          Live Preview
        </h2>
        <IconBtn label="Open full preview" onClick={onOpenFull}>
          <ExternalLinkIcon className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          label={showHidden ? "Hidden blocks are shown (outlined)" : "Show hidden blocks in preview"}
          active={showHidden}
          onClick={() => onShowHidden(!showHidden)}
        >
          {showHidden ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
        </IconBtn>
        <div className="ml-auto">
          <Segmented
            label="Preview device"
            value={device}
            onChange={onDevice}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "tablet", label: "Tablet" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
        </div>
      </div>
      {children}
    </section>
  );
}

/* --------------------------------- Publish -------------------------------- */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayIso = () => isoDay(new Date());
export const time12 = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};

function Calendar({
  date,
  time,
  onPick,
  onTime,
}: {
  date: string;
  time: string;
  onPick: (date: string) => void;
  onTime: (time: string) => void;
}) {
  const base = date || todayIso();
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1, months: false });
  const today = todayIso();
  const first = new Date(view.y, view.m, 1).getDay();
  const times = useMemo(
    () => Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`),
    []
  );

  const step = (delta: number) =>
    setView((current) => {
      if (current.months) return { ...current, y: current.y + delta };
      let m = current.m + delta;
      let y = current.y;
      if (m < 0) [m, y] = [11, y - 1];
      if (m > 11) [m, y] = [0, y + 1];
      return { ...current, m, y };
    });

  return (
    <div className="w-[262px]">
      <div className="mb-1.5 flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setView((current) => ({ ...current, months: !current.months }))}
          className="mr-auto inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-semibold hover:bg-slate-100"
        >
          {view.months ? view.y : `${MONTHS[view.m]} ${view.y}`}
          <ChevronDownIcon className="h-3 w-3" />
        </button>
        <IconBtn label="Previous" onClick={() => step(-1)}>
          <ChevronLeftIcon className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Next" onClick={() => step(1)}>
          <ChevronRightIcon className="h-4 w-4" />
        </IconBtn>
      </div>
      {view.months ? (
        <div className="grid grid-cols-3 gap-1 py-1">
          {MONTHS.map((month, index) => (
            <button
              key={month}
              type="button"
              onClick={() => setView((current) => ({ ...current, m: index, months: false }))}
              className={cn(
                "h-[38px] cursor-pointer rounded-md text-[12px] hover:bg-slate-100",
                index === view.m && "bg-[#0b0b0b] font-semibold text-white hover:bg-[#0b0b0b]"
              )}
            >
              {month.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <span key={day} className="py-1 text-[10.5px] font-semibold text-slate-500">
              {day}
            </span>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const day = new Date(view.y, view.m, i - first + 1);
            const value = isoDay(day);
            const outside = day.getMonth() !== view.m;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPick(value)}
                aria-label={day.toDateString()}
                aria-pressed={value === date}
                className={cn(
                  "h-8 cursor-pointer rounded-md text-[12px] tabular-nums hover:bg-slate-100",
                  outside && "text-slate-400",
                  value === today && "font-semibold shadow-[inset_0_0_0_1px_#0b0b0b]",
                  value === date && "bg-[#0b0b0b] font-semibold text-white hover:bg-[#0b0b0b]"
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      )}
      <label className="mt-2 flex items-center gap-2.5 text-[12px] font-medium">
        Time
        <select value={time} onChange={(event) => onTime(event.target.value)} className={cn(SMALL_FIELD, "flex-1 cursor-pointer")}>
          {times.map((value) => (
            <option key={value} value={value}>
              {time12(value)}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex justify-between border-t border-slate-100 px-0.5 pt-2">
        <button type="button" onClick={() => onPick("")} className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline">
          Clear
        </button>
        <button type="button" onClick={() => onPick(today)} className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline">
          Today
        </button>
      </div>
    </div>
  );
}

export function PublishCard({
  form,
  patch,
  hasPassword,
  primaryLabel,
  secondaryLabel,
  busy,
  note,
  onPrimary,
  onSecondary,
}: {
  form: EditorForm;
  patch: Patch;
  hasPassword: boolean;
  primaryLabel: string;
  secondaryLabel: string;
  busy: boolean;
  note: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const dateButton = useRef<HTMLButtonElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = todayIso();
  const hint = !form.date
    ? "Uses the moment you press Publish."
    : form.date > today
      ? "Publishes automatically on this date."
      : form.date < today
        ? "Backdated: the story shows this date."
        : "";

  const pickDate = (date: string) => {
    const future = Boolean(date) && new Date(`${date}T${form.time}`) > new Date();
    patch({
      date,
      ...(future && form.status === "DRAFT" && { status: "SCHEDULED" }),
      ...(!future && form.status === "SCHEDULED" && { status: "DRAFT" }),
    });
  };

  return (
    <section className={cn(CARD, "p-3.5")}>
      <h3 className="mb-2.5 text-[13px] font-semibold text-slate-900">Publish</h3>
      <div className="flex flex-col gap-2.5">
        <Field label="Status" htmlFor="p-status">
          <select
            id="p-status"
            value={form.status}
            onChange={(event) => patch({ status: event.target.value as BlogStatus })}
            className={cn(FIELD, "cursor-pointer")}
          >
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
        <Field label="Publication Date" hint={hint || undefined}>
          <button
            ref={dateButton}
            type="button"
            onClick={() => setCalendarOpen((value) => !value)}
            aria-haspopup="dialog"
            className={cn(FIELD, "flex cursor-pointer items-center justify-between gap-2 text-left")}
          >
            <span className={cn(!form.date && "text-slate-500")}>
              {form.date
                ? `${new Date(`${form.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${time12(form.time)}`
                : "Publish immediately"}
            </span>
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-600" />
          </button>
        </Field>
        <Popover anchor={dateButton} open={calendarOpen} onClose={() => setCalendarOpen(false)} label="Publication date">
          <Calendar
            date={form.date}
            time={form.time}
            onPick={(date) => {
              pickDate(date);
              setCalendarOpen(false);
            }}
            onTime={(time) => patch({ time })}
          />
        </Popover>
        <Field label="Visibility" htmlFor="p-vis">
          <select
            id="p-vis"
            value={form.visibility}
            onChange={(event) => patch({ visibility: event.target.value as BlogVisibility })}
            className={cn(FIELD, "cursor-pointer")}
          >
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
            <option value="PASSWORD">Password Protected</option>
          </select>
        </Field>
        {form.visibility === "PASSWORD" && (
          <Field
            label="Password"
            htmlFor="p-pw"
            hint={hasPassword ? "A password is set. Type a new one to change it." : "Readers type this to open the story."}
          >
            <input
              id="p-pw"
              type="text"
              autoComplete="off"
              value={form.password}
              onChange={(event) => patch({ password: event.target.value })}
              placeholder={hasPassword ? "••••••••" : "Set a password for readers"}
              className={FIELD}
            />
          </Field>
        )}
        <div className="mt-1 flex gap-2">
          <Btn className="flex-1" onClick={onSecondary} disabled={busy}>
            {secondaryLabel}
          </Btn>
          <Btn variant="primary" className="flex-1" onClick={onPrimary} disabled={busy}>
            {busy && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
            {primaryLabel}
          </Btn>
        </div>
        <p aria-live="polite" className="min-h-[15px] text-[11px] text-slate-500">
          {note}
        </p>
      </div>
    </section>
  );
}

/* --------------------------------- Author --------------------------------- */

export function AuthorCard({
  form,
  patch,
  authors,
  upload,
  pickFromLibrary,
}: {
  form: EditorForm;
  patch: Patch;
  authors: BlogAuthorOption[];
  upload: (file: File | null, use: (url: string) => void) => void;
  pickFromLibrary: (use: (url: string) => void) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const selected = authors.find((author) => author.id === form.authorId);

  const avatar = (name: string, src: string | null, size: string) => (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#0b0b0b] font-semibold text-white", size)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(src) ?? ""} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name) || <UserIcon className="h-4 w-4" />
      )}
    </span>
  );

  return (
    <section className={cn(CARD, "p-3.5")}>
      <h3 className="mb-2 text-[13px] font-semibold text-slate-900">Author</h3>
      <div className="flex items-start gap-2.5 pb-1">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-slate-900">Use custom author</p>
          <p className="text-[10.5px] text-slate-400">Add a name &amp; photo — no staff account needed</p>
        </div>
        <ToggleSwitch checked={form.customAuthor} onChange={(value) => patch({ customAuthor: value })} label="Use custom author" />
      </div>

      {!form.customAuthor ? (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[12.5px] font-semibold text-slate-800">
            Select Author<span className="ml-0.5 text-rose-500">*</span>
          </p>
          <button
            ref={button}
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:border-slate-300"
          >
            {selected ? (
              <>
                {avatar(selected.name, selected.avatar, "h-[30px] w-[30px] text-[11px]")}
                <span className="min-w-0">
                  <b className="block truncate text-[12px] font-semibold">{selected.name}</b>
                  <small className="text-[11px] text-slate-500">{selected.roleLabel}</small>
                </span>
              </>
            ) : (
              <span className="py-1 text-[12.5px] text-slate-500">Choose an author</span>
            )}
            <ChevronDownIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-500" />
          </button>
          <Popover anchor={button} open={open} onClose={() => setOpen(false)} label="Choose an author" className="w-64">
            <div className="max-h-72 overflow-auto">
              {authors.map((author) => (
                <button
                  key={author.id}
                  type="button"
                  onClick={() => {
                    patch({ authorId: author.id });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-slate-50",
                    author.id === form.authorId && "bg-slate-100"
                  )}
                >
                  {avatar(author.name, author.avatar, "h-6 w-6 text-[10px]")}
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">{author.name}</span>
                    <small className="text-[10.5px] text-slate-400">{author.roleLabel}</small>
                  </span>
                  {author.id === form.authorId && <CheckIcon className="ml-auto h-3.5 w-3.5" />}
                </button>
              ))}
              {!authors.length && <p className="p-2 text-[12px] text-slate-500">No active staff accounts.</p>}
            </div>
          </Popover>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              upload(event.target.files?.[0] ?? null, (url) => patch({ customAvatar: url }));
              event.target.value = "";
            }}
          />
          <div className="flex items-center gap-3">
            <span className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-[15px] font-semibold text-slate-500">
              {form.customAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(form.customAvatar) ?? ""} alt="" className="h-full w-full object-cover" />
              ) : form.customName.trim() ? (
                initials(form.customName)
              ) : (
                <UserIcon className="h-5 w-5" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex gap-3">
                <button type="button" onClick={() => fileInput.current?.click()} className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline">
                  Upload photo
                </button>
                <button
                  type="button"
                  onClick={() => pickFromLibrary((url) => patch({ customAvatar: url }))}
                  className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline"
                >
                  Library
                </button>
              </div>
              {form.customAvatar && (
                <button type="button" onClick={() => patch({ customAvatar: null })} className="cursor-pointer text-left text-[12px] font-medium text-rose-600 hover:underline">
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <Field label="Name" htmlFor="au-name" required>
            <input
              id="au-name"
              value={form.customName}
              onChange={(event) => patch({ customName: event.target.value })}
              placeholder="e.g. Adrita Rahman"
              className={FIELD}
            />
          </Field>
          <Field label="Title / Role" htmlFor="au-role" aside={<span className="text-[11px] text-slate-400">optional</span>}>
            <input
              id="au-role"
              value={form.customRole}
              onChange={(event) => patch({ customRole: event.target.value })}
              placeholder="e.g. Guest Contributor"
              className={FIELD}
            />
          </Field>
        </div>
      )}
    </section>
  );
}

/* ------------------------------- Categories ------------------------------- */

export function TaxonomyCard({
  form,
  patch,
  categories,
  onCreateCategory,
}: {
  form: EditorForm;
  patch: Patch;
  categories: BlogCategory[];
  onCreateCategory: (name: string) => Promise<BlogCategory | null>;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [creating, setCreating] = useState(false);

  const chosen = form.categoryIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is BlogCategory => Boolean(category));
  const q = query.trim().toLowerCase();
  const available = categories.filter((category) => !form.categoryIds.includes(category.id) && category.name.toLowerCase().includes(q));
  const exact = categories.some((category) => category.name.toLowerCase() === q);

  const choose = (id: string) => {
    patch({ categoryIds: [...form.categoryIds, id] });
    setOpen(false);
    setQuery("");
  };

  const create = async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const category = await onCreateCategory(name);
    setCreating(false);
    if (category) choose(category.id);
  };

  const addTag = (raw: string) => {
    const value = raw.trim().replace(/,$/, "").trim();
    if (!value) return;
    if (!form.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) patch({ tags: [...form.tags, value] });
    setTagDraft("");
  };

  const chip = (label: string, onRemove: () => void, key: string, primary?: boolean) => (
    <span key={key} className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-2 text-[11.5px] text-slate-700">
      {label}
      {primary && <span className="text-[10px] text-slate-400">· primary</span>}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="grid cursor-pointer place-items-center text-slate-400 hover:text-slate-900">
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );

  return (
    <section className={cn(CARD, "p-3.5")}>
      <h3 className="mb-2 text-[13px] font-semibold text-slate-900">Categories</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {!chosen.length && <span className="text-[11px] text-slate-500">No categories yet. Add one below or under Categories &amp; Tags.</span>}
        {chosen.map((category, index) =>
          chip(category.name, () => patch({ categoryIds: form.categoryIds.filter((id) => id !== category.id) }), category.id, index === 0 && chosen.length > 1)
        )}
      </div>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-2 inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2 text-[11.5px] text-slate-700 hover:border-slate-400"
      >
        <PlusIcon className="h-3 w-3" />
        Add Category
      </button>
      <Popover anchor={button} open={open} onClose={() => setOpen(false)} label="Add a category" className="w-60">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (available[0]) choose(available[0].id);
            else if (!exact) void create();
          }}
          placeholder="Search or create category"
          aria-label="Search or create a category"
          className={cn(SMALL_FIELD, "mb-1.5")}
        />
        <div className="max-h-60 overflow-auto">
          {available.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => choose(category.id)}
              className="block w-full cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
            >
              {category.name}
            </button>
          ))}
          {q && !exact && (
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
            >
              {creating ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <PlusIcon className="h-3.5 w-3.5" />}
              Create “{query.trim()}”
            </button>
          )}
          {!available.length && !q && <p className="px-2 py-1.5 text-[12px] text-slate-500">Every category is already added.</p>}
        </div>
      </Popover>

      <span className="mb-1.5 mt-3 block text-[12px] font-semibold text-slate-800">Tags</span>
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 p-1.5 focus-within:border-slate-400"
        onClick={(event) => (event.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
      >
        {form.tags.map((tag) => chip(tag, () => patch({ tags: form.tags.filter((entry) => entry !== tag) }), tag))}
        <input
          value={tagDraft}
          onChange={(event) => {
            if (event.target.value.endsWith(",")) addTag(event.target.value);
            else setTagDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag(tagDraft);
            }
            if (event.key === "Backspace" && !tagDraft && form.tags.length) patch({ tags: form.tags.slice(0, -1) });
          }}
          onBlur={() => addTag(tagDraft)}
          placeholder="+ Add Tag"
          aria-label="Add a tag"
          className="h-6 min-w-[70px] flex-1 bg-transparent text-[12px] outline-none placeholder:text-slate-400"
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-[1.45] text-slate-500">
        Press <b className="font-semibold text-slate-700">Enter</b> or <b className="font-semibold text-slate-700">,</b> to add a tag.
        Backspace on an empty field removes the last one.
      </p>
    </section>
  );
}

/* -------------------------------- SEO score ------------------------------- */

export function SeoScoreCard({ score, checks }: { score: number; checks: SeoCheck[] }) {
  const color = seoBandColor(score);
  const circumference = 2 * Math.PI * 21;
  return (
    <section className={cn(CARD, "p-3.5")}>
      <h3 className="mb-2.5 text-[13px] font-semibold text-slate-900">SEO Score</h3>
      <div className="mb-3 flex items-center gap-3">
        <svg viewBox="0 0 50 50" className="h-[50px] w-[50px] shrink-0" aria-hidden="true">
          <circle cx="25" cy="25" r="21" fill="none" stroke="#EDF0F3" strokeWidth="5" />
          <circle
            cx="25"
            cy="25"
            r="21"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
            transform="rotate(-90 25 25)"
            style={{ transition: "stroke-dashoffset 500ms ease, stroke 300ms" }}
          />
        </svg>
        <div>
          <b className="text-[20px] font-semibold tabular-nums tracking-[-0.02em]">
            {score}
            <small className="text-[11px] font-medium text-slate-500">/100</small>
          </b>
          <p className="text-[11.5px] font-medium" style={{ color }}>
            {score >= 80 ? "Good SEO score" : score >= 55 ? "Needs a little work" : "Needs work"}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-1.5 text-[11.5px] leading-[1.35] text-slate-700">
            {check.passed ? (
              <span className="mt-px grid h-[15px] w-[15px] shrink-0 place-items-center rounded bg-emerald-600 text-white">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
            ) : (
              <span className="mt-px grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                !
              </span>
            )}
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Post settings ----------------------------- */

export function SettingsCard({ form, patch }: { form: EditorForm; patch: Patch }) {
  return (
    <section className={cn(CARD, "p-3.5")}>
      <h3 className="mb-1.5 text-[13px] font-semibold text-slate-900">Post Settings</h3>
      <Toggle label="Featured post" checked={form.isFeatured} onChange={(value) => patch({ isFeatured: value })} />
      <Toggle label="Allow comments" checked={form.allowComments} onChange={(value) => patch({ allowComments: value })} />
      <Toggle
        label="Show ads in this post"
        hint="Uses your active Ads placements"
        checked={form.showAds}
        onChange={(value) => patch({ showAds: value })}
      />
    </section>
  );
}
