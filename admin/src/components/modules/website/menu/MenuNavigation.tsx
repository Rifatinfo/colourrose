"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImagesIcon,
  LayersIcon,
  LayoutGridIcon,
  Link2Icon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import { FieldSelect } from "@/components/ui/field-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  CARD,
  GhostButton,
  PageHeader,
  PageShell,
  PrimaryButton,
  TableSkeleton,
} from "@/components/modules/administration/shared/ui";
import {
  createMenuItem,
  deleteMenuItem,
  generateMenuFromCategories,
  getCategoryTree,
  loadDefaultMenu,
  getMenuTree,
  getPageTree,
  reorderMenu,
  updateMenuItem,
  type CategoryNode,
  type CollectionRule,
  type MenuItemType,
  type MenuLocation,
  type MenuNode,
  type PageNode,
  isExternalLink,
  normalizeMenuPath,
  STOREFRONT_HOST,
  STOREFRONT_URL,
} from "@/services/website/website";
import { useSessionExpanded } from "../shared/useSessionExpanded";
import { MegaMenuMediaPanel } from "./MegaMenuMedia";
import { branchIds, toPlacements, TreeBoard } from "../shared/TreeBoard";
import { cn } from "@/lib/utils";

/* =========================================================================
   Website > Menu & Navigation.

   The builder for the storefront menu and its mega menu. Every item is a
   *reference* — to a category, a page or a plain URL — never a copy. That is
   what lets the navigation read "Shop > Men > Clothing > Pants" while the
   taxonomy is only "Men > Pants", and why deleting an item here leaves the
   category it pointed at exactly where it was.
   ========================================================================= */

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

const TABS: { id: MenuLocation; label: string }[] = [
  { id: "MAIN", label: "Main Menu" },
  { id: "CATEGORIES", label: "Categories" },
  { id: "FOOTER", label: "Footer Menu" },
];

const TYPE_META: Record<MenuItemType, { label: string; chip: string }> = {
  PAGE: { label: "Page", chip: "bg-slate-100 text-slate-600" },
  CATEGORY: { label: "Category", chip: "bg-indigo-50 text-indigo-700" },
  CUSTOM: { label: "Custom", chip: "bg-amber-50 text-amber-700" },
  DIVIDER: { label: "Divider", chip: "bg-slate-100 text-slate-500" },
  COLLECTION: { label: "Collection", chip: "bg-pink-50 text-pink-700" },
};

/** How a collection picks its products, in the editor's words. */
const COLLECTION_RULES: { value: CollectionRule; label: string }[] = [
  { value: "ALL", label: "Everything in its categories — newest first" },
  { value: "NEWEST", label: "New arrivals — newest first" },
  { value: "BEST_SELLING", label: "Best selling — most ordered first" },
  { value: "ON_SALE", label: "On sale only" },
];

/*
  The main menu's levels, as the mega menu draws them:
  Main menu → Category (column) or Collection (left rail) → Subcategory.
  The footer menu is free-form, so it has no levels.
*/
type Level = "main" | "category" | "collection" | "rail" | "subcategory";

const LEVEL_LABEL: Record<Level, string> = {
  main: "Main menu",
  category: "Category",
  collection: "Collection page",
  rail: "Rail link",
  subcategory: "Subcategory",
};

/** A URL segment: lowercase, words joined by dashes — "Formal Shirt" → "formal-shirt". */
const urlSegment = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function levelOf(node: MenuNode, depth: number): Level {
  if (depth === 0) return "main";
  if (depth === 1) {
    // A column when it is marked as a Category.
    if (node.isCategory) return "category";
    if (node.type === "COLLECTION") return "collection";
    return "rail";
  }
  return "subcategory";
}

const NEW_ITEM_KINDS: {
  type: MenuItemType;
  label: string;
  hint: string;
  icon: typeof FileTextIcon;
}[] = [
  { type: "PAGE", label: "Page", hint: "Link to a custom page", icon: FileTextIcon },
  { type: "CATEGORY", label: "Category", hint: "Link to a product category", icon: LayoutGridIcon },
  { type: "CUSTOM", label: "Custom Link", hint: "Link to a path on your site", icon: Link2Icon },
  {
    type: "COLLECTION",
    label: "Collection",
    hint: "A page of products, like Best Selling",
    icon: LayersIcon,
  },
  { type: "DIVIDER", label: "Divider", hint: "Add a visual divider", icon: MinusIcon },
];

