import { Maximize2, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { desktopApi } from "../app-constants";
import { AppFooter } from "./AppFooter";

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const api = desktopApi;

  useEffect(() => {
    if (!api) {
      return;
    }

    api.window.isMaximized().then(setIsMaximized).catch(() => undefined);
    return api.window.onMaximizedChange(setIsMaximized);
  }, [api]);

  if (!api) {
    return null;
  }

  return (
    <div className="titlebar">
      <div className="titlebar-title">Markdown Them</div>
      <AppFooter />
      <div className="window-controls">
        <button type="button" title="Minimize" aria-label="Minimize" onClick={() => api.window.minimize()}>
          <Minus size={14} />
        </button>
        <button type="button" title={isMaximized ? "Restore" : "Maximize"} aria-label={isMaximized ? "Restore" : "Maximize"} onClick={() => api.window.toggleMaximize()}>
          <Maximize2 size={14} />
        </button>
        <button className="close-control" type="button" title="Close" aria-label="Close" onClick={() => api.window.close()}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
