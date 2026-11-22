"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  BoldIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { RichTextEditor } from "@/components/shared/richTextEditor/RichTextEditor";
import { mediaUrl, searchStoryProducts } from "@/services/blog/blog";
import type { StoryPickerCollection, StoryPickerProduct } from "@/types/blog";
import { cn } from "@/lib/utils";
import {
  ADJUST,
  BLOCKS,
  type Block,
  type BlockData,
  type BlockType,
  NEVER_COLLAPSE,
  TURN_INTO,
  blockSummary,
  isCustomStyled,
  splitIntoParagraphs,
  taka,
  textToParagraphs,
  videoSource,
} from "./blocks";
import { AutoTextarea, IconBtn, Popover, Segmented, SMALL_FIELD } from "./ui";

/* =========================================================================
   One block in the composer: its handle, type, editor, actions and the
   optional "Adjust" overrides. Every change goes up through `onChange`, which
   the composer turns into state and undo history.
   ========================================================================= */

export type ChangeMode = "typing" | "commit";

export type BlockCardProps = {
  block: Block;
  /** Applies a change; "typing" coalesces keystrokes into one undo step. */
  onChange: (id: string, next: Block, mode: ChangeMode) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, step: -1 | 1) => void;
  onTurnInto: (id: string, type: BlockType) => void;
  onSplit: (id: string) => void;
  onFocusBlock: (id: string) => void;
  /** Opens the media library; resolves with the picked URL(s). */
  pickImages: (multiple: boolean, use: (urls: string[]) => void) => void;
  uploadImage: (use: (url: string) => void) => void;
  previewImage: (url: string, caption?: string) => void;
  /** Names for collapsed summaries and chips. */
  products: Record<string, StoryPickerProduct>;
  rememberProducts: (list: StoryPickerProduct[]) => void;
  collections: StoryPickerCollection[];
  notify: (message: string, action?: { label: string; run: () => void }) => void;
  /** Drag and drop, handled by the composer. */
  dragProps: {
    draggable: boolean;
    onGripPointerDown: () => void;
    className?: string;
  };
};

const set = <T extends BlockType>(block: Block<T>, patch: Partial<BlockData[T]>): Block<T> =>
  ({ ...block, data: { ...block.data, ...patch } }) as Block<T>;

/* ------------------------------ Inline rich text --------------------------- */

/**
 * The Text block's editor: paragraphs with bold, italic, links and lists.
 * Uncontrolled while focused (so the caret never jumps), re-synced from the
 * block when it changes from outside — an undo, a template, a split.
 */
