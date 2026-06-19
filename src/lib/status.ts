import chalk from "chalk";
import type { AdrStatus } from "@/lib/adr";

/** Color name per status — valid for both ink (`<Text color>`) and chalk. */
export const STATUS_COLOR: Record<AdrStatus, string> = {
  accepted: "green",
  processing: "cyan",
  deferred: "yellow",
  superseded: "red",
};

/** Return the status string painted in its status color (for chalk output). */
export function colorStatus(status: string): string {
  const name = STATUS_COLOR[status as AdrStatus] ?? "white";
  const paint = (chalk as unknown as Record<string, (s: string) => string>)[name];
  return paint ? paint(status) : status;
}
