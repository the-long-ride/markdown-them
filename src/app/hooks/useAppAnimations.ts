import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { MutableRefObject, RefObject } from "react";
import type { Mode } from "../app-types";
import { shouldReduceMotion } from "../app-utils";

gsap.registerPlugin(useGSAP);

export function useIntroAnimation(workspaceRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (shouldReduceMotion()) {
        return;
      }

      gsap.set(".motion-card, .trust-badge, .brand-lockup, .segmented", { willChange: "transform, opacity" });

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .from(".brand-lockup", { autoAlpha: 0, y: 14, duration: 0.46 })
        .from(".segmented", { autoAlpha: 0, y: -10, duration: 0.38 }, "<0.08")
        .from(".trust-badge", { autoAlpha: 0, y: 14, scale: 0.985, stagger: 0.065, duration: 0.44 }, "<0.06")
        .from(".motion-card", { autoAlpha: 0, y: 18, scale: 0.992, stagger: 0.075, duration: 0.48 }, "<0.1")
        .set(".motion-card, .trust-badge, .brand-lockup, .segmented", { clearProps: "willChange" });
    },
    { scope: workspaceRef },
  );
}

export function useModeAnimation(
  contentRef: RefObject<HTMLElement | null>,
  workspaceRef: RefObject<HTMLElement | null>,
  modeAnimationReadyRef: MutableRefObject<boolean>,
  mode: Mode,
) {
  useGSAP(
    () => {
      if (!modeAnimationReadyRef.current) {
        modeAnimationReadyRef.current = true;
        return;
      }

      if (!contentRef.current || shouldReduceMotion()) {
        return;
      }

      gsap.fromTo(
        contentRef.current,
        { autoAlpha: 0, y: 12, scale: 0.996 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: "power2.out", clearProps: "transform,opacity,visibility" },
      );
    },
    { dependencies: [mode], revertOnUpdate: true, scope: workspaceRef },
  );
}
