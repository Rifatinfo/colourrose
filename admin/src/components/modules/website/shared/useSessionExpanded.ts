"use client";

import { useCallback, useState } from "react";

type Updater = Set<string> | ((current: Set<string>) => Set<string>);

/**
 * Which branches of a tree are open, remembered for the browser session.
 *
 * What you expand stays expanded and what you collapse stays collapsed —
 * across saves, reloads and tab switches — until the tab is closed. The very
 * first load of a session opens everything once; after that it is your call.
 */
export function useSessionExpanded(key: string) {
  const storageKey = `wr-tree-expanded:${key}`;
  const [expanded, setExpandedState] = useState<Set<string>>(new Set());

  const setExpanded = useCallback(
    (next: Updater) =>
      setExpandedState((current) => {
        const value = typeof next === "function" ? next(current) : next;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify([...value]));
        } catch {
          /* private mode: it just won't be remembered */
        }
        return value;
      }),
    [storageKey]
  );

  /** After loading the tree: the session's choice, or everything open the first time. */
  const restore = useCallback(
    (allBranchIds: string[]) => {
      let stored: Set<string> | null = null;
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw !== null) stored = new Set(JSON.parse(raw) as string[]);
      } catch {
        stored = null;
      }
      setExpanded(stored ?? new Set(allBranchIds));
    },
    [setExpanded, storageKey]
  );

  return { expanded, setExpanded, restore };
}
