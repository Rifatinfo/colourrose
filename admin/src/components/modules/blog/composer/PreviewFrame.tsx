"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/* =========================================================================
   A device preview: the story rendered into an iframe at the device's real
   width, then scaled to fit the panel.

   An iframe rather than a scaled <div> because the storefront's layout is
   written with viewport breakpoints. Inside an 820px-wide iframe, `md:` and
   `lg:` respond to 820px — the tablet layout is the real one, not an
   imitation of it. The dashboard's stylesheets are copied in (and kept in
   step while developing), and React renders into it through a portal, so the
   preview is just more of this page's React tree.
   ========================================================================= */

export type Device = "desktop" | "tablet" | "mobile";

export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1200, tablet: 820, mobile: 390 };

export type PreviewFrameHandle = {
  /** Scrolls a block (by id, or "head" / "lead" / "feat") into view and flashes it. */
  scrollTo: (id: string) => void;
};

/** Copies the page's stylesheets and font classes into the frame. */
function syncStyles(doc: Document) {
  doc.head.querySelectorAll("[data-copied]").forEach((node) => node.remove());
  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute("data-copied", "");
    doc.head.appendChild(copy);
  });
  doc.documentElement.className = document.documentElement.className;
  doc.body.className = "";
}

export const PreviewFrame = forwardRef<
  PreviewFrameHandle,
  {
    device: Device;
    /** "fixed": a scrolling panel of this height. Omit to grow with the page. */
    height?: number;
    className?: string;
    children: ReactNode;
  }
>(function PreviewFrame({ device, height, className, children }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(800);

  const width = DEVICE_WIDTH[device];
  const bezel = device !== "desktop";
  const pad = bezel ? (device === "tablet" ? 18 : 14) + 28 : 0;

  // Mount: an empty document, then the page's styles.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const init = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      syncStyles(doc);
      doc.body.style.margin = "0";
      setBody(doc.body);
    };
    if (frame.contentDocument?.readyState === "complete") init();
    frame.addEventListener("load", init);
    // Styles change while developing (hot reload); keep the copy in step.
    const observer = new MutationObserver(() => {
      if (frame.contentDocument) syncStyles(frame.contentDocument);
    });
    observer.observe(document.head, { childList: true });
    return () => {
      frame.removeEventListener("load", init);
      observer.disconnect();
    };
  }, []);

  // Fit the device width into the panel.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const fit = () => {
      const available = Math.max(200, scroller.clientWidth - pad - 2);
      setScale(Math.min(1, available / width));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [width, pad]);

  // Grow the frame with its content.
  useEffect(() => {
    if (!body) return;
    const measure = () => setPageHeight(Math.max(400, body.scrollHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [body, device]);

  const scrollTo = useCallback(
    (id: string) => {
      const scroller = scrollRef.current;
      const target = body?.querySelector<HTMLElement>(`[data-bid="${CSS.escape(id)}"]`);
      if (!scroller || !target || !height) return;
      const top = target.getBoundingClientRect().top - body!.getBoundingClientRect().top;
      scroller.scrollTo({ top: Math.max(0, top * scale - 30), behavior: "smooth" });
      target.classList.remove("wr-flash");
      void target.offsetWidth;
      target.classList.add("wr-flash");
    },
    [body, height, scale]
  );

  useImperativeHandle(ref, () => ({ scrollTo }), [scrollTo]);

  const scaledWidth = Math.floor(width * scale);
  const scaledHeight = Math.ceil(pageHeight * scale);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "relative overflow-auto rounded-lg border border-slate-200 bg-slate-100 [scrollbar-width:thin]",
        className
      )}
      style={height ? { height } : { height: scaledHeight + (bezel ? pad : 0) }}
    >
      <div
        className={cn(
          "relative mx-auto overflow-hidden bg-white",
          bezel && "my-3.5 box-content border-[7px] border-[#15171C]",
          device === "tablet" && "rounded-[18px] border-[9px]",
          device === "mobile" && "rounded-[26px]"
        )}
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        <iframe
          ref={frameRef}
          title="Story preview"
          srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width, height: pageHeight, transform: `scale(${scale})` }}
          tabIndex={-1}
        />
      </div>
      {body && createPortal(children, body)}
    </div>
  );
});
