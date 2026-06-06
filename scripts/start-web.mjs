import { createServer } from "node:http";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(rootDir, "dist", "web");
const defaultPort = Number(process.env.PORT || 5173);
const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf-8"));
const appVersion = String(packageJson.version || "0.0.0");

const clients = [];
const noopServerHandle = {
  close: async () => undefined,
  owned: false,
  port: defaultPort,
};

function notifyClients() {
  console.log(`[Reload Server] Notifying ${clients.length} clients to reload...`);
  for (const client of clients) {
    client.write("data: reload\n\n");
  }
}

async function copyAssets() {
  await mkdir(path.join(webDir, "assets"), { recursive: true });

  let html = await readFile(path.join(rootDir, "src", "app", "index.html"), "utf-8");

  // Adjust CSP connect-src 'none' to connect-src 'self' to allow EventSource
  html = html.replace("connect-src 'none'", "connect-src 'self'");

  // Inject reload script before </body>
  const reloadScript = `
    <!-- Dev reload script -->
    <script>
      (function() {
        const esc = new EventSource('/reload');
        esc.onmessage = function(event) {
          if (event.data === 'reload') {
            console.log('[Dev Reload] File change detected, reloading...');
            window.location.reload();
          }
        };
        esc.onerror = function() {
          console.warn('[Dev Reload] Reload connection lost. Reconnecting...');
        };
      })();
    </script>
  `;
  html = html.replace("</body>", `${reloadScript}</body>`);

  await writeFile(path.join(webDir, "index.html"), html, "utf-8");

  // Copy logo
  await copyFile(
    path.join(rootDir, "assets", "markdown-them-logo.png"),
    path.join(webDir, "assets", "markdown-them-logo.png")
  );

  // Copy worker
  await copyFile(
    path.join(rootDir, "node_modules", "officeparser", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
    path.join(webDir, "assets", "pdf.worker.min.mjs")
  );
}

export async function startServer(port = defaultPort) {
  console.log("[Dev Server] Starting build and watcher...");

  if (!(await canListen(port))) {
    console.log(`Markdown Them web app port ${port} is already in use.`);
    return { ...noopServerHandle, port };
  }

  await copyAssets();

  const ctx = await esbuild.context({
    bundle: true,
    conditions: ["browser"],
    define: {
      MARKDOWN_THEM_VERSION: JSON.stringify(appVersion),
      "process.env.NODE_ENV": JSON.stringify("development"),
    },
    entryPoints: [path.join(rootDir, "src", "app", "main.tsx")],
    format: "iife",
    jsx: "automatic",
    legalComments: "none",
    mainFields: ["browser", "module", "main"],
    minify: false,
    outfile: path.join(webDir, "assets", "app.js"),
    platform: "browser",
    sourcemap: true,
    target: ["chrome120", "edge120", "firefox120", "safari17"],
    plugins: [
      {
        name: "rebuild-notify",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0) {
              console.error("[Dev Server] Build failed:", result.errors);
              return;
            }
            console.log("[Dev Server] Build succeeded. Updating assets and reloading...");
            try {
              await copyAssets();
              notifyClients();
            } catch (err) {
              console.error("[Dev Server] Failed to update assets or notify:", err);
            }
          });
        },
      },
    ],
  });

  await ctx.watch();

  const templateWatcher = watch(path.join(rootDir, "src", "app", "index.html"), async (eventType) => {
    if (eventType === "change") {
      console.log("[Dev Server] index.html template changed. Re-copying and reloading...");
      try {
        await copyAssets();
        notifyClients();
      } catch (err) {
        console.error("[Dev Server] Failed to copy index.html:", err);
      }
    }
  });

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);
      const requestedPath = decodeURIComponent(requestUrl.pathname);

      // Server-Sent Events endpoint for reloading
      if (requestedPath === "/reload") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });
        response.write("\n");
        clients.push(response);

        request.on("close", () => {
          const index = clients.indexOf(response);
          if (index !== -1) {
            clients.splice(index, 1);
          }
        });
        return;
      }

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

  try {
    await listen(server, port);
  } catch (err) {
    templateWatcher.close();
    await ctx.dispose();
    throw err;
  }

  console.log(`Markdown Them web app: http://127.0.0.1:${port}`);

  return {
    close: async () => {
      for (const client of clients.splice(0)) {
        client.end();
      }
      templateWatcher.close();
      await ctx.dispose();
      await closeServer(server);
    },
    owned: true,
    port,
  };
}

function canListen(port) {
  const probe = createServer();

  return new Promise((resolve) => {
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, "127.0.0.1");
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
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

// If run directly
const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(scriptPath) ||
  path.basename(process.argv[1]) === "start-web.mjs"
);

if (isDirectRun) {
  try {
    await startServer();
  } catch (err) {
    console.error("Failed to start development server:", err);
    process.exit(1);
  }
}
