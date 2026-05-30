import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production");

await run(process.execPath, [path.join(rootDir, "scripts", "build-apps.mjs"), "desktop"], {
  ...process.env,
  NODE_ENV: production ? "production" : "development",
});

const electronBin = process.platform === "win32"
  ? path.join(rootDir, "node_modules", ".bin", "electron.cmd")
  : path.join(rootDir, "node_modules", ".bin", "electron");

await run(electronBin, [path.join(rootDir, "dist", "desktop", "main.js")], {
  ...process.env,
  NODE_ENV: production ? "production" : "development",
});

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      shell: process.platform === "win32",
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
