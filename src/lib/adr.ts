import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const DEFAULT_DIR = "docs/adr";

export type AdrStatus = "accepted" | "processing" | "deferred" | "superseded";

export interface AdrFrontmatter {
  title: string;
  date: string;
  status: AdrStatus;
  supersedes?: number;
  superseded_by?: number;
  [key: string]: unknown;
}

export interface Adr {
  number: number;
  file: string;
  path: string;
  data: AdrFrontmatter;
  body: string;
}

const FILE_RE = /^(\d{4})-.*\.md$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "adr"
  );
}

export function pad(n: number): string {
  return String(n).padStart(4, "0");
}

/** Resolve the ADR directory (creating it if it doesn't exist). */
export async function ensureDir(dir: string): Promise<string> {
  const resolved = path.resolve(dir);
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

/** List all ADRs in `dir`, sorted by number ascending. */
export async function listAdrs(dir: string): Promise<Adr[]> {
  const resolved = path.resolve(dir);
  let entries: string[];
  try {
    entries = await fs.readdir(resolved);
  } catch {
    return [];
  }

  const adrs: Adr[] = [];
  for (const file of entries) {
    const m = FILE_RE.exec(file);
    if (!m) continue;
    const full = path.join(resolved, file);
    const raw = await fs.readFile(full, "utf8");
    const parsed = matter(raw);
    adrs.push({
      number: Number(m[1]),
      file,
      path: full,
      data: normalize(parsed.data, file),
      body: parsed.content.replace(/^\n+/, ""),
    });
  }
  adrs.sort((a, b) => a.number - b.number);
  return adrs;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  return "";
}

function normalize(data: Record<string, unknown>, file: string): AdrFrontmatter {
  // Spread first, then override the known keys so a YAML-parsed Date (or a
  // non-string title/status) can't clobber the normalized values.
  return {
    ...data,
    title: typeof data.title === "string" ? data.title : file.replace(/\.md$/, ""),
    date: toDateString(data.date),
    status: (data.status as AdrStatus) ?? "accepted",
  } as AdrFrontmatter;
}

export async function findAdr(dir: string, number: number): Promise<Adr | undefined> {
  const adrs = await listAdrs(dir);
  return adrs.find((a) => a.number === number);
}

export async function nextNumber(dir: string): Promise<number> {
  const adrs = await listAdrs(dir);
  return adrs.length === 0 ? 1 : adrs[adrs.length - 1].number + 1;
}

/** Serialize frontmatter in a stable, human-friendly key order. */
export function serialize(data: AdrFrontmatter, body: string): string {
  const ordered: AdrFrontmatter = {
    title: data.title,
    date: data.date,
    status: data.status,
  };
  if (data.supersedes != null) ordered.supersedes = data.supersedes;
  if (data.superseded_by != null) ordered.superseded_by = data.superseded_by;
  // preserve any extra custom keys
  for (const [k, v] of Object.entries(data)) {
    if (!(k in ordered) && v != null) ordered[k] = v;
  }
  return matter.stringify(`\n${body.trim()}\n`, ordered);
}

function template(): string {
  return "Formulate this ADR as a Y-statement — see https://medium.com/olzzio/y-statements-10eb07b5a177";
}

export const STATUSES: readonly AdrStatus[] = ["accepted", "processing", "deferred", "superseded"];

export const DEFAULT_STATUS: AdrStatus = "processing";

export interface CreateOptions {
  supersedes?: number;
  status?: AdrStatus;
}

export interface CreateResult {
  created: Adr;
  superseded?: Adr;
}

/**
 * Create a new ADR. When `supersedes` is given, the new ADR records it and the
 * superseded ADR is mutated to reference the new one and flipped to `superseded`.
 */
export async function createAdr(
  dir: string,
  title: string,
  options: CreateOptions = {},
): Promise<CreateResult> {
  const { supersedes, status = DEFAULT_STATUS } = options;
  const resolved = await ensureDir(dir);

  let supersededAdr: Adr | undefined;
  if (supersedes != null) {
    supersededAdr = await findAdr(resolved, supersedes);
    if (!supersededAdr) {
      throw new Error(`Cannot supersede ADR ${pad(supersedes)}: it does not exist in ${dir}`);
    }
  }

  const number = await nextNumber(resolved);
  const date = today();
  const data: AdrFrontmatter = {
    title,
    date,
    status,
    ...(supersedes != null ? { supersedes } : {}),
  };
  const file = `${pad(number)}-${slugify(title)}.md`;
  const full = path.join(resolved, file);
  await fs.writeFile(full, serialize(data, template()), "utf8");

  const created: Adr = { number, file, path: full, data, body: template() };

  if (supersededAdr) {
    const note = `> **Superseded by [ADR-${pad(number)}](${file})** on ${date}.`;
    const alreadyNoted = supersededAdr.body.includes(`ADR-${pad(number)}`);
    const newBody = alreadyNoted ? supersededAdr.body : `${note}\n\n${supersededAdr.body}`;
    const newData: AdrFrontmatter = {
      ...supersededAdr.data,
      status: "superseded",
      superseded_by: number,
    };
    await fs.writeFile(supersededAdr.path, serialize(newData, newBody), "utf8");
    supersededAdr = { ...supersededAdr, data: newData, body: newBody };
  }

  return { created, superseded: supersededAdr };
}
