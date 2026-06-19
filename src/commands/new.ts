import chalk from "chalk";
import { createAdr, pad, type AdrStatus } from "@/lib/adr";
import { colorStatus } from "@/lib/status";

export interface NewOptions {
  dir: string;
  supersedes?: number;
  status?: AdrStatus;
}

export async function runNew(title: string, opts: NewOptions): Promise<void> {
  const { created, superseded } = await createAdr(opts.dir, title, {
    supersedes: opts.supersedes,
    status: opts.status,
  });

  console.log(
    `${chalk.green("✔")} Created ${chalk.bold(`ADR-${pad(created.number)}`)} ${chalk.dim(
      created.path,
    )} ${chalk.dim("[")}${colorStatus(created.data.status)}${chalk.dim("]")}`,
  );
  if (superseded) {
    console.log(
      `${chalk.yellow("↻")} ADR-${pad(superseded.number)} ${chalk.dim(
        `(${superseded.data.title})`,
      )} marked ${chalk.bold("superseded")}, superseded by ${pad(created.number)}`,
    );
  }
}
