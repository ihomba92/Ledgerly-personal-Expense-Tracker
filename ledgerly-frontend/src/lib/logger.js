// Browser-side logging.
//   Development: every API call and every warning/error is printed to the browser console (F12 → Console).
//   Production:  only warnings and errors.
// Secrets (tokens, passwords, codes) are removed before anything is printed.
const DEV = import.meta.env.DEV;

const REDACT = [
  [/(token|code|password|access_token)(["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, "$1$2[redacted]"],
  [/Bearer\s+[\w\-.]+/gi, "Bearer [redacted]"],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt redacted]"],
];
export const redact = (text) => REDACT.reduce((t, [re, rep]) => t.replace(re, rep), String(text));

const style = { debug: "color:#8A8F8A", info: "color:#2D5A43", warn: "color:#97472c", error: "color:#ba1a1a;font-weight:bold" };

function write(level, message, details) {
  if (!DEV && (level === "debug" || level === "info")) return;
  const line = `%c[ledgerly] ${redact(message)}`;
  const method = level === "debug" ? "log" : level;
  if (details !== undefined) console[method](line, style[level], details);
  else console[method](line, style[level]);
}

export const logger = {
  debug: (m, d) => write("debug", m, d),
  info: (m, d) => write("info", m, d),
  warn: (m, d) => write("warn", m, d),
  error: (m, d) => write("error", m, d),
};
