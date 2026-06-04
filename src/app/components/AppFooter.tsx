import { desktopApi, desktopDownloadUrl, licenseUrl, npmPackageUrl, profileUrl, repoUrl, privacyUrl, termsUrl } from "../app-constants";
import { ExternalLink } from "./ExternalLink";

interface AppFooterProps {
  onNavigate?: (view: "privacy" | "terms") => void;
}

export function AppFooter({ onNavigate }: AppFooterProps) {
  const isDesktop = Boolean(desktopApi);

  return (
    <footer className="app-footer">
      <span>
        made by <ExternalLink href={profileUrl}>the-long-ride</ExternalLink> with &lt;3
      </span>
      <span>
        <ExternalLink href={repoUrl}>GitHub repo</ExternalLink>
      </span>
      <span>
        <ExternalLink href={desktopDownloadUrl}>Desktop app</ExternalLink>
      </span>
      <span>
        <ExternalLink href={npmPackageUrl}>npm package</ExternalLink>
      </span>
      <span>
        <ExternalLink href={licenseUrl}>MIT license</ExternalLink>
      </span>
      <span>
        {isDesktop ? (
          <ExternalLink href={privacyUrl}>Privacy Policy</ExternalLink>
        ) : (
          <a
            href="#/privacy"
            onClick={(event) => {
              event.preventDefault();
              window.location.hash = "#/privacy";
              onNavigate?.("privacy");
            }}
          >
            Privacy Policy
          </a>
        )}
      </span>
      <span>
        {isDesktop ? (
          <ExternalLink href={termsUrl}>Terms of Service</ExternalLink>
        ) : (
          <a
            href="#/terms"
            onClick={(event) => {
              event.preventDefault();
              window.location.hash = "#/terms";
              onNavigate?.("terms");
            }}
          >
            Terms of Service
          </a>
        )}
      </span>
    </footer>
  );
}

