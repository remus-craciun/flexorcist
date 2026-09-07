type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    return /[\s=]/.test(value) ? `"${value}"` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) return value.message;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return `{ ${entries.map(([k, v]) => `${k}=${formatValue(v)}`).join(" ")} }`;
  }
  return String(value);
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const extras = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join("  ");

  const line = extras
    ? `${timestamp()}  ${level.toUpperCase().padEnd(5)}  ${event}  ${extras}`
    : `${timestamp()}  ${level.toUpperCase().padEnd(5)}  ${event}`;

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
