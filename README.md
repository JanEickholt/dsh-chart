# dsh-chart

DeepSeek Harness plugin that lets the agent render statistics as **inline
charts** (pie, bar, line) in the chat. The model calls the `show_chart` tool
with a small JSON spec; the web client validates it and draws it with
[recharts](https://recharts.org) — no files written, no sidebar, no ASCII art.

## How it works

- **Host half** (`src/index.ts`) registers the `show_chart` tool via
  `ctx.tools.register(defineTool(...))`. The model passes
  `{ type, title?, labels, values, seriesName? }` and receives a canonical
  confirmation value; an invalid spec fails with the first violated
  constraint (e.g. `labels has 3 entries but values has 2`) so the model can
  repair the call. Single validation authority: `src/chart-spec.ts`
  (`checkChartSpec` / `parseChartSpec`), shared by both halves.
- **Client half** (`src/client/`) registers two slots plus the `dsh-chart`
  locale namespace:
  - `conversation.chat.turnTail` — the chart lives at the END of the turn,
    after the final assistant message, so it survives collapsed thinking and
    tool rows. It walks the turn's tool-call nodes and renders every valid
    `show_chart` spec; failed calls are skipped (they stay in their row).
    Selector contract: `useChat` must return identity-stable values —
    `useChat((s) => s)` for the snapshot, derive with `useMemo`. A selector
    that builds a fresh array per call makes `useSyncExternalStore` loop
    forever and freezes the tab.
  - `tool.call.toolview` (key `show_chart`) — a compact static summary of the
    call. Failed calls auto-open with their error text.
  Both parse the call's COMPLETE raw args (never a streaming prefix) and
  degrade to plain text on malformed payloads. A "Show data" toggle reveals
  the raw spec as a table.
- Charts use recharts (inlined in the client bundle) with a fixed 8-hue
  categorical palette validated for colour-vision separation on both the
  light and dark chat surfaces, `currentColor` axes, and DSH alias tokens
  (`--dsw-alias-*`) for the tooltip so it stays readable in either theme.

## Build

```sh
pnpm install
pnpm run build     # tsdown host + client bundles, then check-client-id gate
pnpm run typecheck
pnpm test          # build + node --test smoke tests
```

## Wire into a profile

1. Add the dependency (local dev: link):

   ```json
   "dsh-chart": "link:/home/Jan/Projects/dsh-chart"
   ```

2. `pnpm install` in the profile directory. The host row comes from this
   package's `cordis.patch.yml` (auto-composed for profile deps); the client
   half is discovered from the `dsh.client` manifest in `package.json`.

3. Restart the host; pair with the `charts` skill (`~/.dsh/skills/charts/`)
   so the model knows when to call the tool.

## Limits (v1 ceiling)

- Single series only. Multi-series (the `type/title/x/y[]/unit/data[]`
  shape) is the upgrade trigger when needed.
- `pie` treats negative/zero values as non-slices (shares of a whole).
- At most 100 points; beyond that the tool errors and the model should
  aggregate first.
- No mermaid/diagram support — that would be a separate tool + toolview
  plugin (large client dependency).
