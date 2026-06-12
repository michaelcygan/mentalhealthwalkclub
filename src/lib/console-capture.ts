// Lightweight ring buffer for recent console errors/warnings so error reports
// can include a small diagnostic tail. Browser-only.
export interface ConsoleEntry {
  level: "error" | "warn";
  message: string;
  at: string; // ISO
}

const BUFFER: ConsoleEntry[] = [];
const MAX = 20;
let installed = false;

function push(level: "error" | "warn", args: unknown[]) {
  try {
    const message = args
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(" ")
      .slice(0, 1000);
    BUFFER.push({ level, message, at: new Date().toISOString() });
    if (BUFFER.length > MAX) BUFFER.shift();
  } catch {
    // never throw from a console hook
  }
}

export function installConsoleCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => { push("error", args); origErr(...(args as [])); };
  console.warn = (...args: unknown[]) => { push("warn", args); origWarn(...(args as [])); };
  window.addEventListener("error", (e) => push("error", [e.message, e.filename, e.lineno]));
  window.addEventListener("unhandledrejection", (e) => push("error", ["unhandledrejection", (e as PromiseRejectionEvent).reason]));
}

export function getConsoleTail(): ConsoleEntry[] {
  return BUFFER.slice(-MAX);
}
