/**
 * Minimal Chrome DevTools Protocol client: one headless Chrome, one page,
 * evaluate / screenshot / printToPDF. No dependencies (Node's WebSocket).
 *
 * Chrome is started with SwiftShader so WebGL renders the same with or
 * without a GPU. Override the binary with $CHROME.
 */
import { spawn, type ChildProcess } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

export interface Browser {
  send: (method: string, params?: Record<string, unknown>) => Promise<any>;
  navigate: (url: string) => Promise<void>;
  evaluate: <T = unknown>(expression: string) => Promise<T>;
  setViewport: (width: number, height: number, scale?: number) => Promise<void>;
  printToPdf: (url: string) => Promise<Buffer>;
  close: () => Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser(): Promise<Browser> {
  const bin = process.env.CHROME ?? "google-chrome";
  const profile = mkdtempSync(join(tmpdir(), "uhd-docs-chrome-"));
  const proc: ChildProcess = spawn(
    bin,
    [
      "--headless=new",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--font-render-hinting=none",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await sleep(50);
  if (!existsSync(portFile)) throw new Error(`Chrome did not start (${bin})`);
  await sleep(50);
  const [port, path] = readFileSync(portFile, "utf8").trim().split("\n");

  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise<void>((ok, fail) => {
    ws.onopen = () => ok();
    ws.onerror = () => fail(new Error("CDP connection failed"));
  });
  let nextId = 1;
  const pending = new Map<number, Pending>();
  const listeners: ((msg: any) => void)[] = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
      else p.resolve(msg.result);
    } else for (const l of listeners) l(msg);
  };
  const raw = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<any>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
  const send = (method: string, params: Record<string, unknown> = {}) => raw(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");

  const consoleLines: string[] = [];
  listeners.push((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map((a: any) => a.value ?? a.description ?? "").join(" ");
      if (process.env.DOCS_DEBUG) console.log(`  [page] ${text}`);
      consoleLines.push(text);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.error(`  [page error] ${msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text}`);
    }
  });

  const navigate = async (url: string) => {
    const loaded = new Promise<void>((ok) => {
      const l = (msg: any) => {
        if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") {
          listeners.splice(listeners.indexOf(l), 1);
          ok();
        }
      };
      listeners.push(l);
    });
    await send("Page.navigate", { url });
    await loaded;
  };

  const evaluate = async <T>(expression: string): Promise<T> => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    }
    return r.result.value as T;
  };

  const setViewport = (width: number, height: number, scale = 1) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });

  const printToPdf = async (url: string) => {
    await send("Emulation.clearDeviceMetricsOverride");
    await navigate(url);
    await evaluate("document.fonts.ready.then(() => true)");
    await evaluate(
      "Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))",
    );
    const { data } = await send("Page.printToPDF", {
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
    });
    return Buffer.from(data, "base64");
  };

  const close = async () => {
    try {
      await raw("Browser.close");
    } catch {
      /* already gone */
    }
    ws.close();
    proc.kill();
    await sleep(100);
    rmSync(profile, { recursive: true, force: true });
  };

  return { send, navigate, evaluate, setViewport, printToPdf, close };
}
