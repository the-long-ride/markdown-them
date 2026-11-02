import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { Mode } from '../app-types';
import { shouldReduceMotion } from '../app-utils';

export function useIntroAnimation(workspaceRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (shouldReduceMotion() || !workspaceRef.current) {
      return;
    }

    const elements = workspaceRef.current.querySelectorAll<HTMLElement>(
      '.motion-card, .trust-badge, .brand-lockup, .segmented',
    );

    elements.forEach((el, index) => {
      el.animate(
        [
          { opacity: '0', transform: 'translateY(14px)' },
          { opacity: '1', transform: 'translateY(0)' },
        ],
        {
          duration: 420,
          delay: index * 40,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'both',
        },
      );
    });
  }, [workspaceRef]);
}

export function useModeAnimation(
  contentRef: RefObject<HTMLElement | null>,
  workspaceRef: RefObject<HTMLElement | null>,
  modeAnimationReadyRef: MutableRefObject<boolean>,
  mode: Mode,
) {
  useEffect(() => {
    if (!modeAnimationReadyRef.current) {
      modeAnimationReadyRef.current = true;
      return;
    }

    if (!contentRef.current || shouldReduceMotion()) {
      return;
    }

    contentRef.current.animate(
      [
        { opacity: '0', transform: 'translateY(10px) scale(0.996)' },
        { opacity: '1', transform: 'translateY(0) scale(1)' },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'both',
      },
    );
  }, [mode, contentRef, modeAnimationReadyRef]);
}
