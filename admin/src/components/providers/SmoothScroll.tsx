"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Momentum scrolling, applied once for the whole site.
 *
 * Lenis takes over the wheel and animates the page toward a target instead of
 * jumping to it, so releasing the wheel leaves the page still travelling and
 * easing to a stop rather than halting dead. It drives the real scroll
 * position — not a transformed container — so `position: sticky`, fixed
 * headers, `scrollY` listeners and IntersectionObserver all keep working.
 *
 * Mounted once at the root. A second instance would fight the first for the
 * same scroll position, so everything goes through the singleton below.
 */

let instance: Lenis | null = null;

/** The live instance, or null when smoothing is off (reduced motion). */
export const getLenis = () => instance;

/**
 * The curve for a deliberate jump, as opposed to a wheel gesture.
 *
 * Wheel scrolling uses an ease-*out*: the finger has already supplied the
 * push, so the page starts at speed and decays. A button press has no push
 * behind it, and reusing that curve is what makes "back to top" feel like
 * being catapulted — it leaves at maximum velocity and then crawls the last
 * stretch.
 *
 * This lifts off gently, reaches its quickest around the halfway mark, and
 * spends the whole second half slowing down, arriving with velocity at zero.
 *
 * It is smootherstep — one polynomial across the whole range, not two halves
 * stitched together. The usual ease-in-out curves are piecewise, and while
 * their position and velocity match at the seam, their *acceleration* flips
 * sign instantly there. Measured on this page that showed up as a 45% jump in
 * velocity in a single frame at the midpoint — a real kick, with frame timings
 * clean either side of it. Smootherstep has no seam, and its acceleration
 * starts and ends at zero as well as its velocity, so there is nothing to
 * catch anywhere along the travel.
 */
const glide = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * How long that jump should take, scaled to how far it goes.
 *
 * A fixed duration is wrong at both ends: the same 2 seconds that make a
 * full-page rise feel cinematic make a nudge to the comment box feel broken.
 * The square root keeps it proportional without running away — a page ten
 * times longer takes about three times as long, not ten.
 */
const glideDuration = (distance: number) =>
  Math.min(2.2, Math.max(0.9, 0.7 + Math.sqrt(Math.abs(distance)) / 45));

/**
 * Scrolls somewhere, whichever engine is running.
 *
 * Native `scrollTo({ behavior: "smooth" })` and Lenis both animate the same
 * property, so calling the native one while Lenis is live has the two pulling
 * in opposite directions. Anything that wants a smooth programmatic scroll
 * should come through here.
 */
export function smoothScrollTo(
  target: number | string | HTMLElement,
  options: { offset?: number; duration?: number } = {},
) {
  const lenis = getLenis();

  if (lenis) {
    // Measured from where the page actually is, so the curve is stretched
    // over the real distance rather than a guess.
    const destination =
      typeof target === "number"
        ? target
        : (typeof target === "string" ? document.querySelector(target) : target)
            ?.getBoundingClientRect().top ?? 0;

    const distance =
      typeof target === "number" ? destination - window.scrollY : destination;

    lenis.scrollTo(target, {
      offset: options.offset ?? 0,
      duration: options.duration ?? glideDuration(distance),
      easing: glide,
    });
    return;
  }

  // No Lenis: reduced motion, or the instance has not mounted yet.
  if (typeof target === "number") {
    window.scrollTo({ top: target + (options.offset ?? 0), behavior: "smooth" });
    return;
  }

  const node = typeof target === "string" ? document.querySelector(target) : target;
  node?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const start = () => {
      if (instance) return;

      instance = new Lenis({
        /**
         * The feel. `duration` is how long the glide takes to settle and
         * `easing` is the shape of the deceleration — this is an exponential
         * ease-out, which moves decisively at first and then trails off, the
         * way a car comes off the brake. Together they are the two knobs
         * worth touching:
         *
         *   duration 0.8  — quick and tight
         *   duration 1.05 — here: a glide you notice but never wait for
         *   duration 1.5+ — floaty; the page keeps moving after you have
         *                   stopped reading, which reads as lag, not luxury
         */
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

        /**
         * Left at 1 so a wheel notch moves the page as far as the operating
         * system says it should. Raising it makes the site scroll faster than
         * every other window on the machine, which feels broken rather than
         * fast.
         */
        wheelMultiplier: 1,
        smoothWheel: true,

        /**
         * Touch is deliberately left alone. Phones already have momentum
         * scrolling tuned by the platform, and re-implementing it in
         * JavaScript is what makes smooth-scroll libraries feel awful on a
         * phone — a frame behind the finger, with the rubber-band gone. Set
         * `syncTouch: true` only if you specifically want the JS version.
         */
        syncTouch: false,

        /**
         * Panels that scroll on their own — the chat transcript, the support
         * inbox lists, dropdowns, modals — keep their own scrolling instead
         * of the page moving underneath the cursor.
         */
        allowNestedScroll: true,

        /** `href="#section"` links glide instead of jumping. */
        anchors: true,

        /** Stops smoothing if anything sets `overflow: hidden` on <html>. */
        autoToggle: true,

        /**
         * Lenis owns its own rAF loop, so there is no React state changing
         * per frame and nothing re-renders while scrolling. `destroy()`
         * cancels it.
         */
        autoRaf: true,
      });
    };

    const stop = () => {
      instance?.destroy();
      instance = null;
    };

    // Reduced motion gets native scrolling outright rather than a neutered
    // Lenis: no interception, no rAF loop, nothing to go wrong.
    if (!reduceMotion.matches) start();

    const onPreferenceChange = () => (reduceMotion.matches ? stop() : start());
    reduceMotion.addEventListener("change", onPreferenceChange);

    /**
     * Modals in this codebase lock the page by setting `overflow: hidden` on
     * <body>. Lenis's own `autoToggle` watches <html>, so it does not see
     * those — and a locked page that still scrolls behind the dialog is the
     * classic smooth-scroll bug. Watching the attribute here fixes every
     * existing dialog, drawer, lightbox and overlay at once, and any added
     * later, without touching them.
     */
    const syncWithBodyLock = () => {
      if (!instance) return;
      const locked = getComputedStyle(document.body).overflow === "hidden";
      if (locked) instance.stop();
      else instance.start();
    };

    const bodyWatcher = new MutationObserver(syncWithBodyLock);
    bodyWatcher.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    syncWithBodyLock();

    return () => {
      reduceMotion.removeEventListener("change", onPreferenceChange);
      bodyWatcher.disconnect();
      stop();
    };
  }, []);

  return null;
}
