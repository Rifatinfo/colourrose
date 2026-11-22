import { HeartIcon, MenuIcon, SearchIcon, ShoppingBagIcon, UserIcon } from "lucide-react";

import type { Block, StoryProducts } from "./blocks";
import { segmentStory, StoryBlocks } from "./StoryRender";

/* =========================================================================
   The dashboard's preview of a story, laid out exactly as the storefront's
   /blog/[slug] page lays it out: the headline indented to the text column,
   the byline beside the deck and lead, the cover across the page, then the
   body beside the rail of popular posts and ads.

   It renders inside the preview iframe, so the storefront's own breakpoints
   apply at the device width being previewed.
   ========================================================================= */

export type ArticleDraft = {
  title: string;
  deck: string;
  lead: string;
  /** The Blog Highlight, shown under the introduction. Empty: nothing. */
  highlight: string;
  /** ISO date, or null for "publish immediately". */
  date: string | null;
  author: { name: string; role: string | null; avatar: string | null };
  featuredImage: string | null;
  blocks: Block[];
  /** The Advanced Editor's version, when it is the one being published. */
  manualHtml: string | null;
  tags: string[];
  allowComments: boolean;
  showAds: boolean;
  /** Recent posts standing in for the Popular Posts rail. */
  popular: { id: string; title: string; image: string | null; date: string | null }[];
};

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

function HousePromo({ ratio, label }: { ratio: string; label: string }) {
  return (
    <div className="flex w-full flex-col justify-between bg-[#E7E5E0] p-4 text-[#1C1B1A]" style={{ aspectRatio: ratio }}>
      <p className="text-[9px] uppercase leading-tight tracking-[0.12em] text-[#8A8880]">
        Advertisement
        <br />
        {label}
      </p>
      <div>
        <p className="font-serif text-[clamp(15px,1.6vw,22px)] leading-[1.2]">
          New Arrivals
          <br />
          Now Live
        </p>
        <span className="mt-3 inline-block bg-[#1C1B1A] px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-white">
          Shop Now
        </span>
      </div>
    </div>
  );
}

