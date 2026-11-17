import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync('src/app/index.html', 'utf8');
const sitemap = readFileSync('src/app/sitemap.xml', 'utf8');
const build = readFileSync('scripts/build-apps.mjs', 'utf8');

test('SEO: one canonical and matching sitemap URL, with no fragment-only routes', () => {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)" \/>/);
  assert.ok(canonical);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(urls, [canonical[1]]);
  assert.ok(urls.every((url) => !url.includes('#')));
});

test('SEO: valid, accurate WebApplication JSON-LD with build-time version', () => {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const schema = JSON.parse(match[1]);
  const application = schema['@graph'].find((entry) => entry['@type'] === 'WebApplication');
  assert.ok(application);
  assert.equal(application.softwareVersion, '__MARKDOWN_THEM_VERSION__');
  assert.equal(
    application.license,
    'https://github.com/the-long-ride/markdown-them/blob/main/LICENSE',
  );
  assert.ok(!schema['@graph'].some((entry) => entry['@type'] === 'FAQPage'));
  assert.match(build, /html\.replaceAll\('__MARKDOWN_THEM_VERSION__', appVersion\)/);
});

test('SEO: indexable metadata and social previews use the canonical origin', () => {
  assert.match(html, /<meta\s+name="description"/);
  assert.match(
    html,
    /<meta property="og:url" content="https:\/\/the-long-ride.github.io\/markdown-them\/"/,
  );
  assert.match(html, /<meta\s+name="twitter:card"/);
  assert.match(html, /<meta\s+name="robots"/);
});
