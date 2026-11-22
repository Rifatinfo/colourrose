import { getPosts } from "@/services/blog/blog";
import { getAllCustomers } from "@/services/customer/customer";
import { getAllOrders } from "@/services/order/order";
import type { BlogPost } from "@/types/blog";
import type { ServerUser } from "@/types/customer";
import type { ServerOrder } from "@/types/order";
import type { ActivityEntry, ActivityModule } from "@/types/administration";
import { formatBdt } from "@/utils/format";
import { fetchTeam, type TeamMember } from "./team";
import {
  getCategoryTree,
  getPageTree,
  type CategoryNode,
  type PageNode,
} from "@/services/website/website";

/* =========================================================================
   The activity feed.

   There is no audit table behind the dashboard, so nothing here is invented
   to fill one: every entry is read back off something that really happened
   and carries its own timestamp — an account that was created, an order that
   was placed or cancelled, a post that went live. When an audit endpoint
   exists, this file is what it replaces.
   ========================================================================= */

/** Rows to read from each source. Enough for a month of a busy store. */
const LIMIT = 300;

/** An update this soon after creation is the same event, not a later edit. */
const EDIT_THRESHOLD_MS = 60_000;

function entry(
  parts: Omit<ActivityEntry, "id"> & { id?: string }
): ActivityEntry {
  return { id: parts.id ?? `${parts.module}-${parts.at}-${parts.action}`, ...parts };
}

/* ------------------------------ Team accounts ---------------------------- */

function fromTeam(members: TeamMember[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const member of members) {
    entries.push(
      entry({
        id: `staff-created-${member.id}`,
        at: member.createdAt,
        actorName: member.name,
        actorRole: member.roleLabel,
        actorAvatar: member.avatar,
        action: "Staff account created",
        module: "Administration",
        details: `Joined as ${member.roleLabel} in ${member.department}`,
        status: "SUCCESS",
        facts: [
          { label: "Email", value: member.email },
          { label: "Role", value: member.roleLabel },
          { label: "Department", value: member.department },
        ],
      })
    );

    const changedLater =
      new Date(member.updatedAt).getTime() - new Date(member.createdAt).getTime() >
      EDIT_THRESHOLD_MS;

    if (changedLater && member.status === "INACTIVE") {
      entries.push(
        entry({
          id: `staff-suspended-${member.id}`,
          at: member.updatedAt,
          actorName: member.name,
          actorRole: member.roleLabel,
          actorAvatar: member.avatar,
          action: "Access suspended",
          module: "Administration",
          details: `${member.name} can no longer sign in`,
          status: "SUCCESS",
          facts: [{ label: "Email", value: member.email }],
        })
      );
    } else if (changedLater && member.status === "ACTIVE") {
      entries.push(
        entry({
          id: `staff-updated-${member.id}`,
          at: member.updatedAt,
          actorName: member.name,
          actorRole: member.roleLabel,
          actorAvatar: member.avatar,
          action: "Account updated",
          module: "Administration",
          details: `Profile details changed for ${member.name}`,
          status: "SUCCESS",
          facts: [{ label: "Email", value: member.email }],
        })
      );
    }
  }

  return entries;
}

/* --------------------------------- Orders -------------------------------- */

const ORDER_STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  processed: "Processed",
  on_the_way: "On the way",
  delivered: "Delivered",
  canceled: "Canceled",
  failed: "Failed",
  expired: "Expired",
};

function orderLabel(status: string): string {
  return ORDER_STATUS_LABEL[status?.toLowerCase()] ?? status;
}