function InlineRichText({
  html,
  placeholder,
  onInput,
  onPasteParagraphs,
}: {
  html: string;
  placeholder: string;
  onInput: (html: string) => void;
  onPasteParagraphs: (count: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const linkButton = useRef<HTMLButtonElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [empty, setEmpty] = useState(!html.replace(/<[^>]+>/g, "").trim());

  // Not rendered through React: React would rewrite the content on every
  // keystroke and throw the caret to the start. Set once, then re-synced
  // only for changes that come from outside the editor.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== html && document.activeElement !== el) {
      el.innerHTML = html;
      setEmpty(!el.textContent?.trim() && !el.querySelector("li"));
    }
  }, [html]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    setEmpty(!el.textContent?.trim() && !el.querySelector("li"));
    onInput(el.innerHTML);
  };

  const run = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const tools: { icon: typeof BoldIcon; label: string; command: string }[] = [
    { icon: BoldIcon, label: "Bold", command: "bold" },
    { icon: ItalicIcon, label: "Italic", command: "italic" },
    { icon: ListIcon, label: "Bulleted list", command: "insertUnorderedList" },
    { icon: ListOrderedIcon, label: "Numbered list", command: "insertOrderedList" },
  ];

  return (
    <div className="group/rt">
      <div className="mb-1.5 hidden items-center gap-1 group-focus-within/blk:flex">
        {tools.slice(0, 2).map((tool) => (
          <button
            key={tool.command}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(tool.command)}
            className="grid h-6 w-6.5 cursor-pointer place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <tool.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <button
          ref={linkButton}
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(event) => {
            event.preventDefault();
            const selection = window.getSelection();
            savedRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
          }}
          onClick={() => setLinkOpen(true)}
          className="grid h-6 w-6.5 cursor-pointer place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        {tools.slice(2).map((tool) => (
          <button
            key={tool.command}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(tool.command)}
            className="grid h-6 w-6.5 cursor-pointer place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <tool.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="ml-1.5 text-[11px] text-slate-400">Paste text — Windrise styling is applied automatically</span>
      </div>

      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-1.5 top-[3px] text-[13px] text-slate-400">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Text"
          onInput={emit}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            const html = textToParagraphs(text) || text;
            document.execCommand("insertHTML", false, html);
            emit();
            const count = splitIntoParagraphs(text).length;
            if (count >= 3) onPasteParagraphs(count);
          }}
          className="wr-rt -mx-1.5 min-h-[24px] rounded-md border border-transparent px-1.5 py-0.5 text-[13px] leading-[1.6] text-slate-700 outline-none transition-colors hover:border-slate-100 focus:border-slate-300 [&_a]:text-blue-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>

      <Popover anchor={linkButton} open={linkOpen} onClose={() => setLinkOpen(false)} label="Insert link" className="w-72">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setLinkOpen(false);
            const url = linkUrl.trim();
            if (!url) return;
            ref.current?.focus();
            if (savedRange.current) {
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(savedRange.current);
            }
            document.execCommand("createLink", false, url);
            emit();
            setLinkUrl("");
          }}
        >
          <label className="mb-1 block text-[11.5px] font-medium text-slate-700" htmlFor="rt-link">
            Link address
          </label>
          <input
            id="rt-link"
            autoFocus
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="/collections/… or https://…"
            className={SMALL_FIELD}
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" className="h-7 cursor-pointer rounded-md bg-[#0b0b0b] px-3 text-[12px] font-medium text-white">
              Insert link
            </button>
          </div>
        </form>
      </Popover>
    </div>
  );
}

/* --------------------------------- Pieces --------------------------------- */

const plain =
  "-mx-1.5 block w-[calc(100%+12px)] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] leading-[1.55] text-slate-700 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-100 focus:border-slate-300 focus:bg-white";

function Select({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(SMALL_FIELD, "cursor-pointer pr-7", className)}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-600", className)}>
      {label}
      {children}
    </label>
  );
}

function LinkBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"
    >
      {children}
    </button>
  );
}

/** Thumbnail button for an image field. */
function Thumb({ src, onClick, label, overlay }: { src: string; onClick: () => void; label: string; overlay: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group/th relative grid h-[62px] w-28 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md bg-slate-100 text-slate-400"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(src) ?? ""} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-5 w-5" />
      )}
      <span className="absolute inset-0 grid place-items-center bg-slate-950/55 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover/th:opacity-100">
        {overlay}
      </span>
    </button>
  );
}

/* ------------------------------ Product picker ----------------------------- */

