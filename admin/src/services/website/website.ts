const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/* =========================================================================
   The Website section's API: categories, pages and navigation.

   Three resources, one client, because the screens cross-reference each
   other — the menu builder needs categories and pages to link to, and the
   pages tree needs to know which menu items use a page before deleting it.
   ========================================================================= */

export type CategoryNode = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  productCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
  children: CategoryNode[];
};

export type PageStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED";

export type PageNode = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: PageStatus;
  publishedAt: string | null;
  showInMenu: boolean;
  allowComments: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  childCount: number;
  menuItemCount: number;
  updatedAt: string;
  children: PageNode[];
};

export type MenuLocation = "MAIN" | "CATEGORIES" | "FOOTER";
export type MenuItemType = "PAGE" | "CATEGORY" | "CUSTOM" | "DIVIDER" | "COLLECTION";

/** How a collection picks and orders its products. */
export type CollectionRule = "ALL" | "NEWEST" | "BEST_SELLING" | "ON_SALE";

export type MenuNode = {
  id: string;
  location: MenuLocation;
  label: string;
  type: MenuItemType;
  categoryId: string | null;
  pageId: string | null;
  url: string | null;
  icon: string | null;
  showInMenu: boolean;
  showInMegaMenu: boolean;
  openInNewTab: boolean;
  parentId: string | null;
  sortOrder: number;
  category: { id: string; name: string; slug: string | null } | null;
  page: { id: string; title: string; slug: string } | null;
  /** A second-level item shown as a Category column (underlined heading). */
  isCategory: boolean;
  /** COLLECTION: its page (/collection/<slug>), rule and categories. */
  slug: string | null;
  collectionRule: CollectionRule | null;
  collectionCategories: { id: string; name: string; slug: string | null }[];
  children: MenuNode[];
};

/** The shape a reorder sends: the arrangement as the screen is showing it. */
export type TreePlacement = { id: string; children?: TreePlacement[] };

