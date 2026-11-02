---
schema_version: 1
id: "feature.web-app"
title: "Web standalone application"
kind: "feature"
status: "verified"
summary: "Standalone browser build with local dev server, SSE live reload, CSP compliance, and in-browser conversion."
tags: ["web", "browser", "esbuild", "dev-server", "local-first"]
source_paths: ["scripts/build-apps.mjs", "scripts/start-web.mjs", "src/app/browser-converter.ts", "src/app/main.tsx"]
related_specs: ["architecture.overview", "feature.desktop-app"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:cf8419d4d4bfc030882fe6fb40de8923687bfa1f83aa4576974ea670c71bf000"
---

# Web standalone application

## Purpose and boundaries
Provides a standalone browser deployment of Markdown Them that can be hosted statically (e.g. GitHub Pages) or served locally. Users can drag-and-drop documents into the browser or type formatted text directly, converting documents purely within the client's memory with zero server dependencies.

## Observable behavior
- **Local Dev Server**: `npm run start:web` starts a development HTTP server with Server-Sent Events (SSE) live reloads on file changes.
- **CSP Compliance**: Emits an external `dev-reload.js` script to satisfy strict Content Security Policies (`script-src 'self'`) without inline script hashes.
- **Client Conversion**: Uses the browser runtime to execute in-memory conversion across DOCX, XLSX, PPTX, ODF, RTF, HTML, and PDF.
- **Dynamic PDF.js Worker Resolution**: Dynamically resolves and copies `pdf.worker.min.mjs` across `pnpm`, `npm`, and `yarn` virtual-store layouts.

## Workflow
1. Builder bundles `src/app/main.tsx` into `dist/web/assets/app.js` using esbuild with browser target flags.
2. HTML template and static assets (`favicon`, `robots.txt`, `site.webmanifest`) are copied to `dist/web/`.
3. `pdf.worker.min.mjs` is located via `officeparser` require context and staged into `dist/web/assets/`.
4. Browser runtime loads application and routes document conversion to `browser-converter.ts`.

## Code map
- `src/app/main.tsx` — React entry point mounting the web application into root DOM
- `src/app/browser-converter.ts` — client-side conversion engine mapping files to core parsers
- `scripts/build-apps.mjs` — production and web app bundler script
- `scripts/start-web.mjs` — local development server with file watching and SSE reload stream

## Interfaces and data
- `startServer(port?: number): Promise<ServerHandle>`
- `buildWeb(outDir: string, clean?: boolean): Promise<void>`
- `convertInBrowser(file: File): Promise<string>`

## Verification
- Web build test: `npm run build:web` succeeds with code 0.
- Dev server lifecycle test: Verified clean startup, asset copying, build pipeline, and graceful teardown.

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [Tauri Desktop Application](desktop-app.md)

## Known limitations and open questions
- Large binary files (e.g. >100MB PDFs or presentations) are subject to browser tab memory limits.
