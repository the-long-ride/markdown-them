import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { desktopApi, resolveDesktopApi } from '../app-constants';

type ExternalLinkProps = {
  children: ReactNode;
  href: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'>;

export function ExternalLink({ children, href, ...props }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const api = desktopApi || resolveDesktopApi();
        if (api) {
          event.preventDefault();
          api.openExternal(href).catch((err) => {
            console.warn('Failed to open external URL:', err);
          });
        }
      }}
    >
      {children}
    </a>
  );
}
