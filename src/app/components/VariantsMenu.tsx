import { ChevronDown, ExternalLink as ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  desktopDownloadUrl,
  npmPackageUrl,
  openVsxUrl,
  vscodeMarketplaceUrl,
  webappUrl,
} from "../app-constants";
import { useLanguage } from "../context/LanguageContext";
import { ExternalLink } from "./ExternalLink";

interface VariantsMenuProps {
  isDesktop: boolean;
}

export function VariantsMenu({ isDesktop }: VariantsMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const links = [
    isDesktop
      ? { description: t("webAppVariantDetail"), href: webappUrl, label: t("webApp") }
      : { description: t("desktopVariantDetail"), href: desktopDownloadUrl, label: t("desktopApplication") },
    { description: t("openVsxVariantDetail"), href: openVsxUrl, label: "Open VSX" },
    { description: t("vscodeMarketplaceVariantDetail"), href: vscodeMarketplaceUrl, label: t("vscodeMarketplace") },
    { description: t("npmPackageVariantDetail"), href: npmPackageUrl, label: t("npmPackage") },
  ];

  return (
    <div
      className="variants-menu"
      ref={menuRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="secondary-button variants-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{t("variants")}</span>
        <ChevronDown size={15} />
      </button>

      {isOpen ? (
        <div className="variants-dropdown" role="menu">
          {links.map((link) => (
            <ExternalLink className="variants-link" href={link.href} key={link.href} role="menuitem">
              <span className="variants-link-copy">
                <span>{link.label}</span>
                <small>{link.description}</small>
              </span>
              <ExternalLinkIcon size={14} />
            </ExternalLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
