"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import Swal from "sweetalert2";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloudUploadIcon,
  EyeIcon,
  EyeOffIcon,
  FilmIcon,
  ImageIcon,
  ImagesIcon,
  InfoIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import { FieldSelect } from "@/components/ui/field-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  CARD,
  CheckBox,
  GhostButton,
  PrimaryButton,
  TableSkeleton,
} from "@/components/modules/administration/shared/ui";
import {
  bulkMegaMenuMedia,
  deleteMegaMenuMedia,
  getMegaMenuMedia,
  getMegaMenuTargets,
  getStorefrontMenus,
  normalizeMenuPath,
  reorderMegaMenuMedia,
  saveMegaMenuSettings,
  updateMegaMenuMedia,
  uploadMegaMenuMedia,
  STOREFRONT_HOST,
  STOREFRONT_URL,
  type MegaMenuMedia as MediaItem,
  type MegaMenuMediaOrder,
  type MegaMenuMediaType,
  type MegaMenuSettings,
  type MegaMenuTarget,
  type StorefrontMenu,
} from "@/services/website/website";
import { cn } from "@/lib/utils";

/* =========================================================================
   Website > Menu & Navigation > Mega Menu Media.

   The pictures, videos and GIFs each main menu (Men, Women…) shows where its
   mega menu's promo image sits. Every menu has its own library and its own
   playback settings. Media is stored on the API like every other upload and
   served from /uploads, which both the dashboard and the storefront proxy.
   ========================================================================= */

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

/** Mirrors the server's limits, so a bad file is refused before it is sent. */
const ACCEPT: Record<string, MegaMenuMediaType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "GIF",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;

type Filter = "ALL" | MegaMenuMediaType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "IMAGE", label: "Images" },
  { id: "VIDEO", label: "Videos" },
  { id: "GIF", label: "GIFs" },
];

const ORDER_OPTIONS: { value: MegaMenuMediaOrder; label: string }[] = [
  { value: "DEFAULT", label: "Arranged order" },
  { value: "NEWEST", label: "Newest first" },
  { value: "OLDEST", label: "Oldest first" },
  { value: "RANDOM", label: "Random on each visit" },
];

