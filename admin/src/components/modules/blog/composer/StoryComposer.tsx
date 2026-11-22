"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ChevronDownIcon,
  ClipboardPasteIcon,
  CodeIcon,
  InfoIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  PlusIcon,
  Redo2Icon,
  StarIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";

import { RichTextEditor } from "@/components/shared/richTextEditor/RichTextEditor";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { createTemplate, deleteTemplate, getTemplates } from "@/services/blog/blog";
import type { BlogTemplate, StoryPickerCollection, StoryPickerProduct } from "@/types/blog";
import { cn } from "@/lib/utils";
import {
  ADD_ORDER,
  BLOCKS,
  BUILT_IN_TEMPLATES,
  type Block,
  type BlockType,
  SPLIT_LABELS,
  type SplitKind,
  type StoryProducts,
  blockSummary,
  blockText,
  classifyParagraph,
  makeBlock,
  normalizeBlocks,
  paragraphsToBlocks,
  plainTextOf,
  splitIntoParagraphs,
  stripHtml,
  textToParagraphs,
  toStructureOnly,
  uid,
  wordCount,
} from "./blocks";
import { BlockCard, type ChangeMode } from "./BlockCard";
import { StoryBlocks } from "./StoryRender";
import { Btn, CARD, FIELD, IconBtn, Modal, Popover, Segmented, useComposerToast } from "./ui";

/* =========================================================================
   The Story Composer: the article body as a list of blocks, with undo, the
   add menu and insert points, drag-and-drop, templates, Paste & Split, an
   inline preview and the Advanced Editor's hand-edited version.
   ========================================================================= */

export type ManualState = { on: boolean; html: string };
type Snapshot = { blocks: Block[]; manual: ManualState };

/* -------------------------------- History --------------------------------- */

/**
 * Blocks and the manual version, with undo/redo. Typing is coalesced: the
 * first keystroke after a pause records one undo step for the whole burst.
 */
export function useStoryHistory(initial: Snapshot) {
  const [state, setState] = useState<{ present: Snapshot; past: Snapshot[]; future: Snapshot[] }>({
    present: initial,
    past: [],
    future: [],
  });
  const typingOpen = useRef(false);
  const typingTimer = useRef<number | undefined>(undefined);

  const apply = useCallback((next: (snapshot: Snapshot) => Snapshot, mode: ChangeMode = "commit") => {
    let record = true;
    if (mode === "typing") {
      record = !typingOpen.current;
      typingOpen.current = true;
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => (typingOpen.current = false), 900);
    } else {
      typingOpen.current = false;
    }
    setState((current) => ({
      present: next(current.present),
      past: record ? [...current.past.slice(-79), current.present] : current.past,
      future: record ? [] : current.future,
    }));
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return false;
    typingOpen.current = false;
    setState((current) =>
      current.past.length
        ? {
            present: current.past[current.past.length - 1],
            past: current.past.slice(0, -1),
            future: [current.present, ...current.future],
          }
        : current
    );
    return true;
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return false;
    typingOpen.current = false;
    setState((current) =>
      current.future.length
        ? { present: current.future[0], past: [...current.past, current.present], future: current.future.slice(1) }
        : current
    );
    return true;
  }, [canRedo]);

  /** Replaces everything without an undo step — loading a post. */
  const reset = useCallback((snapshot: Snapshot) => setState({ present: snapshot, past: [], future: [] }), []);

  return {
    blocks: state.present.blocks,
    manual: state.present.manual,
    apply,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  };
}

export type StoryHistory = ReturnType<typeof useStoryHistory>;

/** The story body as HTML, as the reader gets it — for `content` and SEO. */
export function compileStory(blocks: Block[], products: StoryProducts): string {
  return renderToStaticMarkup(
    <StoryBlocks blocks={blocks.filter((block) => !block.hidden)} products={products} options={{}} />
  );
}

/* ------------------------------ Templates menu ------------------------------ */

const HIDDEN_KEY = "windrise:hidden-story-templates";

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeHidden(keys: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(keys));
  } catch {
    // Storage blocked: the built-ins simply come back next visit.
  }
}

