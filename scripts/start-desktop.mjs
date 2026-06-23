import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./start-web.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production");
let webServer;

// 1. Build desktop assets (this compiles main.ts and preload.ts to dist/desktop/)
await run(process.execPath, [path.join(rootDir, "scripts", "build-apps.mjs"), "desktop"], {
  ...process.env,
  NODE_ENV: production ? "production" : "development",
}, false);

// 2. Start the dev server in development mode
if (!production) {
  try {
    webServer = await startServer();
  } catch (err) {
    console.error("Failed to start dev server for Electron:", err);
    process.exit(1);
  }
}

// 3. Launch Electron
const electronBin = process.platform === "win32"
  ? path.join(rootDir, "node_modules", ".bin", "electron.cmd")
  : path.join(rootDir, "node_modules", ".bin", "electron");

try {
  await run(electronBin, [path.join(rootDir, "dist", "desktop", "main.js")], {
    ...process.env,
    NODE_ENV: production ? "production" : "development",
    PORT: webServer ? String(webServer.port) : "5173",
  }, process.platform === "win32");
} finally {
  if (webServer?.owned) {
    await webServer.close();
  }

  if (!production) {
    process.exit(0);
  }
}

function run(command, args, env, useShell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      shell: useShell,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited with code ${code}`));
      }
    });
  });
}