const DEFAULT_SETTINGS: MegaMenuSettings = {
  enabled: true,
  autoSlide: true,
  slideDuration: 5,
  itemOrder: "DEFAULT",
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The order the website will show active media in, for the preview. */
function websiteOrder(items: MediaItem[], order: MegaMenuMediaOrder, seed: number): MediaItem[] {
  const active = items.filter((item) => item.isActive);
  const time = (item: MediaItem) => new Date(item.createdAt).getTime();
  switch (order) {
    case "NEWEST":
      return [...active].sort((a, b) => time(b) - time(a));
    case "OLDEST":
      return [...active].sort((a, b) => time(a) - time(b));
    case "RANDOM": {
      // A stable shuffle per seed, so the preview reshuffles only when asked.
      let s = seed;
      const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const out = [...active];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
    default:
      return active;
  }
}

/** Checks files against the accepted types and sizes; returns the problem, if any. */
function checkFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Upload up to ${MAX_FILES} files at a time.`;
  for (const file of files) {
    const type = ACCEPT[file.type];
    if (!type) return `${file.name} is not a supported file. Use JPG, PNG, WebP, GIF, MP4 or WebM.`;
    const max = type === "VIDEO" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > max) {
      return `${file.name} is ${formatBytes(file.size)}. ${
        type === "VIDEO" ? "Videos" : "Images and GIFs"
      } can be up to ${formatBytes(max)}.`;
    }
  }
  return null;
}

type Draft = { title: string; linkUrl: string; altText: string; isActive: boolean };

export function MegaMenuMediaPanel() {
  const [targets, setTargets] = useState<MegaMenuTarget[]>([]);
  const [menuId, setMenuId] = useState<string>("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [settings, setSettings] = useState<MegaMenuSettings>(DEFAULT_SETTINGS);
  const [storefront, setStorefront] = useState<StorefrontMenu[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [busy, setBusy] = useState(false);

  const [upload, setUpload] = useState<{ count: number; progress: number } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [durationText, setDurationText] = useState("5");
  const [settingsState, setSettingsState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shuffleSeed, setShuffleSeed] = useState(7);

  const menu = targets.find((target) => target.id === menuId) ?? null;

  /* ------------------------------- Loading ------------------------------- */

  useEffect(() => {
    (async () => {
      try {
        const [list, nav] = await Promise.all([
          getMegaMenuTargets(),
          // The preview is a nicety; without it the panel still works.
          getStorefrontMenus().catch(() => [] as StorefrontMenu[]),
        ]);
        setTargets(list);
        setStorefront(nav);
        setMenuId((current) => current || list[0]?.id || "");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not load the menus");
      } finally {
        setLoadingTargets(false);
      }
    })();
  }, []);

  const loadMedia = useCallback(async (id: string) => {
    setLoadingMedia(true);
    try {
      const data = await getMegaMenuMedia(id);
      setItems(data.items);
      setSettings(data.settings);
      setDurationText(String(data.settings.slideDuration));
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load this menu's media");
    } finally {
      setLoadingMedia(false);
    }
  }, []);

  // A different menu is a different library: nothing selected carries over.
  useEffect(() => {
    if (!menuId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
    setOpenId(null);
    setFilter("ALL");
    setSettingsState("idle");
    loadMedia(menuId);
  }, [menuId, loadMedia]);

  /** The selector's count: live for the open menu, as loaded for the rest. */
  const countFor = (target: MegaMenuTarget) =>
    target.id === menuId && !loadingMedia ? items.length : target.mediaCount;

  /* ------------------------------- Derived ------------------------------- */

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: items.length, IMAGE: 0, VIDEO: 0, GIF: 0 };
    items.forEach((item) => (c[item.type] += 1));
    return c;
  }, [items]);

  const visible = useMemo(
    () => (filter === "ALL" ? items : items.filter((item) => item.type === filter)),
    [items, filter]
  );
  const activeCount = items.filter((item) => item.isActive).length;
  const shown = useMemo(
    () => websiteOrder(items, settings.itemOrder, shuffleSeed),
    [items, settings.itemOrder, shuffleSeed]
  );
  const opened = items.find((item) => item.id === openId) ?? null;
  // Drag to arrange only when every item is in view and the arrangement is what shows.
  const canArrange = filter === "ALL" && items.length > 1;

  useEffect(() => {
    if (!opened) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(null);
      return;
    }
    setDraft({
      title: opened.title ?? "",
      linkUrl: opened.linkUrl ?? "",
      altText: opened.altText ?? "",
      isActive: opened.isActive,
    });
    // Only when a different item is opened, not on every save of this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened?.id]);

  /* ------------------------------- Actions ------------------------------- */

  const fail = (err: unknown, fallback: string) =>
    Toast.fire({ icon: "error", title: err instanceof Error ? err.message : fallback });

  const startUpload = async (files: File[]) => {
    if (!menuId || !files.length || upload) return;
    const problem = checkFiles(files);
    if (problem) {
      Toast.fire({ icon: "error", title: problem });
      return;
    }
    setUpload({ count: files.length, progress: 0 });
    try {
      const created = await uploadMegaMenuMedia(menuId, files, (progress) =>
        setUpload({ count: files.length, progress })
      );
      setItems((list) => [...list, ...created]);
      setFilter("ALL");
      Toast.fire({
        icon: "success",
        title: `${created.length} file${created.length === 1 ? "" : "s"} uploaded to ${menu?.label ?? "the menu"}.`,
      });
    } catch (err: unknown) {
      fail(err, "Could not upload the files");
    } finally {
      setUpload(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onDropFiles = (event: DragEvent) => {
    event.preventDefault();
    setDropActive(false);
    // A card being rearranged is not an upload.
    if (dragId) return;
    startUpload(Array.from(event.dataTransfer.files));
  };

  const writeSettings = async (patch: Partial<MegaMenuSettings>) => {
    if (!menuId) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSettingsState("saving");
    try {
      const saved = await saveMegaMenuSettings(menuId, patch);
      setSettings(saved);
      setSettingsState("saved");
    } catch (err: unknown) {
      setSettings(previous);
      setSettingsState("error");
      fail(err, "Could not save the settings");
    }
  };

  const durationValue = Number(durationText);
  const durationError =
    !/^\d+$/.test(durationText.trim()) || durationValue < 2 || durationValue > 60
      ? "Use a whole number from 2 to 60."
      : "";

  const commitDuration = () => {
    if (durationError || durationValue === settings.slideDuration) return;
    writeSettings({ slideDuration: durationValue });
  };

  /** Moves one item to a new position in the arranged order and saves it. */
  const arrange = async (id: string, toIndex: number) => {
    const from = items.findIndex((item) => item.id === id);
    if (from < 0 || toIndex < 0 || toIndex >= items.length || from === toIndex) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    const previous = items;
    setItems(next);
    try {
      await reorderMegaMenuMedia(menuId, next.map((item) => item.id));
      if (settings.itemOrder !== "DEFAULT") {
        Toast.fire({
          icon: "info",
          title: "Order saved. The website uses it once Item Order is set to Arranged order.",
        });
      }
    } catch (err: unknown) {
      setItems(previous);
      fail(err, "Could not save the order");
    }
  };

  const remove = async (ids: string[]) => {
    const names = items.filter((item) => ids.includes(item.id));
    if (!names.length) return;
    const result = await Swal.fire({
      icon: "warning",
      title:
        names.length === 1 ? `Delete ${names[0].fileName}?` : `Delete ${names.length} media items?`,
      text: "The files are removed from the website and from storage. This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    });
    if (!result.isConfirmed) return;

    setBusy(true);
    try {
      if (ids.length === 1) await deleteMegaMenuMedia(ids[0]);
      else await bulkMegaMenuMedia(ids, "delete");
      setItems((list) => list.filter((item) => !ids.includes(item.id)));
      setSelected(new Set());
      if (openId && ids.includes(openId)) setOpenId(null);
      Toast.fire({
        icon: "success",
        title: names.length === 1 ? `${names[0].fileName} deleted.` : `${names.length} items deleted.`,
      });
    } catch (err: unknown) {
      fail(err, "Could not delete the media");
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (ids: string[], isActive: boolean) => {
    setBusy(true);
    try {
      if (ids.length === 1) await updateMegaMenuMedia(ids[0], { isActive });
      else await bulkMegaMenuMedia(ids, isActive ? "activate" : "deactivate");
      setItems((list) => list.map((item) => (ids.includes(item.id) ? { ...item, isActive } : item)));
      if (draft && openId && ids.includes(openId)) setDraft({ ...draft, isActive });
      setSelected(new Set());
      Toast.fire({
        icon: "success",
        title: `${ids.length === 1 ? "1 item" : `${ids.length} items`} ${
          isActive ? "shown on" : "hidden from"
        } the website.`,
      });
    } catch (err: unknown) {
      fail(err, "Could not update the media");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!opened || !draft) return;
    setSavingDraft(true);
    try {
      const saved = await updateMegaMenuMedia(opened.id, {
        title: draft.title,
        linkUrl: draft.linkUrl ? normalizeMenuPath(draft.linkUrl) : "",
        altText: draft.altText,
        isActive: draft.isActive,
      });
      setItems((list) => list.map((item) => (item.id === saved.id ? saved : item)));
      setDraft({
        title: saved.title ?? "",
        linkUrl: saved.linkUrl ?? "",
        altText: saved.altText ?? "",
        isActive: saved.isActive,
      });
      Toast.fire({ icon: "success", title: `${saved.fileName} saved.` });
    } catch (err: unknown) {
      fail(err, "Could not save the media details");
    } finally {
      setSavingDraft(false);
    }
  };

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.id));

  /* -------------------------------- Render ------------------------------- */

  if (loadingTargets) {
    return (
      <section className={CARD}>
        <TableSkeleton />
      </section>
    );
  }

  if (!targets.length) {
    return (
      <section className={cn(CARD, "px-5 py-14 text-center")}>
        <ImagesIcon className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="mt-3 text-[14px] font-medium text-slate-900">There is no main menu yet</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">
          Media belongs to a main menu like Men or Women. Add one under{" "}
          <span className="font-medium text-slate-700">Main Menu</span> (or use Load Default Menu
          there), then come back to give it pictures or videos.
        </p>
        {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}
      </section>
    );
  }

  const selectedIds = [...selected];
  const previewMenu =
    storefront.find((entry) => entry.menuItemId === menuId) ??
    storefront.find((entry) => entry.label.toLowerCase() === menu?.label.toLowerCase());

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      {/* ------------------------------ Library ----------------------------- */}
      <section className={cn(CARD, "overflow-hidden")}>
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <ImagesIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
            <h2 className="text-[17px] font-semibold text-slate-900">Mega Menu Media</h2>
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            Pictures, videos and GIFs shown in a menu&apos;s mega menu, where the promo image
            sits. Each menu has its own.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-64">
              <FieldSelect
                value={menuId}
                onValueChange={setMenuId}
                label="Menu"
                options={targets.map((target) => ({
                  value: target.id,
                  label: `${target.label}${countFor(target) ? ` (${countFor(target)})` : ""}`,
                }))}
              />
            </div>
            {menu && !menu.showInMenu && (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-[12px] font-medium text-amber-700">
                {menu.label} is hidden from the website menu
              </span>
            )}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mx-5 mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
          >
            {error}
          </p>
        )}

        {/* Upload */}
        <div className="px-5">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={Object.keys(ACCEPT).join(",")}
            className="sr-only"
            id="mega-menu-upload"
            onChange={(event) => startUpload(Array.from(event.target.files ?? []))}
          />
          <label
            htmlFor="mega-menu-upload"
            onDragOver={(event) => {
              if (dragId) return;
              event.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={onDropFiles}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-7 text-center transition-colors",
              "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#0b0b0b]",
              dropActive
                ? "border-slate-900 bg-slate-50"
                : "border-slate-300 hover:border-slate-400 hover:bg-slate-50/60",
              upload && "pointer-events-none"
            )}
          >
            {upload ? (
              <>
                <Loader2Icon className="h-6 w-6 animate-spin text-slate-500" aria-hidden="true" />
                <span className="mt-2 text-[14px] font-medium text-slate-900">
                  Uploading {upload.count} file{upload.count === 1 ? "" : "s"}…{" "}
                  {Math.round(upload.progress * 100)}%
                </span>
                <span className="mt-3 h-1 w-48 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-slate-900 transition-[width]"
                    style={{ width: `${Math.round(upload.progress * 100)}%` }}
                  />
                </span>
              </>
            ) : (
              <>
                <CloudUploadIcon className="h-6 w-6 text-slate-500" aria-hidden="true" />
                <span className="mt-2 text-[14px] font-medium text-slate-900">
                  {dropActive ? `Drop to upload to ${menu?.label}` : "Upload media"}
                </span>
                <span className="mt-0.5 text-[13px] text-slate-500">
                  Drag files here, or click to browse.
                </span>
                <span className="mt-2 text-[12px] text-slate-400">
                  JPG, PNG, WebP or GIF up to 10 MB. MP4 or WebM up to 50 MB.
                </span>
              </>
            )}
          </label>
        </div>

        {/* Filters and selection */}
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={cn(
                "h-8 cursor-pointer rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b0b0b]",
                filter === option.id
                  ? "border-[#0b0b0b] bg-[#0b0b0b] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {option.label} ({counts[option.id]})
            </button>
          ))}
          {visible.length > 0 && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
              <CheckBox
                checked={allVisibleSelected}
                indeterminate={selected.size > 0}
                onChange={(next) =>
                  setSelected(next ? new Set(visible.map((item) => item.id)) : new Set())
                }
                label="Select all"
              />
              Select all
            </label>
          )}
        </div>

        {selected.size > 0 && (
          <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5">
            <span className="text-[13px] font-medium text-slate-900">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <GhostButton className="h-8" disabled={busy} onClick={() => setActive(selectedIds, true)}>
                <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Show
              </GhostButton>
              <GhostButton className="h-8" disabled={busy} onClick={() => setActive(selectedIds, false)}>
                <EyeOffIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Hide
              </GhostButton>
              <GhostButton
                className="h-8 text-rose-600 hover:text-rose-700"
                disabled={busy}
                onClick={() => remove(selectedIds)}
              >
                <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </GhostButton>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                aria-label="Clear selection"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Library grid */}
        <div className="px-5 pb-5">
          {loadingMedia ? (
            <TableSkeleton rows={3} />
          ) : items.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-[13px] text-slate-500">
              {menu?.label} has no media yet, so the website shows its standard promo image.
              <br />
              Upload a picture, video or GIF above to replace it.
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-[13px] text-slate-500">
              No {FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} for {menu?.label}.
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {visible.map((item) => {
                  const position = items.indexOf(item);
                  return (
                    <li
                      key={item.id}
                      draggable={canArrange}
                      onDragStart={(event) => {
                        setDragId(item.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item.id);
                      }}
                      onDragOver={(event) => {
                        if (!dragId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setOverId(item.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (dragId && dragId !== item.id) arrange(dragId, position);
                        setDragId(null);
                        setOverId(null);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverId(null);
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow,opacity]",
                        openId === item.id
                          ? "border-slate-900 ring-1 ring-slate-900"
                          : selected.has(item.id)
                            ? "border-slate-400"
                            : "border-slate-200 hover:border-slate-300",
                        dragId === item.id && "opacity-40",
                        overId === item.id && dragId !== item.id && "ring-2 ring-slate-400",
                        canArrange && "cursor-grab active:cursor-grabbing"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === item.id ? null : item.id)}
                        aria-label={`Edit ${item.fileName}`}
                        className="block w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0b0b0b]"
                      >
                        <MediaThumb item={item} />
                      </button>

                      <span className="absolute top-2 left-2 rounded-[6px] bg-white/95 p-0.5 shadow-sm">
                        <CheckBox
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          label={`Select ${item.fileName}`}
                        />
                      </span>
                      <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1">
                        {item.type === "GIF" && (
                          <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            GIF
                          </span>
                        )}
                        {settings.itemOrder === "DEFAULT" && item.isActive && (
                          <span
                            className="grid h-5 min-w-5 place-items-center rounded-md bg-black/60 px-1 text-[11px] font-medium text-white"
                            title="Position on the website"
                          >
                            {shown.indexOf(item) + 1}
                          </span>
                        )}
                      </span>

                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-900" title={item.fileName}>
                            {item.fileName}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                            {formatBytes(item.size)}
                            {!item.isActive && (
                              <span className="rounded bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500">
                                Hidden
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenId(openId === item.id ? null : item.id)}
                          aria-label={`Details for ${item.fileName}`}
                          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <InfoIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}

                <li>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={Boolean(upload)}
                    className="flex h-full min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-[13px] text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-300">
                      <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Add more media
                  </button>
                </li>
              </ul>
              {items.length > 1 && (
                <p className="mt-3 text-[12px] text-slate-400">
                  {canArrange
                    ? "Drag a card to change the order."
                    : "Show All to drag cards into a new order."}
                </p>
              )}
            </>
          )}
        </div>

        {/* Details of the opened item */}
        {opened && draft && (
          <div className="border-t border-slate-200/80 bg-slate-50/60 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">Media details</h3>
                <p className="mt-0.5 truncate text-[13px] text-slate-500">
                  {opened.fileName}, {formatBytes(opened.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close details"
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                <MediaThumb item={opened} large />
              </div>

              <div className="flex flex-col gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Heading</span>
                  <input
                    value={draft.title}
                    maxLength={120}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    placeholder="Explore the Trend"
                    className={FIELD}
                  />
                  <span className="mt-1.5 block text-[12px] text-slate-400">
                    Shown over the media. Leave empty for &ldquo;Explore the Trend&rdquo;.
                  </span>
                </label>

                <div>
                  <label
                    htmlFor="mega-media-link"
                    className="mb-1.5 block text-[13px] font-medium text-slate-700"
                  >
                    Link
                  </label>
                  <div className="flex">
                    {!/^https?:\/\//i.test(draft.linkUrl) && (
                      <span className="inline-flex h-10 shrink-0 items-center rounded-l-lg border border-r-0 border-slate-200 bg-white px-3 text-[13px] text-slate-400">
                        {STOREFRONT_HOST}
                      </span>
                    )}
                    <input
                      id="mega-media-link"
                      value={draft.linkUrl}
                      maxLength={500}
                      onChange={(event) => setDraft({ ...draft, linkUrl: event.target.value })}
                      onBlur={() =>
                        draft.linkUrl && setDraft({ ...draft, linkUrl: normalizeMenuPath(draft.linkUrl) })
                      }
                      placeholder={previewMenu?.href ?? "/men"}
                      className={cn(FIELD, !/^https?:\/\//i.test(draft.linkUrl) && "rounded-l-none")}
                    />
                  </div>
                  <span className="mt-1.5 block text-[12px] text-slate-400">
                    Leave empty to link to the {menu?.label} page.
                  </span>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Description for screen readers
                  </span>
                  <input
                    value={draft.altText}
                    maxLength={240}
                    onChange={(event) => setDraft({ ...draft, altText: event.target.value })}
                    placeholder="Man in a navy suit and white shirt"
                    className={FIELD}
                  />
                </label>

                <div className="flex items-start gap-3">
                  <ToggleSwitch
                    checked={draft.isActive}
                    onChange={(isActive) => setDraft({ ...draft, isActive })}
                    label="Show on website"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">Show on website</p>
                    <p className="text-[12px] text-slate-500">
                      Hidden media stays here but is left out of the mega menu.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4">
                  <GhostButton
                    className="h-9"
                    disabled={items.indexOf(opened) === 0}
                    onClick={() => arrange(opened.id, items.indexOf(opened) - 1)}
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Move earlier
                  </GhostButton>
                  <GhostButton
                    className="h-9"
                    disabled={items.indexOf(opened) === items.length - 1}
                    onClick={() => arrange(opened.id, items.indexOf(opened) + 1)}
                  >
                    Move later
                    <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </GhostButton>
                  <GhostButton
                    className="h-9 text-rose-600 hover:text-rose-700"
                    disabled={busy}
                    onClick={() => remove([opened.id])}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </GhostButton>
                  <PrimaryButton className="ml-auto h-9" onClick={saveDraft} disabled={savingDraft}>
                    {savingDraft && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save details
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------- Settings and preview ------------------------ */}
      <div className="flex flex-col gap-5">
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900">Media Settings</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">For {menu?.label} only.</p>
            </div>
            <span aria-live="polite" className="pt-1 text-[12px] text-slate-400">
              {settingsState === "saving"
                ? "Saving…"
                : settingsState === "saved"
                  ? "Saved"
                  : settingsState === "error"
                    ? "Not saved"
                    : ""}
            </span>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Show media</p>
                <p className="text-[12px] text-slate-500">
                  {settings.enabled
                    ? `${menu?.label}'s mega menu shows the media here.`
                    : "Off: the website shows its standard promo image."}
                </p>
              </div>
              <ToggleSwitch
                checked={settings.enabled}
                onChange={(enabled) => writeSettings({ enabled })}
                label="Show media in the mega menu"
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-slate-900">Slideshow</p>
                <p className="text-[12px] text-slate-500">
                  Rotates the media when 2 or more are shown. A single item stays still.
                </p>
              </div>
              <ToggleSwitch
                checked={settings.autoSlide}
                onChange={(autoSlide) => writeSettings({ autoSlide })}
                label="Rotate media automatically"
                disabled={!settings.enabled}
              />
            </div>

            <div>
              <label htmlFor="mega-slide-duration" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                Slide duration
              </label>
              <div className="flex">
                <input
                  id="mega-slide-duration"
                  inputMode="numeric"
                  value={durationText}
                  disabled={!settings.enabled || !settings.autoSlide}
                  aria-invalid={Boolean(durationError)}
                  aria-describedby="mega-slide-duration-hint"
                  onChange={(event) => setDurationText(event.target.value)}
                  onBlur={commitDuration}
                  onKeyDown={(event) => event.key === "Enter" && commitDuration()}
                  className={cn(
                    FIELD,
                    "rounded-r-none disabled:bg-slate-50 disabled:text-slate-400",
                    durationError && "border-rose-300 focus:border-rose-400"
                  )}
                />
                <span className="inline-flex h-10 shrink-0 items-center rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500">
                  seconds
                </span>
              </div>
              <p
                id="mega-slide-duration-hint"
                className={cn("mt-1.5 text-[12px]", durationError ? "text-rose-600" : "text-slate-400")}
              >
                {durationError || "How long each slide stays on screen, 2 to 60 seconds."}
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-slate-900">Item order</span>
              <FieldSelect
                value={settings.itemOrder}
                onValueChange={(itemOrder) => writeSettings({ itemOrder: itemOrder as MegaMenuMediaOrder })}
                options={ORDER_OPTIONS}
                label="Item order"
                disabled={!settings.enabled}
              />
              <p className="mt-1.5 text-[12px] text-slate-400">
                {settings.itemOrder === "DEFAULT"
                  ? "The order of the cards. Drag them to change it."
                  : settings.itemOrder === "RANDOM"
                    ? "Shuffled every time the page loads."
                    : "By upload date."}
              </p>
            </div>

            <p className="flex gap-2.5 rounded-lg bg-slate-50 px-3.5 py-3 text-[13px] text-slate-600">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>{statusLine(settings, activeCount, items.length, menu?.label ?? "This menu")}</span>
            </p>
          </div>
        </section>

        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
            <h2 className="text-[17px] font-semibold text-slate-900">Live Preview</h2>
            <div className="flex items-center gap-1">
              {settings.itemOrder === "RANDOM" && shown.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShuffleSeed((s) => s + 1)}
                  className="h-8 cursor-pointer rounded-lg px-2.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  Shuffle
                </button>
              )}
              <button
                type="button"
                onClick={() => window.open(STOREFRONT_URL, "_blank", "noopener")}
                aria-label="Open the website in a new tab"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <SquareArrowOutUpRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="px-5 pb-5">
            <MegaMenuPreview
              menus={storefront}
              activeLabel={menu?.label ?? ""}
              activeMenu={previewMenu ?? null}
              media={settings.enabled ? shown : []}
              settings={settings}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/** One sentence saying what the website does right now with this menu's media. */
