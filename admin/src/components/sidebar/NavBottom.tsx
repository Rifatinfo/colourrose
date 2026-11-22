"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, ExternalLinkIcon, LogOutIcon, UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STOREFRONT_URL } from "@/services/website/website";
import { NavItem } from "./nav-config";
import { useCollapsedSidebar } from "./NavMain";
import { NAV_ICON_STROKE, NavIcon, navIconProps } from "./NavIcon";

/* =========================================================================
   The account bar at the foot of the sidebar.

   One row — who is signed in, and a chevron — instead of a "More" section
   plus a profile row. Everything about the account and the dashboard itself
   (Settings, Help Center, the storefront, signing out) opens from it, upward
   in the full sidebar and to the side in the icon bar.
   ========================================================================= */

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SHOP_MANAGER: "Shop Manager",
  MEDIA_MANAGER: "Media Manager",
  CUSTOMER_SUPPORT: "Customer Support",
};

function Avatar({ user, size = "h-7 w-7" }: { user: { name: string; avatar: string }; size?: string }) {
  return user?.avatar ? (
    <Image
      src={user.avatar}
      alt=""
      width={32}
      height={32}
      className={cn(size, "shrink-0 rounded-full object-cover")}
    />
  ) : (
    <span className={cn(size, "flex shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white")}>
      {user.name.trim().charAt(0).toUpperCase() || (
        <UserIcon strokeWidth={NAV_ICON_STROKE} className="h-4 w-4" aria-hidden="true" />
      )}
    </span>
  );
}

const ROW =
  "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black";

export function NavBottom({
  items,
  user,
  onLogout,
}: {
  items: NavItem[];
  user: { name: string; email: string; avatar: string; role: string };
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { collapsed, closeOnMobile } = useCollapsedSidebar();
  const [open, setOpen] = useState(false);
  const roleLabel = ROLE_LABEL[user.role] ?? "User";
  // The bar reads as "here" when one of its routes is the current page.
  const current = items.some((item) => item.path && pathname.startsWith(item.path));

  const close = () => {
    setOpen(false);
    closeOnMobile();
  };

  return (
    <section className={cn("shrink-0 pb-1.5 pt-1", collapsed ? "px-0" : "px-2")} aria-label="Account">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`${user.name}, ${roleLabel}. Account menu`}
              className={cn(
                "flex cursor-pointer items-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black",
                collapsed
                  ? "mx-auto h-9 w-9 justify-center hover:bg-slate-100"
                  : "h-11 w-full gap-2.5 px-1.5 text-left hover:bg-slate-100",
                (open || current) && "bg-slate-100"
              )}
            />
          }
        >
          <Avatar user={user} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                <b className="font-semibold text-slate-900">{user.name}</b>
                <span className="text-slate-500"> · {roleLabel}</span>
              </span>
              <ChevronDownIcon
                strokeWidth={NAV_ICON_STROKE}
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", open && "rotate-180")}
              />
            </>
          )}
        </PopoverTrigger>

        <PopoverContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={collapsed ? 10 : 6}
          className="w-60 rounded-xl bg-white p-1.5 shadow-[0_14px_34px_-10px_rgba(16,24,40,0.22),0_2px_6px_rgba(16,24,40,0.06)] ring-slate-200"
        >
          <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
            <Avatar user={user} size="h-8 w-8" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-900">{user.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user.email || roleLabel}</p>
            </div>
          </div>

          <div className="mx-1 my-1 h-px bg-slate-100" />

          <nav aria-label="Account and dashboard">
            {items.map((item) => {
              const active = Boolean(item.path) && pathname.startsWith(item.path!);
              return (
                <Link
                  key={item.id}
                  href={item.path || "#"}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={cn(ROW, active ? "bg-black text-white" : "text-slate-600 hover:bg-slate-100 hover:text-black")}
                >
                  <NavIcon item={item} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            <a
              href={STOREFRONT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className={cn(ROW, "text-slate-600 hover:bg-slate-100 hover:text-black")}
            >
              <ExternalLinkIcon {...navIconProps} />
              <span className="truncate">View storefront</span>
            </a>
          </nav>

          <div className="mx-1 my-1 h-px bg-slate-100" />

          <button
            type="button"
            onClick={() => {
              close();
              onLogout();
            }}
            className={cn(ROW, "text-rose-600 hover:bg-rose-50")}
          >
            <LogOutIcon {...navIconProps} />
            Log out
          </button>
        </PopoverContent>
      </Popover>
    </section>
  );
}
