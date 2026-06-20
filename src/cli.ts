#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_DIR, DEFAULT_STATUS, STATUSES, type AdrStatus } from "@/lib/adr";
import { runNew } from "@/commands/new";
import { runView } from "@/commands/view";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

function toInt(label: string) {
  return (value: string): number => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`${label} must be a positive integer (got "${value}")`);
    }
    return n;
  };
}

function toStatus(value: string): AdrStatus {
  if (!STATUSES.includes(value as AdrStatus)) {
    throw new Error(`--status must be one of: ${STATUSES.join(", ")} (got "${value}")`);
  }
  return value as AdrStatus;
}

const program = new Command();

program
  .name("adrin")
  .description("Architecture Decision Record (ADR) manager")
  .version(version)
  .option("-d, --dir <dir>", "ADR directory", DEFAULT_DIR);

program
  .command("new")
  .description("Create a new ADR with an auto-incremented number")
  .argument("<title>", "title of the ADR")
  .option(
    "-s, --status <status>",
    `initial status (${STATUSES.join(" | ")})`,
    toStatus,
    DEFAULT_STATUS,
  )
  .option("-r, --replaces <number>", "number of the ADR this one replaces", toInt("--replaces"))
  .option("--supersedes <number>", "alias for --replaces", toInt("--supersedes"))
  .option("-d, --dir <dir>", "ADR directory")
  .action(
    async (
      title: string,
      opts: { replaces?: number; supersedes?: number; status: AdrStatus; dir?: string },
      cmd,
    ) => {
      const dir = opts.dir ?? cmd.optsWithGlobals().dir ?? DEFAULT_DIR;
      await runNew(title, {
        dir,
        supersedes: opts.replaces ?? opts.supersedes,
        status: opts.status,
      });
    },
  );

program
  .command("view")
  .description("Browse ADRs in a TUI, or print a single entry by number")
  .argument("[number]", "view a specific ADR entry by number", toInt("number"))
  .option("-d, --dir <dir>", "ADR directory")
  .action(async (entry: number | undefined, opts: { dir?: string }, cmd) => {
    const dir = opts.dir ?? cmd.optsWithGlobals().dir ?? DEFAULT_DIR;
    await runView({ dir, entry });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
