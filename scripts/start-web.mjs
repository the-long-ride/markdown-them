import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(rootDir, "dist", "web");
const port = Number(process.env.PORT || 5173);

await run(process.execPath, [path.join(rootDir, "scripts", "build-apps.mjs"), "web"], {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "development",
});

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const filePath = path.resolve(webDir, requestedPath === "/" ? "index.html" : `.${requestedPath}`);

    if (!filePath.startsWith(webDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentType(filePath),
    });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.log(`Markdown Them web app: http://127.0.0.1:${port}`);
    process.exit(0);
  }

  throw error;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Markdown Them web app: http://127.0.0.1:${port}`);
});

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
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

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".css":
      return "text/css;charset=utf-8";
    case ".js":
      return "text/javascript;charset=utf-8";
    case ".mjs":
      return "text/javascript;charset=utf-8";
    case ".png":
      return "image/png";
    case ".html":
      return "text/html;charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