function fromOrders(orders: ServerOrder[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const order of orders) {
    const amount = formatBdt(Number(order.totalAmount ?? 0));
    const facts = [
      { label: "Order", value: `#${order.orderNo}` },
      { label: "Amount", value: amount },
      { label: "Payment", value: `${order.paymentMethod} · ${order.paymentStatus}` },
      { label: "Customer", value: order.checkoutEmail || order.phone || "—" },
    ];

    entries.push(
      entry({
        id: `order-placed-${order.id}`,
        at: order.createdAt,
        actorName: order.name || "Guest",
        actorRole: "Customer",
        action: "Placed an order",
        module: "Orders",
        details: `Order #${order.orderNo} for ${amount}`,
        status: "SUCCESS",
        facts,
      })
    );

    const changedLater =
      new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime() >
      EDIT_THRESHOLD_MS;
    if (!changedLater) continue;

    const status = order.orderStatus?.toLowerCase();
    const wentWrong =
      status === "canceled" ||
      status === "failed" ||
      status === "expired" ||
      order.paymentStatus === "FAILED" ||
      order.paymentStatus === "CANCELED";

    entries.push(
      entry({
        id: `order-updated-${order.id}`,
        at: order.updatedAt,
        actorName: order.name || "Guest",
        actorRole: "Customer",
        action: wentWrong ? "Order did not complete" : "Updated order status",
        module: wentWrong && order.paymentStatus === "FAILED" ? "Finance" : "Orders",
        details: `Order #${order.orderNo} marked as ${orderLabel(order.orderStatus)}`,
        status: wentWrong ? "FAILED" : "SUCCESS",
        facts,
      })
    );
  }

  return entries;
}

/* ------------------------------- Customers ------------------------------- */

function fromCustomers(customers: ServerUser[]): ActivityEntry[] {
  return customers.map((customer) =>
    entry({
      id: `customer-${customer.id}`,
      at: customer.createdAt,
      actorName: customer.name?.trim() || customer.email || "Customer",
      actorRole: "Customer",
      actorAvatar: customer.avatar,
      action: "Created an account",
      module: "Customers",
      details: `${customer.email ?? "A new customer"} registered on the store`,
      status: "SUCCESS",
      facts: [{ label: "Email", value: customer.email ?? "—" }],
    })
  );
}

/* --------------------------------- Posts --------------------------------- */

function fromPosts(posts: BlogPost[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const post of posts) {
    const facts = [
      { label: "Post", value: post.title },
      { label: "Status", value: post.status },
      { label: "Category", value: post.category?.name ?? "—" },
    ];

    entries.push(
      entry({
        id: `post-created-${post.id}`,
        at: post.createdAt,
        actorName: post.author?.name || "Editor",
        actorRole: "Media Manager",
        actorAvatar: post.author?.avatar,
        action: "Created a blog post",
        module: "Blogs",
        details: `Draft started: “${post.title}”`,
        status: "SUCCESS",
        facts,
      })
    );

    if (post.status === "PUBLISHED" && post.publishedAt) {
      entries.push(
        entry({
          id: `post-published-${post.id}`,
          at: post.publishedAt,
          actorName: post.author?.name || "Editor",
          actorRole: "Media Manager",
          actorAvatar: post.author?.avatar,
          action: "Published a blog post",
          module: "Blogs",
          details: `“${post.title}” published`,
          status: "SUCCESS",
          facts,
        })
      );
    }
  }

  return entries;
}

/* -------------------------------- Website -------------------------------- */

/**
 * Pages carry their own history: when they were created, and when they were
 * published, which are the two moments worth reporting. A scheduled page
 * shows its due date rather than a publication that has not happened.
 */
function fromPages(nodes: PageNode[]): ActivityEntry[] {
  const flat = (list: PageNode[]): PageNode[] =>
    list.flatMap((node) => [node, ...flat(node.children)]);

  const entries: ActivityEntry[] = [];

  for (const page of flat(nodes)) {
    const facts = [
      { label: "Page", value: page.title },
      { label: "URL", value: `/${page.slug}` },
      { label: "Status", value: page.status },
    ];

    entries.push(
      entry({
        id: `page-created-${page.id}`,
        at: page.updatedAt,
        actorName: "Dashboard",
        actorRole: "Website",
        action: page.status === "DRAFT" ? "Saved a draft page" : "Updated a page",
        module: "Website",
        details: `“${page.title}” at /${page.slug}`,
        status: "SUCCESS",
        facts,
      })
    );

    if (page.status === "PUBLISHED" && page.publishedAt) {
      entries.push(
        entry({
          id: `page-published-${page.id}`,
          at: page.publishedAt,
          actorName: "Dashboard",
          actorRole: "Website",
          action: "Published a page",
          module: "Website",
          details: `“${page.title}” went live at /${page.slug}`,
          status: "SUCCESS",
          facts,
        })
      );
    }
  }

  return entries;
}

