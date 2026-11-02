import fs from 'node:fs';
import path from 'node:path';

export function extractChangelogForVersion(changelogText, tagOrVersion) {
  const targetVersion = tagOrVersion.replace(/^v/, '').trim();
  const lines = changelogText.split(/\r?\n/);
  let capturing = false;
  const capturedLines = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s*\[?v?([0-9]+\.[0-9]+\.[0-9]+[^\]\s]*)\]?/);
    if (headerMatch) {
      if (capturing) {
        break; // reached the next version section
      }
      if (headerMatch[1] === targetVersion) {
        capturing = true;
        continue;
      }
    }
    if (capturing) {
      capturedLines.push(line);
    }
  }

  const result = capturedLines.join('\n').trim();
  return result.length > 0 ? result : null;
}

export function buildReleaseBody({ tagName, changelogNotes }) {
  const version = tagName.replace(/^v/, '');
  const changelogSection = changelogNotes
    ? `<details>\n<summary><b>Changelog for ${tagName}</b></summary>\n\n${changelogNotes}\n\n</details>`
    : `<details>\n<summary><b>Changelog for ${tagName}</b></summary>\n\n_See [CHANGELOG.md](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) for detailed changes._\n\n</details>`;

  return `## Markdown Them Release [${tagName}](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md)

${changelogSection}

Choose the file that matches how you want to use Markdown Them:

* [\`.vsix\`](https://github.com/the-long-ride/markdown-them/releases/download/${tagName}/the-long-ride.markdown-them-${version}.vsix) : VS Code extension package for manual install. In VS Code, run "Extensions: Install from VSIX..." and choose this file.
* [\`.zip\` (Windows Portable)](https://github.com/the-long-ride/markdown-them/releases/download/${tagName}/markdown-them_${version}_windows_x64_portable.zip) : Portable Windows desktop app (extract and run \`markdown-them.exe\` without installation).
* [\`.exe\` (Windows Portable)](https://github.com/the-long-ride/markdown-them/releases/download/${tagName}/markdown-them_${version}_windows_x64_portable.exe) : Standalone portable Windows executable.
* [\`.deb\`](https://github.com/the-long-ride/markdown-them/releases/download/${tagName}/markdown-them_${version}_amd64.deb) : Linux installer for Debian, Ubuntu, and compatible distributions.
* [\`.tar.gz\` (macOS Portable)](https://github.com/the-long-ride/markdown-them/releases/download/${tagName}/markdown-them_${version}_macos_portable.tar.gz) : Portable macOS app bundle (extract and move \`markdown-them.app\` anywhere).
* [\`.zip\` (macOS Portable)](https://github.com/the-long-ride/markdown-them/releases/download/${tagName}/markdown-them_${version}_macos_portable.zip) : Portable macOS zip archive.

### Other Install Links
* **npm Package:** https://www.npmjs.com/package/@the-long-ride/markdown-them (install: \`npm i -g @the-long-ride/markdown-them\`, verify: \`mdthem -v\`)
* **VS Code Marketplace:** https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them
* **Open VSX:** https://open-vsx.org/extension/the-long-ride/markdown-them
* **Project Website:** https://the-long-ride.github.io/markdown-them/

For a list of changes in this release, see the [CHANGELOG.md](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md).
`;
}

function main() {
  const args = process.argv.slice(2);
  const tagName = args[0] || process.env.GITHUB_REF_NAME || 'v1.4.0';
  const outputPath = args[1] || 'release-notes.md';

  const changelogPath = path.resolve('CHANGELOG.md');
  let changelogNotes = null;
  if (fs.existsSync(changelogPath)) {
    const changelogText = fs.readFileSync(changelogPath, 'utf8');
    changelogNotes = extractChangelogForVersion(changelogText, tagName);
  }

  const body = buildReleaseBody({ tagName, changelogNotes });
  fs.writeFileSync(outputPath, body, 'utf8');
  console.log(`Generated release notes for ${tagName} at ${outputPath}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve('scripts/generate-release-notes.mjs')
) {
  main();
}
