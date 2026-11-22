"use server"
import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies, headers } from "next/headers";

export const setCookie = async (key: string, value: string, options: Partial<ResponseCookie>) => {
    const cookieStore = await cookies();
    cookieStore.set(key, value, options);
}

export const getCookie = async (key: string) => {
    const cookieStore = await cookies();
    return cookieStore.get(key)?.value || null;
}

export const deleteCookie = async (key: string) => {
    const cookieStore = await cookies();

    // Host-only: how these cookies were set before the shared domain was
    // introduced, and how `otpTicket` is still set. Deleting it also clears
    // the leftovers in the browser of anyone signed in before that change,
    // so one stale copy cannot sit beside the new one under the same name.
    cookieStore.delete(key);

    // And the shared-domain one. A cookie is only removed by a deletion
    // that matches its domain, so without this, signing out would leave the
    // session in place and the next page load would still be signed in.
    const domain = await authCookieDomain();
    if (domain) cookieStore.delete({ name: key, domain, path: "/" });
}

/**
 * The domain auth cookies are scoped to, or undefined to leave them host-only.
 *
 * This is the difference between the dashboard working in production and not.
 * The API, the storefront and this app are three hosts under one domain —
 * server., www. and mis.thewindrise.com — and a cookie set without a domain is
 * *host-only*: the browser returns it to that exact host and nowhere else. So
 * the session minted here reaches this app but is never attached to the
 * `credentials: "include"` calls the pages make straight to the API, which is
 * why a signed-in admin with a valid ADMIN role still sees "You are not
 * authorized!" on every panel.
 *
 * None of it shows up locally, which is why it survived so long: everything
 * runs on localhost there, on different ports, and a port is not part of a
 * cookie's identity — one host-only `localhost` cookie is sent to all of them.
 *
 * Set `AUTH_COOKIE_DOMAIN=.thewindrise.com` in production.
 *
 * It is only applied when this request actually arrived under that domain. A
 * domain that does not match the host is rejected by the browser outright —
 * silently — and a production `.env` copied onto a laptop brings the value with
 * it. On localhost that threw every session cookie away: signing in appeared to
 * work, because the page after it renders on the server with the cookies just
 * set, and the first refresh arrived with no session and landed on the login
 * page. Checking the host makes one `.env` correct in both places.
 */
export const authCookieDomain = async (): Promise<string | undefined> => {
    const configured = process.env.AUTH_COOKIE_DOMAIN?.trim();
    if (!configured) return undefined;

    const requestHeaders = await headers();
    // Behind a proxy the public host is forwarded; the port is never part of it.
    const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
        .split(",")[0]
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, "");
    const domain = configured.toLowerCase().replace(/^\./, "");

    return host === domain || host.endsWith(`.${domain}`) ? configured : undefined;
};
