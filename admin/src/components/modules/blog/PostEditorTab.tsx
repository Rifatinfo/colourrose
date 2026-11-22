"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InfoIcon, Loader2Icon } from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import {
  createCategory,
  createPost,
  getAuthors,
  getCategories,
  getPost,
  getPosts,
  getStoryCollections,
  mediaUrl,
  searchStoryProducts,
  suggestSeo,
  updatePost,
  uploadBlogImage,
} from "@/services/blog/blog";
import type {
  BlogAuthorOption,
  BlogCategory,
  BlogPost,
  BlogStatus,
  StoryPickerCollection,
  StoryPickerProduct,
} from "@/types/blog";
import { buildSeoChecks, computeSeoScore } from "@/utils/seoScore";
import { makeBlock, normalizeBlocks, type Block, type StoryProducts } from "./composer/blocks";
import {
  ArticleSetupCard,
  AuthorCard,
  FeaturedImageCard,
  PreviewCard,
  PublishCard,
  SeoMetaCard,
  SeoScoreCard,
  SettingsCard,
  STOREFRONT_HOST,
  TaxonomyCard,
  slugify,

  isoDay,
  type EditorForm,
} from "./composer/EditorCards";
import { MediaLibrary } from "./composer/MediaLibrary";
import { PreviewFrame, type Device, type PreviewFrameHandle } from "./composer/PreviewFrame";
import { StoryArticle, type ArticleDraft } from "./composer/StoryArticle";
import { compileStory, StoryComposer, useStoryHistory, type ComposerView, type ManualState } from "./composer/StoryComposer";
import { ComposerToasts, Modal, Segmented, useComposerToast } from "./composer/ui";
import "./composer/story.css";

/* =========================================================================
   Dashboard → Content → Blogs → Add New / Edit Post: the Story Composer.

   The page owns every piece of state — the form, the blocks (with undo), the
   product catalog the pickers have seen — and hands it to presentational
   cards. The preview and the SEO score both read the same compiled article,
   so what is scored is exactly what is shown and published.
   ========================================================================= */

const STOREFRONT_URL = (process.env.NEXT_PUBLIC_STOREFRONT_URL || "https://thewindrise.com").replace(/\/+$/, "");

