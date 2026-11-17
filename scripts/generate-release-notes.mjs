import { execFileSync } from 'node:child_process';
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

/**
 * List the human commit authors and co-authors between adjacent version tags.
 * For the first version tag, include all reachable history instead.
 */
export function collectReleaseContributors(tagName, cwd = process.cwd()) {
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(tagName)) {
    throw new Error('Expected a version tag such as v1.4.0.');
  }

  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(['rev-parse', '--verify', 'refs/tags/' + tagName + '^{commit}']);

  const versions = git([
    'tag',
    '--merged',
    tagName,
    '--list',
    'v[0-9]*',
    '--sort=-version:refname',
  ]);
  const previous = versions.split('\n').find((tag) => tag && tag !== tagName);
  const range = previous ? previous + '..' + tagName : tagName;
  const history = git(['log', '--no-merges', '--format=%aN%x1f%aE%x1f%B%x1e', range]);
  const contributors = new Map();

  const add = (name, email) => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const match = normalizedEmail.match(
      /^(?:[0-9]+\+)?([a-z0-9-]+(?:\[bot\])?)@users\.noreply\.github\.com$/i,
    );
    const login = match ? match[1] : null;
    if (!normalizedName || /\[bot\]$/i.test(login || normalizedName)) return;
    const key = login
      ? 'github:' + login.toLowerCase()
      : normalizedEmail || normalizedName.toLowerCase();
    if (!contributors.has(key)) {
      contributors.set(key, { name: normalizedName, login });
    }
  };

  for (const item of history.split('\x1e')) {
    const parts = item.trim().split('\x1f');
    if (parts.length < 3) continue;
    add(parts[0], parts[1]);
    const message = parts.slice(2).join('\x1f');
    for (const match of message.matchAll(/^Co-authored-by:\s*(.+?)\s*<([^<>]+)>\s*$/gim)) {
      add(match[1], match[2]);
    }
  }

  return [...contributors.values()].sort((a, b) =>
    (a.login || a.name).localeCompare(b.login || b.name, 'en', { sensitivity: 'base' }),
  );
}

export function formatContributors(contributors) {
  const escapeName = (name) => name.replace(/([\\[\]()*_<>])/g, '\\$1');
  const entries = contributors.map(({ name, login }) =>
    login ? '- [@' + login + '](https://github.com/' + login + ')' : '- ' + escapeName(name),
  );
  return (
    '### Contributors\n\n' +
    (entries.length
      ? entries.join('\n')
      : '_No individual contributors identified for this release._')
  );
}

export function buildReleaseBody({ tagName, changelogNotes, contributors = [] }) {
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

${formatContributors(contributors)}
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

  const contributors = collectReleaseContributors(tagName);
  const body = buildReleaseBody({ tagName, changelogNotes, contributors });
  fs.writeFileSync(outputPath, body, 'utf8');
  console.log(`Generated release notes for ${tagName} at ${outputPath}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve('scripts/generate-release-notes.mjs')
) {
  main();
}
