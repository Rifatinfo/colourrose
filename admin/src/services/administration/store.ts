"use client";

import {
  DEFAULT_SECURITY_SETTINGS,
  type SecuritySettings,
} from "@/types/administration";

/* =========================================================================
   Where Administration keeps the settings the API does not store yet.

   Users & Access, Roles & Permissions, Departments and the Activity Log all
   read live data from the API now. The security policy is what is left: it
   has no endpoint behind it, so it is kept per browser rather than faked into
   the UI. What is saved here is what is shown here, and nothing pretends the
   server has accepted it. Swapping this file for real requests is the only
   change that screen needs once the endpoint exists.
   ========================================================================= */

const SECURITY_KEY = "windrise.administration.security.v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Private mode, a blocked origin, or a value written by an older shape.
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Saving is a convenience; the screen keeps working from memory.
  }
}

/* ------------------------------- Security ------------------------------- */

export function loadSecuritySettings(): SecuritySettings {
  const saved = read<Partial<SecuritySettings>>(SECURITY_KEY);
  return { ...DEFAULT_SECURITY_SETTINGS, ...(saved ?? {}) };
}

export function saveSecuritySettings(settings: SecuritySettings): void {
  write(SECURITY_KEY, settings);
}