function statusLine(settings: MegaMenuSettings, active: number, total: number, label: string) {
  if (!settings.enabled) return `Media is off for ${label}. The website shows its standard promo image.`;
  if (!total) return `${label} has no media yet. The website shows its standard promo image.`;
  if (!active) return `All of ${label}'s media is hidden. The website shows its standard promo image.`;
  const hidden = total - active;
  const lead = `${active} of ${total} item${total === 1 ? "" : "s"} show${active === 1 ? "s" : ""} on the website`;
  if (active === 1) return `${lead}, as a still image.${hidden ? " Hidden items are skipped." : ""}`;
  if (!settings.autoSlide)
    return `${lead}. Each time the menu opens it shows the next one, and visitors can pick one from the dots.`;
  return `${lead}, rotating every ${settings.slideDuration} seconds. Each time the menu opens it starts on the next one.`;
}

/* ---------------------------------------------------------------------------
   Thumbnails
   ------------------------------------------------------------------------ */

function MediaThumb({ item, large = false }: { item: MediaItem; large?: boolean }) {
  return (
    <div className="relative aspect-[4/3] bg-slate-100">
      {item.type === "VIDEO" ? (
        <>
          <video
            src={`${item.url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            controls={large}
            className={cn("h-full w-full", large ? "object-contain" : "object-cover")}
          />
          {!large && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-black/40 text-white">
                <PlayIcon className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
              </span>
            </span>
          )}
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.altText ?? ""}
          loading="lazy"
          className={cn("h-full w-full", large ? "object-contain" : "object-cover", !item.isActive && !large && "opacity-50")}
        />
      )}
      {!large && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 p-1 text-white">
          {item.type === "VIDEO" ? (
            <FilmIcon className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-3 w-3" aria-hidden="true" />
          )}
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Live preview — the storefront's header unfolded into its mega menu, at a
   fraction of the size: the same #080808 curtain, the same grey column
   headings over a rule, and the media slot rotating exactly as the website
   will rotate it.
   ------------------------------------------------------------------------ */

function MegaMenuPreview({
  menus,
  activeLabel,
  activeMenu,
  media,
  settings,
}: {
  menus: StorefrontMenu[];
  activeLabel: string;
  activeMenu: StorefrontMenu | null;
  media: MediaItem[];
  settings: MegaMenuSettings;
}) {
  const [index, setIndex] = useState(0);
  const count = media.length;
  const rotates = settings.autoSlide && count >= 2;
  const safeIndex = count ? index % count : 0;
  const current = media[safeIndex];

  useEffect(() => {
    if (!rotates) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      Math.max(2, settings.slideDuration) * 1000
    );
    return () => window.clearInterval(timer);
  }, [rotates, count, settings.slideDuration]);

  const groups = activeMenu?.groups ?? [];
  const middle = Math.ceil(groups.length / 2);
  const columns = [groups.slice(0, middle), groups.slice(middle)];
  const labels = menus.length ? menus.map((m) => m.label) : [activeLabel];

  return (
    <div
      className="@container overflow-hidden rounded-xl bg-[#080808] text-white"
      style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}
      aria-label={`Preview of the ${activeLabel} mega menu`}
      role="img"
    >
      <div className="flex items-center gap-5 px-4 pt-3.5 pb-3">
        <span className="shrink-0 text-[15px] tracking-[0.01em] text-white">windrise</span>
        <span className="flex min-w-0 gap-3 overflow-hidden text-[10px] text-white/70">
          {labels.map((label) => (
            <span
              key={label}
              className={cn(
                "shrink-0 pb-1",
                label === activeLabel ? "border-b border-white text-white" : ""
              )}
            >
              {label}
            </span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 pt-1 pb-4 @[380px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.9fr)]">
        <ul className="hidden space-y-1.5 text-[9px] text-[#707070] @[380px]:block">
          {(activeMenu?.collections ?? []).map((link) => (
            <li key={link.label} className="truncate">
              {link.label}
            </li>
          ))}
        </ul>
        {columns.map((column, c) => (
          <div key={c} className="hidden space-y-3 @[380px]:block">
            {column.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 truncate border-b border-[#707070]/70 pb-0.5 text-[9px] text-[#707070]">
                  {group.label}
                </p>
                <ul className="space-y-1 text-[8.5px] text-[#707070]">
                  {group.items.slice(0, 7).map((item) => (
                    <li key={item.label} className="truncate">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}

        {/* The media slot */}
        <div className="relative aspect-[544/306] self-start overflow-hidden bg-white/[0.04]">
          {current ? (
            <>
              {media.map((item, i) => (
                <div
                  key={item.id}
                  className={cn(
                    // The website's transition: a slow cross-fade, settling from a hair larger.
                    "absolute inset-0 transition-[opacity,transform] duration-1200 ease-in-out motion-reduce:duration-0",
                    i === safeIndex ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"
                  )}
                >
                  {item.type === "VIDEO" ? (
                    <video
                      src={item.url}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="text-[7px] font-medium tracking-widest text-white/80 uppercase">Featured</p>
                <p className="mt-0.5 truncate text-[11px] font-medium">{current.title || "Explore the Trend"}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[8px] font-light">
                  Explore <ArrowRightIcon className="h-2 w-2" aria-hidden="true" />
                </p>
              </div>
              {count > 1 && (
                <span className="absolute right-2.5 bottom-2.5 flex gap-1">
                  {media.map((item, i) => (
                    <span
                      key={item.id}
                      className={cn(
                        "h-1 rounded-full transition-all duration-500",
                        i === safeIndex ? "w-3 bg-white" : "w-1 bg-white/45"
                      )}
                    />
                  ))}
                </span>
              )}
            </>
          ) : (
            <span className="absolute inset-0 grid place-items-center px-3 text-center text-[10px] leading-snug text-white/45">
              {settings.enabled ? "No media shown yet. The standard promo image appears here." : "Media off. The standard promo image appears here."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
