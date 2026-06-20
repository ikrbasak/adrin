import { render } from "ink";
import type { Adr } from "@/lib/adr";
import { App } from "@/tui/App";

/** Clear the visible screen, the scrollback, and home the cursor. */
const CLEAR = "\x1b[2J\x1b[3J\x1b[H";
/** Enable mouse button + wheel reporting (SGR mode) so we can scroll content. */
const MOUSE_ON = "\x1b[?1000h\x1b[?1006h";
/** Disable mouse reporting again. */
const MOUSE_OFF = "\x1b[?1000l\x1b[?1006l";

export async function runTui(adrs: Adr[]): Promise<void> {
  process.stdout.write(CLEAR);
  process.stdout.write(MOUSE_ON);
  const { waitUntilExit } = render(<App adrs={adrs} />);
  try {
    await waitUntilExit();
  } finally {
    process.stdout.write(MOUSE_OFF);
    process.stdout.write(CLEAR);
  }
}
