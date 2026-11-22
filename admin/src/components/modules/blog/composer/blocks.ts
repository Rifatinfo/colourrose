import {
  CodeIcon,
  GalleryHorizontalEndIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  type LucideIcon,
  MinusIcon,
  MousePointerClickIcon,
  MoveVerticalIcon,
  QuoteIcon,
  ShoppingBagIcon,
  SparkleIcon,
  TypeIcon,
  VideoIcon,
} from "lucide-react";

/* =========================================================================
   Story Composer — block definitions.

   One place for what each block is: its label and icon, the data it holds,
   the "Adjust" overrides it offers, the spacing it takes by default, and the
   built-in templates made from them. The renderer, the editor cards and the
   template/paste tools all read from here, so a block type is added once.

   The storefront keeps a copy of the rendering half of this file
   (`windrise-client/src/components/modules/blog/story/blocks.ts`); the
   server validates the same shapes in `blog.blocks.ts`. Keep the three in
   step.
   ========================================================================= */

export type BlockType =
  | "text"
  | "heading"
  | "subheading"
  | "pull"
  | "image"
  | "gallery"
  | "video"
  | "highlight"
  | "product"
  | "cta"
  | "divider"
  | "spacer"
  | "advanced";

export type ImageDisplay = "Standard" | "Wide" | "Full Width";

export type BlockData = {
  text: { html: string };
  heading: { text: string };
  subheading: { text: string };
  pull: { text: string; cite: string };
  image: { img: string; alt: string; cap: string; disp: ImageDisplay };
  gallery: { imgs: string[]; layout: "Grid" | "Two Column" | "Mosaic"; cap: string };
  video: { url: string; poster: string; cap: string };
  highlight: { label: string; text: string };
  product: {
    mode: "products" | "collection";
    items: string[];
    coll: string;
    layout: "Grid" | "Single feature";
  };
  cta: { title: string; desc: string; btn: string; link: string };
  divider: { style: "Line" | "Short Rule" | "Dots" };
  spacer: { h: number };
  advanced: { html: string };
};

export type Block<T extends BlockType = BlockType> = {
  [K in T]: {
    id: string;
    type: K;
    hidden: boolean;
    collapsed: boolean;
    /** Placeholder hint, from a template. */
    ph: string;
    /** Style overrides; a missing key means the Windrise default. */
    adj: Record<string, string>;
    data: BlockData[K];
  };
}[T];

/** A product as a story card shows it (resolved by the API). */
export type StoryProduct = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  image: string | null;
  href: string | null;
};

export type StoryCollection = {
  slug: string;
  title: string;
  href: string;
  products: StoryProduct[];
};

export type StoryProducts = {
  products: Record<string, StoryProduct>;
  collections: Record<string, StoryCollection>;
};

export const EMPTY_PRODUCTS: StoryProducts = { products: {}, collections: {} };

/* --------------------------------- Catalog -------------------------------- */

export const BLOCKS: Record<
  BlockType,
  { label: string; icon: LucideIcon; desc: string; /** Can turn into another text type. */ textLike?: boolean }
> = {
  text: { label: "Text", icon: TypeIcon, desc: "Paragraphs with basic formatting", textLike: true },
  heading: { label: "Section Heading", icon: Heading2Icon, desc: "Starts a new section", textLike: true },
  subheading: { label: "Subheading", icon: Heading3Icon, desc: "Smaller heading inside a section", textLike: true },
  pull: { label: "Pull Text", icon: QuoteIcon, desc: "Paste a quote, styled automatically", textLike: true },
  image: { label: "Image", icon: ImageIcon, desc: "Single image with caption" },
  gallery: { label: "Gallery", icon: GalleryHorizontalEndIcon, desc: "Several images in a grid" },
  video: { label: "Video", icon: VideoIcon, desc: "YouTube or Vimeo link" },
  highlight: { label: "Editorial Highlight", icon: SparkleIcon, desc: "Key takeaway box", textLike: true },
  product: { label: "Product / Collection", icon: ShoppingBagIcon, desc: "Shoppable product cards" },
  cta: { label: "CTA", icon: MousePointerClickIcon, desc: "Call to action with button" },
  divider: { label: "Divider", icon: MinusIcon, desc: "Separates sections" },
  spacer: { label: "Spacer", icon: MoveVerticalIcon, desc: "Adds vertical space" },
  advanced: { label: "Advanced Content", icon: CodeIcon, desc: "Full rich-text editor" },
};

