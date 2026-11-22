import type { CSSProperties, ReactNode } from "react";

import {
  type Block,
  type StoryProduct,
  type StoryProducts,
  spaceOf,
  taka,
} from "./blocks";
import { StoryVideo } from "./StoryVideo";

/* =========================================================================
   Story renderer — blocks to the article body.

   Stateless and hook-free (the video player is its own client component), so
   the storefront renders it on the server and the dashboard renders the very
   same markup in its preview and compiles it to HTML for `content`.
   The storefront keeps a copy: windrise-client/src/components/modules/blog/
   story/StoryRender.tsx. Keep the two identical.
   ========================================================================= */

export type RenderOptions = {
  /**
   * The dashboard preview: empty blocks show a dashed placeholder instead of
   * vanishing, and hidden blocks can be shown outlined.
   */
  preview?: boolean;
  /** Preview only: include hidden blocks, outlined. */
  showHidden?: boolean;
  /** Resolve an uploaded path to a URL the browser can load. */
  media?: (path: string) => string;
};

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const ALIGN: Record<string, string> = { Left: "al-left", Center: "al-center", Right: "al-right" };

function Empty({ block, label, options }: { block: Block; label: string; options: RenderOptions }) {
  if (!options.preview) return null;
  return <div className="a-empty">{block.ph || `Empty ${label}`}</div>;
}

function ProductCard({ product, media }: { product: StoryProduct; media: (path: string) => string }) {
  const body = (
    <>
      <div className="im">
        {product.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media(product.image)} alt={product.name} loading="lazy" />
        )}
      </div>
      <div>
        <b>{product.name}</b>
        <span>
          {taka(product.salePrice ?? product.price)}
          {product.salePrice !== null && <s>{taka(product.price)}</s>}
        </span>
      </div>
    </>
  );
  return product.href ? (
    <a className="pc" href={product.href}>
      {body}
    </a>
  ) : (
    <div className="pc">{body}</div>
  );
}

