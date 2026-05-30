import * as esbuild from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "all";
const production =
  process.argv.includes("--production") ||
  (process.env.NODE_ENV ? process.env.NODE_ENV === "production" : !process.argv.includes("--development"));

if (!["all", "web", "desktop"].includes(target)) {
  throw new Error(`Unknown build target: ${target}`);
}

if (target === "web" || target === "all") {
  await buildWeb(path.join(rootDir, "dist", "web"));
}

if (target === "desktop" || target === "all") {
  await buildDesktop();
}

async function buildDesktop() {
  const desktopDir = path.join(rootDir, "dist", "desktop");
  await rm(desktopDir, { recursive: true, force: true });
  await mkdir(desktopDir, { recursive: true });
  await buildWeb(path.join(desktopDir, "web"), false);

  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "electron", "main.ts")],
    bundle: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
    },
    external: ["electron"],
    format: "cjs",
    legalComments: "none",
    minify: production,
    outfile: path.join(desktopDir, "main.js"),
    platform: "node",
    sourcemap: !production,
    target: "node20",
  });

  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "electron", "preload.ts")],
    bundle: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
    },
    external: ["electron"],
    format: "cjs",
    legalComments: "none",
    minify: production,
    outfile: path.join(desktopDir, "preload.js"),
    platform: "node",
    sourcemap: !production,
    target: "node20",
  });
}

async function buildWeb(outDir, clean = true) {
  if (clean) {
    await rm(outDir, { recursive: true, force: true });
  }

  const assetsDir = path.join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });
  await copyFile(path.join(rootDir, "src", "app", "index.html"), path.join(outDir, "index.html"));
  await copyFile(path.join(rootDir, "assets", "markdown-them-logo.png"), path.join(assetsDir, "markdown-them-logo.png"));
  await copyFile(
    path.join(rootDir, "node_modules", "officeparser", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
    path.join(assetsDir, "pdf.worker.min.mjs"),
  );

  await esbuild.build({
    bundle: true,
    conditions: ["browser"],
    define: {
      "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
    },
    entryPoints: [path.join(rootDir, "src", "app", "main.tsx")],
    format: "iife",
    jsx: "automatic",
    legalComments: "none",
    mainFields: ["browser", "module", "main"],
    minify: production,
    outfile: path.join(assetsDir, "app.js"),
    platform: "browser",
    sourcemap: !production,
    target: ["chrome120", "edge120", "firefox120", "safari17"],
  });
}
