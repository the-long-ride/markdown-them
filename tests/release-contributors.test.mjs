import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReleaseBody,
  collectReleaseCommits,
  collectReleaseContributors,
  extractChangelogForVersion,
  extractUnreleasedChangelog,
  formatContributors,
  resolveGitHubContributors,
  resolveReleaseChangelog,
} from '../scripts/generate-release-notes.mjs';

function fixture() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'markdown-them-release-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  let count = 0;

  git('init', '--quiet');
  git('config', 'user.name', 'Test User');
  git('config', 'user.email', 'test@example.com');

  const commit = (name, email, message = 'Update') => {
    writeFileSync(path.join(cwd, 'content.txt'), String(++count));
    git('add', 'content.txt');
    git('-c', 'user.name=' + name, '-c', 'user.email=' + email, 'commit', '--quiet', '-m', message);
  };

  return { cwd, git, commit, close: () => rmSync(cwd, { recursive: true, force: true }) };
}

test('first release includes the full history and excludes bot authors', () => {
  const repo = fixture();
  try {
    repo.commit('A User', '123+a-user@users.noreply.github.com');
    repo.commit('dependabot[bot]', '49699333+dependabot[bot]@users.noreply.github.com');
    repo.git('tag', 'v1.0.0');
    assert.deepEqual(collectReleaseContributors('v1.0.0', repo.cwd), [
      { name: 'A User', login: 'a-user' },
    ]);
  } finally {
    repo.close();
  }
});

test('subsequent tags only credit new commits and co-authors once', () => {
  const repo = fixture();
  try {
    repo.commit('Old User', 'old@example.com');
    repo.git('tag', 'v1.0.0');
    repo.commit(
      'Alice',
      '23+alice@users.noreply.github.com',
      'Feature\n\nCo-authored-by: Bob Example <bob@example.com>',
    );
    repo.commit(
      'Alice',
      '23+alice@users.noreply.github.com',
      'Follow up\n\nCo-authored-by: Bob Example <bob@example.com>',
    );
    repo.git('tag', 'v1.1.0');
    assert.deepEqual(collectReleaseContributors('v1.1.0', repo.cwd), [
      { name: 'Alice', login: 'alice' },
      { name: 'Bob Example', login: null },
    ]);
  } finally {
    repo.close();
  }
});

test('rendered contributor list is the final section of a release', () => {
  const body = buildReleaseBody({
    tagName: 'v1.1.0',
    changelogNotes: 'Release changes',
    contributors: [{ name: 'Alice', login: 'alice' }],
  });
  assert.match(body, /Changelog for v1\.1\.0/);
  assert.match(
    body,
    /### Contributors\n\n<a href="https:\/\/github\.com\/alice"><img src="https:\/\/github\.com\/alice\.png\?size=80" width="40" height="40" alt="@alice" title="@alice" \/><\/a>\n$/,
  );
  assert.match(formatContributors([]), /No individual contributors identified/);
  assert.equal(extractChangelogForVersion('## 1.2.0\n\nHello', 'v1.2.0'), 'Hello');
});

test('malformed or missing tags are rejected', () => {
  const repo = fixture();
  try {
    assert.throws(() => collectReleaseContributors('--all', repo.cwd), /Expected a version tag/);
    assert.throws(() => collectReleaseContributors('v9.0.0', repo.cwd));
  } finally {
    repo.close();
  }
});

test('release changelog uses version section, unreleased notes, or commits', () => {
  const repo = fixture();
  try {
    repo.commit('Alice', 'alice@example.com', 'feat: initial');
    repo.git('tag', 'v1.0.0');

    writeFileSync(path.join(repo.cwd, 'CHANGELOG.md'), '## [Unreleased]\n\n- Added feature X\n');
    repo.git('add', 'CHANGELOG.md');
    repo.git('commit', '--quiet', '-m', 'docs: update changelog');
    repo.commit('Alice', 'alice@example.com', 'feat: ship X');
    repo.git('tag', 'v1.0.1');

    const withUnreleased = resolveReleaseChangelog({
      tagName: 'v1.0.1',
      changelogText: '## [Unreleased]\n\n- Added feature X\n\n## [1.0.0]\n\n- Initial',
      cwd: repo.cwd,
    });
    assert.equal(withUnreleased, '- Added feature X');

    repo.commit('Alice', 'alice@example.com', 'fix: hotfix without changelog');
    repo.git('tag', 'v1.0.2');

    const fromCommits = resolveReleaseChangelog({
      tagName: 'v1.0.2',
      changelogText: '## [Unreleased]\n\n- Added feature X\n\n## [1.0.0]\n\n- Initial',
      cwd: repo.cwd,
    });
    assert.match(fromCommits, /^- fix: hotfix without changelog \(`[0-9a-f]+`\)/m);
    assert.match(fromCommits, /compare\/v1\.0\.1\.\.\.v1\.0\.2$/);
    assert.equal(extractUnreleasedChangelog('## [Unreleased]\n\n- A\n\n## [1.0.0]\n\n- B'), '- A');
    assert.equal(collectReleaseCommits('v1.0.2', repo.cwd).commits.length, 1);
  } finally {
    repo.close();
  }
});

test('github contributor resolution links avatars and deduplicates', async () => {
  const repo = fixture();
  try {
    repo.commit('Old User', 'old@example.com');
    repo.git('tag', 'v1.0.0');
    repo.commit('the-long-ride', 'personal@example.com', 'feat: one');
    repo.commit('Thế Long', '73347418+the-long-ride@users.noreply.github.com', 'feat: two');
    repo.git('tag', 'v1.0.1');

    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        commits: [
          {
            sha: repo.git('rev-parse', 'v1.0.1~1'),
            author: {
              login: 'the-long-ride',
              type: 'User',
              avatar_url: 'https://avatars.githubusercontent.com/u/73347418?v=4',
            },
            commit: { author: { email: 'personal@example.com' } },
          },
        ],
      }),
    });

    const contributors = await resolveGitHubContributors('v1.0.1', repo.cwd, {
      fetchImpl: mockFetch,
      repoSlug: 'the-long-ride/markdown-them',
    });
    assert.deepEqual(contributors, [
      {
        name: 'Thế Long',
        login: 'the-long-ride',
        avatarUrl: 'https://avatars.githubusercontent.com/u/73347418?v=4',
      },
    ]);
    assert.equal(
      formatContributors(contributors),
      '### Contributors\n\n<a href="https://github.com/the-long-ride"><img src="https://avatars.githubusercontent.com/u/73347418?v=4&amp;s=80" width="40" height="40" alt="@the-long-ride" title="@the-long-ride" /></a>',
    );
  } finally {
    repo.close();
  }
});
