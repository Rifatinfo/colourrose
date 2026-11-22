const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/* =========================================================================
   Sessions.

   The API can end every session for the signed-in account, but it cannot
   list them — there is no endpoint that says which devices are signed in.
   So this screen shows the one session it can actually see, this browser,
   and offers the one action that really exists.
   ========================================================================= */

/** Ends every session for the signed-in account, including this one. */
export async function signOutEverywhere(): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/logout-all`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Could not sign out the other sessions");
  }
}

/** "Chrome on Windows", from what the browser is willing to say. */
export function describeThisDevice(): string {
  if (typeof navigator === "undefined") return "This browser";
  const agent = navigator.userAgent;

  const browser =
    /Edg\//.test(agent) ? "Edge"
    : /OPR\//.test(agent) ? "Opera"
    : /Firefox\//.test(agent) ? "Firefox"
    : /Chrome\//.test(agent) ? "Chrome"
    : /Safari\//.test(agent) ? "Safari"
    : "Browser";

  const os =
    /Windows/.test(agent) ? "Windows"
    : /Android/.test(agent) ? "Android"
    : /iPhone|iPad/.test(agent) ? "iOS"
    : /Mac OS X/.test(agent) ? "macOS"
    : /Linux/.test(agent) ? "Linux"
    : "";

  return os ? `${browser} on ${os}` : browser;
}