/** Categories report their last change, which covers creating and moving. */
function fromCategories(nodes: CategoryNode[]): ActivityEntry[] {
  const flat = (list: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] =>
    list.flatMap((node) => [{ node, depth }, ...flat(node.children, depth + 1)]);

  return flat(nodes).map(({ node, depth }) =>
    entry({
      id: `category-${node.id}`,
      at: node.updatedAt ?? node.createdAt,
      actorName: "Dashboard",
      actorRole: "Website",
      action: depth === 0 ? "Updated a top-level category" : "Updated a category",
      module: "Website",
      details: `${node.name}${node.isActive ? "" : " (inactive)"} — ${node.productCount} ${
        node.productCount === 1 ? "product" : "products"
      }`,
      status: "SUCCESS",
      facts: [
        { label: "Category", value: node.name },
        { label: "Products", value: `${node.productCount}` },
        { label: "Subcategories", value: `${node.childCount}` },
      ],
    })
  );
}

/* --------------------------------- Feed ---------------------------------- */

export type ActivityFeed = {
  entries: ActivityEntry[];
  /** Sources that could not be read, named for the screen to report. */
  failed: string[];
};

export async function fetchActivity(): Promise<ActivityFeed> {
  const [team, orders, customers, posts, pages, categories] = await Promise.allSettled([
    fetchTeam(),
    getAllOrders({ limit: LIMIT, sortBy: "createdAt", sortOrder: "desc" }),
    getAllCustomers({ limit: LIMIT, sortBy: "createdAt", sortOrder: "desc" }),
    getPosts({ limit: 100 }),
    getPageTree(),
    getCategoryTree(),
  ]);

  const entries: ActivityEntry[] = [];
  const failed: string[] = [];

  if (team.status === "fulfilled") entries.push(...fromTeam(team.value.members));
  else failed.push("team");

  if (orders.status === "fulfilled") entries.push(...fromOrders(orders.value.data ?? []));
  else failed.push("orders");

  if (customers.status === "fulfilled")
    entries.push(...fromCustomers(customers.value.data ?? []));
  else failed.push("customers");

  if (posts.status === "fulfilled") entries.push(...fromPosts(posts.value.data ?? []));
  else failed.push("posts");

  if (pages.status === "fulfilled") entries.push(...fromPages(pages.value));
  else failed.push("pages");

  if (categories.status === "fulfilled") entries.push(...fromCategories(categories.value));
  else failed.push("categories");

  entries.sort((a, b) => b.at.localeCompare(a.at));
  return { entries, failed };
}

/** The activity modules a feed actually contains, for the filter list. */
export function modulesIn(entries: ActivityEntry[]): ActivityModule[] {
  return [...new Set(entries.map((item) => item.module))].sort() as ActivityModule[];
}

/** Rows as a CSV file, exactly as they are shown. */
export function toCsv(entries: ActivityEntry[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["Time", "User", "Role", "Action", "Module", "Details", "Status"];
  const rows = entries.map((item) =>
    [
      new Date(item.at).toISOString(),
      item.actorName,
      item.actorRole,
      item.action,
      item.module,
      item.details,
      item.status === "SUCCESS" ? "Success" : "Failed",
    ]
      .map(escape)
      .join(",")
  );
  return [header.map(escape).join(","), ...rows].join("\r\n");
}
