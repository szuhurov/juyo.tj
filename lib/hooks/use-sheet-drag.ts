"use client";

/**
 * Apple-style bottom-sheet physics for the web (.claude/skills/apple-design):
 *  - enters with a critically damped spring (no bounce — nothing was thrown);
 *  - drags 1:1 after a 10px threshold (taps on its buttons still work),
 *    rubber-bands upward instead of stopping dead;
 *  - on release decides from the PROJECTED resting point, and hands the
 *    finger's velocity to the spring so there is no seam;
 *  - can be grabbed again mid-animation and continues from where it is.
 * Phones only (< md); on desktop the element is left alone (centered dialog).
 */
import { useEffect, type RefObject } from "react";
import { animate } from "motion";

const DRAG_THRESHOLD = 10;

function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function currentY(el: HTMLElement) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return m.m42;
}

export function useSheetDrag(
  ref: RefObject<HTMLElement | null>,
  { open, onDismiss }: { open: boolean; onDismiss: () => void },
) {
  useEffect(() => {
    const el = ref.current;
    if (!open || !el || !window.matchMedia("(max-width: 767px)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let controls: ReturnType<typeof animate> | null = null;
    const run = (to: number, velocity: number, bounce: number, done?: () => void) => {
      controls?.stop();
      if (reduceMotion) {
        el.style.transform = `translateY(${to}px)`;
        done?.();
        return;
      }
      controls = animate(el, { y: to }, { type: "spring", bounce, duration: 0.35, velocity });
      if (done) controls.then(done);
    };

    // Enter from below (spatial consistency: it leaves the same way).
    const height = el.getBoundingClientRect().height;
    el.style.transform = `translateY(${height}px)`;
    run(0, 0, 0);

    let startY = 0;
    let baseY = 0;
    let dragging = false;
    let pointerId: number | null = null;
    let history: { y: number; t: number }[] = [];

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerId = e.pointerId;
      startY = e.clientY;
      dragging = false;
      history = [{ y: e.clientY, t: e.timeStamp }];
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dy) < DRAG_THRESHOLD) return;
        dragging = true;
        controls?.stop();
        baseY = currentY(el) - dy; // grab where it is, keep the finger offset
        el.setPointerCapture(e.pointerId);
      }
      history.push({ y: e.clientY, t: e.timeStamp });
      if (history.length > 5) history.shift();
      const raw = baseY + dy;
      const y = raw >= 0 ? raw : -rubberband(-raw, el.getBoundingClientRect().height);
      el.style.transform = `translateY(${y}px)`;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      const first = history[0];
      const last = history[history.length - 1];
      const dt = Math.max(last.t - first.t, 1);
      const velocity = ((last.y - first.y) / dt) * 1000; // px/s
      const y = currentY(el);
      const h = el.getBoundingClientRect().height;
      if (y + project(velocity) > h * 0.4) {
        run(h, velocity, 0, onDismiss);
      } else {
        run(0, velocity, 0.2); // a little bounce: the gesture carried momentum
      }
    };
    // A drag must not also click the button it started on.
    const onClickCapture = (e: MouseEvent) => {
      if (history.length > 1 && Math.abs(history[history.length - 1].y - history[0].y) >= DRAG_THRESHOLD) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      controls?.stop();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [ref, open, onDismiss]);
}
