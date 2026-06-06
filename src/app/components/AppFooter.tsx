import { desktopApi, licenseUrl, profileUrl, repoUrl, privacyUrl, termsUrl } from "../app-constants";
import { useLanguage } from "../context/LanguageContext";
import { ExternalLink } from "./ExternalLink";

interface AppFooterProps {
  onNavigate?: (view: "privacy" | "terms") => void;
}

export function AppFooter({ onNavigate }: AppFooterProps) {
  const isDesktop = Boolean(desktopApi);
  const { t } = useLanguage();

  return (
    <footer className="app-footer">
      <span>
        {t("madeBy")} <ExternalLink href={profileUrl}>the-long-ride</ExternalLink> with ❤️
      </span>
      <span>
        <ExternalLink href={repoUrl}>{t("githubRepo")}</ExternalLink>
      </span>
      <span>
        <ExternalLink href={licenseUrl}>{t("mitLicense")}</ExternalLink>
      </span>
      <span>
        {isDesktop ? (
          <ExternalLink href={privacyUrl}>{t("privacyPolicy")}</ExternalLink>
        ) : (
          <a
            href="#/privacy"
            onClick={(event) => {
              event.preventDefault();
              window.location.hash = "#/privacy";
              onNavigate?.("privacy");
            }}
          >
            {t("privacyPolicy")}
          </a>
        )}
      </span>
      <span>
        {isDesktop ? (
          <ExternalLink href={termsUrl}>{t("termsOfService")}</ExternalLink>
        ) : (
          <a
            href="#/terms"
            onClick={(event) => {
              event.preventDefault();
              window.location.hash = "#/terms";
              onNavigate?.("terms");
            }}
          >
            {t("termsOfService")}
          </a>
        )}
      </span>
    </footer>
  );
}
