import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin, useStdout } from "ink";
import wrapAnsi from "wrap-ansi";
import type { Adr } from "@/lib/adr";
import { pad } from "@/lib/adr";
import { renderAdr } from "@/lib/render";
import { STATUS_COLOR } from "@/lib/status";

interface AppProps {
  adrs: Adr[];
}

type Focus = "list" | "content";

/** Fixed width of the left list pane (including its border and padding). */
const LIST_WIDTH = 36;

/** Truncate `text` to `width` columns, adding an ellipsis when shortened. */
function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

/** Wrap `text` in an OSC 8 file:// hyperlink so terminals open it on click. */
function fileLink(path: string, text: string): string {
  return `\x1b]8;;file://${path}\x07${text}\x1b]8;;\x07`;
}

export function App({ adrs }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { stdin } = useStdin();
  const [selected, setSelected] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [focus, setFocus] = useState<Focus>("list");

  const rows = stdout?.rows ?? 24;
  const columns = stdout?.columns ?? 80;
  // full height minus the footer line (1) and the pane's top+bottom borders (2)
  const viewport = Math.max(3, rows - 3);
  // terminal width minus the list pane (LIST_WIDTH) and the content pane's
  // borders (2) + horizontal padding (2)
  const contentWidth = Math.max(1, columns - LIST_WIDTH - 4);

  const current = adrs[selected];
  // Pre-wrap to the pane width so each entry is exactly one visual row; this
  // keeps the line-based scroll math in sync with what's actually drawn.
  const contentLines = useMemo(() => {
    if (!current) return [] as string[];
    return renderAdr(current, adrs)
      .split("\n")
      .flatMap((line) => wrapAnsi(line, contentWidth, { hard: true, trim: false }).split("\n"));
  }, [current, adrs, contentWidth]);

  const maxScroll = Math.max(0, contentLines.length - viewport);

  // Refs keep the stdin listener stable while still reading current values.
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const maxScrollRef = useRef(maxScroll);
  maxScrollRef.current = maxScroll;

  // Mouse wheel scrolls the content pane, or moves the selection when the list
  // is focused. SGR mouse reports arrive as "\x1b[<b;col;row(M|m)"; wheel up is
  // button 64, wheel down 65.
  useEffect(() => {
    if (!stdin) return;
    const WHEEL_STEP = 3;
    const onData = (data: Buffer) => {
      for (const m of data.toString().matchAll(/\x1b\[<(\d+);\d+;\d+[Mm]/g)) {
        const button = Number(m[1]);
        const up = button === 64;
        const down = button === 65;
        if (!up && !down) continue;
        if (focusRef.current === "list") {
          setScroll(0);
          if (up) setSelected((s) => Math.max(0, s - 1));
          else setSelected((s) => Math.min(adrs.length - 1, s + 1));
        } else {
          if (up) setScroll((s) => Math.max(0, s - WHEEL_STEP));
          else setScroll((s) => Math.min(maxScrollRef.current, s + WHEEL_STEP));
        }
      }
    };
    stdin.on("data", onData);
    return () => {
      stdin.off("data", onData);
    };
  }, [stdin, adrs.length]);

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }
    if (key.tab || key.leftArrow || key.rightArrow) {
      setFocus((f) => (f === "list" ? "content" : "list"));
      return;
    }

    if (focus === "list") {
      if (key.return) {
        setFocus("content");
      } else if (key.upArrow || input === "k") {
        setSelected((s) => Math.max(0, s - 1));
        setScroll(0);
      } else if (key.downArrow || input === "j") {
        setSelected((s) => Math.min(adrs.length - 1, s + 1));
        setScroll(0);
      }
    } else {
      if (key.escape) setFocus("list");
      else if (key.upArrow || input === "k") setScroll((s) => Math.max(0, s - 1));
      else if (key.downArrow || input === "j") setScroll((s) => Math.min(maxScroll, s + 1));
      else if (input === " " || key.pageDown) setScroll((s) => Math.min(maxScroll, s + viewport));
      else if (key.pageUp) setScroll((s) => Math.max(0, s - viewport));
    }
  });

  const visible = contentLines.slice(scroll, scroll + viewport);

  return (
    <Box flexDirection="column" height={rows}>
      <Box flexGrow={1} minHeight={0}>
        {/* Left: list */}
        <Box
          flexDirection="column"
          width={LIST_WIDTH}
          flexShrink={0}
          borderStyle="round"
          borderColor={focus === "list" ? "cyan" : "gray"}
          paddingX={1}
          overflow="hidden"
        >
          <Text bold>{` ADRs (${adrs.length}) `}</Text>
          {adrs.map((adr, i) => {
            const isSel = i === selected;
            const color = STATUS_COLOR[adr.data.status] ?? "white";
            // Pre-truncate to the visible width (pane minus border, padding and
            // the status dot) so wrapping the label in an OSC 8 file:// link
            // can't have its closing escape clipped. cmd/ctrl-click opens it.
            const label = fileLink(
              adr.path,
              truncate(`${pad(adr.number)} ${adr.data.title}`, LIST_WIDTH - 6),
            );
            return (
              <Text key={adr.number} inverse={isSel} wrap="truncate-end">
                <Text color={color}>{"● "}</Text>
                {label}
              </Text>
            );
          })}
        </Box>

        {/* Right: content */}
        <Box
          flexDirection="column"
          flexGrow={1}
          minWidth={0}
          borderStyle="round"
          borderColor={focus === "content" ? "cyan" : "gray"}
          paddingX={1}
          overflow="hidden"
        >
          {visible.map((line, i) => (
            <Text key={scroll + i} wrap="truncate-end">
              {line || " "}
            </Text>
          ))}
        </Box>
      </Box>

      <Box paddingX={1}>
        <Text dimColor>
          {`focus: `}
          <Text color="cyan">{focus}</Text>
          {`  •  ↑/↓ or j/k ${focus === "list" ? "select" : "scroll"}`}
          {focus === "list" ? `  •  ↵ read` : `  •  Esc back`}
          {`  •  Tab/←/→ switch pane`}
          {maxScroll > 0 ? `  •  ${scroll}/${maxScroll}` : ""}
          {`  •  q quit`}
        </Text>
      </Box>
    </Box>
  );
}
