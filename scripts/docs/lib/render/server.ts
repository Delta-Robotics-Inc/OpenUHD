/**
 * Tiny static file server for the doc renderer and the print step.
 *
 *   /repo/<path>    files from the UHD checkout (GLBs, generated docs)
 *   /three/<path>   the three.js package (see resolveThree)
 *   /page/<path>    the render page (scripts/docs/lib/render/page)
 *
 * Bound to 127.0.0.1 on a random port; closed when the build finishes.
 */
import { createServer, type Server } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import { extname, join, normalize, resolve } from "path";
import { fileURLToPath } from "url";

export const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const PAGE_DIR = fileURLToPath(new URL("./page/", import.meta.url));

/**
 * three.js is not a UHD dependency. Use, in order: $UHD_THREE_DIR, the UHD
 * checkout's node_modules, then the sibling uhd-viewer checkout's.
 */
export function resolveThree(): string {
  const candidates = [
    process.env.UHD_THREE_DIR,
    join(REPO_ROOT, "node_modules/three"),
    join(REPO_ROOT, "../uhd-viewer/node_modules/three"),
  ].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(join(c, "build/three.module.js"))) return c;
  throw new Error(
    `three.js not found. Set UHD_THREE_DIR to a three@>=0.160 package directory (tried: ${candidates.join(", ")}).`,
  );
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(): Promise<StaticServer> {
  const three = resolveThree();
  const roots: Record<string, string> = { repo: REPO_ROOT, three, page: PAGE_DIR };
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const [, mount, ...rest] = decodeURIComponent(url.pathname).split("/");
    const root = roots[mount];
    const file = root && normalize(join(root, ...rest));
    if (!root || !file || !file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}
