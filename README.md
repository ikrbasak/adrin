# adrin

> A small, fast CLI for managing **Architecture Decision Records (ADRs)** — auto-numbering, supersession tracking, and a terminal UI for browsing.

`adrin` keeps your ADRs as plain Markdown files with YAML frontmatter, so they live happily in your repo alongside the code they document. It handles the bookkeeping — sequential numbering, status, and supersession links — while you focus on the decision.

## Install

Run it on demand with no install:

```bash
npx adrin --help
```

Or install it globally:

```bash
npm install -g adrin
# pnpm add -g adrin
# yarn global add adrin
```

Requires **Node.js 22+**.

## Quick start

```bash
adrin new "Use PostgreSQL as primary datastore"   # create ADR 0001
adrin view                                         # browse in the TUI
```

ADRs live in `docs/adr/` by default; point anywhere with `-d, --dir <dir>`.
Files are named `0001-title-slug.md`.

## Commands

### `adrin new <title>`

Creates an ADR with the next available number and a minimal body prompting you
to phrase the decision as a [Y-statement](https://medium.com/olzzio/y-statements-10eb07b5a177).

```bash
adrin new "Adopt event-driven architecture"
```

New ADRs default to status `processing`. Pick a different initial status with
`-S, --status` (`accepted` · `processing` · `deferred` · `superseded`):

```bash
adrin new -S accepted "Adopt event-driven architecture"
```

#### Superseding an existing ADR

```bash
adrin new -s 1 "Switch primary datastore to DynamoDB"
```

The new ADR records `supersedes: 1`. ADR `0001` is updated in place — its status
flips to `superseded`, it gains `superseded_by: <new>`, and a note linking the
replacement is prepended to its body. Supersession stays bidirectional and
discoverable from either record.

### `adrin view`

Opens a split-pane terminal UI: the ADR list (number · title, colored by status)
on the left, the rendered ADR on the right.

| Key                       | Action                                             |
| ------------------------- | -------------------------------------------------- |
| `↑` / `↓` or `j` / `k`    | move selection / scroll content (depends on focus) |
| `Tab` / `←` / `→`         | switch focus between the list and content panes    |
| `Space` / `PgUp` / `PgDn` | page the content                                   |
| `q`                       | quit                                               |

Each entry renders as:

```
"<title>" <date>
status: <status> (Superseded by XXXX on <date>)
────────────────────────────────────────
<content>
```

Status colors: `accepted` green · `processing` cyan · `deferred` yellow ·
`superseded` red.

When stdout isn't a TTY (piped or CI), `view` prints a plain list instead.

### `adrin view -e <number>`

Renders a single ADR to stdout — handy for piping or quick inspection.

```bash
adrin view -e 1
```

## File format

Each ADR is Markdown with a YAML frontmatter block:

```yaml
---
title: <title>
date: <YYYY-MM-DD>
status: accepted | processing | deferred | superseded
supersedes: N # only when this ADR supersedes another
superseded_by: X # only when another ADR supersedes this one
---
```

## Development

```bash
pnpm install
pnpm dev         # tsdown watch
pnpm typecheck   # tsc --noEmit
pnpm build       # bundle to dist/
```

Source uses absolute imports via the `@/*` → `src/*` alias (tsconfig `paths`,
resolved by both `tsc` and tsdown).

## License

[MIT](./LICENSE) © Krishna Basak
