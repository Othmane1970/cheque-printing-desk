/** The message a failed server call carries, for the page to show. */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    // A validation failure arrives as zod's JSON list of issues.
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // Not JSON: a plain message.
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** A stored UTC timestamp ("2026-11-19 10:04:00") as "19/11/2026 10:04 UTC". */
export function formatTimestamp(ts: string): string {
  const [date, time = ""] = ts.split(" ");
  return `${formatDate(date!)} ${time.slice(0, 5)} UTC`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