function ProductPicker({
  exclude,
  onAdd,
  rememberProducts,
}: {
  exclude: string[];
  onAdd: (product: StoryPickerProduct) => void;
  rememberProducts: (list: StoryPickerProduct[]) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StoryPickerProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchStoryProducts({ q: term.trim() });
        if (cancelled) return;
        setResults(res.data);
        rememberProducts(res.data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, term, rememberProducts]);

  const shown = results.filter((product) => !exclude.includes(product.id));

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add product
      </button>
      <Popover anchor={button} open={open} onClose={() => setOpen(false)} label="Add a product" className="w-80">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name or SKU"
            aria-label="Search products"
            className={cn(SMALL_FIELD, "pl-7")}
          />
        </label>
        <div className="mt-2 max-h-72 overflow-auto">
          {loading && !shown.length && <p className="px-2 py-3 text-[12px] text-slate-400">Searching…</p>}
          {!loading && !shown.length && (
            <p className="px-2 py-3 text-[12px] text-slate-500">{term ? "No products match." : "No products yet."}</p>
          )}
          {shown.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onAdd(product);
                setOpen(false);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-slate-100">
                {product.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(product.image) ?? ""} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-slate-900">{product.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {taka(product.salePrice ?? product.price)}
                  {!product.isActive && " · Hidden from the shop"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

/* ------------------------------ Type editors ------------------------------ */

function Editor(props: BlockCardProps) {
  const { block, onChange } = props;
  const typing = (next: Block) => onChange(block.id, next, "typing");
  const commit = (next: Block) => onChange(block.id, next, "commit");

  switch (block.type) {
    case "text":
      return (
        <InlineRichText
          html={block.data.html}
          placeholder={block.ph || "Type or paste paragraphs…"}
          onInput={(html) => typing(set(block, { html }))}
          onPasteParagraphs={(count) =>
            props.notify(`Pasted ${count} paragraphs`, { label: "Split into blocks", run: () => props.onSplit(block.id) })
          }
        />
      );

    case "heading":
    case "subheading":
      return (
        <input
          value={block.data.text}
          onChange={(event) => typing(set(block, { text: event.target.value }))}
          placeholder={block.ph || (block.type === "heading" ? "Section heading" : "Subheading")}
          aria-label={BLOCKS[block.type].label}
          className={cn(plain, block.type === "heading" ? "text-[13.5px] font-semibold text-slate-900" : "font-semibold")}
        />
      );

    case "pull":
      return (
        <div>
          <AutoTextarea
            value={block.data.text}
            onChange={(event) => typing(set(block, { text: event.target.value }))}
            placeholder={block.ph || "Paste or type the quotation…"}
            aria-label="Quotation"
            className={plain}
          />
          <input
            value={block.data.cite}
            onChange={(event) => typing(set(block, { cite: event.target.value }))}
            placeholder="— Attribution (optional)"
            aria-label="Attribution"
            className={cn(plain, "mt-1 text-[12px] text-slate-500")}
          />
        </div>
      );

    case "image": {
      const d = block.data;
      return (
        <div className="grid gap-3 md:grid-cols-[112px_minmax(0,1fr)_150px] md:items-start">
          <Thumb
            src={d.img}
            label={d.img ? "Change image" : "Choose an image"}
            overlay="Change"
            onClick={() => props.pickImages(false, ([url]) => commit(set(block, { img: url })))}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <input
              value={d.alt}
              onChange={(event) => typing(set(block, { alt: event.target.value }))}
              placeholder="Alt text — describe the image"
              aria-label="Alt text"
              className={SMALL_FIELD}
            />
            <input
              value={d.cap}
              onChange={(event) => typing(set(block, { cap: event.target.value }))}
              placeholder="Caption (optional)"
              aria-label="Caption"
              className={SMALL_FIELD}
            />
            <div className="flex flex-wrap gap-3">
              <LinkBtn onClick={() => props.uploadImage((url) => commit(set(block, { img: url })))}>
                <UploadIcon className="h-3.5 w-3.5" />
                Upload
              </LinkBtn>
              <LinkBtn onClick={() => props.pickImages(false, ([url]) => commit(set(block, { img: url })))}>
                <ImageIcon className="h-3.5 w-3.5" />
                Media Library
              </LinkBtn>
              {d.img && (
                <LinkBtn onClick={() => props.previewImage(d.img, d.cap)}>
                  <EyeIcon className="h-3.5 w-3.5" />
                  Preview
                </LinkBtn>
              )}
            </div>
          </div>
          <Labeled label="Display Style">
            <Select
              label="Display style"
              value={d.disp}
              options={["Standard", "Wide", "Full Width"]}
              onChange={(disp) => commit(set(block, { disp: disp as BlockData["image"]["disp"] }))}
            />
            <span className="font-normal text-slate-400">
              {{ Standard: "Article column", Wide: "Container width", "Full Width": "Edge to edge" }[d.disp]}
            </span>
          </Labeled>
        </div>
      );
    }

    case "gallery": {
      const d = block.data;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {d.imgs.map((img, index) => (
              <div key={`${img}-${index}`} className="group/g relative h-[62px] w-[62px] overflow-hidden rounded-md bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(img) ?? ""} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => commit(set(block, { imgs: d.imgs.filter((_, i) => i !== index) }))}
                  className="absolute right-1 top-1 grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full bg-white/95 text-slate-700 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/g:opacity-100"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              aria-label="Add images"
              onClick={() => props.pickImages(true, (urls) => commit(set(block, { imgs: [...d.imgs, ...urls] })))}
              className="grid h-[62px] w-[62px] cursor-pointer place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-blue-500 hover:text-blue-600"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-end">
            <Labeled label="Layout">
              <Select
                label="Gallery layout"
                value={d.layout}
                options={["Grid", "Two Column", "Mosaic"]}
                onChange={(layout) => commit(set(block, { layout: layout as BlockData["gallery"]["layout"] }))}
              />
            </Labeled>
            <input
              value={d.cap}
              onChange={(event) => typing(set(block, { cap: event.target.value }))}
              placeholder="Gallery caption (optional)"
              aria-label="Gallery caption"
              className={SMALL_FIELD}
            />
          </div>
        </div>
      );
    }

    case "video": {
      const d = block.data;
      const source = videoSource(d.url);
      return (
        <div className="grid gap-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-start">
          <Thumb
            src={d.poster}
            label="Choose a poster image"
            overlay="Poster"
            onClick={() => props.pickImages(false, ([url]) => commit(set(block, { poster: url })))}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <input
              value={d.url}
              onChange={(event) => typing(set(block, { url: event.target.value }))}
              placeholder="Paste a YouTube or Vimeo link"
              aria-label="Video link"
              className={SMALL_FIELD}
            />
            <input
              value={d.cap}
              onChange={(event) => typing(set(block, { cap: event.target.value }))}
              placeholder="Caption (optional)"
              aria-label="Caption"
              className={SMALL_FIELD}
            />
            <p className="text-[11.5px] text-slate-500">
              {source.kind === "youtube" || source.kind === "vimeo" ? (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-blue-700">
                  {source.kind === "youtube" ? "YouTube" : "Vimeo"} link recognised
                </span>
              ) : d.url ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                  Video file
                </span>
              ) : (
                "The poster shows until the reader presses play."
              )}
              {d.poster && (
                <button
                  type="button"
                  onClick={() => commit(set(block, { poster: "" }))}
                  className="ml-2 cursor-pointer text-[11.5px] text-rose-600 hover:underline"
                >
                  Remove poster
                </button>
              )}
            </p>
          </div>
        </div>
      );
    }

    case "highlight":
      return (
        <div>
          <input
            value={block.data.label}
            onChange={(event) => typing(set(block, { label: event.target.value }))}
            placeholder="Label"
            aria-label="Highlight label"
            className={cn(plain, "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500")}
          />
          <AutoTextarea
            value={block.data.text}
            onChange={(event) => typing(set(block, { text: event.target.value }))}
            placeholder={block.ph || "The one thing readers should remember…"}
            aria-label="Highlight text"
            className={cn(plain, "mt-0.5")}
          />
        </div>
      );

    case "product": {
      const d = block.data;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Product source"
              value={d.mode}
              onChange={(mode) => commit(set(block, { mode }))}
              options={[
                { value: "products", label: "Products" },
                { value: "collection", label: "Collection" },
              ]}
            />
            <label className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              Layout
              <Select
                label="Product layout"
                value={d.layout}
                options={["Grid", "Single feature"]}
                onChange={(layout) => commit(set(block, { layout: layout as BlockData["product"]["layout"] }))}
                className="w-auto"
              />
            </label>
          </div>
          {d.mode === "collection" ? (
            <select
              aria-label="Collection"
              value={d.coll}
              onChange={(event) => commit(set(block, { coll: event.target.value }))}
              className={cn(SMALL_FIELD, "cursor-pointer")}
            >
              <option value="">Choose a collection…</option>
              {props.collections.map((collection) => (
                <option key={collection.slug} value={collection.slug}>
                  {collection.parent ? `${collection.parent} › ` : ""}
                  {collection.title} · {collection.products.length ? `${collection.products.length}+ items` : "no items yet"}
                  {collection.showInMenu ? "" : " (hidden)"}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {d.items.map((id) => {
                const product = props.products[id];
                return (
                  <span
                    key={id}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white pl-0.5 pr-1.5 text-[11.5px]"
                  >
                    <span className="h-[22px] w-[22px] overflow-hidden rounded bg-slate-100">
                      {product?.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(product.image) ?? ""} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <b className="max-w-40 truncate font-medium">{product?.name ?? "Unavailable product"}</b>
                    {product && <span className="text-slate-500">{taka(product.salePrice ?? product.price)}</span>}
                    <button
                      type="button"
                      aria-label={`Remove ${product?.name ?? "product"}`}
                      onClick={() => commit(set(block, { items: d.items.filter((item) => item !== id) }))}
                      className="grid cursor-pointer place-items-center text-slate-400 hover:text-slate-800"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              <ProductPicker
                exclude={d.items}
                rememberProducts={props.rememberProducts}
                onAdd={(product) => commit(set(block, { items: [...d.items, product.id] }))}
              />
            </div>
          )}
        </div>
      );
    }

    case "cta": {
      const d = block.data;
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-start">
          <div className="flex min-w-0 flex-col gap-1">
            <input
              value={d.title}
              onChange={(event) => typing(set(block, { title: event.target.value }))}
              placeholder="CTA headline"
              aria-label="CTA headline"
              className={cn(plain, "font-semibold text-slate-900")}
            />
            <input
              value={d.desc}
              onChange={(event) => typing(set(block, { desc: event.target.value }))}
              placeholder="Supporting line (optional)"
              aria-label="Supporting line"
              className={plain}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              value={d.btn}
              onChange={(event) => typing(set(block, { btn: event.target.value }))}
              aria-label="Button label"
              className="h-8 w-full rounded-md border-0 bg-[#0b0b0b] px-2 text-center text-[12px] font-semibold text-white outline-none focus:ring-3 focus:ring-slate-900/15"
            />
            <input
              value={d.link}
              onChange={(event) => typing(set(block, { link: event.target.value }))}
              placeholder="/collections/…"
              aria-label="Button link"
              className={SMALL_FIELD}
            />
          </div>
        </div>
      );
    }

    case "divider":
      return (
        <div className="flex items-center gap-3.5">
          <Select
            label="Divider style"
            value={block.data.style}
            options={["Line", "Short Rule", "Dots"]}
            onChange={(style) => commit(set(block, { style: style as BlockData["divider"]["style"] }))}
            className="w-32"
          />
          <div className="grid min-w-0 flex-1 place-items-center text-slate-400" aria-hidden="true">
            {block.data.style === "Dots" ? (
              "• • •"
            ) : (
              <span className={block.data.style === "Short Rule" ? "block h-0.5 w-12 bg-slate-900" : "block h-px w-full bg-slate-200"} />
            )}
          </div>
        </div>
      );

    case "spacer":
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={8}
            max={160}
            step={4}
            value={block.data.h}
            aria-label="Spacer height"
            onChange={(event) => typing(set(block, { h: Number(event.target.value) }))}
            className="min-w-0 flex-1 accent-[#0b0b0b]"
          />
          <output className="w-12 text-right text-[11.5px] tabular-nums text-slate-500">{block.data.h}px</output>
        </div>
      );

    case "advanced":
      return (
        <RichTextEditor
          variant="full"
          value={block.data.html}
          onChange={(html) => typing(set(block, { html }))}
          minHeight={160}
          placeholder="Write or build a custom section…"
        />
      );
  }
}

/* ---------------------------------- Adjust --------------------------------- */

function Adjust({ block, onChange }: { block: Block; onChange: BlockCardProps["onChange"] }) {
  const [open, setOpen] = useState(false);
  const fields = ADJUST[block.type];
  if (!fields) return null;
  const custom = isCustomStyled(block);

  return (
    <div className="mx-2.5 border-t border-dashed border-slate-200 py-2 md:ml-[38px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex cursor-pointer items-center gap-1.5 py-0.5 text-left text-[11.5px] text-slate-600"
      >
        <ChevronRightIcon className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        <b className="font-semibold text-slate-900">Adjust</b>
        <span className="text-slate-500">
          {custom
            ? "(Manual overrides active for this block only)"
            : "(Optional · Default Windrise style will be used if not changed)"}
        </span>
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-end gap-2.5 pb-0.5 pt-2">
            {fields.map((field) => {
              const value = block.adj[field.key] || field.options[0];
              const changed = value !== field.options[0];
              return (
                <Labeled key={field.key} label={field.label} className="w-[118px]">
                  <select
                    value={value}
                    aria-label={field.label}
                    onChange={(event) => {
                      const adj = { ...block.adj };
                      if (event.target.value === field.options[0]) delete adj[field.key];
                      else adj[field.key] = event.target.value;
                      onChange(block.id, { ...block, adj } as Block, "commit");
                    }}
                    className={cn(SMALL_FIELD, "cursor-pointer", changed && "border-blue-300 bg-blue-50 text-blue-700")}
                  >
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Labeled>
              );
            })}
            <button
              type="button"
              disabled={!custom}
              onClick={() => onChange(block.id, { ...block, adj: {} } as Block, "commit")}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-900 bg-white px-2.5 text-[12px] font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-400"
            >
              <RotateCcwIcon className="h-3.5 w-3.5" />
              Reset to Windrise Style
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Card ---------------------------------- */

function BlockCardImpl(props: BlockCardProps) {
  const { block, onChange } = props;
  const meta = BLOCKS[block.type];
  const Icon = meta.icon;
  const turnButton = useRef<HTMLButtonElement>(null);
  const [turnOpen, setTurnOpen] = useState(false);
  const canCollapse = !NEVER_COLLAPSE.has(block.type);
  const custom = isCustomStyled(block);
  const summary = blockSummary(block, {
    product: (id) => props.products[id]?.name ?? "Product",
    collection: (slug) => props.collections.find((c) => c.slug === slug)?.title ?? slug,
  });

  const typeLabel = (
    <>
      <Icon className="h-[15px] w-[15px] shrink-0" />
      <span className="truncate">{meta.label}</span>
    </>
  );

  return (
    <div
      data-id={block.id}
      draggable={props.dragProps.draggable}
      onFocus={() => props.onFocusBlock(block.id)}
      className={cn(
        "group/blk rounded-[9px] border bg-white transition-[box-shadow,border-color,opacity] focus-within:border-slate-300 focus-within:shadow-[0_0_0_3px_rgba(15,23,42,0.04)]",
        block.hidden ? "border-dashed border-slate-300 bg-slate-50/60" : "border-slate-200",
        props.dragProps.className
      )}
    >
      <div className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2.5 py-2.5 pl-1.5 pr-2 md:grid-cols-[22px_136px_minmax(0,1fr)_auto]">
        <button
          type="button"
          aria-label={`Move ${meta.label} block. Drag, or press the up and down arrow keys.`}
          onPointerDown={props.dragProps.onGripPointerDown}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              props.onMove(block.id, event.key === "ArrowUp" ? -1 : 1);
            }
          }}
          className="grid h-[26px] w-[22px] cursor-grab place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
        >
          <GripVerticalIcon className="h-[15px] w-[15px]" />
        </button>

        <div className="flex min-w-0 flex-col items-start gap-1">
          {meta.textLike ? (
            <button
              ref={turnButton}
              type="button"
              title="Change block type"
              onClick={() => setTurnOpen((value) => !value)}
              className="-ml-1.5 inline-flex min-h-[26px] max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-[12px] font-semibold text-slate-900 hover:bg-slate-100"
            >
              {typeLabel}
              <ChevronDownIcon className="h-3 w-3 shrink-0 text-slate-400" />
            </button>
          ) : (
            <span className="inline-flex min-h-[26px] max-w-full items-center gap-1.5 text-[12px] font-semibold text-slate-900">
              {typeLabel}
            </span>
          )}
          {(block.hidden || custom) && (
            <div className="flex flex-wrap gap-1 pl-[22px]">
              {block.hidden && (
                <span className="rounded bg-slate-100 px-1.5 text-[10.5px] font-semibold leading-[18px] text-slate-500">Hidden</span>
              )}
              {custom && (
                <span className="rounded bg-blue-50 px-1.5 text-[10.5px] font-semibold leading-[18px] text-blue-700">Custom style</span>
              )}
            </div>
          )}
        </div>

        <div className={cn("col-span-3 min-w-0 pl-1 pt-0.5 md:col-span-1 md:pl-0", block.hidden && "opacity-55", "order-last md:order-none")}>
          {block.collapsed ? (
            <button
              type="button"
              onClick={() => onChange(block.id, { ...block, collapsed: false } as Block, "commit")}
              title="Expand"
              className="block w-full cursor-pointer truncate pt-0.5 text-left text-[13px] text-slate-600"
            >
              {summary || <i className="text-slate-400">Empty — click to edit</i>}
            </button>
          ) : (
            <Editor {...props} />
          )}
        </div>

        <div className="flex gap-px">
          {canCollapse && (
            <IconBtn
              label={block.collapsed ? "Expand" : "Collapse"}
              onClick={() => onChange(block.id, { ...block, collapsed: !block.collapsed } as Block, "commit")}
            >
              {block.collapsed ? <ChevronRightIcon className="h-[15px] w-[15px]" /> : <ChevronDownIcon className="h-[15px] w-[15px]" />}
            </IconBtn>
          )}
          <IconBtn label="Duplicate" onClick={() => props.onDuplicate(block.id)}>
            <CopyIcon className="h-[15px] w-[15px]" />
          </IconBtn>
          <IconBtn
            label={block.hidden ? "Show block" : "Hide block"}
            onClick={() => {
              onChange(block.id, { ...block, hidden: !block.hidden } as Block, "commit");
              props.notify(block.hidden ? "Block visible again" : "Block hidden from the article");
            }}
          >
            {block.hidden ? <EyeOffIcon className="h-[15px] w-[15px]" /> : <EyeIcon className="h-[15px] w-[15px]" />}
          </IconBtn>
          <IconBtn label="Delete" danger onClick={() => props.onRemove(block.id)}>
            <Trash2Icon className="h-[15px] w-[15px]" />
          </IconBtn>
        </div>
      </div>

      {!block.collapsed && <Adjust block={block} onChange={onChange} />}

      <Popover anchor={turnButton} open={turnOpen} onClose={() => setTurnOpen(false)} label="Turn into" className="w-64">
        <p className="mb-1.5 ml-1 text-[11.5px] font-semibold text-slate-800">Turn into</p>
        {TURN_INTO.map((type) => {
          const TypeIcon = BLOCKS[type].icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setTurnOpen(false);
                if (type !== block.type) props.onTurnInto(block.id, type);
              }}
              className={cn(
                "flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50",
                type === block.type && "bg-slate-100 text-slate-900"
              )}
            >
              <TypeIcon className="mt-0.5 h-[15px] w-[15px] shrink-0" />
              <span>
                {BLOCKS[type].label}
                <small className="block text-[10.5px] text-slate-400">{BLOCKS[type].desc}</small>
              </span>
            </button>
          );
        })}
      </Popover>
    </div>
  );
}

/** Re-renders only when its own block (or the shared catalogs) change. */
export const BlockCard = memo(BlockCardImpl);