const EMPTY_FORM: EditorForm = {
  title: "",
  slug: "",
  slugManual: false,
  excerpt: "",
  highlight: "",
  deck: "",
  lead: "",
  featuredImage: null,
  thumbnailImage: null,
  useFeaturedAsThumbnail: true,
  useFeaturedForSocial: true,
  status: "DRAFT",
  date: "",
  time: "10:00",
  visibility: "PUBLIC",
  password: "",
  customAuthor: false,
  authorId: "",
  customName: "",
  customRole: "Guest Contributor",
  customAvatar: null,
  categoryIds: [],
  tags: [],
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
  keywords: "",
  canonicalUrl: "",
  isFeatured: false,
  allowComments: true,
  showAds: true,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The server's post as the editor's form. */
function toForm(post: BlogPost): EditorForm {
  const published = post.publishedAt ? new Date(post.publishedAt) : null;
  return {
    title: post.title,
    slug: post.slug,
    slugManual: true,
    excerpt: post.excerpt ?? "",
    highlight: post.highlight ?? "",
    // A story from before the composer showed its excerpt as the deck.
    deck: post.deck ?? (!post.blocks && post.excerpt && post.excerpt.length <= 300 ? post.excerpt : ""),
    lead: post.lead ?? "",
    featuredImage: post.featuredImage,
    thumbnailImage: post.thumbnailImage,
    useFeaturedAsThumbnail: post.useFeaturedAsThumbnail,
    useFeaturedForSocial: post.useFeaturedForSocial,
    status: post.status,
    date: published ? isoDay(published) : "",
    time: published ? `${pad(published.getHours())}:${pad(published.getMinutes())}` : "10:00",
    visibility: post.visibility,
    password: "",
    customAuthor: Boolean(post.customAuthorName),
    authorId: post.authorId ?? "",
    customName: post.customAuthorName ?? "",
    customRole: post.customAuthorRole ?? "",
    customAvatar: post.customAuthorAvatar,
    categoryIds: post.categories?.map((category) => category.id) ?? (post.categoryId ? [post.categoryId] : []),
    tags: post.tags.map((tag) => tag.name),
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
    focusKeyword: post.focusKeyword ?? "",
    keywords: post.keywords.join(", "),
    canonicalUrl: post.canonicalUrl ?? "",
    isFeatured: post.isFeatured,
    allowComments: post.allowComments,
    showAds: post.showAds,
  };
}

/**
 * Everything a save sends except `content` (compiled at save time) and the
 * status. Pure, so "unsaved changes" can compare it against what was loaded.
 */
function payloadOf(form: EditorForm, blocks: Block[], manual: ManualState) {
  return {
    title: form.title.trim(),
    slug: form.slug || slugify(form.title),
    excerpt: form.excerpt.trim() || null,
    highlight: form.highlight.trim() || null,
    deck: form.deck.trim() || null,
    lead: form.lead.trim() || null,
    blocks,
    manualContent: manual.html || null,
    useManualContent: manual.on,
    visibility: form.visibility,
    ...(form.visibility === "PASSWORD" && form.password.trim() && { password: form.password.trim() }),
    publishedAt: form.date ? new Date(`${form.date}T${form.time}`).toISOString() : null,
    featuredImage: form.featuredImage,
    thumbnailImage: form.useFeaturedAsThumbnail ? null : form.thumbnailImage,
    useFeaturedAsThumbnail: form.useFeaturedAsThumbnail || !form.thumbnailImage,
    useFeaturedForSocial: form.useFeaturedForSocial,
    authorId: form.customAuthor ? null : form.authorId || null,
    customAuthorName: form.customAuthor ? form.customName.trim() || null : null,
    customAuthorAvatar: form.customAuthor ? form.customAvatar : null,
    customAuthorRole: form.customAuthor ? form.customRole.trim() || null : null,
    categoryIds: form.categoryIds,
    tags: form.tags,
    metaTitle: form.metaTitle.trim() || null,
    metaDescription: form.metaDescription.trim() || null,
    focusKeyword: form.focusKeyword.trim() || null,
    keywords: form.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    canonicalUrl: form.canonicalUrl.trim() || null,
    isFeatured: form.isFeatured,
    allowComments: form.allowComments,
    showAds: form.showAds,
  };
}

const signatureOf = (form: EditorForm, blocks: Block[], manual: ManualState) =>
  JSON.stringify(payloadOf(form, blocks, manual));

/** Product ids the blocks point at, to load their names and prices. */
const productIdsIn = (blocks: Block[]) =>
  [...new Set(blocks.flatMap((block) => (block.type === "product" ? block.data.items : [])))];

export function PostEditorTab(props: { postId: string | null; onSaved: () => void; onDone: () => void }) {
  return (
    <ComposerToasts>
      <Editor {...props} />
    </ComposerToasts>
  );
}

function Editor({ postId, onSaved }: { postId: string | null; onSaved: () => void; onDone: () => void }) {
  const toast = useComposerToast();
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const history = useStoryHistory({ blocks: [makeBlock("text", {}, { ph: "Start writing your story…" })], manual: { on: false, html: "" } });
  const [loading, setLoading] = useState(Boolean(postId));
  const [legacy, setLegacy] = useState(false);

  // Reference data.
  const [authors, setAuthors] = useState<BlogAuthorOption[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [collections, setCollections] = useState<StoryPickerCollection[]>([]);
  const [catalog, setCatalog] = useState<Record<string, StoryPickerProduct>>({});
  const [popular, setPopular] = useState<ArticleDraft["popular"]>([]);

  // Saving.
  const savedId = useRef<string | null>(postId);
  const [serverStatus, setServerStatus] = useState<BlogStatus | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  // View.
  const [view, setView] = useState<ComposerView>("compose");
  const [device, setDevice] = useState<Device>("desktop");
  const [showHidden, setShowHidden] = useState(false);
  const [fullPreview, setFullPreview] = useState<Device | null>(null);
  const [library, setLibrary] = useState<{ multiple: boolean; use: (urls: string[]) => void } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(0);
  const previewRef = useRef<PreviewFrameHandle>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<((url: string) => void) | null>(null);

  const patch = useCallback((next: Partial<EditorForm>) => setForm((current) => ({ ...current, ...next })), []);

  const rememberProducts = useCallback(
    (list: StoryPickerProduct[]) =>
      setCatalog((current) => {
        const next = { ...current };
        list.forEach((product) => (next[product.id] = product));
        return next;
      }),
    []
  );

  /* ---------------------------------- Load --------------------------------- */

  useEffect(() => {
    getCategories().then((res) => setCategories(res.data)).catch(() => undefined);
    getStoryCollections().then((res) => setCollections(res.data)).catch(() => undefined);
    getPosts({ status: "PUBLISHED", limit: 4 })
      .then((res) =>
        setPopular(
          res.data
            .filter((post) => post.id !== postId)
            .slice(0, 4)
            .map((post) => ({ id: post.id, title: post.title, image: mediaUrl(post.cardImage ?? post.featuredImage), date: post.publishedAt }))
        )
      )
      .catch(() => undefined);
    getAuthors()
      .then((res) => {
        setAuthors(res.data);
        if (!postId) setForm((current) => ({ ...current, authorId: current.authorId || res.data[0]?.id || "" }));
      })
      .catch(() => undefined);
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    getPost(postId)
      .then(async (res) => {
        if (cancelled) return;
        const post = res.data;
        let blocks = normalizeBlocks(post.blocks);
        // A story from before the composer: its body becomes one Advanced
        // Content block, so nothing is lost and it can be split up later.
        if (!post.blocks) {
          blocks = post.content ? [makeBlock("advanced", { html: post.content })] : [makeBlock("text")];
          setLegacy(Boolean(post.content));
        }
        const loadedForm = toForm(post);
        const manual = { on: post.useManualContent, html: post.manualContent ?? "" };
        setForm(loadedForm);
        history.reset({ blocks, manual });
        // What "unsaved changes" compares against. A converted legacy story
        // counts as changed, since saving it is what moves it to blocks.
        setSavedSignature(post.blocks ? signatureOf(loadedForm, blocks, manual) : "");
        setServerStatus(post.status);
        setHasPassword(post.hasPassword);
        const ids = productIdsIn(blocks);
        if (ids.length) {
          const products = await searchStoryProducts({ ids }).catch(() => null);
          if (products && !cancelled) rememberProducts(products.data);
        }
      })
      .catch((error) => Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "Couldn't load the post" }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `history.reset` is stable; loading runs once per post.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, rememberProducts]);

  /* --------------------------------- Derived ------------------------------- */

  const products: StoryProducts = useMemo(
    () => ({
      products: catalog,
      collections: Object.fromEntries(
        collections.map((collection) => [
          collection.slug,
          { slug: collection.slug, title: collection.title, href: `/collection/${collection.slug}`, products: collection.products },
        ])
      ),
    }),
    [catalog, collections]
  );

  // The article as the reader gets it, compiled a beat after typing stops.
  const [compiled, setCompiled] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(
      () => setCompiled(history.manual.on ? history.manual.html : compileStory(history.blocks, products)),
      250
    );
    return () => window.clearTimeout(timer);
  }, [history.blocks, history.manual, products]);

  const seoInput = {
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    lead: form.lead,
    metaTitle: form.metaTitle,
    metaDescription: form.metaDescription,
    focusKeyword: form.focusKeyword,
    content: compiled,
    featuredImage: form.featuredImage,
  };
  const score = computeSeoScore(seoInput);
  const checks = buildSeoChecks(seoInput);

  const author = useMemo(() => {
    if (form.customAuthor) {
      return { name: form.customName.trim() || "Guest author", role: form.customRole.trim() || null, avatar: mediaUrl(form.customAvatar) };
    }
    const staff = authors.find((entry) => entry.id === form.authorId);
    return { name: staff?.name ?? "Unassigned", role: staff?.roleLabel ?? null, avatar: mediaUrl(staff?.avatar) };
  }, [form.customAuthor, form.customName, form.customRole, form.customAvatar, form.authorId, authors]);

  const draft: ArticleDraft = {
    title: form.title,
    deck: form.deck,
    lead: form.lead,
    highlight: form.highlight.trim(),
    date: form.date ? new Date(`${form.date}T${form.time}`).toISOString() : null,
    author,
    featuredImage: mediaUrl(form.featuredImage),
    blocks: history.blocks,
    manualHtml: history.manual.on ? history.manual.html : null,
    tags: form.tags,
    allowComments: form.allowComments,
    showAds: form.showAds,
    popular,
  };

  const renderArticle = () => <StoryArticle draft={draft} products={products} showHidden={showHidden} />;

  /* -------------------------------- Payload -------------------------------- */

  const wasPublished = serverStatus === "PUBLISHED" || serverStatus === "SCHEDULED";

  const signature = useMemo(
    () => signatureOf(form, history.blocks, history.manual),
    [form, history.blocks, history.manual]
  );

  // A new story counts as changed once anything has been written in it.
  const dirty =
    savedSignature === null
      ? Boolean(form.title.trim() || compiled.replace(/<[^>]+>/g, "").trim())
      : signature !== savedSignature;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* --------------------------------- Save ---------------------------------- */

  const future = Boolean(form.date) && new Date(`${form.date}T${form.time}`) > new Date();

  const problem = (forPublish: boolean) => {
    if (!form.title.trim()) return { message: "Add a post title first", focus: "f-title" };
    if (form.customAuthor && !form.customName.trim()) return { message: "Add the custom author’s name", focus: "au-name" };
    if (!form.customAuthor && !form.authorId) return { message: "Select an author", focus: null };
    if (forPublish && !form.excerpt.trim()) return { message: "Add an excerpt before publishing", focus: "f-excerpt" };
    if (form.visibility === "PASSWORD" && !hasPassword && !form.password.trim()) {
      return { message: "Set a password, or change visibility", focus: "p-pw" };
    }
    return null;
  };

  const save = async (status: BlogStatus, { quiet = false } = {}) => {
    const issue = problem(status === "PUBLISHED" || status === "SCHEDULED");
    if (issue) {
      if (quiet) return;
      toast(issue.message);
      if (issue.focus) document.getElementById(issue.focus)?.focus();
      return;
    }
    if (status === "SCHEDULED" && !future) {
      toast("Pick a future date and time to schedule");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...payloadOf(form, history.blocks, history.manual),
        content: history.manual.on ? history.manual.html : compileStory(history.blocks, products),
        status,
      };
      const res = savedId.current ? await updatePost(savedId.current, payload) : await createPost(payload);
      const post = res.data;
      savedId.current = post.id;
      setServerStatus(post.status);
      setHasPassword(post.hasPassword);
      setForm((current) => ({ ...current, status: post.status, slug: post.slug, password: "" }));
      setSavedSignature(signature);
      setLegacy(false);
      onSaved();

      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (quiet) {
        setNote(`Draft saved automatically at ${time}`);
        return;
      }
      const when = post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";
      const messages: Partial<Record<BlogStatus, string>> = {
        PUBLISHED: wasPublished ? "Post updated" : "Published",
        SCHEDULED: `Scheduled for ${when}`,
        PENDING_REVIEW: "Submitted for review",
        DRAFT: wasPublished ? "Moved back to drafts" : "Draft saved",
        ARCHIVED: "Archived",
      };
      toast(messages[post.status] ?? "Saved");
      setNote(
        post.status === "PUBLISHED"
          ? `${wasPublished ? "Updated" : "Published"} at ${time} · ${STOREFRONT_HOST}/blog/${post.slug}`
          : post.status === "SCHEDULED"
            ? `Scheduled for ${when}`
            : `${messages[post.status] ?? "Saved"} at ${time}`
      );
    } catch (error) {
      if (!quiet) Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  // Unpublished drafts save themselves a few seconds after the last change.
  useEffect(() => {
    if (!dirty || !savedId.current || wasPublished || saving) return;
    if (form.status !== "DRAFT" && form.status !== "PENDING_REVIEW") return;
    const timer = window.setTimeout(() => void save(form.status, { quiet: true }), 8000);
    return () => window.clearTimeout(timer);
    // `save` reads the latest state when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, dirty, wasPublished, saving, form.status]);

  const primary = (() => {
    if (wasPublished) return { label: "Update", status: (form.status === "SCHEDULED" && !future ? "PUBLISHED" : future ? "SCHEDULED" : form.status) as BlogStatus };
    if (form.status === "PENDING_REVIEW") return { label: "Submit for Review", status: "PENDING_REVIEW" as BlogStatus };
    if (form.status === "ARCHIVED") return { label: "Save", status: "ARCHIVED" as BlogStatus };
    if (future) return { label: "Schedule", status: "SCHEDULED" as BlogStatus };
    return { label: "Publish", status: "PUBLISHED" as BlogStatus };
  })();

  const secondary = wasPublished
    ? { label: "Unpublish", run: () => void save("DRAFT") }
    : { label: "Save Draft", run: () => void save("DRAFT") };

  /* --------------------------------- Media --------------------------------- */

  const upload = useCallback(
    async (file: File | null, onUploaded: (url: string) => void) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast("Choose an image file (JPG, PNG or WebP)");
        return;
      }
      setUploading(true);
      try {
        const res = await uploadBlogImage(file);
        onUploaded(res.data.url);
        toast("Image uploaded");
      } catch (error) {
        Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "Upload failed" });
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  const pickImages = useCallback((multiple: boolean, use: (urls: string[]) => void) => setLibrary({ multiple, use }), []);
  const pickOne = useCallback((use: (url: string) => void) => setLibrary({ multiple: false, use: ([url]) => use(url) }), []);
  const uploadForBlock = useCallback((use: (url: string) => void) => {
    pendingUpload.current = use;
    uploadInput.current?.click();
  }, []);
  const previewImage = useCallback((url: string, caption?: string) => setLightbox({ url, caption }), []);

  /* ------------------------------ AI SEO draft ----------------------------- */

  const generate = async () => {
    if (!form.title.trim() && !history.blocks.length) {
      toast("Write a title or some content first");
      return;
    }
    const previous = {
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      focusKeyword: form.focusKeyword,
      keywords: form.keywords,
    };
    setGenerating(true);
    try {
      const res = await suggestSeo({
        title: form.title || "Untitled story",
        excerpt: [form.excerpt, form.deck, form.lead].filter(Boolean).join("\n\n") || null,
        content: compiled || null,
        categoryName: categories.find((category) => category.id === form.categoryIds[0])?.name ?? null,
      });
      const suggestion = res.data;
      patch({
        metaTitle: suggestion.metaTitle,
        metaDescription: suggestion.metaDescription,
        focusKeyword: form.focusKeyword.trim() || suggestion.focusKeyword,
        keywords: suggestion.keywords.join(", "),
      });
      setGenerated((n) => n + 1);
      toast(
        suggestion.source === "fallback" ? "Drafted from your post (no AI model configured). Review before publishing." : "SEO fields drafted. Review before publishing.",
        { label: "Undo", run: () => patch(previous) }
      );
    } catch (error) {
      Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "Couldn't draft the SEO fields" });
    } finally {
      setGenerating(false);
    }
  };

  /* ------------------------------- Categories ------------------------------ */

  const addCategory = async (name: string) => {
    try {
      const res = await createCategory({ name });
      const category = { ...res.data, postCount: 0 };
      setCategories((current) => [...current, category]);
      toast(`Category “${category.name}” created`);
      return category;
    } catch (error) {
      Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "Couldn't create the category" });
      return null;
    }
  };

  /* --------------------------------- Render -------------------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const scrollPreview = (id: string) => previewRef.current?.scrollTo(id);
  const viewSite = () => {
    if (serverStatus === "PUBLISHED" && form.visibility !== "PRIVATE") {
      window.open(`${STOREFRONT_URL}/blog/${form.slug}`, "_blank", "noopener");
    } else {
      setFullPreview(device);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 2xl:grid-cols-[minmax(0,1fr)_452px]">
      <input
        ref={uploadInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const use = pendingUpload.current;
          if (use) void upload(event.target.files?.[0] ?? null, use);
          event.target.value = "";
        }}
      />

      {/* ------------------------------- Main ------------------------------- */}
      <div className="flex min-w-0 flex-col gap-3.5">
        {legacy && (
          <p className="flex items-start gap-2.5 rounded-lg bg-blue-50 px-3.5 py-2.5 text-[12.5px] text-blue-900">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            This story was written before the Story Composer. Its body is in one Advanced Content block below — keep
            editing it there, or add blocks around it. Saving publishes it through the composer.
          </p>
        )}
        <ArticleSetupCard
          form={form}
          patch={patch}
          onFocusArea={scrollPreview}
          onViewSite={viewSite}
          viewSiteLabel={serverStatus === "PUBLISHED" ? "View on site" : "Preview"}
        />
        <FeaturedImageCard
          form={form}
          patch={patch}
          upload={(file, use) => void upload(file, use)}
          pickFromLibrary={pickOne}
          preview={(url) => previewImage(url)}
          uploading={uploading}
          onFocusArea={() => scrollPreview("feat")}
        />
        <StoryComposer
          history={history}
          products={products}
          productCatalog={catalog}
          rememberProducts={rememberProducts}
          collections={collections}
          view={view}
          onViewChange={setView}
          onFocusBlock={scrollPreview}
          pickImages={pickImages}
          uploadImage={uploadForBlock}
          previewImage={previewImage}
          lead={form.lead}
          renderPreview={() => <PreviewFrame device="desktop">{renderArticle()}</PreviewFrame>}
        />
        <SeoMetaCard form={form} patch={patch} generating={generating} onGenerate={() => void generate()} generated={generated} />
      </div>

      {/* ------------------------------- Rail ------------------------------- */}
      <div className="flex min-w-0 flex-col gap-3.5 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-auto 2xl:[scrollbar-width:thin]">
        <PreviewCard
          device={device}
          onDevice={setDevice}
          showHidden={showHidden}
          onShowHidden={(value) => {
            setShowHidden(value);
            toast(value ? "Hidden blocks shown in preview" : "Hidden blocks excluded from preview");
          }}
          onOpenFull={() => setFullPreview(device)}
        >
          <PreviewFrame ref={previewRef} device={device} height={470}>
            {renderArticle()}
          </PreviewFrame>
        </PreviewCard>

        <div className="grid items-start gap-3.5 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3.5">
            <PublishCard
              form={form}
              patch={patch}
              hasPassword={hasPassword}
              primaryLabel={primary.label}
              secondaryLabel={secondary.label}
              busy={saving}
              note={note || (dirty ? "Unsaved changes" : serverStatus ? "All changes saved" : "")}
              onPrimary={() => void save(primary.status)}
              onSecondary={secondary.run}
            />
            <AuthorCard form={form} patch={patch} authors={authors} upload={(file, use) => void upload(file, use)} pickFromLibrary={pickOne} />
            <TaxonomyCard form={form} patch={patch} categories={categories} onCreateCategory={addCategory} />
          </div>
          <div className="flex min-w-0 flex-col gap-3.5">
            <SeoScoreCard score={score} checks={checks} />
            <SettingsCard form={form} patch={patch} />
          </div>
        </div>
      </div>

      {/* ----------------------------- Overlays ----------------------------- */}
      {fullPreview && (
        <Modal
          title={`Preview · ${form.title || "Untitled"}`}
          size="full"
          onClose={() => setFullPreview(null)}
          headerExtra={
            <div className="ml-3">
              <Segmented
                label="Preview device"
                value={fullPreview}
                onChange={setFullPreview}
                options={[
                  { value: "desktop", label: "Desktop" },
                  { value: "tablet", label: "Tablet" },
                  { value: "mobile", label: "Mobile" },
                ]}
              />
            </div>
          }
        >
          <div className="h-full bg-slate-100">
            <PreviewFrame device={fullPreview} height={typeof window === "undefined" ? 700 : window.innerHeight - 120} className="rounded-none border-0">
              {renderArticle()}
            </PreviewFrame>
          </div>
        </Modal>
      )}

      {library && (
        <MediaLibrary
          multiple={library.multiple}
          onClose={() => setLibrary(null)}
          onPick={(urls) => {
            library.use(urls);
            setLibrary(null);
          }}
        />
      )}

      {lightbox && (
        <Modal title="Preview image" size="lg" onClose={() => setLightbox(null)}>
          <div className="p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(lightbox.url) ?? ""} alt="" className="w-full rounded-lg" />
            {lightbox.caption && <p className="mt-2 text-[12px] text-slate-500">{lightbox.caption}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