async function handleError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message ?? `Request failed with status ${res.status}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/website${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) await handleError(res);
  return (await res.json()).data as T;
}

const body = (payload: unknown) => ({ body: JSON.stringify(payload) });

/* ------------------------------- Categories ------------------------------ */

export const getCategoryTree = () => request<CategoryNode[]>("/category");

export const createCategory = (payload: {
  name: string;
  slug?: string;
  description?: string;
  image?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}) => request<CategoryNode>("/category", { method: "POST", ...body(payload) });

export const updateCategory = (
  id: string,
  payload: {
    name?: string;
    slug?: string;
    description?: string;
    image?: string | null;
    parentId?: string | null;
    isActive?: boolean;
  }
) => request<CategoryNode>(`/category/${id}`, { method: "PATCH", ...body(payload) });

/** What a delete would take with it, so the confirmation can name it. */
export const categoryImpact = (id: string) =>
  request<{
    id: string;
    name: string;
    descendantCount: number;
    productCount: number;
    menuItemCount: number;
  }>(`/category/${id}/impact`);

export const deleteCategory = (id: string) =>
  request<{ id: string; name: string; removed: number }>(`/category/${id}`, {
    method: "DELETE",
  });

export const reorderCategories = (items: TreePlacement[]) =>
  request<{ updated: number }>("/category/reorder", { method: "POST", ...body({ items }) });

/* --------------------------------- Pages -------------------------------- */

export const getPageTree = () => request<PageNode[]>("/page");

export type PagePayload = {
  title: string;
  slug?: string;
  content?: string;
  status?: PageStatus;
  publishedAt?: string | null;
  showInMenu?: boolean;
  allowComments?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  icon?: string | null;
  parentId?: string | null;
};

export const createPage = (payload: PagePayload) =>
  request<PageNode>("/page", { method: "POST", ...body(payload) });

export const updatePage = (id: string, payload: Partial<PagePayload>) =>
  request<PageNode>(`/page/${id}`, { method: "PATCH", ...body(payload) });

export const pageImpact = (id: string) =>
  request<{
    id: string;
    title: string;
    descendantCount: number;
    menuItemCount: number;
    menuItems: { label: string; location: MenuLocation }[];
  }>(`/page/${id}/impact`);

export const deletePage = (id: string) =>
  request<{ id: string; title: string; removed: number }>(`/page/${id}`, { method: "DELETE" });

export const reorderPages = (items: TreePlacement[]) =>
  request<{ updated: number }>("/page/reorder", { method: "POST", ...body({ items }) });

/* --------------------------------- Menu --------------------------------- */

export const getMenuTree = (location: MenuLocation) =>
  request<MenuNode[]>(`/menu?location=${location}`);

export type MenuPayload = {
  location?: MenuLocation;
  label: string;
  type?: MenuItemType;
  categoryId?: string | null;
  pageId?: string | null;
  url?: string | null;
  icon?: string | null;
  showInMenu?: boolean;
  showInMegaMenu?: boolean;
  openInNewTab?: boolean;
  parentId?: string | null;
  isCategory?: boolean;
  collectionRule?: CollectionRule;
  collectionCategoryIds?: string[];
};

export const createMenuItem = (payload: MenuPayload) =>
  request<MenuNode>("/menu", { method: "POST", ...body(payload) });

export const updateMenuItem = (id: string, payload: Partial<MenuPayload>) =>
  request<MenuNode>(`/menu/${id}`, { method: "PATCH", ...body(payload) });

/** Removes the navigation entry only — never the category or page behind it. */
export const deleteMenuItem = (id: string) =>
  request<{ id: string; label: string; removed: number }>(`/menu/${id}`, { method: "DELETE" });

export const reorderMenu = (location: MenuLocation, items: TreePlacement[]) =>
  request<{ updated: number }>("/menu/reorder", {
    method: "POST",
    ...body({ location, items }),
  });

/**
 * Adds every active top-level category the menu does not link to yet. Each
 * one expands into its own sub-categories on the storefront, so this is all a
 * menu needs to mirror the category tree. Never duplicates or removes.
 */
export const generateMenuFromCategories = (location: MenuLocation) =>
  request<{ created: number; skipped: number }>("/menu/generate", {
    method: "POST",
    ...body({ location }),
  });

/**
 * Loads the storefront's default navigation: its categories (Men > Clothing >
 * Panjabi…), the main menu with every mega menu, and the Home and Blog pages.
 * Re-runnable — it updates what is already there and never deletes.
 */
export const loadDefaultMenu = () =>
  request<{
    written: { categories: number; menuItems: number; pages: number };
    totals: { categories: number; menuItems: number; pages: number };
  }>("/menu/defaults", { method: "POST" });

/* ------------------------------- Links ---------------------------------- */

/**
 * The storefront's address, for the fixed prefix on link fields and for
 * "View on Website". Set NEXT_PUBLIC_STOREFRONT_URL per environment; the
 * default is the live site.
 */
export const STOREFRONT_URL = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "https://thewindrise.com"
).replace(/\/+$/, "");

/** The storefront's host, as shown in front of a path: "thewindrise.com". */
export const STOREFRONT_HOST = STOREFRONT_URL.replace(/^https?:\/\//, "");

/**
 * What the server will store for a typed link, shown as soon as the field is
 * left so there is no surprise on save. The server applies the same rules;
 * this only mirrors them.
 *
 *   "sale" or "/sale"               → "/sale"
 *   "https://thewindrise.com/sale"  → "/sale"
 *   "https://instagram.com/x"       → unchanged (another site)
 */
export function normalizeMenuPath(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const own = new Set([
        STOREFRONT_HOST.toLowerCase(),
        STOREFRONT_HOST.toLowerCase().replace(/^www\./, ""),
        `www.${STOREFRONT_HOST.toLowerCase().replace(/^www\./, "")}`,
        "thewindrise.com",
        "www.thewindrise.com",
      ]);
      if (own.has(url.hostname.toLowerCase())) {
        return `${url.pathname}${url.search}${url.hash}` || "/";
      }
    } catch {
      // Leave it for the server to reject with a proper message.
    }
    return raw;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.replace(/\/{2,}/g, "/");
}

/** Whether a link leaves the site. */
export const isExternalLink = (href: string) => /^https?:\/\//i.test(href);

/* ---------------------------- Mega menu media ---------------------------- */

export type MegaMenuMediaType = "IMAGE" | "VIDEO" | "GIF";
export type MegaMenuMediaOrder = "DEFAULT" | "NEWEST" | "OLDEST" | "RANDOM";

/** A main menu (Men, Women…) that can carry mega menu media. */
export type MegaMenuTarget = {
  id: string;
  label: string;
  showInMenu: boolean;
  mediaCount: number;
};

export type MegaMenuMedia = {
  id: string;
  menuItemId: string;
  type: MegaMenuMediaType;
  /** A path on the API host: /uploads/mega-menu/<file>. */
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  title: string | null;
  linkUrl: string | null;
  altText: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MegaMenuSettings = {
  enabled: boolean;
  autoSlide: boolean;
  /** Seconds each slide stays on screen. */
  slideDuration: number;
  itemOrder: MegaMenuMediaOrder;
};

export const getMegaMenuTargets = () => request<MegaMenuTarget[]>("/mega-menu/menus");

export const getMegaMenuMedia = (menuId: string) =>
  request<{ menu: { id: string; label: string }; settings: MegaMenuSettings; items: MegaMenuMedia[] }>(
    `/mega-menu/${menuId}`
  );

/**
 * Uploads files to a menu, reporting progress from 0 to 1. XHR rather than
 * fetch, because fetch cannot report upload progress.
 */
export function uploadMegaMenuMedia(
  menuId: string,
  files: File[],
  onProgress?: (fraction: number) => void
): Promise<MegaMenuMedia[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/v1/website/mega-menu/${menuId}/media`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: { data?: MegaMenuMedia[]; message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Fall through to the status message below.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body.data ?? []);
      else reject(new Error(body.message ?? `Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(form);
  });
}

export const updateMegaMenuMedia = (
  id: string,
  payload: Partial<Pick<MegaMenuMedia, "title" | "linkUrl" | "altText" | "isActive">>
) => request<MegaMenuMedia>(`/mega-menu/media/${id}`, { method: "PATCH", ...body(payload) });

export const deleteMegaMenuMedia = (id: string) =>
  request<{ id: string; fileName: string }>(`/mega-menu/media/${id}`, { method: "DELETE" });

export const bulkMegaMenuMedia = (ids: string[], action: "delete" | "activate" | "deactivate") =>
  request<{ count: number }>("/mega-menu/media/bulk", { method: "POST", ...body({ ids, action }) });

export const reorderMegaMenuMedia = (menuId: string, ids: string[]) =>
  request<{ updated: number }>(`/mega-menu/${menuId}/reorder`, { method: "POST", ...body({ ids }) });

export const saveMegaMenuSettings = (menuId: string, payload: Partial<MegaMenuSettings>) =>
  request<MegaMenuSettings>(`/mega-menu/${menuId}/settings`, { method: "PUT", ...body(payload) });

/** One menu of the storefront header, as `GET /website/navigation` returns it. */
export type StorefrontMenu = {
  id: string;
  menuItemId: string | null;
  label: string;
  href: string | null;
  hasMegaMenu: boolean;
  groups: { label: string; items: { label: string }[] }[];
  collections: { label: string }[];
};

/** The live storefront header, for the mega menu preview. */
export const getStorefrontMenus = () => request<StorefrontMenu[]>("/navigation");
