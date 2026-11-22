"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  FolderTreeIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SquareStackIcon,
  Trash2Icon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import { FieldSelect } from "@/components/ui/field-select";
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
import {
  categoryImpact,
  createCategory,
  deleteCategory,
  getCategoryTree,
  reorderCategories,
  updateCategory,
  type CategoryNode,
  STOREFRONT_URL,
} from "@/services/website/website";
import { useSessionExpanded } from "../shared/useSessionExpanded";
import { branchIds, toPlacements, TreeBoard } from "../shared/TreeBoard";
import { cn } from "@/lib/utils";

/* =========================================================================
   Website > Categories.

   The product taxonomy, shaped by dragging. These are the same `Category`
   rows the product form has always used, so a category created here is
   available on a product straight away — there is no second list.
   ========================================================================= */

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

/** Every category as a flat list, for the parent pickers. */
function flatten(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

function countAll(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...countAll(node.children)]);
}

export function WebsiteCategories() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Remembered for the session: saves and reloads keep what you opened.
  const { expanded, setExpanded, restore } = useSessionExpanded("categories");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** True once a drag has moved something that is not yet written. */
  const [pendingOrder, setPendingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  /* ------------------------------ Edit panel ----------------------------- */
  const [form, setForm] = useState({
    name: "",
    parentId: "",
    description: "",
    image: "",
    isActive: true,
  });

  /* --------------------------- Add New Category -------------------------- */
  const [draft, setDraft] = useState({ name: "", parentId: "", description: "" });
  const [creating, setCreating] = useState(false);

  const load = async (keepSelection = true) => {
    try {
      const next = await getCategoryTree();
      setTree(next);
      restore(branchIds(next));
      if (!keepSelection) setSelectedId(null);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const all = useMemo(() => countAll(tree), [tree]);
  const selected = useMemo(
    () => all.find((node) => node.id === selectedId) ?? null,
    [all, selectedId]
  );

  // The panel follows the selection rather than holding its own copy.
  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: selected.name,
      parentId: selected.parentId ?? "",
      description: selected.description ?? "",
      image: selected.image ?? "",
      isActive: selected.isActive,
    });
  }, [selected]);

  const stats = useMemo(
    () => ({
      total: all.length,
      active: all.filter((node) => node.isActive).length,
      inactive: all.filter((node) => !node.isActive).length,
      top: tree.length,
    }),
    [all, tree]
  );

  /*
    A category cannot become its own descendant, so its own branch is left out
    of the parent list — the same rule the server enforces, shown before the
    admin can pick it.
  */
  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (selected) {
      const walk = (node: CategoryNode) => {
        excluded.add(node.id);
        node.children.forEach(walk);
      };
      walk(selected);
    }
    return [
      { value: "", label: "None (Top Level)" },
      ...flatten(tree)
        .filter(({ node }) => !excluded.has(node.id))
        .map(({ node, depth }) => ({
          value: node.id,
          label: `${"— ".repeat(depth)}${node.name}`,
        })),
    ];
  }, [tree, selected]);

  const draftParentOptions = useMemo(
    () => [
      { value: "", label: "None (Top Level)" },
      ...flatten(tree).map(({ node, depth }) => ({
        value: node.id,
        label: `${"— ".repeat(depth)}${node.name}`,
      })),
    ],
    [tree]
  );

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

  /* -------------------------------- Actions ------------------------------ */

  /**
   * A drag commits immediately: the tree on screen is the arrangement, and
   * the server re-checks it before writing. A failure reloads, so the screen
   * never keeps an arrangement the database refused.
   */
  /**
   * A drag rearranges what is on screen and nothing else. The arrangement is
   * only written when it is saved, so an accidental drop is one Discard away
   * rather than already in the database.
   */
  const move = (next: CategoryNode[]) => {
    setTree(next);
    setPendingOrder(true);
  };

  const saveOrder = () =>
    attempt(async () => {
      setSavingOrder(true);
      try {
        await reorderCategories(toPlacements(tree));
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
      if (!selected) return;
      if (form.name.trim().length < 1) {
        Toast.fire({ icon: "error", title: "A category needs a name." });
        return;
      }
      setSaving(true);
      try {
        await updateCategory(selected.id, {
          name: form.name.trim(),
          parentId: form.parentId || null,
          description: form.description,
          image: form.image || null,
          isActive: form.isActive,
        });
        await load();
        Toast.fire({ icon: "success", title: `${form.name.trim()} saved.` });
      } finally {
        setSaving(false);
      }
    });

  const add = () =>
    attempt(async () => {
      if (draft.name.trim().length < 1) {
        Toast.fire({ icon: "error", title: "A category needs a name." });
        return;
      }
      setCreating(true);
      try {
        const created = await createCategory({
          name: draft.name.trim(),
          parentId: draft.parentId || null,
          description: draft.description,
        });
        setDraft({ name: "", parentId: "", description: "" });
        await load();
        if (created.parentId) setExpanded((current) => new Set([...current, created.parentId!]));
        setSelectedId(created.id);
        Toast.fire({ icon: "success", title: `${created.name} created.` });
      } finally {
        setCreating(false);
      }
    });

  /**
   * The warning names what would go: the server refuses a category with
   * products anywhere beneath it, so this asks first and says why.
   */
  const remove = (node: CategoryNode) =>
    attempt(async () => {
      const impact = await categoryImpact(node.id);

      if (impact.productCount > 0) {
        await Swal.fire({
          icon: "info",
          title: `${impact.name} is in use`,
          text:
            `${impact.productCount} ${impact.productCount === 1 ? "product is" : "products are"} ` +
            `in this category${impact.descendantCount ? " or one below it" : ""}. ` +
            `Move them to another category first.`,
          confirmButtonText: "Got it",
          confirmButtonColor: "#0b0b0b",
        });
        return;
      }

      const parts = [
        impact.descendantCount
          ? `${impact.descendantCount} ${impact.descendantCount === 1 ? "subcategory" : "subcategories"} will be removed with it`
          : null,
        impact.menuItemCount
          ? `${impact.menuItemCount} menu ${impact.menuItemCount === 1 ? "item" : "items"} link to it and will lose that link, but will not be deleted`
          : null,
      ].filter(Boolean);

      const result = await Swal.fire({
        icon: "warning",
        title: `Delete ${impact.name}?`,
        text: parts.length ? `${parts.join(". ")}.` : "This cannot be undone.",
        showCancelButton: true,
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#ef4444",
      });
      if (!result.isConfirmed) return;

      await deleteCategory(node.id);
      if (selectedId === node.id) setSelectedId(null);
      await load();
      Toast.fire({ icon: "success", title: `${impact.name} deleted.` });
    });

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* -------------------------------- Render ------------------------------- */

  return (
    <PageShell>
      <PageHeader
        crumb="Categories"
        title="Categories"
        description="Manage product categories and subcategories. Drag and drop to reorder, create, edit or nest categories."
      >
        <GhostButton onClick={() => window.open(STOREFRONT_URL, "_blank", "noopener")}>
          <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" />
          View on Website
        </GhostButton>
        <PrimaryButton
          onClick={() => document.getElementById("new-category-name")?.focus()}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add Category
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
        <StatCard icon={FolderTreeIcon} label="Total Categories" value={stats.total} />
        <StatCard
          icon={SquareStackIcon}
          label="Active Categories"
          value={stats.active}
          caption="Visible on the website"
        />
        <StatCard
          icon={SquareStackIcon}
          label="Inactive Categories"
          value={stats.inactive}
          caption="Hidden from the website"
        />
        <StatCard
          icon={FolderTreeIcon}
          label="Top Level Categories"
          value={stats.top}
          caption={tree.slice(0, 3).map((node) => node.name).join(", ") || "None yet"}
        />
      </StatGrid>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* --------------------------- The tree --------------------------- */}
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900">Category Structure</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Drag and drop to reorder or nest categories. Click an item to edit.
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

          <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_60px] border-y border-slate-200/80 bg-slate-50/80 px-5 py-2.5 text-[12px] font-medium text-slate-500">
            <span>Name</span>
            <span className="text-right">Products</span>
            <span className="text-right">Status</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : (
            <TreeBoard
              items={tree}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              selectedId={selectedId}
              onSelect={(node) => setSelectedId(node.id)}
              onMove={move}
              emptyState={
                <p className="px-5 py-14 text-center text-[13px] text-slate-500">
                  No categories yet. Create one below and it becomes available on products
                  straight away.
                </p>
              }
              renderRow={(node) => (
                <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_60px] items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-slate-900">
                    {node.name}
                  </span>
                  <span className="text-right text-[13px] tabular-nums text-slate-500">
                    {node.productCount}
                  </span>
                  <span className="flex justify-end">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium",
                        node.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <span
                        className={cn(
                          "h-[6px] w-[6px] rounded-full",
                          node.isActive ? "bg-emerald-500" : "bg-slate-400"
                        )}
                        aria-hidden="true"
                      />
                      {node.isActive ? "Active" : "Inactive"}
                    </span>
                  </span>
                  <span className="flex justify-end">
                    <RowMenu
                      label={`Actions for ${node.name}`}
                      items={[
                        {
                          label: "Edit category",
                          icon: PencilIcon,
                          onSelect: () => setSelectedId(node.id),
                        },
                        {
                          label: "Delete category",
                          icon: Trash2Icon,
                          tone: "danger" as const,
                          onSelect: () => remove(node),
                        },
                      ]}
                    />
                  </span>
                </div>
              )}
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

        {/* ------------------------- Edit + Create ------------------------- */}
        <div className="flex flex-col gap-5">
          <section className={cn(CARD, "overflow-hidden")}>
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
              <h2 className="text-[17px] font-semibold text-slate-900">Edit Category</h2>
              {selected && (
                <button
                  type="button"
                  onClick={() => remove(selected)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-100"
                >
                  <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              )}
            </div>

            {!selected ? (
              <p className="px-5 pb-6 text-[13px] text-slate-500">
                Pick a category from the tree to edit its name, parent, description and status.
              </p>
            ) : (
              <div className="flex flex-col gap-4 px-5 pb-5">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Category Name<span className="ml-0.5 text-rose-500">*</span>
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className={FIELD}
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Parent Category
                  </span>
                  <div className="flex gap-2">
                    <FieldSelect
                      value={form.parentId}
                      onValueChange={(parentId) => setForm({ ...form, parentId })}
                      options={parentOptions}
                      label="Parent category"
                      className="flex-1"
                    />
                    <GhostButton
                      onClick={() => setForm({ ...form, parentId: "" })}
                      disabled={!form.parentId}
                    >
                      Clear
                    </GhostButton>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Description
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    rows={3}
                    maxLength={160}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                  />
                  <span className="mt-1 block text-right text-[12px] text-slate-400">
                    {form.description.length}/160
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Category Image
                  </span>
                  <input
                    value={form.image}
                    onChange={(event) => setForm({ ...form, image: event.target.value })}
                    placeholder="/uploads/categories/men.jpg"
                    className={FIELD}
                  />
                  <span className="mt-1 block text-[12px] text-slate-400">
                    Recommended: 800 × 800px (JPG/PNG, max 2MB)
                  </span>
                </label>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Status
                  </span>
                  <FieldSelect
                    value={form.isActive ? "active" : "inactive"}
                    onValueChange={(value) =>
                      setForm({ ...form, isActive: value === "active" })
                    }
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                    label="Status"
                  />
                  <span className="mt-1 block text-[12px] text-slate-400">
                    Inactive categories will be hidden from the website.
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <GhostButton
                    onClick={() => setSelectedId(null)}
                    className="flex-1 justify-center"
                  >
                    Cancel
                  </GhostButton>
                  <PrimaryButton
                    onClick={save}
                    disabled={saving}
                    className="flex-1 justify-center"
                  >
                    {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save Changes
                  </PrimaryButton>
                </div>
              </div>
            )}
          </section>

          <section className={cn(CARD, "overflow-hidden")}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-[17px] font-semibold text-slate-900">Add New Category</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Choose a parent category to create a subcategory, or leave empty for a top level
                category.
              </p>
            </div>

            <div className="flex flex-col gap-4 px-5 pb-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Category Name<span className="ml-0.5 text-rose-500">*</span>
                  </span>
                  <input
                    id="new-category-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="e.g. Shirts"
                    className={FIELD}
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Parent Category
                  </span>
                  <FieldSelect
                    value={draft.parentId}
                    onValueChange={(parentId) => setDraft({ ...draft, parentId })}
                    options={draftParentOptions}
                    label="Parent category for the new category"
                  />
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Description
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Add a short description..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                />
              </label>

              <PrimaryButton onClick={add} disabled={creating} className="justify-center">
                {creating && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Create Category
              </PrimaryButton>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

export default WebsiteCategories;
