"use client";

import type { LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-config";

/**
 * One stroke and one size for every icon in the sidebar — routes, search,
 * chevrons, collapse and sign-out alike — so the set reads as a single family.
 * Lucide is drawn on a 24px grid; 1.75 at 18px keeps lines light without
 * turning hairline on a standard-density screen.
 */
export const NAV_ICON_STROKE = 1.75;
export const NAV_ICON_SIZE = "h-[18px] w-[18px]";

export function NavIcon({ item, className }: { item: NavItem; className?: string }) {
  const Icon = item.icon;
  return (
    <Icon
      strokeWidth={NAV_ICON_STROKE}
      aria-hidden="true"
      className={cn("shrink-0", NAV_ICON_SIZE, className)}
    />
  );
}

/** Shared props for the sidebar's non-route icons, so they match the routes. */
export const navIconProps: Pick<LucideProps, "strokeWidth" | "className" | "aria-hidden"> = {
  strokeWidth: NAV_ICON_STROKE,
  className: cn("shrink-0", NAV_ICON_SIZE),
  "aria-hidden": true,
};