/** The Add Block menu, three to a row. */
export const ADD_ORDER: BlockType[] = [
  "text", "image", "cta",
  "heading", "gallery", "divider",
  "subheading", "video", "spacer",
  "pull", "product", "advanced",
  "highlight",
];

/** Text blocks that can turn into one another. */
export const TURN_INTO: BlockType[] = ["text", "heading", "subheading", "pull", "highlight"];

/** Blocks too small to be worth collapsing. */
export const NEVER_COLLAPSE = new Set<BlockType>(["heading", "subheading", "divider", "spacer"]);

/* --------------------------------- Adjust --------------------------------- */

export type AdjustField = { key: string; label: string; options: string[] };

const SPACING = ["Auto", "None", "Small", "Medium", "Large", "Extra Large"];
const SPACE_PX: Record<string, number> = { None: 0, Small: 12, Medium: 28, Large: 48, "Extra Large": 72 };
const BEFORE_AFTER: AdjustField[] = [
  { key: "before", label: "Spacing Before", options: SPACING },
  { key: "after", label: "Spacing After", options: SPACING },
];
const HEADING: AdjustField[] = [
  { key: "style", label: "Style", options: ["Windrise Default", "Sans Bold", "Uppercase Label"] },
  { key: "size", label: "Size", options: ["Auto", "Small", "Large"] },
  { key: "align", label: "Alignment", options: ["Auto", "Left", "Center"] },
  ...BEFORE_AFTER,
];

/** The overrides each block offers. The first option is always the default. */
export const ADJUST: Partial<Record<BlockType, AdjustField[]>> = {
  text: [
    { key: "size", label: "Size", options: ["Auto", "Small", "Large"] },
    { key: "align", label: "Alignment", options: ["Auto", "Left", "Justify", "Center"] },
    { key: "dropcap", label: "Drop Cap", options: ["Auto", "On", "Off"] },
    ...BEFORE_AFTER,
  ],
  heading: HEADING,
  subheading: HEADING,
  pull: [
    { key: "style", label: "Style", options: ["Windrise Default", "Rule Lines", "Quote Mark", "Minimal Italic", "Accent Block"] },
    { key: "size", label: "Size", options: ["Auto", "Small", "Medium", "Large", "Extra Large"] },
    { key: "width", label: "Width", options: ["Auto", "Narrow", "Column", "Wide"] },
    { key: "align", label: "Alignment", options: ["Auto", "Left", "Center", "Right"] },
    ...BEFORE_AFTER,
  ],
  image: [
    { key: "corners", label: "Corners", options: ["Auto", "Square", "Rounded"] },
    { key: "capAlign", label: "Caption", options: ["Auto", "Left", "Center"] },
    ...BEFORE_AFTER,
  ],
  gallery: [{ key: "gap", label: "Gap", options: ["Auto", "Tight", "Loose"] }, ...BEFORE_AFTER],
  video: BEFORE_AFTER,
  highlight: [
    { key: "style", label: "Style", options: ["Windrise Default", "Outline", "Left Rule", "Dark"] },
    { key: "align", label: "Alignment", options: ["Auto", "Left", "Center"] },
    ...BEFORE_AFTER,
  ],
  product: [{ key: "card", label: "Card Style", options: ["Auto", "Minimal", "Bordered"] }, ...BEFORE_AFTER],
  cta: [
    { key: "style", label: "Style", options: ["Windrise Default", "Dark Banner", "Light Card", "Button Only"] },
    { key: "align", label: "Alignment", options: ["Auto", "Left", "Center"] },
    ...BEFORE_AFTER,
  ],
};

/** Default space above and below each block, px. */
const DEFAULT_SPACE: Record<BlockType, [number, number]> = {
  text: [0, 0],
  heading: [38, 12],
  subheading: [26, 8],
  pull: [38, 38],
  image: [28, 28],
  gallery: [28, 28],
  video: [28, 28],
  highlight: [30, 30],
  product: [32, 32],
  cta: [36, 36],
  divider: [30, 30],
  spacer: [0, 0],
  advanced: [14, 14],
};

export const spaceOf = (block: Block, side: "before" | "after") => {
  const value = block.adj[side];
  return value && value !== "Auto" && value in SPACE_PX
    ? SPACE_PX[value]
    : DEFAULT_SPACE[block.type][side === "before" ? 0 : 1];
};

