import chalk from "chalk";
import { pad, type Adr } from "@/lib/adr";
import { colorStatus } from "@/lib/status";

/** Drop a leading "> **Superseded by ...**" note from the body (shown in the header instead). */
function stripSupersededNote(body: string): string {
  return body.replace(/^>\s*\*\*Superseded by[^\n]*\n+/, "");
}

/**
 * Render a single ADR for display: a header (title, date, status with an
 * optional supersession note) followed by a rule and the rendered body.
 */
export function renderAdr(adr: Adr, all: Adr[] = []): string {
  const d = adr.data;
  const header: string[] = [];
  header.push(`${chalk.bold(`"${d.title}"`)}${chalk.dim(` ${d.date}`)}`);

  let statusLine = `status: ${colorStatus(d.status)}`;
  if (d.status === "superseded" && d.superseded_by != null) {
    const by = all.find((a) => a.number === d.superseded_by);
    const onDate = by?.data.date ?? "";
    statusLine += chalk.dim(` (Superseded by ${pad(d.superseded_by)} on ${onDate})`);
  }
  header.push(statusLine);
  header.push(chalk.dim("─".repeat(40)));

  return `${header.join("\n")}\n${renderMarkdown(stripSupersededNote(adr.body))}`;
}

/**
 * Wrap text in an OSC 8 hyperlink escape so terminals that support it make the
 * label clickable while still showing the styled label inline.
 */
function hyperlink(label: string, url: string): string {
  const styled = chalk.blue.underline(label);
  return `\x1b]8;;${url}\x07${styled}\x1b]8;;\x07`;
}

/**
 * Apply inline markdown styling: images, links, autolinked URLs, bold, italic,
 * and inline code. Links and images become clickable terminal hyperlinks.
 */
function inline(text: string): string {
  return text
    .replace(/\[!\[([^\]]*)\]\([^)]*\)\]\(([^)\s]+)[^)]*\)/g, (_m, alt, url) =>
      hyperlink(alt || url, url),
    )
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_m, alt, url) => hyperlink(alt || url, url))
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, label, url) => hyperlink(label, url))
    .replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, (_m, pre, url) => `${pre}${hyperlink(url, url)}`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, s) => chalk.bold(s))
    .replace(/`([^`]+)`/g, (_m, s) => chalk.cyan(s))
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, (_m, pre, s) => `${pre}${chalk.italic(s)}`)
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, (_m, pre, s) => `${pre}${chalk.italic(s)}`);
}

/**
 * Render a markdown ADR (frontmatter + body) into an ANSI-styled string.
 * Intentionally small: handles headings, lists, blockquotes, code fences,
 * horizontal rules, the YAML frontmatter block, and inline styling.
 */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inFrontmatter = false;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "---" && i === 0) {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") {
        inFrontmatter = false;
        out.push("");
        continue;
      }
      const m = /^(\s*[\w-]+):\s*(.*)$/.exec(line);
      if (m) out.push(`${chalk.dim(m[1] + ":")} ${chalk.yellow(m[2])}`);
      else out.push(chalk.dim(line));
      continue;
    }

    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      out.push(chalk.dim(line));
      continue;
    }
    if (inCode) {
      out.push(chalk.dim(line));
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = inline(heading[2]);
      out.push(level <= 2 ? chalk.bold.underline(text) : chalk.bold(text));
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push(chalk.dim("─".repeat(40)));
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(`${bullet[1]}${chalk.cyan("•")} ${inline(bullet[2])}`);
      continue;
    }

    if (/^\s*>/.test(line)) {
      out.push(chalk.dim("│ ") + chalk.italic(inline(line.replace(/^\s*>\s?/, ""))));
      continue;
    }

    out.push(inline(line));
  }

  return out.join("\n");
}
