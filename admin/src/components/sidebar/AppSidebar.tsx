"use client";

import {
  NAV_MAIN,
  NAV_SECONDARY,
  NAV_ADMINISTRATION,
  NAV_CONTENT,
  NAV_WEBSITE,
} from "./nav-config";
import { NavMain, useCollapsedSidebar } from "./NavMain";
import { SidebarSearch } from "./SidebarSearch";
import { navIconProps } from "./NavIcon";

import { UserRole } from "@/lib/auth-utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import Image from "next/image";
import { PanelLeftIcon } from "lucide-react";
import { filterNavByRole } from "@/utiles/filterNav";
import { NavBottom } from "./NavBottom";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/services/auth/logoutUser";
import { getUserAvatar } from "@/utiles/user-utils";
import { useContentCounts } from "@/services/blog/contentCounts";

/**
 * Collapses to the icon bar and back. Ctrl/⌘+B does the same, and so does a
 * click on the sidebar's right edge.
 */
function CollapseToggle() {
  const { toggleSidebar, isMobile } = useSidebar();
  const { collapsed } = useCollapsedSidebar();

  // On phones the sidebar is a sheet with its own close; there is nothing to collapse.
  if (isMobile) return null;

  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={label}
            aria-expanded={!collapsed}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          />
        }
      >
        {/* One panel icon either way, as the toggle is a switch, not a direction. */}
        <PanelLeftIcon {...navIconProps} />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label} <kbd className="font-sans opacity-70">Ctrl B</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar() {
  const { user, loading } = useAuth();

  // Hook order has to stay stable, so the fetch is gated by a flag rather
  // than by returning early above it.
  const contentCounts = useContentCounts(Boolean(user));

  if (loading) return null;
  if (!user) return null;

  return (
    <SidebarShell
      user={{ name: user.name, email: user.email, role: user.role as UserRole, avatar: getUserAvatar(user) }}
      contentCounts={contentCounts}
    />
  );
}

/** The sidebar itself, for a known user. */
export function SidebarShell({
  user,
  contentCounts,
}: {
  user: { name?: string; email?: string; role: UserRole; avatar: string };
  contentCounts?: Partial<Record<string, number>> | null;
}) {
  const { collapsed } = useCollapsedSidebar();

  const role = user.role;
  const avatar = user.avatar;

  const navMain = filterNavByRole(NAV_MAIN, role);
  const navAdministration = filterNavByRole(NAV_ADMINISTRATION, role);
  const navSecondary = filterNavByRole(NAV_SECONDARY, role);
  const navContent = filterNavByRole(NAV_CONTENT, role);
  const navWebsite = filterNavByRole(NAV_WEBSITE, role);


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="bg-white md:pt-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link href="/admin" aria-label="Windrise dashboard" className="flex h-8 items-center">
              {/* The brand mark, drawn in black: the shipped mark files are
                  light for dark backgrounds, so the SVG is used as a mask. */}
              <span
                aria-hidden="true"
                className="block h-[19px] w-8 bg-black"
                style={{
                  maskImage: "url(/assets/Logo-icon.svg)",
                  WebkitMaskImage: "url(/assets/Logo-icon.svg)",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            </Link>
            <CollapseToggle />
          </div>
        ) : (
          // The toggle leads, the wordmark follows it — the panel control sits
          // where the collapsed bar puts it, at the sidebar's edge.
          <div className="flex items-center gap-1 px-1">
            <CollapseToggle />
            <Link href="/admin" className="p-1.5">
              <Image
                className="block dark:hidden"
                src="/assets/Logo_Black_1.png"
                width={104}
                height={89}
                alt="Black Logo"
              />
            </Link>
          </div>
        )}

        {/* Sits under the logo and above Dashboards. Only surfaces routes
            this role can already reach. */}
        <SidebarSearch role={role} />
      </SidebarHeader>

      {/* The icon bar still scrolls: the primitive hides overflow in icon mode,
          which would cut off the lower routes on a short screen. */}
      <SidebarContent className="flex flex-col pt-2 bg-white group-data-[collapsible=icon]:overflow-auto">

        <NavMain items={navMain} title="Dashboards" />

        {navContent.length > 0 && (
          <NavMain
            items={navContent}
            title="Content"
            counts={contentCounts ?? undefined}
          />
        )}

        {navWebsite.length > 0 && <NavMain items={navWebsite} title="Website" />}

        {navAdministration.length > 0 && (
          <div className="mt-auto">
            <NavMain items={navAdministration} title="Administration" />
          </div>
        )}
      </SidebarContent>

      {/* One account bar: profile, Settings, Help Center and sign-out all
          open from it, so the footer stays a single row. */}
      <SidebarFooter className="border-t border-slate-100 bg-white">
        <NavBottom
          items={navSecondary}
          user={{
            name: user.name || "Unknown User",
            email: user.email || "",
            avatar: avatar,
            role: role,
          }}
          onLogout={logout}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