/** Whether a block overrides any of its defaults. */
export const isCustomStyled = (block: Block) =>
  Object.entries(block.adj).some(([key, value]) => {
    const field = ADJUST[block.type]?.find((entry) => entry.key === key);
    return Boolean(value) && Boolean(field) && value !== field!.options[0];
  });

/* ---------------------------------- Make ---------------------------------- */

let counter = 0;
export const uid = () => `b${Date.now().toString(36)}${(++counter).toString(36)}`;

export function defaultData<T extends BlockType>(type: T): BlockData[T] {
  const defaults: { [K in BlockType]: BlockData[K] } = {
    text: { html: "" },
    heading: { text: "" },
    subheading: { text: "" },
    pull: { text: "", cite: "" },
    image: { img: "", alt: "", cap: "", disp: "Standard" },
    gallery: { imgs: [], layout: "Grid", cap: "" },
    video: { url: "", poster: "", cap: "" },
    highlight: { label: "In brief", text: "" },
    product: { mode: "products", items: [], coll: "", layout: "Grid" },
    cta: { title: "", desc: "", btn: "Shop Collection", link: "/" },
    divider: { style: "Line" },
    spacer: { h: 48 },
    advanced: { html: "" },
  };
  return structuredClone(defaults[type]);
}

export function makeBlock<T extends BlockType>(
  type: T,
  data: Partial<BlockData[T]> = {},
  extra: Partial<Pick<Block, "ph" | "collapsed" | "hidden">> = {}
): Block<T> {
  return {
    id: uid(),
    type,
    hidden: false,
    collapsed: false,
    ph: "",
    adj: {},
    ...extra,
    data: { ...defaultData(type), ...data },
  } as Block<T>;
}

/**
 * Blocks from the API, filled out with defaults so every field the editor
 * reads exists even on blocks saved by an older version.
 */
export function normalizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((raw): raw is { type: BlockType } => Boolean(raw) && typeof raw === "object" && (raw as { type?: string }).type! in BLOCKS)
    .map((raw) => {
      const value = raw as Partial<Block> & { type: BlockType };
      return {
        id: value.id || uid(),
        type: value.type,
        hidden: Boolean(value.hidden),
        collapsed: Boolean(value.collapsed),
        ph: value.ph ?? "",
        adj: { ...(value.adj ?? {}) },
        data: { ...defaultData(value.type), ...((value.data as object) ?? {}) },
      } as Block;
    });
}

/* ---------------------------------- Read ---------------------------------- */

export const stripHtml = (html: string) => {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
};

export const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;

/** A block's readable text, for word counts and the AI draft. */
export function blockText(block: Block): string {
  switch (block.type) {
    case "text":
    case "advanced":
      return stripHtml(block.data.html);
    case "heading":
    case "subheading":
    case "pull":
    case "highlight":
      return block.data.text;
    case "cta":
      return `${block.data.title} ${block.data.desc}`;
    case "image":
    case "gallery":
    case "video":
      return block.data.cap;
    default:
      return "";
  }
}

/** One line describing a collapsed block. */
export function blockSummary(block: Block, names: { product: (id: string) => string; collection: (slug: string) => string }): string {
  const d = block.data;
  switch (block.type) {
    case "text":
    case "advanced":
      return stripHtml((d as BlockData["text"]).html);
    case "heading":
    case "subheading":
      return (d as BlockData["heading"]).text;
    case "pull":
      return (d as BlockData["pull"]).text ? `“${(d as BlockData["pull"]).text}”` : "";
    case "image": {
      const image = d as BlockData["image"];
      return image.img ? `${image.cap || image.alt || "Image"} · ${image.disp}` : "";
    }
    case "gallery": {
      const gallery = d as BlockData["gallery"];
      return gallery.imgs.length
        ? [`${gallery.imgs.length} images`, gallery.layout, gallery.cap].filter(Boolean).join(" · ")
        : "";
    }
    case "video":
      return (d as BlockData["video"]).url;
    case "highlight": {
      const highlight = d as BlockData["highlight"];
      return highlight.text ? `${highlight.label}: ${highlight.text}` : "";
    }
    case "product": {
      const product = d as BlockData["product"];
      return product.mode === "collection"
        ? product.coll
          ? names.collection(product.coll)
          : ""
        : product.items.map(names.product).join(", ");
    }
    case "cta": {
      const cta = d as BlockData["cta"];
      return cta.title ? `${cta.title} → ${cta.btn}` : "";
    }
    case "divider":
      return (d as BlockData["divider"]).style;
    case "spacer":
      return `${(d as BlockData["spacer"]).h}px`;
  }
}

