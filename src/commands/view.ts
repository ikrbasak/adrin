import chalk from "chalk";
import { listAdrs, pad } from "@/lib/adr";
import { renderAdr } from "@/lib/render";
import { colorStatus } from "@/lib/status";

export interface ViewOptions {
  dir: string;
  entry?: number;
}

export async function runView(opts: ViewOptions): Promise<void> {
  const adrs = await listAdrs(opts.dir);

  if (opts.entry != null) {
    const adr = adrs.find((a) => a.number === opts.entry);
    if (!adr) {
      console.error(chalk.red(`ADR-${pad(opts.entry)} not found in ${opts.dir}`));
      process.exitCode = 1;
      return;
    }
    console.log(renderAdr(adr, adrs));
    return;
  }

  if (adrs.length === 0) {
    console.log(chalk.dim(`No ADRs found in ${opts.dir}. Create one with: adrin new "<title>"`));
    return;
  }

  // Non-interactive (piped / no TTY): print a plain list instead of the TUI.
  if (!process.stdout.isTTY) {
    for (const adr of adrs) {
      const status = adr.data.status;
      const gap = " ".repeat(Math.max(1, 12 - status.length));
      console.log(`${pad(adr.number)}  ${colorStatus(status)}${gap}${adr.data.title}`);
    }
    return;
  }

  const { runTui } = await import("@/tui/run");
  await runTui(adrs, opts.dir);
}
