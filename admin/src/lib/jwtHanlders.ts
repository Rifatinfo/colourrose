/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * These helpers *decode* tokens; they deliberately do not verify signatures.
 *
 * This app holds no signing keys — see .env. The API signs the tokens and is
 * the only thing that authorises a request, so a forged token gets a 401 from
 * the API the moment it is used. What the frontend needs from a token is its
 * role (to pick a route) and its expiry (to know whether to refresh), and both
 * are readable without the secret.
 *
 * Calling jwt.verify() here instead is not "safer", it is broken: with
 * process.env.JWT_SECRET undefined, jsonwebtoken throws
 * "secret or public key must be provided" for *every* token, valid or not. The
 * middleware read that as a bad token and deleted the session on each request,
 * so signing in bounced straight back to /login and the OTP ticket was gone by
 * the time the code was submitted — surfacing as "This sign-in attempt has
 * expired. Please log in again."
 */

/** Seconds of clock skew tolerated when checking `exp`. */
const CLOCK_SKEW_SECONDS = 30;

const decode = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.decode(token);
    return decoded && typeof decoded !== "string" ? decoded : null;
  } catch {
    return null;
  }
};

const isExpired = (payload: JwtPayload): boolean => {
  if (typeof payload.exp !== "number") {
    // No expiry claim: treat as unusable rather than eternally valid.
    return true;
  }
  return payload.exp <= Math.floor(Date.now() / 1000) - CLOCK_SKEW_SECONDS;
};

export const verifyAccessToken = async (token: string) => {
  const payload = decode(token);

  if (!payload) {
    return { success: false as const, message: "Malformed token" };
  }

  if (isExpired(payload)) {
    return { success: false as const, message: "Token has expired" };
  }

  return {
    success: true as const,
    message: "Token is valid",
    payload,
  };
};

export const verifyResetPasswordToken = async (token: string) => {
  const payload = decode(token);

  if (!payload) {
    return { success: false as const, message: "Malformed token" };
  }

  if (isExpired(payload)) {
    return { success: false as const, message: "Reset link has expired" };
  }

  // The reset form is only a form — submitting it sends this same token to the
  // API, which verifies the signature before changing any password.
  return {
    success: true as const,
    message: "Token is valid",
    payload,
  };
};