/** A text-like block as plain paragraphs, for turning it into another type. */
export function plainTextOf(block: Block): string {
  if (block.type === "text") {
    if (typeof document === "undefined") return stripHtml(block.data.html);
    const div = document.createElement("div");
    div.innerHTML = block.data.html;
    const parts = Array.from(div.querySelectorAll("p,li"))
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean);
    return parts.join("\n\n") || stripHtml(block.data.html);
  }
  if ("text" in block.data) return block.data.text;
  return "";
}

/* ------------------------------ Paste & Split ----------------------------- */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain text to paragraphs: blank lines split, single newlines break. */
export const textToParagraphs = (text: string) =>
  text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");

export type SplitKind = "text" | "heading" | "subheading" | "pull" | "highlight" | "list" | "skip";

export const SPLIT_LABELS: Record<SplitKind, string> = {
  text: "Text",
  heading: "Section Heading",
  subheading: "Subheading",
  pull: "Pull Text",
  highlight: "Editorial Highlight",
  list: "Text (list)",
  skip: "Skip",
};

/** Guesses what a pasted paragraph is: "## x" headings, "quoted" pull text, lists… */
export function classifyParagraph(raw: string): [SplitKind, string] {
  const text = raw.trim();
  if (/^#{3}\s/.test(text)) return ["subheading", text.replace(/^#+\s*/, "")];
  if (/^#{1,2}\s/.test(text)) return ["heading", text.replace(/^#+\s*/, "")];
  if (/^[“"][\s\S]+[”"]$/.test(text) || /^>\s/.test(text)) {
    return ["pull", text.replace(/^>\s*/, "").replace(/^[“"]|[”"]$/g, "")];
  }
  if (text.split(/\n/).every((line) => /^\s*([-•*]|\d+[.)])\s+/.test(line))) return ["list", text];
  if (text.length < 80 && !/[.!?:;,]$/.test(text) && wordCount(text) <= 12) return ["heading", text];
  return ["text", text];
}

/** Classified paragraphs into blocks; runs of text and lists merge into one Text block. */
export function paragraphsToBlocks(rows: [SplitKind, string][]): Block[] {
  const out: Block[] = [];
  const appendText = (html: string) => {
    const last = out[out.length - 1];
    if (last && last.type === "text") last.data.html += html;
    else out.push(makeBlock("text", { html }));
  };
  for (const [kind, text] of rows) {
    if (kind === "skip") continue;
    if (kind === "list") {
      const ordered = /^\s*\d/.test(text);
      const items = text
        .split(/\n/)
        .map((line) => `<li>${escapeHtml(line.replace(/^\s*([-•*]|\d+[.)])\s+/, ""))}</li>`)
        .join("");
      appendText(ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`);
    } else if (kind === "text") {
      appendText(`<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`);
    } else if (kind === "highlight") {
      out.push(makeBlock("highlight", { text }));
    } else {
      out.push(makeBlock(kind, { text: text.replace(/\s+/g, " ") }));
    }
  }
  return out;
}

export const splitIntoParagraphs = (text: string) =>
  text.replace(/\r/g, "").split(/\n{2,}/).filter((part) => part.trim());

/* -------------------------------- Templates ------------------------------- */

const hint = <T extends BlockType>(type: T, ph: string, data: Partial<BlockData[T]> = {}) =>
  makeBlock(type, data, { ph });

export type BuiltInTemplate = { key: string; name: string; description: string; build: () => Block[] };

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    key: "blank",
    name: "Blank Story",
    description: "One empty text block to start from",
    build: () => [hint("text", "Start writing your story…")],
  },
  {
    key: "style-guide",
    name: "Style Guide",
    description: "Intro, key pieces, how to wear it, shop",
    build: () => [
      hint("text", "Introduce the look in two or three sentences…"),
      hint("heading", "The key pieces"),
      makeBlock("image"),
      hint("text", "Describe each piece and why it works together…"),
      hint("subheading", "How to wear it"),
      hint("text", "Give practical styling advice: occasions, pairings, colours…"),
      hint("pull", "A memorable line from the stylist or designer…"),
      makeBlock("product"),
      makeBlock("cta", { title: "Shop the look", desc: "Every piece from this guide, in one place." }),
    ],
  },
  {
    key: "trend-story",
    name: "Trend Story",
    description: "Narrative, quote, gallery, takeaway",
    build: () => [
      hint("text", "Open with what you are seeing on the street or runway…"),
      hint("heading", "Name the trend"),
      hint("pull", "Quote someone who is wearing or making it…"),
      makeBlock("gallery", { layout: "Mosaic" }),
      hint("text", "Explain where the trend comes from and why now…"),
      hint("highlight", "Summarise the trend in one sentence…", { label: "The takeaway" }),
      hint("text", "Close with where the trend is heading next…"),
      makeBlock("cta", { title: "Explore the edit", desc: "Pieces that capture this season’s direction." }),
    ],
  },
  {
    key: "fit-fabric",
    name: "Fit & Fabric",
    description: "Fabric notes, fit advice, size guide",
    build: () => [
      hint("text", "Introduce the garment and who it is for…"),
      hint("heading", "The fabric"),
      makeBlock("image"),
      hint("text", "Weave, weight, feel and how it behaves in Dhaka weather…"),
      hint("heading", "The fit"),
      hint("highlight", "Model is 5′11″ and wears size M…", { label: "Size guide" }),
      hint("text", "How it sits on the shoulders, chest and hem…"),
      makeBlock("product", { layout: "Single feature" }),
      makeBlock("cta", { title: "Find your size", desc: "Free exchanges within 7 days.", btn: "View size chart" }),
    ],
  },
  {
    key: "care-guide",
    name: "Care Guide",
    description: "Washing, drying, storage, quick tips",
    build: () => [
      hint("text", "Explain why this fabric needs a little extra care…"),
      hint("heading", "Washing"),
      hint("text", "Water temperature, detergent, hand-wash or machine…"),
      hint("heading", "Drying and ironing"),
      hint("text", "Shade drying, iron temperature, steam…"),
      hint("highlight", "Three quick tips to remember…", { label: "Quick care tips" }),
      makeBlock("divider"),
      makeBlock("cta", { title: "Questions about care?", desc: "Our team answers within a day.", btn: "Contact us", link: "/support" }),
    ],
  },
];

/**
 * A block as a structure-only template keeps: its type, layout choices and
 * style overrides. Its words become the placeholder hint for the next story.
 */
export function toStructureOnly(block: Block, summary: string): Block {
  const keep: Partial<Record<BlockType, string[]>> = {
    image: ["disp"],
    gallery: ["layout"],
    product: ["mode", "coll", "layout", "items"],
    cta: ["btn", "link"],
    divider: ["style"],
    spacer: ["h"],
    highlight: ["label"],
  };
  const data = defaultData(block.type) as Record<string, unknown>;
  for (const key of keep[block.type] ?? []) data[key] = (block.data as Record<string, unknown>)[key];
  const textual = ["text", "heading", "subheading", "pull", "highlight", "advanced"].includes(block.type);
  const ph = block.ph || (textual && summary ? (summary.length > 70 ? `${summary.slice(0, 68)}…` : summary) : "");
  return { ...block, id: uid(), ph, collapsed: false, data } as Block;
}

/* ---------------------------------- Video --------------------------------- */

export const youTubeId = (url: string) =>
  /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(url ?? "")?.[1] ?? "";

export const vimeoId = (url: string) => /vimeo\.com\/(?:video\/)?(\d+)/.exec(url ?? "")?.[1] ?? "";

/** Where a video plays: an embed for YouTube/Vimeo, the file itself otherwise. */
export function videoSource(url: string): { kind: "youtube" | "vimeo" | "file" | "none"; src: string } {
  const yt = youTubeId(url);
  if (yt) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0` };
  const vimeo = vimeoId(url);
  if (vimeo) return { kind: "vimeo", src: `https://player.vimeo.com/video/${vimeo}?autoplay=1` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("/uploads/")) return { kind: "file", src: url };
  return { kind: url ? "file" : "none", src: url };
}

/** ৳3,450 — the storefront's price format. */
export const taka = (amount: number) => `৳${Math.round(amount).toLocaleString("en-IN")}`;
