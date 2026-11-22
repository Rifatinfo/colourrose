"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavItem } from "./nav-config";
import { NAV_ICON_STROKE, NavIcon } from "./NavIcon";

/**
 * Whether the sidebar is showing as the narrow icon bar.
 *
 * Never on phones: there the sidebar is a slide-over sheet, which always shows
 * the full menu, whatever the desktop bar was last left as.
 */
export function useCollapsedSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  return {
    collapsed: !isMobile && state === "collapsed",
    // A tap on a link should close the phone sheet, or the page changes
    // underneath a menu that is still covering it.
    closeOnMobile: () => {
      if (isMobile) setOpenMobile(false);
    },
  };
}

export function SectionLabel({ label }: { label: string }) {
  const { collapsed } = useCollapsedSidebar();

  // The words do not fit the icon bar; a short rule keeps the grouping.
  if (collapsed) {
    return <div aria-hidden="true" className="mx-auto my-2.5 h-px w-6 bg-slate-200" />;
  }

  return (
    <div className="flex items-center gap-1 pt-3 pb-1 text-[11px] font-medium text-slate-400">
      <span>{label}</span>
      <ChevronRightIcon strokeWidth={NAV_ICON_STROKE} className="h-2.5 w-2.5" />
    </div>
  );
}

/** One square icon button in the collapsed bar, named by a tooltip on hover or focus. */
export function IconBarLink({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={item.path || "#"}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-black text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-black"
            )}
          />
        }
      >
        <NavIcon item={item} />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function NavLink({
  item,
  isActive,
  count,
}: {
  item: NavItem;
  isActive: boolean;
  count?: number;
}) {
  const { collapsed, closeOnMobile } = useCollapsedSidebar();

  if (collapsed) return <IconBarLink item={item} isActive={isActive} />;

  return (
    <Link
      href={item.path || "#"}
      onClick={closeOnMobile}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-black text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-black"
      )}
    >
      <NavIcon item={item} />
      <span className="truncate">{item.label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "ml-auto shrink-0 text-[11px] tabular-nums",
            isActive ? "text-white/70" : "text-slate-400"
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/**
 * A group with sub-pages, collapsed: there is no room to unfold the children
 * in place, so they open in a flyout beside the bar instead.
 */
function IconBarGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const children = item.children ?? [];
  const hasActiveChild = children.some((child) => child.path === pathname);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={item.label}
        className={cn(
          "mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-black",
          hasActiveChild
            ? "bg-black text-white shadow-sm"
            : open
              ? "bg-slate-100 text-black"
              : "text-slate-600 hover:bg-slate-100 hover:text-black"
        )}
      >
        <NavIcon item={item} />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={10} className="w-52 p-1.5">
        <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium text-slate-400">{item.label}</p>
        <div className="space-y-0.5">
          {children.map((child) => {
            const isChildActive = child.path === pathname;
            return (
              <Link
                key={child.id}
                href={child.path || "#"}
                onClick={() => setOpen(false)}
                aria-current={isChildActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  isChildActive
                    ? "bg-black text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-black"
                )}
              >
                <NavIcon item={child} />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NavCollapsible({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const { collapsed, closeOnMobile } = useCollapsedSidebar();
  const children = item.children ?? [];
  const hasActiveChild = children.some((child) => child.path === pathname);

  // null = follow the route; true/false = the user has toggled it by hand.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);

  // Adjusting state during render (a supported React pattern) so that landing
  // on a child route — e.g. via the sidebar search — expands its parent group
  // even though this component is already mounted and collapsed.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setManualOpen(null);
  }

  const open = manualOpen ?? hasActiveChild;

  if (collapsed) return <IconBarGroup item={item} pathname={pathname} />;

  return (
    <div>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors text-slate-600 hover:bg-slate-100 hover:text-black"
      >
        <NavIcon item={item} />
        <span className="truncate">{item.label}</span>
        <ChevronDownIcon
          strokeWidth={NAV_ICON_STROKE}
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-0.5 pt-0.5 pb-0.5">
            {children.map((child) => {
              const isChildActive = child.path === pathname;
              return (
                <Link
                  key={child.id}
                  href={child.path || "#"}
                  onClick={closeOnMobile}
                  aria-current={isChildActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 pl-8 text-[13px] font-medium transition-colors",
                    isChildActive
                      ? "bg-black text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-black"
                  )}
                >
                  <NavIcon item={child} />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NavMain({
  items,
  title,
  counts,
}: {
  items: NavItem[];
  title?: string;
  /** Live badge numbers, keyed by each item's `countKey`. */
  counts?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const { collapsed } = useCollapsedSidebar();
  if (!items.length) return null;

  return (
    <div className={collapsed ? "px-0" : "px-4"}>
      {title && <SectionLabel label={title} />}
      <nav aria-label={title} className={collapsed ? "space-y-1" : "space-y-0.5"}>
        {items.map((item) => {
          if (item.children && item.children.length > 0) {
            return <NavCollapsible key={item.id} item={item} pathname={pathname} />;
          }
          const isActive = item.path ? pathname === item.path : false;
          return (
            <NavLink
              key={item.id}
              item={item}
              isActive={isActive}
              count={item.countKey ? counts?.[item.countKey] : undefined}
            />
          );
        })}
      </nav>
    </div>
  );
}
