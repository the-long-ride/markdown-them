import type { ReactNode } from "react";
import { desktopApi } from "../app-constants";

export function ExternalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
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
