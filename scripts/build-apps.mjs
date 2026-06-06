import * as esbuild from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "all";
const production =
  process.argv.includes("--production") ||
  (process.env.NODE_ENV ? process.env.NODE_ENV === "production" : !process.argv.includes("--development"));
const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf-8"));
const appVersion = String(packageJson.version || "0.0.0");
const sharedDefine = {
  MARKDOWN_THEM_VERSION: JSON.stringify(appVersion),
  "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
};

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
    define: sharedDefine,
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
    define: sharedDefine,
    external: ["electron"],
    format: "cjs",
    legalComments: "none",
    minify: production,
    outfile: path.join(desktopDir, "preload.js"),
    platform: "node",
    sourcemap: !production,
    target: "node20",
  });

  await writeDesktopPackageJson(desktopDir);
}

async function writeDesktopPackageJson(desktopDir) {
  const desktopPackageJson = {
    name: packageJson.name,
    productName: packageJson.displayName || packageJson.name,
    version: appVersion,
    description: packageJson.description,
    main: "main.js",
    author: packageJson.author || "the-long-ride <thelong1406@gmail.com>",
    license: packageJson.license,
    dependencies: {},
  };

  await writeFile(path.join(desktopDir, "package.json"), `${JSON.stringify(desktopPackageJson, null, 2)}\n`);
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
    define: sharedDefine,
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
