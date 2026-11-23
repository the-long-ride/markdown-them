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

export function extractUnreleasedChangelog(changelogText) {
  const lines = changelogText.split(/\r?\n/);
  let capturing = false;
  const capturedLines = [];

  for (const line of lines) {
    if (/^##\s*\[?Unreleased\]?/i.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing && /^##\s+/.test(line)) {
      break;
    }
    if (capturing) {
      capturedLines.push(line);
    }
  }

  const result = capturedLines.join('\n').trim();
  return result.length > 0 ? result : null;
}

function resolveReleaseRange(tagName, cwd = process.cwd()) {
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(tagName)) {
    throw new Error('Expected a version tag such as v1.4.0.');
  }

  const git = (args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  git(['rev-parse', '--verify', 'refs/tags/' + tagName + '^{commit}']);

  const versions = git([
    'tag',
    '--merged',
    tagName,
    '--list',
    'v[0-9]*',
    '--sort=-version:refname',
  ]);
  const previousTag = versions.split(/\r?\n/).find((tag) => tag && tag !== tagName) || null;
  const range = previousTag ? previousTag + '..' + tagName : tagName;
  return { git, previousTag, range };
}

export function collectReleaseCommits(tagName, cwd = process.cwd()) {
  const { git, previousTag, range } = resolveReleaseRange(tagName, cwd);
  const parseCommits = (args) =>
    git(args)
      .split('\x1e')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [subject, shortSha] = entry.split('\x1f');
        return { subject: (subject || '').trim(), shortSha: (shortSha || '').trim() };
      })
      .filter((item) => item.subject.length > 0);

  let commits = parseCommits(['log', '--no-merges', '--format=%s%x1f%h%x1e', range]);
  if (commits.length === 0) {
    commits = parseCommits(['log', '--format=%s%x1f%h%x1e', range]);
  }
  return { commits, previousTag, range };
}

export function resolveReleaseChangelog({ tagName, changelogText = '', cwd = process.cwd() }) {
  if (changelogText) {
    const versionNotes = extractChangelogForVersion(changelogText, tagName);
    if (versionNotes) {
      return versionNotes;
    }
  }

  const { git, previousTag, range } = resolveReleaseRange(tagName, cwd);
  const unreleased = changelogText ? extractUnreleasedChangelog(changelogText) : null;
  const changelogUpdated =
    Boolean(unreleased) &&
    (!previousTag || git(['diff', '--name-only', range, '--', 'CHANGELOG.md']).length > 0);

  if (changelogUpdated) {
    return unreleased;
  }

  const { commits } = collectReleaseCommits(tagName, cwd);
  if (commits.length === 0) {
    return null;
  }

  const lines = commits.map(({ subject, shortSha }) =>
    shortSha ? `- ${subject} (\`${shortSha}\`)` : `- ${subject}`,
  );
  if (previousTag) {
    lines.push(
      '',
      `**Full Changelog**: https://github.com/the-long-ride/markdown-them/compare/${previousTag}...${tagName}`,
    );
  }
  return lines.join('\n');
}

function parseNoreplyEmail(email) {
  const match = email
    .trim()
    .toLowerCase()
    .match(/^(?:([0-9]+)\+)?([a-z0-9-]+(?:\[bot\])?)@users\.noreply\.github\.com$/i);
  if (!match) return null;
  return { userId: match[1] || null, login: match[2] };
}

function parseRepositorySlug(cwd = process.cwd()) {
  if (process.env.GITHUB_REPOSITORY && /^[^/]+\/[^/]+$/.test(process.env.GITHUB_REPOSITORY)) {
    return process.env.GITHUB_REPOSITORY;
  }
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
      const match = repoUrl?.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
      if (match) return match[1];
    } catch {
      // ignore invalid package.json
    }
  }
  return 'the-long-ride/markdown-them';
}

function collectContributorEntries(tagName, cwd = process.cwd()) {
  const { git, previousTag, range } = resolveReleaseRange(tagName, cwd);
  const history = git(['log', '--no-merges', '--format=%H%x1f%aN%x1f%aE%x1f%B%x1e', range]);
  const contributors = new Map();

  const add = (name, email, sha) => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const noreply = parseNoreplyEmail(normalizedEmail);
    const login = noreply ? noreply.login : null;
    if (!normalizedName || /\[bot\]$/i.test(login || normalizedName)) return;
    const key = login
      ? 'github:' + login.toLowerCase()
      : normalizedEmail || normalizedName.toLowerCase();
    if (!contributors.has(key)) {
      const avatarUrl = noreply?.userId
        ? `https://avatars.githubusercontent.com/u/${noreply.userId}?v=4`
        : null;
      contributors.set(key, {
        name: normalizedName,
        email: normalizedEmail,
        login,
        avatarUrl,
        sha,
      });
    }
  };

  for (const item of history.split('\x1e')) {
    const parts = item.trim().split('\x1f');
    if (parts.length < 4) continue;
    const sha = parts[0].trim();
    add(parts[1], parts[2], sha);
    const message = parts.slice(3).join('\x1f');
    for (const match of message.matchAll(/^Co-authored-by:\s*(.+?)\s*<([^<>]+)>\s*$/gim)) {
      add(match[1], match[2], null);
    }
  }

  return { entries: [...contributors.values()], previousTag };
}

