# Military-Industrial Complex Explainer

`/mic` is a visual explainer of how U.S. tax money turns into weapons, focused on Israel and
Palestine. It's one animated diagram. Money climbs the left side (taxpayers to Congress to the
Pentagon), crosses the top as contracts to weapons makers, and comes down the right side as
weapons to the Israeli military and strikes on Gaza. A dashed lobbying line runs from the weapons
makers back to Congress.

Tapping any node or line opens a panel with its summary, key numbers, and sources. It's a side
panel on desktop and a bottom sheet on phones. Escape, the close button, or tapping the same
thing again closes it.

It's fully static: no backend, and all content lives in one data file.

## Files

| File | What it does |
|---|---|
| `app/mic/page.tsx` | Route and metadata |
| `app/mic/micData.ts` | All content: nodes, flows, groups, page copy, and both layouts |
| `app/mic/micGeometry.ts` | Works out flow curves, arrowheads, label spots, and group boxes. No React |
| `components/mic/MicExplainer.tsx` | Page layout: header, legend, both diagrams, the panel, and selection state |
| `components/mic/MicFlowDiagram.tsx` | Draws one layout as an SVG: groups, flows with moving particles, nodes |
| `components/mic/MicDetailPanel.tsx` | The panel for the selected node or flow |
| `components/mic/MicIcon.tsx` | The line icons, drawn in a 48 x 48 box |
| `components/mic/mic.module.css` | All the styling |

## Editing content

Everything is in `micData.ts`. Each node and flow has a `detail`:

```ts
{
  summary: "plain-language explanation",
  stats: [{ value: "$3.8B", label: "per year in military aid", sourceUrl: "https://..." }],
  sources: [{ name: "CRS report on U.S. aid to Israel", url: "https://..." }],
}
```

- An empty `summary` shows "Details coming soon."
- Empty `stats` or `sources` lists don't render.
- A stat with a `sourceUrl` gets a "source" link under it.
- `MIC_PAGE_COPY` holds the title, intro (hidden when empty), and tap hint.

## Flows

Each flow has a `kind`, which sets how it looks:

| Kind | Color | Particles | Line |
|---|---|---|---|
| `money` | green | coins | solid |
| `weapons` | red | small bombs | solid |
| `influence` | purple | dots | dashed |

Particles move at the same speed on every line, so longer lines take longer to cross. They're
hidden when the viewer has reduced motion turned on.

## Layouts

There are two layouts, and both always render. CSS shows the wide one above 720px and the tall
one at 720px and below, so the static export never flashes the wrong one. Each layout sets:

- `width` / `height`: the SVG canvas, in its own units
- `positions`: each node's center
- `groupPadX`: room on each side of a group box, wide enough for the longest node label
- `flowBends`: how much each flow curves, by flow id, as a fraction of its length. Positive bows
  to the right of the direction of travel (as drawn on screen), negative to the left. Unlisted
  flows are straight.

Lines stop short of the node circles. When a line leaves a node out the bottom (within 45
degrees of straight down), it also skips past the node's label.

To add a node, add its id to `MicNodeId`, an entry to `MIC_NODES`, and a position to both
layouts. To add a flow, add an entry to `MIC_FLOWS`, plus a bend in each layout if it needs to
curve around something. New icons go in `ICON_SHAPES` in `MicIcon.tsx` and the `MicIconName`
type.

## Links

It's in the sitemap and in the home page's list view (`LIST_ONLY_ENTRIES` in
`components/home/worldObjects.ts`), but not in the pixel world or the "I'm feeling lucky" routes
yet, since it doesn't have a sprite.