function flattenCategories(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

function flattenPages(nodes: PageNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.title}` },
    ...flattenPages(node.children, depth + 1),
  ]);
}

function flattenMenu(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenu(node.children)]);
}

type Draft = {
  label: string;
  type: MenuItemType;
  categoryId: string;
  pageId: string;
  url: string;
  showInMenu: boolean;
  showInMegaMenu: boolean;
  openInNewTab: boolean;
  collectionRule: CollectionRule;
  collectionCategoryIds: string[];
  isCategory: boolean;
};

export function MenuNavigation() {
  const [location, setLocation] = useState<MenuLocation>("MAIN");
  /**
   * The Mega Menu Media tab. Not a menu location: it replaces the structure
   * and editor panels with its own, and leaves `location` (and its loaded
   * tree) as it was for when you come back.
   */
  const [mediaTab, setMediaTab] = useState(false);
  const [tree, setTree] = useState<MenuNode[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [pages, setPages] = useState<PageNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Remembered per menu for the session: saves and reloads keep what you opened.
  const { expanded, setExpanded, restore } = useSessionExpanded(`menu:${location}`);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  /** True once a drag has moved something that is not yet written. */
  const [pendingOrder, setPendingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [generating, setGenerating] = useState(false);

  /**
   * Puts the category tree into this menu: one entry per top-level category,
   * each of which brings its whole sub-tree to the storefront by itself.
   */
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  /**
   * The storefront's default menu, in full: Men, Women, Kids, Gifts and Home
   * Decor with every group, item and collection, and their categories.
   */
  const loadDefaults = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Load the default menu?",
      text:
        "Adds Men, Women, Kids, Gifts and Home Decor with all their groups, items and collections, " +
        "and creates the categories they link to. Items already there are updated, not duplicated; nothing is deleted.",
      showCancelButton: true,
      confirmButtonText: "Load Default Menu",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#0b0b0f",
    });
    if (!result.isConfirmed) return;

    setLoadingDefaults(true);
    try {
      const { totals } = await loadDefaultMenu();
      await load();
      Toast.fire({
        icon: "success",
        title: `Default menu loaded — ${totals.menuItems} menu items, ${totals.categories} categories.`,
      });
    } catch (err: unknown) {
      Toast.fire({ icon: "error", title: err instanceof Error ? err.message : "Could not load the default menu" });
    } finally {
      setLoadingDefaults(false);
    }
  };

  const buildFromCategories = async () => {
    setGenerating(true);
    try {
      const { created } = await generateMenuFromCategories(location);
      await load();
      Toast.fire({
        icon: "success",
        title: created
          ? `${created} categor${created === 1 ? "y" : "ies"} added — each shows its sub-categories on the website.`
          : "Every top-level category is already in this menu.",
      });
    } catch (err: unknown) {
      Toast.fire({ icon: "error", title: err instanceof Error ? err.message : "Could not build the menu" });
    } finally {
      setGenerating(false);
    }
  };

  const load = async (next: MenuLocation = location) => {
    try {
      const [menu, cats, pageTree] = await Promise.all([
        getMenuTree(next),
        getCategoryTree(),
        getPageTree(),
      ]);
      setTree(menu);
      setCategories(cats);
      setPages(pageTree);
      restore(branchIds(menu));
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the menu");
    } finally {
      setLoading(false);
    }
  };

  // Switching tab loads that menu and clears whatever was selected in the
  // previous one, since the selection cannot survive the change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSelectedId(null);
    setDraft(null);
    load(location);
    // `load` is redefined each render; the tab is what should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const all = useMemo(() => flattenMenu(tree), [tree]);
  const selected = useMemo(
    () => all.find((node) => node.id === selectedId) ?? null,
    [all, selectedId]
  );

  /** Each item's depth (0 = main menu) and parent, for levels and "add under". */
  const placeOf = useMemo(() => {
    const map = new Map<string, { depth: number; parentId: string | null }>();
    const walk = (nodes: MenuNode[], depth: number, parentId: string | null) =>
      nodes.forEach((node) => {
        map.set(node.id, { depth, parentId });
        walk(node.children, depth + 1, node.id);
      });
    walk(tree, 0, null);
    return map;
  }, [tree]);
  const structured = location !== "FOOTER";

  /** The address the storefront gives an item: /<main menu>/<item>, lowercase. */
  const suggestedPath = useCallback(
    (node: MenuNode, label = node.label) => {
    let mainId: string | null = node.id;
    for (let p = placeOf.get(node.id)?.parentId ?? null; p; p = placeOf.get(p)?.parentId ?? null) mainId = p;
    const main = mainId && mainId !== node.id ? all.find((n) => n.id === mainId) : null;
    return main ? `/${urlSegment(main.label)}/${urlSegment(label)}` : `/${urlSegment(label)}`;
    },
    [placeOf, all]
  );

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      label: selected.label,
      type: selected.type,
      categoryId: selected.categoryId ?? "",
      pageId: selected.pageId ?? "",
      // An empty custom link starts from its suggested address (editable).
      url:
        selected.type === "CUSTOM" && (!selected.url || selected.url === "/")
          ? suggestedPath(selected)
          : (selected.url ?? ""),
      showInMenu: selected.showInMenu,
      showInMegaMenu: selected.showInMegaMenu,
      openInNewTab: selected.openInNewTab,
      collectionRule: selected.collectionRule ?? "ALL",
      collectionCategoryIds: selected.collectionCategories.map((c) => c.id),
      isCategory: selected.isCategory,
    });
  }, [selected, suggestedPath]);

  const categoryOptions = useMemo(
    () => flattenCategories(categories).map((c) => ({ value: c.id, label: c.label })),
    [categories]
  );
  const pageOptions = useMemo(
    () => flattenPages(pages).map((p) => ({ value: p.id, label: p.label })),
    [pages]
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

  /**
   * A drag rearranges what is on screen and nothing else. The arrangement is
   * only written when it is saved, so an accidental drop is one Discard away
   * rather than already in the database.
   */
  const move = (next: MenuNode[]) => {
    setTree(next);
    setPendingOrder(true);
  };

  const saveOrder = () =>
    attempt(async () => {
      setSavingOrder(true);
      try {
        await reorderMenu(location, toPlacements(tree));
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

  /** Adds an item of the chosen kind at the end of the current menu. */
  const addItem = (type: MenuItemType) =>
    attempt(async () => {
      const defaults: Record<MenuItemType, { label: string; extra: Record<string, unknown> }> = {
        PAGE: { label: pages[0]?.title ?? "New page link", extra: { pageId: pages[0]?.id } },
        CATEGORY: {
          label: categories[0]?.name ?? "New category link",
          extra: { categoryId: categories[0]?.id },
        },
        CUSTOM: { label: "New link", extra: { url: "/" } },
        DIVIDER: { label: "Divider", extra: {} },
        COLLECTION: { label: "New collection", extra: { collectionRule: "ALL" } },
      };

      if (type === "PAGE" && !pages.length) {
        Toast.fire({ icon: "error", title: "Create a page first, then link to it." });
        return;
      }
      if (type === "CATEGORY" && !categories.length) {
        Toast.fire({ icon: "error", title: "Create a category first, then link to it." });
        return;
      }

      /*
        Where it goes: under the selected item when that is its level — a
        category or collection under a main menu, a subcategory under a
        category — otherwise at the end as a new main menu.
      */
      /*
        Inside the selected item: under a main menu it joins the rail (or a
        column, once marked), and inside a second-level item it lists under
        it — which makes that item a Category column. With a third-level item
        selected it goes beside it. With nothing selected it is a new main menu.
      */
      let parentId: string | null = null;
      if (selected) {
        const place = placeOf.get(selected.id);
        const depth = place?.depth ?? 0;
        parentId = structured && depth >= 2 ? (place?.parentId ?? null) : selected.id;
      }

      const created = await createMenuItem({
        location,
        type,
        label: defaults[type].label,
        parentId,
        ...defaults[type].extra,
      });
      // Open the branch it went into, so the new item is in view.
      if (parentId) setExpanded((current) => new Set([...current, parentId!]));
      await load();
      setSelectedId(created.id);
      Toast.fire({ icon: "success", title: `${created.label} added.` });
    });

  const save = () =>
    attempt(async () => {
      if (!selected || !draft) return;
      if (!draft.label.trim()) {
        Toast.fire({ icon: "error", title: "A menu item needs a label." });
        return;
      }

      setSaving(true);
      try {
        await updateMenuItem(selected.id, {
          label: draft.label.trim(),
          type: draft.type,
          categoryId: draft.type === "CATEGORY" ? draft.categoryId || null : null,
          pageId: draft.type === "PAGE" ? draft.pageId || null : null,
          url: draft.type === "CUSTOM" ? normalizeMenuPath(draft.url) || null : null,
          showInMenu: draft.showInMenu,
          showInMegaMenu: draft.showInMegaMenu,
          openInNewTab: draft.openInNewTab,
          ...(structured && placeOf.get(selected.id)?.depth === 1 && { isCategory: draft.isCategory }),
          ...(draft.type === "COLLECTION" && {
            collectionRule: draft.collectionRule,
            collectionCategoryIds: draft.collectionCategoryIds,
          }),
        });
        await load();
        Toast.fire({ icon: "success", title: `${draft.label.trim()} saved.` });
      } finally {
        setSaving(false);
      }
    });

  /**
   * Removing a navigation entry, and only that. The confirmation says so
   * outright, because "delete Men" reads alarmingly next to a category tree.
   */
  const remove = (node: MenuNode) =>
    attempt(async () => {
      const submenu = flattenMenu(node.children).length;
      const target =
        node.type === "CATEGORY"
          ? `The "${node.category?.name ?? "linked"}" category itself is not affected.`
          : node.type === "PAGE"
            ? `The "${node.page?.title ?? "linked"}" page itself is not affected.`
            : "";

      const result = await Swal.fire({
        icon: "warning",
        title: `Remove "${node.label}" from the menu?`,
        text: [
          submenu
            ? `Its ${submenu} submenu ${submenu === 1 ? "item" : "items"} will be removed too.`
            : null,
          target,
        ]
          .filter(Boolean)
          .join(" "),
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#ef4444",
      });
      if (!result.isConfirmed) return;

      await deleteMenuItem(node.id);
      if (selectedId === node.id) setSelectedId(null);
      await load();
      Toast.fire({ icon: "success", title: `${node.label} removed from the menu.` });
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
        crumb="Menu & Navigation"
        title="Menu & Navigation"
        description="Manage your main menu, categories and mega menu structure. Drag and drop to reorder, add new items, or nest submenus."
      >
        <GhostButton onClick={() => window.open(STOREFRONT_URL, "_blank", "noopener")}>
          <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" />
          View on Website
        </GhostButton>
        {!mediaTab && (
          <PrimaryButton onClick={() => addItem("CUSTOM")}>
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add Menu Item
          </PrimaryButton>
        )}
      </PageHeader>

      <div
        role="tablist"
        aria-label="Which menu to edit"
        className="flex items-center gap-6 border-b border-slate-200/80"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={!mediaTab && location === tab.id}
            onClick={() => {
              setMediaTab(false);
              setLocation(tab.id);
            }}
            className={cn(
              "-mb-px cursor-pointer border-b-2 pb-3 text-[13px] font-medium transition-colors",
              !mediaTab && location === tab.id
                ? "border-[#0b0b0b] text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={mediaTab}
          onClick={() => setMediaTab(true)}
          className={cn(
            "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-3 text-[13px] font-medium transition-colors",
            mediaTab
              ? "border-[#0b0b0b] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <ImagesIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Mega Menu Media
        </button>
      </div>

      {mediaTab ? (
        <MegaMenuMediaPanel />
      ) : (
      <>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900">
                {TABS.find((tab) => tab.id === location)?.label} Structure
              </h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Drag and drop to reorder items or nest them to create submenus.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {location === "MAIN" && (
                <GhostButton onClick={loadDefaults} disabled={loadingDefaults}>
                  {loadingDefaults ? (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Load Default Menu
                </GhostButton>
              )}
              {location !== "FOOTER" && (
                <GhostButton onClick={buildFromCategories} disabled={generating}>
                  {generating ? (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <LayoutGridIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Build from Categories
                </GhostButton>
              )}
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
                  This menu is empty. Add an item from the panel on the right — it links to a
                  category or page rather than copying it.
                  {location !== "FOOTER" && (
                    <>
                      <br />
                      {location === "MAIN" ? (
                        <>
                          Or use <span className="font-medium text-slate-700">Load Default Menu</span> for the
                          site&apos;s full default menu, or{" "}
                          <span className="font-medium text-slate-700">Build from Categories</span> to add your
                          category tree in one go.
                        </>
                      ) : (
                        <>
                          Or use <span className="font-medium text-slate-700">Build from Categories</span>{" "}
                          to add your whole category tree in one go.
                        </>
                      )}
                      {location === "MAIN" && (
                        <>
                          {" "}
                          Until then, the website builds its menu from your categories.
                        </>
                      )}
                    </>
                  )}
                </p>
              }
              renderRow={(node) => (
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
                    {node.type === "DIVIDER" ? (
                      <span className="text-slate-400">— {node.label}</span>
                    ) : (
                      node.label
                    )}
                  </span>
                  {!node.showInMenu && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      Hidden
                    </span>
                  )}
                  {structured && (
                    <span className="hidden text-[11px] text-slate-400 sm:inline">
                      {LEVEL_LABEL[levelOf(node, placeOf.get(node.id)?.depth ?? 0)]}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[12px] font-medium",
                      TYPE_META[node.type].chip
                    )}
                  >
                    {TYPE_META[node.type].label}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(node);
                    }}
                    aria-label={`Remove ${node.label} from the menu`}
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
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

        <div className="flex flex-col gap-5">
          <section className={cn(CARD, "overflow-hidden")}>
            <div className="px-5 pt-5 pb-4">
              <h2 className="text-[17px] font-semibold text-slate-900">Edit Menu Item</h2>
              {selected && <p className="mt-0.5 text-[13px] text-slate-500">{selected.label}</p>}
            </div>

            {!selected || !draft ? (
              <p className="px-5 pb-6 text-[13px] text-slate-500">
                Pick an item from the menu to change its label, what it links to and where it
                appears.
              </p>
            ) : (
              <div className="flex flex-col gap-4 px-5 pb-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      Label<span className="ml-0.5 text-rose-500">*</span>
                    </span>
                    <input
                      value={draft.label}
                      onChange={(event) => {
                        const label = event.target.value;
                        // A URL still on its suggestion follows the label; one typed by hand stays.
                        const following = draft.url === suggestedPath(selected, draft.label);
                        setDraft({
                          ...draft,
                          label,
                          url: following ? suggestedPath(selected, label) : draft.url,
                        });
                      }}
                      className={FIELD}
                    />
                  </label>

                  <div>
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      Type<span className="ml-0.5 text-rose-500">*</span>
                    </span>
                    <FieldSelect
                      value={draft.type}
                      onValueChange={(type) =>
                        setDraft({
                          ...draft,
                          type: type as MenuItemType,
                          // Becoming a custom link: start from the suggested address.
                          url:
                            type === "CUSTOM" && (!draft.url || draft.url === "/")
                              ? suggestedPath(selected, draft.label)
                              : draft.url,
                        })
                      }
                      options={NEW_ITEM_KINDS.map((kind) => ({
                        value: kind.type,
                        label: kind.label,
                      }))}
                      label="Type"
                    />
                  </div>
                </div>

                {draft.type === "CATEGORY" && (
                  <div>
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      Link to Category<span className="ml-0.5 text-rose-500">*</span>
                    </span>
                    <FieldSelect
                      value={draft.categoryId}
                      onValueChange={(categoryId) => setDraft({ ...draft, categoryId })}
                      options={categoryOptions}
                      label="Link to category"
                    />
                  </div>
                )}

                {draft.type === "COLLECTION" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                        Shows<span className="ml-0.5 text-rose-500">*</span>
                      </span>
                      <FieldSelect
                        value={draft.collectionRule}
                        onValueChange={(rule) =>
                          setDraft({ ...draft, collectionRule: rule as CollectionRule })
                        }
                        options={COLLECTION_RULES}
                        label="Shows"
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                        From these categories
                      </span>
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 px-3 py-2">
                        {flattenCategories(categories).map((category) => {
                          const checked = draft.collectionCategoryIds.includes(category.id);
                          return (
                            <label
                              key={category.id}
                              className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setDraft({
                                    ...draft,
                                    collectionCategoryIds: checked
                                      ? draft.collectionCategoryIds.filter((id) => id !== category.id)
                                      : [...draft.collectionCategoryIds, category.id],
                                  })
                                }
                                className="h-3.5 w-3.5 accent-slate-900"
                              />
                              {category.label}
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[12px] text-slate-400">
                        Each category brings everything under it. Choose none to use the whole main
                        menu it sits under.
                        {selected.slug && (
                          <>
                            {" "}
                            Its page:{" "}
                            <span className="text-slate-600">
                              {STOREFRONT_HOST}/collection/{selected.slug}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {draft.type === "PAGE" && (
                  <div>
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                      Link to Page<span className="ml-0.5 text-rose-500">*</span>
                    </span>
                    <FieldSelect
                      value={draft.pageId}
                      onValueChange={(pageId) => setDraft({ ...draft, pageId })}
                      options={pageOptions}
                      label="Link to page"
                    />
                  </div>
                )}

                {draft.type === "CUSTOM" && (
                  <div>
                    <label
                      htmlFor="menu-item-path"
                      className="mb-1.5 block text-[13px] font-medium text-slate-700"
                    >
                      URL Path<span className="ml-0.5 text-rose-500">*</span>
                    </label>
                    <div className="flex">
                      {/* The domain is fixed: links to the storefront are stored
                          as paths so they survive a domain change and work on
                          staging. It hides for a link to another site. */}
                      {!isExternalLink(draft.url) && (
                        <span className="inline-flex h-10 shrink-0 items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400">
                          {STOREFRONT_HOST}
                        </span>
                      )}
                      <input
                        id="menu-item-path"
                        value={draft.url}
                        onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                        onBlur={() => setDraft({ ...draft, url: normalizeMenuPath(draft.url) })}
                        placeholder="/sale"
                        className={cn(FIELD, !isExternalLink(draft.url) && "rounded-l-none")}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-slate-400">
                      Filled in from where the item sits — {suggestedPath(selected, draft.label)}.
                      Keep it, or type any path on your site (/sale) or a full https:// address.
                      {draft.url !== suggestedPath(selected, draft.label) && (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={() => setDraft({ ...draft, url: suggestedPath(selected, draft.label) })}
                            className="cursor-pointer font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                          >
                            Use {suggestedPath(selected, draft.label)}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3.5 border-t border-slate-100 pt-4">
                  {structured && placeOf.get(selected.id)?.depth === 1 && (
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={draft.isCategory}
                        onChange={(event) => setDraft({ ...draft, isCategory: event.target.checked })}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-slate-900"
                      />
                      <span>
                        <span className="block text-[13px] font-medium text-slate-900">Category</span>
                        <span className="block text-[12px] text-slate-500">
                          {draft.isCategory
                            ? "A column heading, like Clothing, with its items listed under it. Untick to make it a left-side link, like Best Selling."
                            : "A left-side link, like Best Selling. Tick to make it a column heading, like Clothing, with its items listed under it."}
                          {!draft.isCategory && selected.children.length > 0 && (
                            <span className="mt-1 block text-amber-700">
                              Its {selected.children.length} item{selected.children.length === 1 ? "" : "s"} stay
                              here but won&apos;t show on the website until it&apos;s a Category again.
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  )}
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
                        Visible on the website navigation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ToggleSwitch
                      checked={draft.showInMegaMenu}
                      onChange={(showInMegaMenu) => setDraft({ ...draft, showInMegaMenu })}
                      label="Show in mega menu"
                      tone="good"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Show in Mega Menu</p>
                      <p className="text-[12px] text-slate-500">
                        Display submenu with categories and products.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ToggleSwitch
                      checked={draft.openInNewTab}
                      onChange={(openInNewTab) => setDraft({ ...draft, openInNewTab })}
                      label="Open in new tab"
                      tone="good"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Open in New Tab</p>
                      <p className="text-[12px] text-slate-500">
                        Opens the link in a new browser tab.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <GhostButton
                    onClick={() => setSelectedId(null)}
                    className="flex-1 justify-center"
                  >
                    Cancel
                  </GhostButton>
                  <PrimaryButton onClick={save} disabled={saving} className="flex-1 justify-center">
                    {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save Changes
                  </PrimaryButton>
                </div>
              </div>
            )}
          </section>

          <section className={cn(CARD, "overflow-hidden")}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-[17px] font-semibold text-slate-900">Add New Menu Item</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                It goes inside the selected item: pick a main menu (Men) to add a category or a
                left-side link to it, or a category (Clothing) to add an item under it. With
                nothing selected it becomes a new main menu. You can also drag any item into
                another.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
              {NEW_ITEM_KINDS.map((kind) => (
                <button
                  key={kind.type}
                  type="button"
                  onClick={() => addItem(kind.type)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    <kind.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-900">
                      {kind.label}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500">{kind.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      </>
      )}
    </PageShell>
  );
}

export default MenuNavigation;
