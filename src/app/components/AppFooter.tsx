import { desktopDownloadUrl, licenseUrl, npmPackageUrl, profileUrl, repoUrl } from "../app-constants";
import { ExternalLink } from "./ExternalLink";

export function AppFooter() {
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
    </footer>
  );
}
