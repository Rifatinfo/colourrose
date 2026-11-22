/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { parse } from "cookie";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt, { JwtPayload } from "jsonwebtoken";

import { serverFetch } from "@/lib/server-fetch";
import { getDefaultDashboardRoute, isValidRedirectForRole } from "@/lib/auth-utils";
import { zodValidator } from "@/lib/zodValidator";
import { loginValidationZodSchema, signInSchema } from "../zod/user.validation";
import { setCookie, authCookieDomain } from "./tokenHandlers";


export const loginUser = async (_currentState: any, formData: any): Promise<any> => {
    try {
        const redirectTo = formData.get('redirect') || null;

        let accessTokenObject: null | any = null;
        let refreshTokenObject: null | any = null;
        const payload = {
            email: formData.get('email'),
            password: formData.get('password')
        }
        if (zodValidator(payload, loginValidationZodSchema).success === false) {
            return zodValidator(payload, loginValidationZodSchema);
        }
        const validatedFields = signInSchema.safeParse(payload);
        if (!validatedFields.success) {
            return {
                success: false,
                errors: validatedFields.error.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message
                    }
                })
            }
        }
        const res = await serverFetch.post("/api/v1/auth/login", {
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "application/json",
            }
        });

        const result = await res.json();

        // Staff roles (admin, shop/media manager, customer support) never get a
        // session from the password step — the backend emails a one-time code
        // instead. Park the short-lived ticket in an httpOnly cookie and hand
        // over to the code screen.
        if (result?.success && result?.data?.otpRequired) {
            await setCookie("otpTicket", result.data.otpTicket, {
                secure: true,
                httpOnly: true,
                sameSite: "lax",
                maxAge: 60 * 5,
                path: "/",
            });

            const params = new URLSearchParams();
            if (result.data.email) params.set("to", result.data.email);
            if (redirectTo) params.set("redirect", redirectTo.toString());

            redirect(`/verify-otp${params.size ? `?${params.toString()}` : ""}`);
        }

        const setCookieHeaders = res.headers.getSetCookie();

        if (setCookieHeaders && setCookieHeaders.length > 0) {
            setCookieHeaders.forEach((cookie: string) => {
                const parsedCookie = parse(cookie);

                if (parsedCookie['accessToken']) {
                    accessTokenObject = parsedCookie;
                }
                if (parsedCookie['refreshToken']) {
                    refreshTokenObject = parsedCookie;
                }
            });
        } 
        if (!accessTokenObject) {
            throw new Error("Tokens not found in cookies")
        }
        if (!refreshTokenObject) {
            throw new Error("Tokens not found in cookies")
        }

        const cookieStore = await cookies();

        await setCookie("accessToken", accessTokenObject.accessToken, {
            domain: await authCookieDomain(),
            secure: true,
            httpOnly: true,
            maxAge: parseInt(accessTokenObject['Max-Age']) || 1000 * 60 * 60,
            path: accessTokenObject.Path || "/",
        });
        await setCookie("refreshToken", refreshTokenObject.refreshToken, {
            domain: await authCookieDomain(),
            secure: true,
            httpOnly: true,
            maxAge: parseInt(accessTokenObject['Max-Age']) || 1000 * 60 * 60 * 24 * 90,
            path: refreshTokenObject.Path || "/",
        });
        type UserRole = "ADMIN" | "CUSTOMER" | "SHOP_MANAGER" | "MEDIA_MANAGER";


        // Decoded, not verified — this app holds no signing key, so jwt.verify
        // would throw on every token and turn a successful login into
        // "Your session token is invalid". The API already verified the
        // credentials to issue this token; all that is needed here is the role
        // to pick a landing route.
        let verifiedToken: JwtPayload | null = null;

        const decoded = jwt.decode(accessTokenObject.accessToken);

        if (decoded && typeof decoded !== "string") {
            verifiedToken = decoded as JwtPayload;
        }

        // 2. Proceed only if verifiedToken exists
        if (!verifiedToken) {
            throw new Error("Invalid token structure");
        }

        const userRole = verifiedToken.role as UserRole;
        // const redirectPath = redirectTo ? redirectTo.toString() : getDefaultDashboardRoute(userRole as UserRole);
        // redirect(redirectPath);

        if (!result.success) {
            throw new Error("Login Failed");
        }
    

        let redirectPath = getDefaultDashboardRoute(userRole);

        if (redirectTo) {
            const requestedPath = redirectTo.toString();

            if (isValidRedirectForRole(requestedPath, userRole)) {
                redirectPath = requestedPath;
            }
        }
        redirect(`${redirectPath}?loggedIn=true`);
    } catch (error: any) {
        // Re-throw NEXT_REDIRECT errors so Next.js can handle them
        if (error?.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }

        return { success: false, message: `${process.env.NODE_ENV === 'development' ? error.message : "Login Failed. You might have entered incorrect email or password."}` };
    }
}