function TemplatesMenu({
  onApply,
  onSave,
}: {
  onApply: (name: string, blocks: Block[]) => void;
  onSave: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const toast = useComposerToast();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<BlogTemplate[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  /** Opening reads the team's templates fresh, so a colleague's new one shows. */
  const toggle = () => {
    if (open) return setOpen(false);
    setOpen(true);
    setHidden(readHidden());
    getTemplates()
      .then((res) => setSaved(res.data))
      .catch(() => setSaved([]));
  };

  const builtIns = BUILT_IN_TEMPLATES.filter((template) => !hidden.includes(template.key));

  const remove = async (key: string) => {
    setConfirming(null);
    if (BUILT_IN_TEMPLATES.some((template) => template.key === key)) {
      const next = [...hidden, key];
      setHidden(next);
      writeHidden(next);
      toast("Template removed from your list", {
        label: "Undo",
        run: () => {
          const back = readHidden().filter((entry) => entry !== key);
          writeHidden(back);
          setHidden(back);
        },
      });
      return;
    }
    try {
      await deleteTemplate(key);
      setSaved((current) => current?.filter((template) => template.id !== key) ?? null);
      toast("Template deleted");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the template");
    }
  };

  const row = (key: string, name: string, detail: string, builtIn: boolean, build: () => Block[]) =>
    confirming === key ? (
      <div key={key} className="my-0.5 flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1.5 text-[12px]">
        <span className="min-w-0 flex-1 truncate text-rose-900">Delete “{name}”?</span>
        <Btn size="sm" onClick={() => setConfirming(null)}>
          Cancel
        </Btn>
        <Btn size="sm" variant="danger" onClick={() => void remove(key)}>
          Delete
        </Btn>
      </div>
    ) : (
      <div key={key} className="group/tpl flex items-start gap-0.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onApply(name, build());
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
        >
          {builtIn ? (
            <LayoutTemplateIcon className="mt-0.5 h-[15px] w-[15px] shrink-0 text-slate-500" />
          ) : (
            <StarIcon className="mt-0.5 h-[15px] w-[15px] shrink-0 text-slate-500" />
          )}
          <span className="min-w-0">
            <b className="block text-[12px] font-semibold text-slate-900">{name}</b>
            <small className="block text-[10.5px] text-slate-400">{detail}</small>
          </span>
        </button>
        <IconBtn
          label={`Delete ${name}`}
          danger
          onClick={() => setConfirming(key)}
          className="mt-1 opacity-0 group-hover/tpl:opacity-100 focus-visible:opacity-100"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    );

  return (
    <>
      <Btn ref={button} size="sm" onClick={toggle} aria-expanded={open}>
        <LayoutTemplateIcon className="h-3.5 w-3.5" />
        Templates
        <ChevronDownIcon className="h-3 w-3" />
      </Btn>
      <Popover anchor={button} open={open} onClose={() => setOpen(false)} align="right" label="Story templates" className="w-[310px]">
        <p className="mb-1 ml-1 text-[11.5px] font-semibold text-slate-800">Story templates</p>
        <div className="max-h-[340px] overflow-auto">
          {builtIns.length > 0 && (
            <p className="mx-2 mb-0.5 mt-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-slate-400">
              Windrise templates
            </p>
          )}
          {builtIns.map((template) =>
            row(
              template.key,
              template.name,
              `${template.description} · ${template.build().length} blocks`,
              true,
              template.build
            )
          )}
          <p className="mx-2 mb-0.5 mt-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Team templates
          </p>
          {saved === null ? (
            <p className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-slate-400">
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </p>
          ) : saved.length === 0 ? (
            <p className="px-2 pb-1.5 pt-1 text-[12px] text-slate-500">
              Nothing saved yet. Save the current story to reuse its structure.
            </p>
          ) : (
            saved.map((template) =>
              row(
                template.id,
                template.name,
                `${template.description || (template.withContent ? "Structure and content" : "Structure only")} · ${
                  template.blocks.length
                } blocks · saved ${new Date(template.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                false,
                () => normalizeBlocks(template.blocks).map((block) => ({ ...block, id: uid() }))
              )
            )
          )}
        </div>
        <div className="mt-2 flex flex-col items-start gap-2 border-t border-slate-100 pt-2.5">
          <Btn
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              onSave();
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Save current story as template
          </Btn>
          {hidden.length > 0 && (
            <button
              type="button"
              onClick={() => {
                writeHidden([]);
                setHidden([]);
                toast("Windrise templates restored");
              }}
              className="cursor-pointer text-[12px] font-medium text-blue-600 hover:underline"
            >
              Restore {hidden.length} removed Windrise template{hidden.length === 1 ? "" : "s"}
            </button>
          )}
          <p className="text-[11px] text-slate-500">Applying a template replaces the current blocks. You can undo it.</p>
        </div>
      </Popover>
    </>
  );
}

function SaveTemplateModal({
  blocks,
  summaryOf,
  onClose,
}: {
  blocks: Block[];
  summaryOf: (block: Block) => string;
  onClose: () => void;
}) {
  const toast = useComposerToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [withContent, setWithContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    setSaving(true);
    try {
      const shaped = blocks.map((block) =>
        withContent ? { ...block, collapsed: false } : toStructureOnly(block, summaryOf(block))
      );
      await createTemplate({
        name: name.trim(),
        description: description.trim() || null,
        blocks: shaped,
        withContent,
      });
      toast(`Saved “${name.trim()}” to your team’s templates`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the template");
      setSaving(false);
    }
  };

  const option = (value: boolean, title: string, detail: string) => (
    <label
      className={cn(
        "my-1.5 flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5",
        withContent === value ? "border-blue-300 bg-blue-50" : "border-slate-200"
      )}
    >
      <input
        type="radio"
        name="template-content"
        checked={withContent === value}
        onChange={() => setWithContent(value)}
        className="mt-0.5 accent-[#0b0b0b]"
      />
      <span>
        <b className="block text-[12.5px] font-semibold text-slate-900">{title}</b>
        <small className="text-[11.5px] text-slate-500">{detail}</small>
      </span>
    </label>
  );

  return (
    <Modal
      title="Save as template"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-slate-500">
            {blocks.length} blocks{blocks.some((block) => block.hidden) ? " · hidden blocks stay hidden" : ""}
          </span>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
            Save template
          </Btn>
        </>
      }
    >
      <form
        className="space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-800">
            Template name<span className="ml-0.5 text-rose-500">*</span>
          </span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Designer Interview" className={FIELD} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex justify-between text-[12.5px] font-semibold text-slate-800">
            Description <span className="font-normal text-slate-400">optional</span>
          </span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this template for?"
            className={FIELD}
          />
        </label>
        <div>
          <p className="text-[12.5px] font-semibold text-slate-800">What to save</p>
          {option(false, "Structure only", "Block order, block types and style overrides. Current text becomes placeholder hints.")}
          {option(true, "Structure and content", "Also keeps the current text, images and products.")}
        </div>
        <div className="flex flex-wrap gap-1">
          {blocks.map((block) => {
            const Icon = BLOCKS[block.type].icon;
            return (
              <span key={block.id} className="inline-flex h-[22px] items-center gap-1 rounded bg-slate-100 px-1.5 text-[11px] text-slate-600">
                <Icon className="h-3 w-3" />
                {BLOCKS[block.type].label}
              </span>
            );
          })}
        </div>
        {error && <p className="text-[12px] text-rose-600">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ------------------------------ Paste & Split ------------------------------ */

function PasteSplitModal({ onAdd, onClose }: { onAdd: (blocks: Block[]) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<[SplitKind, string][]>([]);
  const result = useMemo(() => paragraphsToBlocks(rows), [rows]);

  return (
    <Modal
      title="Paste & Split"
      subtitle="Paste an article. Each paragraph becomes a block you can retype before adding."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-slate-500">
            {rows.length ? `${rows.length} paragraphs → ${result.length} blocks` : ""}
          </span>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!result.length} onClick={() => onAdd(result)}>
            {result.length ? `Add ${result.length} blocks` : "Add blocks"}
          </Btn>
        </>
      }
    >
      <div className="p-4">
        <textarea
          value={text}
          rows={7}
          onChange={(event) => {
            setText(event.target.value);
            setRows(splitIntoParagraphs(event.target.value).map(classifyParagraph));
          }}
          placeholder={
            "Paste your article here. Separate paragraphs with a blank line.\n\nShort lines become headings, “quoted” paragraphs become Pull Text, and - lists stay lists."
          }
          aria-label="Article text"
          className={cn(FIELD, "resize-y")}
        />
        {rows.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {rows.map(([kind, paragraph], index) => (
              <div
                key={index}
                className="grid items-center gap-2.5 rounded-md border border-slate-100 px-2 py-1.5 sm:grid-cols-[160px_minmax(0,1fr)]"
              >
                <select
                  aria-label={`Paragraph ${index + 1} type`}
                  value={kind}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((entry, i) => (i === index ? [event.target.value as SplitKind, entry[1]] : entry))
                    )
                  }
                  className="h-8 cursor-pointer rounded-md border border-slate-200 bg-white px-2 text-[12px]"
                >
                  {(Object.keys(SPLIT_LABELS) as SplitKind[]).map((value) => (
                    <option key={value} value={value}>
                      {SPLIT_LABELS[value]}
                    </option>
                  ))}
                </select>
                <p className={cn("truncate text-[12px] text-slate-600", kind === "skip" && "line-through opacity-50")}>
                  {paragraph}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------- Add menu -------------------------------- */

function AddMenu({
  anchor,
  open,
  onClose,
  onPick,
  align = "left",
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  onPick: (type: BlockType) => void;
  align?: "left" | "center";
}) {
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align={align} label="Add block" className="w-[420px]">
      <p className="mb-1.5 ml-1 text-[11.5px] font-semibold text-slate-800">Add Block</p>
      <div className="grid grid-cols-2 gap-x-1 sm:grid-cols-3">
        {ADD_ORDER.map((type) => {
          const Icon = BLOCKS[type].icon;
          return (
            <button
              key={type}
              type="button"
              title={BLOCKS[type].desc}
              onClick={() => {
                onClose();
                onPick(type);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              <span className="truncate">{BLOCKS[type].label}</span>
            </button>
          );
        })}
      </div>
      <p className="mx-1 mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        Each block starts in the Windrise style. Open <b className="text-slate-700">Adjust</b> inside a block to override it.
      </p>
    </Popover>
  );
}

function InsertPoint({ onPick }: { onPick: (type: BlockType) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="group/ins relative h-2">
      <span className="pointer-events-none absolute inset-x-10 top-1/2 h-px bg-blue-500 opacity-0 transition-opacity group-focus-within/ins:opacity-50 group-hover/ins:opacity-50" />
      <button
        ref={button}
        type="button"
        aria-label="Insert block here"
        title="Insert block here"
        onClick={() => setOpen((value) => !value)}
        className="absolute left-1/2 top-1/2 z-[2] grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 scale-75 cursor-pointer place-items-center rounded-full bg-[#0b0b0b] text-white opacity-0 transition-[opacity,transform] focus-visible:scale-100 focus-visible:opacity-100 group-hover/ins:scale-100 group-hover/ins:opacity-100"
      >
        <PlusIcon className="h-3 w-3" />
      </button>
      <AddMenu anchor={button} open={open} onClose={() => setOpen(false)} onPick={onPick} align="center" />
    </div>
  );
}

/* --------------------------------- Composer -------------------------------- */

export type ComposerView = "compose" | "preview" | "advanced";

export function StoryComposer({
  history,
  products,
  productCatalog,
  rememberProducts,
  collections,
  view,
  onViewChange,
  onFocusBlock,
  pickImages,
  uploadImage,
  previewImage,
  lead,
  renderPreview,
}: {
  history: StoryHistory;
  /** Resolved product data for rendering. */
  products: StoryProducts;
  /** Everything the pickers have seen, for names and prices. */
  productCatalog: Record<string, StoryPickerProduct>;
  rememberProducts: (list: StoryPickerProduct[]) => void;
  collections: StoryPickerCollection[];
  view: ComposerView;
  onViewChange: (view: ComposerView) => void;
  onFocusBlock: (id: string) => void;
  pickImages: (multiple: boolean, use: (urls: string[]) => void) => void;
  uploadImage: (use: (url: string) => void) => void;
  previewImage: (url: string, caption?: string) => void;
  /** The lead, counted into words and reading time. */
  lead: string;
  /** The inline preview (an auto-height device frame). */
  renderPreview: () => React.ReactNode;
}) {
  const toast = useComposerToast();
  const { blocks, manual, apply, undo, redo } = history;
  const listRef = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; before: boolean } | null>(null);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [manualKey, setManualKey] = useState(0);

  const summaryOf = useCallback(
    (block: Block) =>
      blockSummary(block, {
        product: (id) => productCatalog[id]?.name ?? "Product",
        collection: (slug) => collections.find((c) => c.slug === slug)?.title ?? slug,
      }),
    [productCatalog, collections]
  );

  const doUndo = useCallback(() => undo() && toast("Undone"), [undo, toast]);
  const doRedo = useCallback(() => redo() && toast("Redone"), [redo, toast]);

  // Ctrl/⌘ Z outside a text field undoes a block change.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable='true']")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) doRedo();
        else doUndo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  const flash = (id: string) =>
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (!el) return;
      el.animate(
        [{ boxShadow: "0 0 0 3px rgba(37,99,235,0.35)" }, { boxShadow: "0 0 0 3px rgba(37,99,235,0)" }],
        { duration: 1000, easing: "ease-out" }
      );
    });

  const setBlocks = useCallback(
    (next: (blocks: Block[]) => Block[], mode: ChangeMode = "commit") =>
      apply((snapshot) => ({ ...snapshot, blocks: next(snapshot.blocks) }), mode),
    [apply]
  );

  const add = (type: BlockType, at: number | null) => {
    const block = makeBlock(type);
    setBlocks((list) => {
      const next = [...list];
      next.splice(at ?? next.length, 0, block);
      return next;
    });
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${block.id}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      window.setTimeout(() => el?.querySelector<HTMLElement>("[contenteditable],input,textarea")?.focus(), 250);
    });
    if (type === "image") {
      window.setTimeout(
        () =>
          pickImages(false, ([url]) =>
            setBlocks((list) =>
              list.map((entry) => (entry.id === block.id ? ({ ...entry, data: { ...entry.data, img: url } } as Block) : entry))
            )
          ),
        280
      );
    }
  };

  const onChange = useCallback(
    (id: string, next: Block, mode: ChangeMode) =>
      setBlocks((list) => list.map((block) => (block.id === id ? next : block)), mode),
    [setBlocks]
  );

  const onDuplicate = useCallback(
    (id: string) => {
      const copyId = uid();
      setBlocks((list) => {
        const index = list.findIndex((block) => block.id === id);
        const copy = { ...structuredClone(list[index]), id: copyId };
        const next = [...list];
        next.splice(index + 1, 0, copy);
        return next;
      });
      flash(copyId);
      toast("Block duplicated");
    },
    [setBlocks, toast]
  );

  const onRemove = useCallback(
    (id: string) => {
      const block = history.blocks.find((entry) => entry.id === id);
      setBlocks((list) => list.filter((entry) => entry.id !== id));
      toast(`${block ? BLOCKS[block.type].label : "Block"} block deleted`, { label: "Undo", run: () => void undo() });
    },
    [history.blocks, setBlocks, toast, undo]
  );

  const onMove = useCallback(
    (id: string, step: -1 | 1) => {
      setBlocks((list) => {
        const from = list.findIndex((block) => block.id === id);
        const to = from + step;
        if (from < 0 || to < 0 || to >= list.length) return list;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      requestAnimationFrame(() =>
        listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"] button[aria-label^="Move"]`)?.focus()
      );
      flash(id);
    },
    [setBlocks]
  );

  const onTurnInto = useCallback(
    (id: string, type: BlockType) => {
      setBlocks((list) =>
        list.map((block) => {
          if (block.id !== id) return block;
          const text = plainTextOf(block);
          const next = makeBlock(type);
          next.id = block.id;
          if (next.type === "text") next.data.html = textToParagraphs(text);
          else if (next.type === "pull") next.data.text = text.replace(/^[“"']|[”"']$/g, "");
          else if ("text" in next.data)
            (next.data as { text: string }).text = type === "heading" || type === "subheading" ? text.replace(/\s+/g, " ") : text;
          return next;
        })
      );
      flash(id);
      toast(`Changed to ${BLOCKS[type].label}`, { label: "Undo", run: () => void undo() });
    },
    [setBlocks, toast, undo]
  );

  const onSplit = useCallback(
    (id: string) => {
      const source = blocks.find((block) => block.id === id);
      if (!source) return;
      const replacement = paragraphsToBlocks(splitIntoParagraphs(plainTextOf(source)).map(classifyParagraph));
      if (!replacement.length) return;
      setBlocks((list) => {
        const index = list.findIndex((block) => block.id === id);
        if (index < 0) return list;
        const next = [...list];
        next.splice(index, 1, ...replacement);
        return next;
      });
      toast(`Split into ${replacement.length} blocks`, { label: "Undo", run: () => void undo() });
    },
    [blocks, setBlocks, toast, undo]
  );

  /* ---- Drag and drop ---- */

  const endDrag = () => {
    setDragId(null);
    setArmed(null);
    setDrop(null);
  };

  const onDrop = () => {
    if (!dragId || !drop || drop.id === dragId) return endDrag();
    const moving = dragId;
    setBlocks((list) => {
      const from = list.findIndex((block) => block.id === moving);
      const next = [...list];
      const [moved] = next.splice(from, 1);
      let to = next.findIndex((block) => block.id === drop.id);
      if (!drop.before) to += 1;
      next.splice(to, 0, moved);
      return next;
    });
    flash(moving);
    onFocusBlock(moving);
    endDrag();
  };

  /* ---- Stats ---- */

  const visible = blocks.filter((block) => !block.hidden);
  const words = wordCount(`${lead} ${manual.on ? stripHtml(manual.html) : visible.map(blockText).join(" ")}`);
  const hiddenCount = blocks.length - visible.length;

  return (
    <section className={cn(CARD, "p-4")} id="story-composer">
      <div className="mb-3 flex flex-wrap items-start gap-2.5">
        <div className="flex min-w-[220px] flex-1 gap-2.5">
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600">
            <LayoutTemplateIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900">Story Composer</h2>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Build your story with content blocks. Each block has a default Windrise style, with manual controls when
              needed.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <IconBtn label="Undo (Ctrl/⌘ Z)" onClick={doUndo} disabled={!history.canUndo}>
            <Undo2Icon className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Redo (Ctrl/⌘ Shift Z)" onClick={doRedo} disabled={!history.canRedo}>
            <Redo2Icon className="h-4 w-4" />
          </IconBtn>
          <TemplatesMenu
            onSave={() => (blocks.length ? setSaveOpen(true) : toast("Add some blocks first"))}
            onApply={(name, next) => {
              apply((snapshot) => ({ ...snapshot, blocks: next }));
              onViewChange("compose");
              toast(`${name} template applied`, { label: "Undo", run: () => void undo() });
            }}
          />
          <Segmented
            label="Composer view"
            value={view}
            onChange={onViewChange}
            options={[
              { value: "compose", label: "Compose" },
              { value: "preview", label: "Preview" },
              { value: "advanced", label: "Advanced Editor" },
            ]}
          />
        </div>
      </div>

      {manual.on && view !== "advanced" && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <InfoIcon className="h-4 w-4 shrink-0" />
          <span>The preview and published article use your manual Advanced Editor version. Your blocks are kept unchanged.</span>
          <button
            type="button"
            onClick={() => {
              apply((snapshot) => ({ ...snapshot, manual: { ...snapshot.manual, on: false } }));
              toast("Article built from blocks again");
            }}
            className="ml-auto cursor-pointer font-medium text-blue-700 hover:underline"
          >
            Use blocks again
          </button>
        </div>
      )}

      {view === "compose" && (
        <>
          <div
            ref={listRef}
            className="flex flex-col"
            onDragStart={(event) => {
              const id = (event.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
              if (!id || id !== armed) return;
              setDragId(id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", id);
            }}
            onDragOver={(event) => {
              if (!dragId) return;
              event.preventDefault();
              const card = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
              if (!card || card.dataset.id === dragId) return setDrop(null);
              const box = card.getBoundingClientRect();
              setDrop({ id: card.dataset.id!, before: event.clientY < box.top + box.height / 2 });
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDrop();
            }}
            onDragEnd={endDrag}
            onPointerUp={() => !dragId && setArmed(null)}
          >
            {blocks.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-[12px] text-slate-500">
                No blocks yet. Add a block, paste an article, or pick a template.
              </p>
            )}
            {blocks.map((block, index) => (
              <div key={block.id}>
                <InsertPoint onPick={(type) => add(type, index)} />
                <BlockCard
                  block={block}
                  onChange={onChange}
                  onDuplicate={onDuplicate}
                  onRemove={onRemove}
                  onMove={onMove}
                  onTurnInto={onTurnInto}
                  onSplit={onSplit}
                  onFocusBlock={onFocusBlock}
                  pickImages={pickImages}
                  uploadImage={uploadImage}
                  previewImage={previewImage}
                  products={productCatalog}
                  rememberProducts={rememberProducts}
                  collections={collections}
                  notify={toast}
                  dragProps={{
                    draggable: armed === block.id,
                    onGripPointerDown: () => setArmed(block.id),
                    className: cn(
                      dragId === block.id && "opacity-35",
                      drop?.id === block.id && (drop.before ? "shadow-[0_-3px_0_0_#2563eb]" : "shadow-[0_3px_0_0_#2563eb]")
                    ),
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              ref={addButton}
              type="button"
              onClick={() => setAddOpen((value) => !value)}
              className="flex h-9 min-w-[200px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white text-[13px] font-semibold text-slate-800 transition-colors hover:border-slate-900 hover:bg-slate-50"
            >
              <PlusIcon className="h-4 w-4" />
              Add Block
            </button>
            <Btn onClick={() => setPasteOpen(true)}>
              <ClipboardPasteIcon className="h-3.5 w-3.5" />
              Paste &amp; Split
            </Btn>
            <div className="flex w-full flex-wrap gap-3.5 px-0.5 pt-0.5 text-[11.5px] tabular-nums text-slate-500">
              <span>
                {blocks.length} blocks{hiddenCount ? ` · ${hiddenCount} hidden` : ""}
              </span>
              <span>{words} words</span>
              <span>{Math.max(1, Math.round(words / 220))} min read</span>
              <span className="ml-auto hidden sm:inline">Drag ⋮⋮ or focus it and press ↑ ↓ to reorder</span>
            </div>
          </div>
          <AddMenu anchor={addButton} open={addOpen} onClose={() => setAddOpen(false)} onPick={(type) => add(type, null)} />
        </>
      )}

      {view === "preview" && renderPreview()}

      {view === "advanced" && (
        <div>
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
            <CodeIcon className="h-4 w-4 shrink-0" />
            <span>Full manual control over the article body. It starts from your blocks; editing here never changes them.</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="font-medium">Use this version</span>
              <ToggleSwitch
                checked={manual.on}
                onChange={(on) => {
                  apply((snapshot) => ({ ...snapshot, manual: { ...snapshot.manual, on } }));
                  toast(on ? "Preview now uses the manual version" : "Preview uses blocks");
                }}
                label="Use the manual version for preview and publishing"
              />
            </span>
            <Btn
              size="sm"
              variant={confirmRebuild ? "outline" : "ghost"}
              onClick={() => {
                if (!confirmRebuild) {
                  setConfirmRebuild(true);
                  window.setTimeout(() => setConfirmRebuild(false), 3000);
                  return;
                }
                setConfirmRebuild(false);
                apply((snapshot) => ({
                  ...snapshot,
                  manual: { ...snapshot.manual, html: compileStory(snapshot.blocks, products) },
                }));
                setManualKey((key) => key + 1);
                toast("Rebuilt from blocks", { label: "Undo", run: () => { undo(); setManualKey((key) => key + 1); } });
              }}
            >
              <Undo2Icon className="h-3.5 w-3.5" />
              {confirmRebuild ? "Replace manual edits?" : "Rebuild from blocks"}
            </Btn>
          </div>
          <RichTextEditor
            key={manualKey}
            variant="full"
            value={manual.html || compileStory(blocks, products)}
            onChange={(html) => apply((snapshot) => ({ ...snapshot, manual: { ...snapshot.manual, html } }), "typing")}
            minHeight={480}
            placeholder="Write or build a custom section…"
          />
        </div>
      )}

      {pasteOpen && (
        <PasteSplitModal
          onClose={() => setPasteOpen(false)}
          onAdd={(added) => {
            setPasteOpen(false);
            setBlocks((list) => [...list, ...added]);
            toast(`${added.length} blocks added`);
            requestAnimationFrame(() =>
              listRef.current
                ?.querySelector<HTMLElement>(`[data-id="${added[0].id}"]`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" })
            );
          }}
        />
      )}
      {saveOpen && <SaveTemplateModal blocks={blocks} summaryOf={summaryOf} onClose={() => setSaveOpen(false)} />}
    </section>
  );
}
