"use client";

import { Fragment } from "react";

import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type RolePermissions,
} from "@/types/administration";
import { PERMISSION_GROUPS } from "@/services/administration/permissionCatalog";
import { CheckBox, Th } from "../shared/ui";
import { cn } from "@/lib/utils";

/* =========================================================================
   The permission matrix: every screen in the dashboard against the five
   things a role can do with it.

   One rule holds the grid together — anything other than View implies View,
   and dropping View drops the rest. A role that may edit a module but not
   open it is not a state worth being able to save.
   ========================================================================= */

export function applyAction(
  current: PermissionAction[],
  action: PermissionAction,
  next: boolean
): PermissionAction[] {
  const set = new Set(current);

  if (next) {
    set.add(action);
    if (action !== "view") set.add("view");
  } else {
    set.delete(action);
    if (action === "view") set.clear();
  }

  // Keep the stored order the same as the column order, so two roles with the
  // same access serialise identically.
  return PERMISSION_ACTIONS.filter((entry) => set.has(entry.id)).map((entry) => entry.id);
}

export function countGranted(permissions: RolePermissions): number {
  return Object.values(permissions).reduce((sum, actions) => sum + actions.length, 0);
}

export function PermissionMatrix({
  permissions,
  readOnly,
  onChange,
}: {
  permissions: RolePermissions;
  readOnly: boolean;
  onChange: (moduleId: string, action: PermissionAction, next: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead>
          <tr className="border-y border-slate-200/80 bg-slate-50/80">
            <Th className="w-[45%]">Module / Feature</Th>
            {PERMISSION_ACTIONS.map((action) => (
              <Th key={action.id} className="text-center">
                {action.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((group) => (
            <Fragment key={group.id}>
              <tr className="bg-slate-50/60">
                <th
                  scope="colgroup"
                  colSpan={PERMISSION_ACTIONS.length + 1}
                  className="px-5 py-2 text-left text-[11px] font-semibold tracking-[0.08em] text-slate-400 uppercase"
                >
                  {group.label}
                </th>
              </tr>
              {group.modules.map((module) => {
                const granted = permissions[module.id] ?? [];
                return (
                  <tr
                    key={module.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                  >
                    <td
                      className={cn(
                        "px-5 py-2.5 text-[13px] text-slate-700",
                        // Sub-routes sit under the menu they belong to, so the
                        // grid reads the way the sidebar does.
                        module.parentId && "pl-10 text-slate-500"
                      )}
                    >
                      {module.label}
                    </td>
                    {PERMISSION_ACTIONS.map((action) => (
                      <td key={action.id} className="px-5 py-2.5">
                        <div className="flex justify-center">
                          <CheckBox
                            checked={granted.includes(action.id)}
                            disabled={readOnly}
                            onChange={(next) => onChange(module.id, action.id, next)}
                            label={`${action.label} ${module.label}`}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