/** One block's content, in the Windrise style plus its overrides. */
export function StoryBlockView({
  block,
  products,
  options = {},
}: {
  block: Block;
  products: StoryProducts;
  options?: RenderOptions;
}): ReactNode {
  const media = options.media ?? ((path: string) => path);
  const a = block.adj;

  switch (block.type) {
    case "text": {
      const d = block.data;
      if (!d.html.replace(/<[^>]+>/g, "").trim()) return <Empty block={block} label="text block" options={options} />;
      const style: CSSProperties | undefined =
        a.align && a.align !== "Auto" ? { textAlign: a.align.toLowerCase() as CSSProperties["textAlign"] } : undefined;
      return (
        <div
          className={cx("a-text", a.size === "Small" && "sz-s", a.size === "Large" && "sz-l", a.dropcap === "On" && "dc")}
          style={style}
          dangerouslySetInnerHTML={{ __html: d.html }}
        />
      );
    }

    case "heading":
    case "subheading": {
      const text = block.data.text.trim();
      if (!text) return <Empty block={block} label={block.type === "heading" ? "section heading" : "subheading"} options={options} />;
      const Tag = block.type === "heading" ? "h2" : "h3";
      return (
        <Tag
          className={cx(
            Tag === "h2" ? "a-h2" : "a-h3",
            a.style === "Sans Bold" && "st-sans",
            a.style === "Uppercase Label" && "st-label",
            a.size === "Small" && "sz-s",
            a.size === "Large" && "sz-l"
          )}
          style={a.align && a.align !== "Auto" ? { textAlign: a.align.toLowerCase() as CSSProperties["textAlign"] } : undefined}
        >
          {text}
        </Tag>
      );
    }

    case "pull": {
      const d = block.data;
      if (!d.text.trim()) return <Empty block={block} label="pull text" options={options} />;
      const style =
        { "Rule Lines": "s-rule", "Quote Mark": "s-mark", "Minimal Italic": "s-min", "Accent Block": "s-acc" }[a.style ?? ""] ??
        "s-def";
      const size = { Small: 19, Medium: 23, Large: 28, "Extra Large": 34 }[a.size ?? ""];
      const width = { Narrow: "480px", Column: "640px", Wide: "none" }[a.width ?? ""];
      const align =
        a.align && a.align !== "Auto" ? ALIGN[a.align] : style === "s-min" || style === "s-acc" ? "al-left" : "";
      return (
        <blockquote
          className={cx("a-pull", style, align)}
          style={{ ...(size && { fontSize: size }), ...(width && { maxWidth: width }) }}
        >
          <p>{style === "s-min" ? `“${d.text}”` : d.text}</p>
          {d.cite && <span className="cite">{d.cite.replace(/^[—–-]\s*/, "")}</span>}
        </blockquote>
      );
    }

    case "image": {
      const d = block.data;
      if (!d.img && !options.preview) return null;
      return (
        <figure className={cx("a-fig", a.corners === "Rounded" && "rd", a.capAlign === "Center" && "cc")}>
          {d.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media(d.img)} alt={d.alt} loading="lazy" />
          ) : (
            <div className="a-ph">{block.ph || "Image — none selected"}</div>
          )}
          {d.cap && <figcaption>{d.cap}</figcaption>}
        </figure>
      );
    }

    case "gallery": {
      const d = block.data;
      if (!d.imgs.length) return <Empty block={block} label="gallery — add images" options={options} />;
      return (
        <figure className="a-fig">
          <div
            className={cx(
              "a-gal",
              d.layout === "Two Column" && "g-two",
              d.layout === "Mosaic" && "g-mos",
              a.gap === "Tight" && "gp-t",
              a.gap === "Loose" && "gp-l"
            )}
          >
            {d.imgs.map((img, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${img}-${index}`}
                src={media(img)}
                alt={d.cap ? `${d.cap} (${index + 1} of ${d.imgs.length})` : `Gallery image ${index + 1}`}
                loading="lazy"
              />
            ))}
          </div>
          {d.cap && <figcaption>{d.cap}</figcaption>}
        </figure>
      );
    }

    case "video": {
      const d = block.data;
      if (!d.url && !options.preview) return null;
      return <StoryVideo url={d.url} poster={d.poster ? media(d.poster) : ""} caption={d.cap} />;
    }

    case "highlight": {
      const d = block.data;
      if (!d.text.trim()) return <Empty block={block} label="editorial highlight" options={options} />;
      const style = { Outline: "s-out", "Left Rule": "s-rule", Dark: "s-dark" }[a.style ?? ""];
      return (
        <aside className={cx("a-hl", style, a.align === "Center" && "al-center")}>
          {d.label && <span className="lb">{d.label}</span>}
          <p>{d.text}</p>
        </aside>
      );
    }

    case "product": {
      const d = block.data;
      const collection = d.mode === "collection" ? products.collections[d.coll] : null;
      const items =
        d.mode === "collection"
          ? (collection?.products ?? [])
          : d.items.map((id) => products.products[id]).filter((product): product is StoryProduct => Boolean(product));
      if (!items.length) return <Empty block={block} label="product block — add products" options={options} />;
      const single = d.layout === "Single feature";
      const shown = single ? items.slice(0, 1) : items.slice(0, 3);
      return (
        <div className={cx("a-prod", a.card === "Bordered" && "c-bord", single && "l-single")}>
          <div className="hd">
            <span>{collection ? collection.title : "Shop the story"}</span>
            {collection && <a href={collection.href}>View all</a>}
          </div>
          <div className="pg">
            {shown.map((product) => (
              <ProductCard key={product.id} product={product} media={media} />
            ))}
          </div>
        </div>
      );
    }

    case "cta": {
      const d = block.data;
      if (!d.title && !d.btn) return <Empty block={block} label="call to action" options={options} />;
      const style = { "Dark Banner": "s-dark", "Light Card": "s-card", "Button Only": "s-btn" }[a.style ?? ""];
      const external = /^https?:\/\//i.test(d.link);
      return (
        <div className={cx("a-cta", style, a.align === "Center" && "al-center")}>
          <div className="tx">
            <h4>{d.title || "Call to action"}</h4>
            {d.desc && <p>{d.desc}</p>}
          </div>
          <a
            className="b"
            href={d.link || "#"}
            {...(external && { target: "_blank", rel: "noopener noreferrer" })}
          >
            {d.btn || "Learn more"}
          </a>
        </div>
      );
    }

    case "divider":
      return block.data.style === "Dots" ? (
        <div className="a-dots" role="separator">•••</div>
      ) : (
        <hr className={cx("a-hr", block.data.style === "Short Rule" && "short")} />
      );

    case "spacer":
      return <div aria-hidden="true" style={{ height: block.data.h }} />;

    case "advanced": {
      const html = block.data.html;
      const empty = !html.replace(/<[^>]+>/g, "").trim() && !/<(img|table|hr|iframe|video|figure)/i.test(html);
      if (empty) return <Empty block={block} label="advanced content" options={options} />;
      return (
        <div className="a-adv product-description post-content" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
  }
}

/** Blocks, each in its spacing wrapper, in order. */
export function StoryBlocks({
  blocks,
  products,
  options = {},
}: {
  blocks: Block[];
  products: StoryProducts;
  options?: RenderOptions;
}) {
  return (
    <>
      {blocks
        .filter((block) => !block.hidden || options.showHidden)
        .map((block) => (
          <div
            key={block.id}
            data-bid={block.id}
            className={cx("wr-b", `t-${block.type}`, block.hidden && "is-hidden")}
            style={{ marginTop: spaceOf(block, "before"), marginBottom: spaceOf(block, "after") }}
          >
            <StoryBlockView block={block} products={products} options={options} />
          </div>
        ))}
    </>
  );
}

export type StorySegment = { kind: "column" | "wide" | "full"; blocks: Block[] };

/**
 * The body in layout runs: the text column (beside the rail), with Wide and
 * Full Width images breaking out of it into runs of their own.
 */
export function segmentStory(blocks: Block[]): StorySegment[] {
  const segments: StorySegment[] = [];
  let column: Block[] = [];
  for (const block of blocks) {
    const breakout = block.type === "image" && block.data.disp !== "Standard" && Boolean(block.data.img);
    if (breakout) {
      if (column.length) segments.push({ kind: "column", blocks: column });
      column = [];
      segments.push({ kind: block.data.disp === "Wide" ? "wide" : "full", blocks: [block] });
    } else {
      column.push(block);
    }
  }
  if (column.length || !segments.some((segment) => segment.kind === "column")) {
    segments.push({ kind: "column", blocks: column });
  }
  return segments;
}
