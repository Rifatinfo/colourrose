"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, Loader2Icon, SearchIcon, UploadCloudIcon } from "lucide-react";

import { getMedia, mediaUrl, uploadBlogImage } from "@/services/blog/blog";
import type { BlogMediaItem } from "@/types/blog";
import { cn } from "@/lib/utils";
import { Btn, Modal } from "./ui";

/**
 * The blog's media library: every image uploaded through the blog, newest
 * first. Pick one (most places) or several (galleries); "Upload new" adds to
 * the library and, for a single pick, uses the upload straight away.
 */
export function MediaLibrary({
  multiple = false,
  onPick,
  onClose,
}: {
  multiple?: boolean;
  onPick: (urls: string[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<BlogMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const res = await getMedia({ limit: 120, searchTerm: term || undefined });
      setItems(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the media library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search.trim()), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  const upload = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      setError("Choose an image file (JPG, PNG or WebP).");
      return;
    }
    setUploading(images.length);
    const urls: string[] = [];
    try {
      for (const file of images) {
        const res = await uploadBlogImage(file);
        urls.push(res.data.url);
      }
      if (!multiple && urls[0]) {
        onPick([urls[0]]);
        return;
      }
      setSelected((current) => [...current, ...urls]);
      await load(search.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(0);
    }
  };

  const toggle = (url: string) => {
    if (!multiple) {
      onPick([url]);
      return;
    }
    setSelected((current) => (current.includes(url) ? current.filter((entry) => entry !== url) : [...current, url]));
  };

  return (
    <Modal
      title="Media Library"
      subtitle={multiple ? "Select one or more images" : "Click an image to use it"}
      size="lg"
      onClose={onClose}
      footer={
        multiple ? (
          <>
            <span className="mr-auto text-[12px] text-slate-500">{selected.length} selected</span>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!selected.length} onClick={() => onPick(selected)}>
              {selected.length ? `Add ${selected.length} image${selected.length === 1 ? "" : "s"}` : "Add images"}
            </Btn>
          </>
        ) : undefined
      }
    >
      <div className="p-4">
        <label className="relative mb-4 block max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file name"
            aria-label="Search the media library"
            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-[13px] outline-none focus:border-slate-400"
          />
        </label>

        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
            {error}
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />

        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void upload(Array.from(event.dataTransfer.files));
          }}
        >
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading > 0}
            className="flex min-h-[124px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[12px] text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-wait"
          >
            {uploading ? (
              <>
                <Loader2Icon className="h-5 w-5 animate-spin" />
                Uploading {uploading}…
              </>
            ) : (
              <>
                <UploadCloudIcon className="h-5 w-5" />
                Upload new
              </>
            )}
          </button>

          {items.map((item) => {
            const on = selected.includes(item.url);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.url)}
                aria-pressed={multiple ? on : undefined}
                className={cn(
                  "relative cursor-pointer overflow-hidden rounded-lg border bg-white text-left transition-[border-color,box-shadow]",
                  on ? "border-blue-600 ring-2 ring-blue-600" : "border-slate-200 hover:border-slate-300"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(item.url) ?? ""} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-[11px] text-slate-600">{item.name}</span>
                {multiple && (
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded border-[1.5px]",
                      on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                    )}
                  >
                    {on && <CheckIcon className="h-3 w-3" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2Icon className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && !items.length && (
          <p className="py-8 text-center text-[13px] text-slate-500">
            {search ? "No images match that name." : "The library is empty. Upload an image to start it."}
          </p>
        )}
      </div>
    </Modal>
  );
}
