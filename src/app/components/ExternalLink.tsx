import type { AnchorHTMLAttributes, ReactNode } from "react";
import { desktopApi } from "../app-constants";

type ExternalLinkProps = {
  children: ReactNode;
  href: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href">;

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

        if (!desktopApi) {
          return;
        }

        event.preventDefault();
        desktopApi.openExternal(href).catch(() => undefined);
      }}
    >
      {children}
    </a>
  );
}