/**
 * List the human commit authors and co-authors between adjacent version tags.
 * For the first version tag, include all reachable history instead.
 */
export function collectReleaseContributors(tagName, cwd = process.cwd()) {
  const { entries } = collectContributorEntries(tagName, cwd);
  return entries
    .map(({ name, login }) => ({ name, login }))
    .sort((a, b) =>
      (a.login || a.name).localeCompare(b.login || b.name, 'en', { sensitivity: 'base' }),
    );
}

export async function resolveGitHubContributors(
  tagName,
  cwd = process.cwd(),
  {
    fetchImpl = globalThis.fetch,
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '',
    repoSlug = parseRepositorySlug(cwd),
  } = {},
) {
  const { entries, previousTag } = collectContributorEntries(tagName, cwd);
  const byEmail = new Map();
  const bySha = new Map();

  if (typeof fetchImpl === 'function' && entries.length > 0) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'markdown-them-release-notes',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const fetchJson = async (url) => {
      try {
        const res = await fetchImpl(url, { headers });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };
    const recordApiCommit = (item) => {
      const login = item?.author?.login;
      const isBot = item?.author?.type === 'Bot' || /\[bot\]$/i.test(login || '');
      if (!login && !isBot) return;
      const info = isBot
        ? { isBot: true }
        : { isBot: false, login, avatarUrl: item.author.avatar_url || null };
      if (item?.sha) bySha.set(item.sha, info);
      const email = item?.commit?.author?.email?.trim().toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, info);
    };

    const listUrl = previousTag
      ? `https://api.github.com/repos/${repoSlug}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(tagName)}`
      : `https://api.github.com/repos/${repoSlug}/commits?sha=${encodeURIComponent(tagName)}&per_page=100`;
    const listData = await fetchJson(listUrl);
    const listCommits = Array.isArray(listData) ? listData : listData?.commits;
    if (Array.isArray(listCommits)) {
      for (const item of listCommits) recordApiCommit(item);
    }

    const unresolvedShas = entries
      .filter((entry) => !entry.login && entry.sha && !bySha.has(entry.sha))
      .map((entry) => entry.sha)
      .slice(0, 20);
    for (const sha of unresolvedShas) {
      const commitData = await fetchJson(
        `https://api.github.com/repos/${repoSlug}/commits/${encodeURIComponent(sha)}`,
      );
      if (commitData) recordApiCommit(commitData);
    }
  }

  const deduped = new Map();
  for (const entry of entries) {
    const apiMatch = (entry.sha && bySha.get(entry.sha)) || byEmail.get(entry.email) || null;
    if (apiMatch?.isBot) continue;
    const login = apiMatch?.login || entry.login || null;
    const avatarUrl = apiMatch?.avatarUrl || entry.avatarUrl || null;
    const key = login ? 'github:' + login.toLowerCase() : entry.email || entry.name.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, { name: entry.name, login, avatarUrl });
    }
  }

  return [...deduped.values()].sort((a, b) =>
    (a.login || a.name).localeCompare(b.login || b.name, 'en', { sensitivity: 'base' }),
  );
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatAvatarUrl(login, avatarUrl, size = 80) {
  if (avatarUrl) {
    const url = new URL(avatarUrl);
    url.searchParams.set('s', String(size));
    return url.toString();
  }
  return `https://github.com/${login}.png?size=${size}`;
}

export function formatContributors(contributors) {
  const escapeName = (name) => name.replace(/([\\[\]()*_<>])/g, '\\$1');
  const linked = [];
  const plain = [];

  for (const { name, login, avatarUrl } of contributors) {
    if (login) {
      const safeLogin = escapeAttr(login);
      const profileUrl = `https://github.com/${encodeURIComponent(login)}`;
      const src = escapeAttr(formatAvatarUrl(login, avatarUrl));
      linked.push(
        `<a href="${profileUrl}"><img src="${src}" width="40" height="40" alt="@${safeLogin}" title="@${safeLogin}" /></a>`,
      );
    } else {
      plain.push('- ' + escapeName(name));
    }
  }

  if (linked.length === 0 && plain.length === 0) {
    return '### Contributors\n\n_No individual contributors identified for this release._';
  }

  const sections = [];
  if (linked.length > 0) sections.push(linked.join(' '));
  if (plain.length > 0) sections.push(plain.join('\n'));
  return '### Contributors\n\n' + sections.join('\n\n');
}

export function buildReleaseBody({ tagName, changelogNotes, contributors = [] }) {
  const version = tagName.replace(/^v/, '');
  const notesContent = changelogNotes || `_No commits recorded for ${tagName}._`;
  const changelogSection = `<details>\n<summary><b>Changelog for ${tagName}</b></summary>\n\n${notesContent}\n\n</details>`;

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

async function main() {
  const args = process.argv.slice(2);
  const tagName = args[0] || process.env.GITHUB_REF_NAME || 'v1.4.0';
  const outputPath = args[1] || 'release-notes.md';

  const changelogPath = path.resolve('CHANGELOG.md');
  const changelogText = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
  const changelogNotes = resolveReleaseChangelog({ tagName, changelogText });

  const contributors = await resolveGitHubContributors(tagName);
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
