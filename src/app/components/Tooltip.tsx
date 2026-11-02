import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children: ReactElement;
  content: ReactNode;
  delay?: number;
  disabled?: boolean;
  position?: TooltipPosition;
  shortcut?: string;
  wrap?: boolean;
}

export function Tooltip({
  children,
  content,
  delay = 120,
  disabled = false,
  position = 'top',
  shortcut,
  wrap,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    effectivePos: TooltipPosition;
    ready: boolean;
  }>({
    left: 0,
    top: 0,
    effectivePos: position,
    ready: false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    const PADDING = 8;
    const GAP = 6;

    let pos = position;

    // Flip vertical if out of bounds
    if (pos === 'top' && triggerRect.top - tooltipHeight - GAP < PADDING) {
      pos = 'bottom';
    } else if (
      pos === 'bottom' &&
      triggerRect.bottom + GAP + tooltipHeight > window.innerHeight - PADDING
    ) {
      pos = 'top';
    }

    // Flip horizontal if out of bounds
    if (pos === 'left' && triggerRect.left - tooltipWidth - GAP < PADDING) {
      pos = 'right';
    } else if (
      pos === 'right' &&
      triggerRect.right + GAP + tooltipWidth > window.innerWidth - PADDING
    ) {
      pos = 'left';
    }

    let top = 0;
    let left = 0;

    if (pos === 'top') {
      top = triggerRect.top - tooltipHeight - GAP;
      left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
    } else if (pos === 'bottom') {
      top = triggerRect.bottom + GAP;
      left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
    } else if (pos === 'left') {
      top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
      left = triggerRect.left - tooltipWidth - GAP;
    } else if (pos === 'right') {
      top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
      left = triggerRect.right + GAP;
    }

    // Clamp horizontal and vertical positions within viewport bounds
    left = Math.max(PADDING, Math.min(window.innerWidth - tooltipWidth - PADDING, left));
    top = Math.max(PADDING, Math.min(window.innerHeight - tooltipHeight - PADDING, top));

    setCoords({ left, top, effectivePos: pos, ready: true });
  }, [position]);

  const showTooltip = () => {
    if (disabled || !content) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    clearTimer();
    setVisible(false);
    setCoords((prev) => ({ ...prev, ready: false }));
  };

  useLayoutEffect(() => {
    if (!visible) return;
    updatePosition();
  }, [visible, updatePosition]);

  useEffect(() => {
    if (!visible) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideTooltip();
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, updatePosition]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  // Intercept and wrap event handlers on the child element
  const childProps = children.props as Record<string, any>;
  const clonedChild = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = (children as any).ref;
      if (typeof childRef === 'function') {
        childRef(node);
      } else if (childRef && typeof childRef === 'object') {
        childRef.current = node;
      }
    },
    // Remove native title so browser default OS tooltip never appears
    title: undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e);
      showTooltip();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e);
      hideTooltip();
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      showTooltip();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      hideTooltip();
    },
    onClick: (e: React.MouseEvent) => {
      childProps.onClick?.(e);
      hideTooltip();
    },
    onMouseDown: (e: React.MouseEvent) => {
      childProps.onMouseDown?.(e);
      hideTooltip();
    },
  } as any);

  const isMultiline = wrap || (typeof content === 'string' && content.length > 55);

  return (
    <>
      {clonedChild}
      {visible && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tooltipRef}
              className={`app-tooltip app-tooltip--${coords.effectivePos} ${isMultiline ? 'app-tooltip--multiline' : ''}`}
              role="tooltip"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                visibility: coords.ready ? 'visible' : 'hidden',
                opacity: coords.ready ? 1 : 0,
              }}
            >
              <span className="tooltip-label">{content}</span>
              {shortcut ? <kbd className="tooltip-kbd">{shortcut}</kbd> : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