function Rail({ draft }: { draft: ArticleDraft }) {
  return (
    <aside className="w-full lg:sticky lg:top-6">
      <div className="space-y-6">
        {draft.popular.length > 0 && (
          <section>
            <h2 className="font-serif text-[13px] font-semibold text-[#1C1B1A]">Popular Posts</h2>
            <ul className="mt-3 space-y-3.5">
              {draft.popular.map((post) => (
                <li key={post.id} className="flex gap-3">
                  <div className="h-[108px] w-[108px] shrink-0 overflow-hidden bg-[#E7E5E0]">
                    {post.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.image} alt="" className="h-full w-full rounded-sm object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] leading-[1.35] text-[#1C1B1A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {post.title}
                    </p>
                    {post.date && <p className="mt-1 text-[9px] text-[#9A978F]">{longDate(post.date)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {draft.showAds && (
          <>
            <div className="hidden lg:block">
              <HousePromo ratio="300 / 600" label="300 X 600 PX" />
            </div>
            <div className="hidden lg:block">
              <HousePromo ratio="300 / 300" label="300 X 300 PX" />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export function StoryArticle({
  draft,
  products,
  showHidden,
}: {
  draft: ArticleDraft;
  products: StoryProducts;
  showHidden: boolean;
}) {
  const options = { preview: true, showHidden };
  const visible = draft.blocks.filter((block) => showHidden || !block.hidden);
  const segments = draft.manualHtml !== null ? null : segmentStory(visible);
  const firstColumn = segments?.findIndex((segment) => segment.kind === "column") ?? 0;
  const lead = draft.lead
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const nav = ["Men", "Women", "Kids", "Gifts", "Home Decor"];

  return (
    <div className="min-h-full bg-[#F8F9F4] text-[#1C1B1A]">
      {/* The storefront header, at rest over a light page. */}
      <header className="flex items-center gap-8 border-b border-[#ECEAE5] bg-white px-5 py-4 md:px-8 lg:px-20">
        <span className="text-[24px] tracking-[-0.035em]">windrise</span>
        <nav className="hidden gap-9 text-[12px] text-[#777] md:flex" aria-hidden="true">
          {nav.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-4 text-[#222]" aria-hidden="true">
          <SearchIcon className="h-4 w-4" />
          <HeartIcon className="hidden h-4 w-4 sm:block" />
          <ShoppingBagIcon className="h-4 w-4" />
          <UserIcon className="hidden h-4 w-4 sm:block" />
          <MenuIcon className="h-[18px] w-[18px] md:hidden" />
        </span>
      </header>

      <main className="mx-auto w-full max-w-[1188px] px-5 py-10 md:px-8">
        <article>
          <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)]" data-bid="head">
            <div aria-hidden="true" />
            <header>
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] md:text-[12px]">
                {longDate(draft.date ?? new Date().toISOString())}
              </p>
              <h1 className="font-display mt-3 text-[clamp(24px,2.6vw,34px)] font-medium leading-[1.22] text-[#1C1B1A]">
                {draft.title || "Untitled story"}
              </h1>
            </header>
          </div>

          <hr className="mt-8 border-[#E3E0D9]" />

          <div className="mt-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]" data-bid="lead">
            <div className="flex items-center gap-3 lg:block">
              <p className="order-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#1C1B1A] md:text-[16px] lg:order-none">
                {draft.author.name}
                {draft.author.role && (
                  <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-[#8A8880] md:text-[12px]">
                    {draft.author.role}
                  </span>
                )}
              </p>
              <div className="order-1 h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-[#8C8880] lg:order-none lg:mt-3 lg:h-[88px] lg:w-[88px]">
                {draft.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.author.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display grid h-full w-full place-items-center text-[17px] text-white lg:text-[30px]">
                    {initials(draft.author.name)}
                  </span>
                )}
              </div>
              <div className="order-3 ml-auto lg:ml-0 lg:mt-5">
                <p className="text-[9px] uppercase tracking-[0.12em]">Share:</p>
                <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
                  {["f", "X", "p", "🔗"].map((label) => (
                    <span key={label} className="grid h-5 w-5 place-items-center rounded-full bg-[#1C1B1A] text-[8px] font-bold text-white">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 min-w-0 lg:mt-0">
              {draft.deck && (
                <p className="font-serif text-[clamp(18px,1.4vw,24px)] leading-[1.5] text-[#1C1B1A]">{draft.deck}</p>
              )}
              {lead.length > 0 && (
                <div className="wr-story mt-5">
                  {lead.map((paragraph, index) => (
                    <p key={index} className="mb-4 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
              {draft.highlight && (
                <div className="mt-7 border-y border-[#E3E0D9] py-6">
                  <p className="text-center font-serif text-[clamp(15px,1.5vw,19px)] leading-[1.55] text-[#1C1B1A]">
                    {draft.highlight}
                  </p>
                </div>
              )}
            </div>
          </div>

          <figure className="mt-9" data-bid="feat">
            {draft.featuredImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.featuredImage} alt="" className="w-full object-cover" style={{ aspectRatio: "16 / 9" }} />
            ) : (
              <div className="grid w-full place-items-center bg-[#ECEAE4] text-[13px] text-[#A8A39A]" style={{ aspectRatio: "16 / 9" }}>
                No featured image
              </div>
            )}
          </figure>

          {segments === null ? (
            <div className="mt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_222px] lg:gap-x-[80px]">
              <div className="wr-story min-w-0">
                <div
                  className="a-adv product-description post-content"
                  dangerouslySetInnerHTML={{ __html: draft.manualHtml ?? "" }}
                />
              </div>
              <div className="mt-12 lg:mt-0">
                <Rail draft={draft} />
              </div>
            </div>
          ) : (
            segments.map((segment, index) =>
              segment.kind === "column" ? (
                <div key={index} className="mt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_222px] lg:gap-x-[80px]">
                  <div className="wr-story min-w-0">
                    <StoryBlocks blocks={segment.blocks} products={products} options={options} />
                  </div>
                  <div className={index === firstColumn ? "mt-12 lg:mt-0" : "hidden lg:block"}>
                    {index === firstColumn && <Rail draft={draft} />}
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className={`wr-story mt-9 ${segment.kind === "full" ? "wr-full -mx-5 md:-mx-8 lg:mx-[calc(50%-50vw)]" : ""}`}
                >
                  <StoryBlocks blocks={segment.blocks} products={products} options={options} />
                </div>
              )
            )
          )}

          <div className="mt-14 lg:grid lg:grid-cols-[minmax(0,1fr)_222px] lg:gap-x-[80px]">
            <div>
              {draft.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[11px] text-[#777]">
                  {draft.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[#E3E0D9] px-2.5 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-6 border-t border-[#E3E0D9] pt-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#8A8880]">Next</p>
                <p className="mt-1 font-serif text-[13px] text-[#1C1B1A]">
                  {draft.popular[0]?.title ?? "The next story in the archive"} »
                </p>
              </div>
            </div>
          </div>
        </article>
      </main>

      <div className="mx-auto w-full max-w-[1188px] px-5 md:px-8">
        <hr className="border-[#E3E0D9]" />
      </div>

      <section className="mx-auto w-full max-w-[1188px] px-5 py-12 md:px-8">
        {draft.allowComments ? (
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-[18px] text-[#1C1B1A]">Leave a Reply</h2>
              <p className="mt-1 text-[10px] text-[#A29E96]">
                Your email address will not be published. Required fields are marked *
              </p>
              <div className="mt-3 h-20 border border-[#D9D6CF] bg-white px-3 py-2 text-[11px] text-[#B0ACA4]">
                Write your comment*
              </div>
              <span className="mt-4 inline-block bg-[#1C1B1A] px-6 py-2.5 text-[10px] font-semibold tracking-[0.06em] text-white">
                POST COMMENT
              </span>
            </div>
            <div className="text-[11px] text-[#8A8880]">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[#555]">Comments</p>
              <p className="mt-3">Readers’ comments appear here once the story is live.</p>
            </div>
          </div>
        ) : (
          <p className="text-center text-[12px] text-[#A29E96]">Comments are closed for this story.</p>
        )}
      </section>

      <footer className="bg-[#0E0E0E] px-5 py-10 text-white md:px-8 lg:px-20">
        <span className="text-[26px] tracking-[-0.035em]">windrise</span>
        <p className="mt-2 max-w-[240px] text-[11px] leading-[1.5] text-[#9A9A9A]">
          A curated blend of refined essentials for a life well-lived.
        </p>
      </footer>
    </div>
  );
}
