"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRightIcon, GripVerticalIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/* =========================================================================
   The draggable tree the three Website screens share.

   Categories, pages and menu items are different things with the same
   problem: a hierarchy you rearrange by dragging. One component, so the drop
   rules — and the refusal to drop a parent into its own child — are written
   once and behave identically on all three screens.

   Drag and drop is the platform's own, deliberately: the dashboard has no
   drag library and this needs no inertia, multi-select or virtualisation.
   ========================================================================= */

export type TreeNode = { id: string; children?: TreeNode[] };

/** Where a drop would land, relative to the row under the pointer. */
type DropZone = "before" | "inside" | "after";

type DropTarget = { id: string; zone: DropZone };

/* ------------------------------ Tree helpers ----------------------------- */

function cloneWithout<T extends TreeNode>(nodes: T[], id: string): T[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: cloneWithout((node.children ?? []) as T[], id),
    })) as T[];
}

function find<T extends TreeNode>(nodes: T[], id: string): T | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find((node.children ?? []) as T[], id);
    if (hit) return hit;
  }
  return null;
}

/** Every id beneath `id`, so a drag can refuse to land inside itself. */
function descendantIds(node: TreeNode): string[] {
  const out: string[] = [];
  const walk = (current: TreeNode) => {
    for (const child of current.children ?? []) {
      out.push(child.id);
      walk(child);
    }
  };
  walk(node);
  return out;
}

/**
 * Puts `dragged` where the drop says, and hands back the whole new tree.
 *
 * The node is removed first and then inserted, so a move within the same
 * parent lands at the index the user is looking at rather than one off.
 */
function applyDrop<T extends TreeNode>(
  nodes: T[],
  draggedId: string,
  target: DropTarget
): T[] {
  const dragged = find(nodes, draggedId);
  if (!dragged || draggedId === target.id) return nodes;

  const without = cloneWithout(nodes, draggedId);
  const moving = { ...dragged } as T;

  if (target.zone === "inside") {
    const parent = find(without, target.id);
    if (!parent) return nodes;
    parent.children = [...((parent.children ?? []) as T[]), moving];
    return without;
  }

  const insert = (list: T[]): T[] => {
    const index = list.findIndex((node) => node.id === target.id);
    if (index >= 0) {
      const at = target.zone === "before" ? index : index + 1;
      return [...list.slice(0, at), moving, ...list.slice(at)];
    }
    return list.map((node) => ({
      ...node,
      children: insert((node.children ?? []) as T[]),
    })) as T[];
  };

  return insert(without);
}

/* -------------------------------- Rendering ------------------------------ */

type Flat<T> = { node: T; depth: number; hasChildren: boolean };

function flatten<T extends TreeNode>(
  nodes: T[],
  expanded: Set<string>,
  depth = 0,
  into: Flat<T>[] = []
): Flat<T>[] {
  for (const node of nodes) {
    const children = (node.children ?? []) as T[];
    into.push({ node, depth, hasChildren: children.length > 0 });
    if (children.length && expanded.has(node.id)) {
      flatten(children, expanded, depth + 1, into);
    }
  }
  return into;
}

