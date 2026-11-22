"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import { FieldSelect } from "@/components/ui/field-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { RichTextEditor } from "@/components/shared/richTextEditor/RichTextEditor";
import {
  CARD,
  GhostButton,
  PageHeader,
  PageShell,
  PrimaryButton,
  RowMenu,
  StatCard,
  StatGrid,
  TableSkeleton,
} from "@/components/modules/administration/shared/ui";
import { formatDate } from "@/components/modules/administration/shared/format";
import {
  createPage,
  deletePage,
  getPageTree,
  pageImpact,
  reorderPages,
  updatePage,
  type PageNode,
  type PageStatus,
  STOREFRONT_URL,
} from "@/services/website/website";
import { useSessionExpanded } from "../shared/useSessionExpanded";
import { branchIds, toPlacements, TreeBoard } from "../shared/TreeBoard";
import { cn } from "@/lib/utils";

/* =========================================================================
   Website > Pages.

   A light CMS. Pages nest, so "Shop > Men" is a real relationship, and the
   navigation references them rather than copying them — deleting a page is
   reported against the menu items that point at it before it happens.
   ========================================================================= */

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

const STATUS_META: Record<PageStatus, { label: string; dot: string; chip: string }> = {
  PUBLISHED: { label: "Published", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  DRAFT: { label: "Draft", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700" },
  SCHEDULED: { label: "Scheduled", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
};

/** A URL segment from a title — the same shape the server settles on. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function flatten(nodes: PageNode[], depth = 0): { node: PageNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

type Draft = {
  id: string | null;
  title: string;
  slug: string;
  content: string;
  parentId: string;
  status: PageStatus;
  publishedAt: string;
  showInMenu: boolean;
  allowComments: boolean;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY: Draft = {
  id: null,
  title: "",
  slug: "",
  content: "",
  parentId: "",
  status: "DRAFT",
  publishedAt: "",
  showInMenu: false,
  allowComments: false,
  seoTitle: "",
  seoDescription: "",
};

export function WebsitePages() {
  const [tree, setTree] = useState<PageNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Remembered for the session: saves and reloads keep what you opened.
  const { expanded, setExpanded, restore } = useSessionExpanded("pages");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  /** True once a drag has moved something that is not yet written. */
  const [pendingOrder, setPendingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  /** True while the slug still follows the title, as it does for a new page. */
  const [slugLinked, setSlugLinked] = useState(true);

  const load = async () => {
    try {
      const next = await getPageTree();
      setTree(next);
      restore(branchIds(next));
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const all = useMemo(() => flatten(tree).map(({ node }) => node), [tree]);

  const stats = useMemo(
    () => ({
      total: all.length,
      published: all.filter((page) => page.status === "PUBLISHED").length,
      drafts: all.filter((page) => page.status === "DRAFT").length,
      scheduled: all.filter((page) => page.status === "SCHEDULED").length,
    }),
    [all]
  );

  /* A page cannot be its own ancestor, so its branch is left out. */
  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (draft?.id) {
      const current = all.find((page) => page.id === draft.id);
      const walk = (node: PageNode) => {
        excluded.add(node.id);
        node.children.forEach(walk);
      };
      if (current) walk(current);
    }
    return [
      { value: "", label: "None (Top Level)" },
      ...flatten(tree)
        .filter(({ node }) => !excluded.has(node.id))
        .map(({ node, depth }) => ({
          value: node.id,
          label: `${"— ".repeat(depth)}${node.title}`,
        })),
    ];
  }, [tree, draft?.id, all]);

  const attempt = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (err: unknown) {
      Toast.fire({
        icon: "error",
        title: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  const openPage = (page: PageNode) => {
    setSlugLinked(false);
    setDraft({
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content ?? "",
      parentId: page.parentId ?? "",
      status: page.status,
      publishedAt: page.publishedAt ? page.publishedAt.slice(0, 16) : "",
      showInMenu: page.showInMenu,
      allowComments: page.allowComments,
      seoTitle: page.seoTitle ?? "",
      seoDescription: page.seoDescription ?? "",
    });
  };

  const openNew = () => {
    setSlugLinked(true);
    setDraft({ ...EMPTY });
  };

  /**
   * A drag rearranges what is on screen and nothing else. The arrangement is
   * only written when it is saved, so an accidental drop is one Discard away
   * rather than already in the database.
   */
  const move = (next: PageNode[]) => {
    setTree(next);
    setPendingOrder(true);
  };

  const saveOrder = () =>
    attempt(async () => {
      setSavingOrder(true);
      try {
        await reorderPages(toPlacements(tree));
        setPendingOrder(false);
        await load();
        Toast.fire({ icon: "success", title: "Order saved." });
      } finally {
        setSavingOrder(false);
      }
    });

  /** Throws the arrangement away by re-reading what the server holds. */
  const discardOrder = () => {
    setPendingOrder(false);
    load();
  };

  const save = () =>
    attempt(async () => {
      if (!draft) return;
      if (!draft.title.trim()) {
        Toast.fire({ icon: "error", title: "A page needs a title." });
        return;
      }
      if (draft.status === "SCHEDULED" && !draft.publishedAt) {
        Toast.fire({ icon: "error", title: "Pick the date this page should go live." });
        return;
      }

      setSaving(true);
      try {
        const payload = {
          title: draft.title.trim(),
          slug: draft.slug.trim() || slugify(draft.title),
          content: draft.content,
          parentId: draft.parentId || null,
          status: draft.status,
          publishedAt:
            draft.status === "SCHEDULED" ? new Date(draft.publishedAt).toISOString() : null,
          showInMenu: draft.showInMenu,
          allowComments: draft.allowComments,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
        };

        const saved = draft.id
          ? await updatePage(draft.id, payload)
          : await createPage(payload);

        await load();
        setDraft(null);
        Toast.fire({ icon: "success", title: `${saved.title} saved.` });
      } finally {
        setSaving(false);
      }
    });

  /** The warning names the menu items that point at the page. */
  const remove = (page: PageNode) =>
    attempt(async () => {
      const impact = await pageImpact(page.id);

      const parts = [
        impact.descendantCount
          ? `${impact.descendantCount} ${impact.descendantCount === 1 ? "subpage" : "subpages"} will be removed with it`
          : null,
        impact.menuItemCount
          ? `It is used by ${impact.menuItems.map((item) => `"${item.label}"`).join(", ")} in the navigation. ` +
            `Those menu items stay, but will lose their link`
          : null,
      ].filter(Boolean);

      const result = await Swal.fire({
        icon: "warning",
        title: `Delete ${impact.title}?`,
        text: parts.length ? `${parts.join(". ")}.` : "This cannot be undone.",
        showCancelButton: true,
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#ef4444",
      });
      if (!result.isConfirmed) return;

      await deletePage(page.id);
      if (draft?.id === page.id) setDraft(null);
      await load();
      Toast.fire({ icon: "success", title: `${impact.title} deleted.` });
    });

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setTitle = (title: string) => {
    if (!draft) return;
    // The slug follows the title until it is edited by hand, then it stops.
    setDraft({ ...draft, title, ...(slugLinked ? { slug: slugify(title) } : {}) });
  };

  /* -------------------------------- Render ------------------------------- */

  return (
    <PageShell>
      <PageHeader
        crumb="Pages"
        title="Pages"
        description="Manage website pages. Create, edit, organize and publish pages for your online store."
      >
        <GhostButton onClick={() => window.open(STOREFRONT_URL, "_blank", "noopener")}>
          <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" />
          View on Website
        </GhostButton>
        <PrimaryButton onClick={openNew}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add Page
        </PrimaryButton>
      </PageHeader>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
        >
          {error}
        </p>
      )}

      <StatGrid>
        <StatCard icon={FileTextIcon} label="Total Pages" value={stats.total} />
        <StatCard icon={FileTextIcon} label="Published" value={stats.published} />
        <StatCard icon={PencilIcon} label="Drafts" value={stats.drafts} />
        <StatCard icon={ClockIcon} label="Scheduled" value={stats.scheduled} />
      </StatGrid>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900">Pages Structure</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Drag and drop to reorder pages or nest them to create subpages.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <GhostButton onClick={() => setExpanded(new Set(branchIds(tree)))}>
                <ChevronsUpDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Expand All
              </GhostButton>
              <GhostButton onClick={() => setExpanded(new Set())}>
                <ChevronsDownUpIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Collapse All
              </GhostButton>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_150px_100px_100px_56px] border-y border-slate-200/80 bg-slate-50/80 px-5 py-2.5 text-[12px] font-medium text-slate-500">
            <span>Title</span>
            <span>URL Slug</span>
            <span>Status</span>
            <span>Updated</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : (
            <TreeBoard
              items={tree}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              selectedId={draft?.id ?? null}
              onSelect={openPage}
              onMove={move}
              emptyState={
                <div className="px-5 py-14 text-center">
                  <p className="text-[13px] text-slate-500">
                    No pages yet. Add one and it becomes available to the navigation.
                  </p>
                  <PrimaryButton onClick={openNew} className="mx-auto mt-4">
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    Add Page
                  </PrimaryButton>
                </div>
              }
              renderRow={(node) => {
                const meta = STATUS_META[node.status];
                return (
                  <div className="grid grid-cols-[minmax(0,1fr)_150px_100px_100px_56px] items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-slate-900">
                      {node.title}
                    </span>
                    <span className="truncate text-[13px] text-slate-500">/{node.slug}</span>
                    <span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium",
                          meta.chip
                        )}
                      >
                        <span
                          className={cn("h-[6px] w-[6px] rounded-full", meta.dot)}
                          aria-hidden="true"
                        />
                        {meta.label}
                      </span>
                    </span>
                    <span className="text-[13px] whitespace-nowrap text-slate-500">
                      {formatDate(node.updatedAt)}
                    </span>
                    <span className="flex justify-end">
                      <RowMenu
                        label={`Actions for ${node.title}`}
                        items={[
                          { label: "Edit page", icon: PencilIcon, onSelect: () => openPage(node) },
                          {
                            label: "Delete page",
                            icon: Trash2Icon,
                            tone: "danger" as const,
                            onSelect: () => remove(node),
                          },
                        ]}
                      />
                    </span>
                  </div>
                );
              }}
            />
          )}

          {pendingOrder && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 bg-slate-50/80 px-5 py-3.5">
              <p className="text-[13px] text-slate-600">
                You have rearranged this structure. It is not saved yet.
              </p>
              <div className="ml-auto flex items-center gap-2">
                <GhostButton onClick={discardOrder} disabled={savingOrder}>
                  Discard
                </GhostButton>
                <PrimaryButton onClick={saveOrder} disabled={savingOrder}>
                  {savingOrder && (
                    <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Save Changes
                </PrimaryButton>
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------ Editor ------------------------------ */}
        {draft ? (
          <div className="flex flex-col gap-5">
            <section className={cn(CARD, "overflow-hidden")}>
              <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
                <h2 className="text-[17px] font-semibold text-slate-900">
                  {draft.id ? "Edit Page" : "New Page"}
                </h2>
                {draft.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const page = all.find((item) => item.id === draft.id);
                      if (page) remove(page);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-100"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-4 px-5 pb-5">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Page Title<span className="ml-0.5 text-rose-500">*</span>
                  </span>
                  <input
                    value={draft.title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. About Us"
                    className={FIELD}
                    autoFocus
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    URL Slug<span className="ml-0.5 text-rose-500">*</span>
                  </span>
                  <div className="flex">
                    <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400">
                      /
                    </span>
                    <input
                      value={draft.slug}
                      onChange={(event) => {
                        setSlugLinked(false);
                        setDraft({ ...draft, slug: event.target.value });
                      }}
                      placeholder="about-us"
                      className={cn(FIELD, "rounded-l-none")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSlugLinked(true);
                        setDraft({ ...draft, slug: slugify(draft.title) });
                      }}
                      aria-label="Suggest a slug from the title"
                      title="Suggest from the title"
                      className="ml-2 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                    >
                      <RefreshCwIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Parent Page
                  </span>
                  <div className="flex gap-2">
                    <FieldSelect
                      value={draft.parentId}
                      onValueChange={(parentId) => setDraft({ ...draft, parentId })}
                      options={parentOptions}
                      label="Parent page"
                      className="flex-1"
                    />
                    <GhostButton
                      onClick={() => setDraft({ ...draft, parentId: "" })}
                      disabled={!draft.parentId}
                    >
                      Clear
                    </GhostButton>
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Page Content
                  </span>
                  {/* The dashboard's own editor, so Pages writes the same way
                      the blog does — Write/Preview, links, images and lists. */}
                  <RichTextEditor
                    value={draft.content}
                    onChange={(content) => setDraft({ ...draft, content })}
                    placeholder="Write your page content..."
                    minHeight={200}
                  />
                </div>
              </div>
            </section>

            <section className={cn(CARD, "overflow-hidden")}>
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-[17px] font-semibold text-slate-900">Page Settings</h2>
              </div>

              <div className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <ToggleSwitch
                      checked={draft.status === "PUBLISHED"}
                      onChange={(on) =>
                        setDraft({ ...draft, status: on ? "PUBLISHED" : "DRAFT" })
                      }
                      label="Publish page"
                      tone="good"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Publish Page</p>
                      <p className="text-[12px] text-slate-500">
                        Make this page visible on the website.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ToggleSwitch
                      checked={draft.showInMenu}
                      onChange={(showInMenu) => setDraft({ ...draft, showInMenu })}
                      label="Show in menu"
                      tone="good"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Show in Menu</p>
                      <p className="text-[12px] text-slate-500">
                        Offer this page to the main navigation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ToggleSwitch
                      checked={draft.allowComments}
                      onChange={(allowComments) => setDraft({ ...draft, allowComments })}
                      label="Allow comments"
                      tone="good"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Allow Comments</p>
                      <p className="text-[12px] text-slate-500">
                        Allow users to comment on this page.
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      Schedule
                    </span>
                    <FieldSelect
                      value={draft.status}
                      onValueChange={(status) =>
                        setDraft({ ...draft, status: status as PageStatus })
                      }
                      options={[
                        { value: "DRAFT", label: "Draft" },
                        { value: "PUBLISHED", label: "Published" },
                        { value: "SCHEDULED", label: "Scheduled" },
                      ]}
                      label="Publish status"
                    />
                    {draft.status === "SCHEDULED" && (
                      <input
                        type="datetime-local"
                        value={draft.publishedAt}
                        onChange={(event) =>
                          setDraft({ ...draft, publishedAt: event.target.value })
                        }
                        aria-label="Publish date"
                        className={cn(FIELD, "mt-2")}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      SEO Title
                    </span>
                    <input
                      value={draft.seoTitle}
                      onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })}
                      placeholder={`${draft.title || "Page"} – Windrise`}
                      className={FIELD}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      SEO Description
                    </span>
                    <textarea
                      value={draft.seoDescription}
                      onChange={(event) =>
                        setDraft({ ...draft, seoDescription: event.target.value })
                      }
                      rows={3}
                      maxLength={160}
                      className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                    />
                    <span className="mt-1 block text-right text-[12px] text-slate-400">
                      {draft.seoDescription.length}/160
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
                <GhostButton onClick={() => setDraft(null)} className="flex-1 justify-center">
                  Cancel
                </GhostButton>
                <PrimaryButton onClick={save} disabled={saving} className="flex-1 justify-center">
                  {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Save Changes
                </PrimaryButton>
              </div>
            </section>
          </div>
        ) : (
          <section className={cn(CARD, "px-5 py-14 text-center")}>
            <p className="text-[13px] text-slate-500">
              Pick a page from the list to edit it, or add a new one.
            </p>
            <PrimaryButton onClick={openNew} className="mx-auto mt-4">
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Add Page
            </PrimaryButton>
          </section>
        )}
      </div>
    </PageShell>
  );
}

export default WebsitePages;
