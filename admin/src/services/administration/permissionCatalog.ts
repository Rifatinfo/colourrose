import {
  NAV_ADMINISTRATION,
  NAV_CONTENT,
  NAV_MAIN,
  NAV_SECONDARY,
  NAV_WEBSITE,
  type NavItem,
} from "@/components/sidebar/nav-config";
import { PERMISSION_ACTIONS } from "@/types/administration";

/* =========================================================================
   The permission matrix, read off the sidebar.

   This used to be a hand-written list that happened to look like the menu,
   which meant every new route was a screen nobody could grant access to
   until someone remembered to add a second entry for it. The sidebar is
   already the list of everywhere an account can go, so it is the source:
   add a route to `nav-config.ts` and its row appears here on the next
   render, in the section it was filed under.

   Roles are stored by module id, and a nav item's id is that module id. So
   renaming an id in the sidebar retires its stored grants — which is the
   honest outcome, since the route it described is gone.
   ========================================================================= */

export type PermissionModule = {
  id: string;
  label: string;
  /** A sub-route, shown indented under the group it belongs to. */
  parentId?: string;
};

export type PermissionGroup = {
  id: string;
  label: string;
  modules: PermissionModule[];
};

/**
 * The sidebar's own sections, in the order they appear in it. `NAV_SECONDARY`
 * is the footer group — Settings and Help Center — which the matrix files
 * under System.
 */
const SECTIONS: { id: string; label: string; items: NavItem[] }[] = [
  { id: "dashboards", label: "Dashboards", items: NAV_MAIN },
  { id: "content", label: "Content", items: NAV_CONTENT },
  { id: "website", label: "Website", items: NAV_WEBSITE },
  { id: "administration", label: "Administration", items: NAV_ADMINISTRATION },
  { id: "system", label: "System", items: NAV_SECONDARY },
];

/**
 * A group with sub-pages becomes one row for the group and one for each page
 * under it. Products is a menu, but "may edit products" and "may edit pricing"
 * are different grants, and a matrix that only offered the parent could not
 * say so.
 */
function flatten(items: NavItem[]): PermissionModule[] {
  const modules: PermissionModule[] = [];
  for (const item of items) {
    modules.push({ id: item.id, label: item.label });
    for (const child of item.children ?? []) {
      modules.push({ id: child.id, label: child.label, parentId: item.id });
    }
  }
  return modules;
}

export const PERMISSION_GROUPS: PermissionGroup[] = SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  modules: flatten(section.items),
}));

export const ALL_PERMISSION_MODULES: PermissionModule[] = PERMISSION_GROUPS.flatMap(
  (group) => group.modules
);

/** Every cell in the matrix, which is what the "Total Permissions" card counts. */
export const TOTAL_PERMISSION_COUNT =
  ALL_PERMISSION_MODULES.length * PERMISSION_ACTIONS.length;

/** Whether a stored module id still corresponds to somewhere in the dashboard. */
export function isKnownModule(id: string): boolean {
  return ALL_PERMISSION_MODULES.some((module) => module.id === id);
}