export function TreeBoard<T extends TreeNode>({
  items,
  expanded,
  onToggleExpanded,
  selectedId,
  onSelect,
  onMove,
  renderRow,
  emptyState,
  indent = 28,
}: {
  items: T[];
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  selectedId?: string | null;
  onSelect?: (node: T) => void;
  /** The whole rearranged tree, for the caller to persist. */
  onMove: (next: T[]) => void;
  renderRow: (node: T, depth: number) => ReactNode;
  emptyState?: ReactNode;
  indent?: number;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  // Ids the dragged node may not land on: itself and everything under it.
  const forbidden = useMemo(() => {
    if (!draggingId) return new Set<string>();
    const node = find(items, draggingId);
    return new Set(node ? [node.id, ...descendantIds(node)] : []);
  }, [draggingId, items]);

  const rows = useMemo(() => flatten(items, expanded), [items, expanded]);
  const dragImage = useRef<HTMLElement | null>(null);

  const zoneFor = (event: React.DragEvent<HTMLDivElement>): DropZone => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientY - rect.top) / rect.height;
    // The middle band nests; the edges reorder. One gesture does both, which
    // is what the reference's single drag handle implies.
    if (offset < 0.3) return "before";
    if (offset > 0.7) return "after";
    return "inside";
  };

  const finishDrag = () => {
    setDraggingId(null);
    setTarget(null);
  };

  if (!rows.length && emptyState) return <>{emptyState}</>;

  return (
    <div
      className="relative"
      onDragEnd={finishDrag}
      onDrop={finishDrag}
      onDragLeave={(event) => {
        // Only clear when the pointer has left the list entirely.
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setTarget(null);
      }}
    >
      {rows.map(({ node, depth, hasChildren }) => {
        const isDragging = draggingId === node.id;
        const isTarget = target?.id === node.id;
        const blocked = forbidden.has(node.id);

        return (
          <div
            key={node.id}
            onDragOver={(event) => {
              if (!draggingId || blocked) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const zone = zoneFor(event);
              if (target?.id !== node.id || target?.zone !== zone) {
                setTarget({ id: node.id, zone });
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggingId || blocked || !target) return finishDrag();
              const next = applyDrop(items, draggingId, target);
              finishDrag();
              onMove(next);
            }}
            className={cn(
              "relative border-b border-slate-100 last:border-b-0 transition-colors",
              isDragging && "opacity-40",
              isTarget && target?.zone === "inside" && "bg-slate-900/[0.04] ring-1 ring-inset ring-slate-900/20",
              !isDragging && !isTarget && "hover:bg-slate-50/70",
              selectedId === node.id && "bg-slate-50"
            )}
          >
            {/* The line showing where a reorder would land. */}
            {isTarget && target?.zone !== "inside" && (
              <span
                aria-hidden="true"
                style={{ left: depth * indent + 16 }}
                className={cn(
                  "pointer-events-none absolute right-3 z-10 h-0.5 rounded-full bg-slate-900",
                  target.zone === "before" ? "top-0 -translate-y-px" : "bottom-0 translate-y-px"
                )}
              />
            )}

            <div
              className="flex items-center gap-2 py-2.5 pr-4"
              style={{ paddingLeft: depth * indent + 12 }}
            >
              <button
                type="button"
                draggable
                aria-label={`Reorder ${node.id}`}
                onDragStart={(event) => {
                  setDraggingId(node.id);
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox needs data set or the drag never starts.
                  event.dataTransfer.setData("text/plain", node.id);
                  const row = event.currentTarget.closest("div");
                  if (row) {
                    dragImage.current = row as HTMLElement;
                    event.dataTransfer.setDragImage(row, 20, 16);
                  }
                }}
                className="shrink-0 cursor-grab rounded text-slate-300 transition-colors hover:text-slate-500 active:cursor-grabbing"
              >
                <GripVerticalIcon className="h-4 w-4" aria-hidden="true" />
              </button>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(node.id)}
                  aria-label={expanded.has(node.id) ? "Collapse" : "Expand"}
                  aria-expanded={expanded.has(node.id)}
                  className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ChevronRightIcon
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      expanded.has(node.id) && "rotate-90"
                    )}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <span className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}

              <div
                className="min-w-0 flex-1"
                onClick={() => onSelect?.(node)}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onKeyDown={(event) => {
                  if (onSelect && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelect(node);
                  }
                }}
              >
                {renderRow(node, depth)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Every id in the tree, for Expand All. */
export function allIds<T extends TreeNode>(nodes: T[]): string[] {
  return nodes.flatMap((node) => [node.id, ...allIds((node.children ?? []) as T[])]);
}

/** Ids that have children, which are the only ones Expand All needs. */
export function branchIds<T extends TreeNode>(nodes: T[]): string[] {
  return nodes.flatMap((node) => {
    const children = (node.children ?? []) as T[];
    return children.length ? [node.id, ...branchIds(children)] : [];
  });
}

/** Strips a tree down to the ids and nesting a reorder request carries. */
export function toPlacements<T extends TreeNode>(
  nodes: T[]
): { id: string; children?: { id: string }[] }[] {
  return nodes.map((node) => ({
    id: node.id,
    children: toPlacements((node.children ?? []) as T[]),
  }));
}
