"use server";

import { redirect } from "next/navigation";
import { deleteCookie, getCookie } from "./tokenHandlers";

export const logout = async () => {
    /*
      Tell the API first, then clear locally.

      Deleting the cookies alone only made this browser forget the session —
      the refresh token stayed valid on the server for its full lifetime, so
      a copy of it kept working long after the user believed they had signed
      out. This call is what actually ends it.
    */
    const refreshToken = await getCookie("refreshToken");

    if (refreshToken) {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/logout`, {
                method: "POST",
                headers: { Cookie: `refreshToken=${refreshToken}` },
            });
        } catch {
            // The API is unreachable. Still clear locally — a user who asked
            // to sign out must not be left looking signed in. The session
            // expires on its own, and signing in again replaces it.
        }
    }

    await deleteCookie("accessToken");
    await deleteCookie("refreshToken");
    redirect("/login?loggedOut=true");
};
