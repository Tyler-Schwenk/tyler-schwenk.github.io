# Community Board

## Overview
The Community Board route (`/community-board`) is a full-screen interactive corkboard where users can explore curated links by dragging and zooming across a two-axis board. Links are organized into visual groups with category headers.

## Main Route
- `/community-board`
  - Full-screen 2-axis corkboard implementation
  - Background: `/images/cork bg 2.avif` with repeating texture
  - Navigation header with frog icon in top left to return home
  - Board dimensions: 2400px x 1600px
  - Default view: 1.0x scale at offset (-400, -200)

## Interactive Features
- **Drag to pan**: Click and drag anywhere on the board to navigate
- **Scroll to zoom**: Mouse wheel zooms in/out from cursor position (min: dynamic to fill viewport, max: 1.8x)
- **Boundary constraints**: Cannot scroll or zoom beyond board edges; minimum zoom is dynamically calculated to ensure the board always fills the viewport, preventing any background from showing
- **Cursor-based zoom**: Zoom always centers on the cursor position, not a fixed point
- **Touch support**: Pointer events handle both mouse and touch interactions

## Visual Organization
Links are grouped into four categories with dedicated header post-its:

### Friends Section (Left)
- Header: Blue post-it at top
- 6 friend links below in 2 rows
- X range: 150-720px

### Beloved Local Orgs Section (Middle)
- Header: Blue post-it at top
- 4 organization links below in 2 rows
- X range: 1000-1300px

### Other Inspirations Section (Right Top)
- Header: Blue post-it at top
- 2 inspiration links below
- X range: 1780-1820px

### Personal Links Section (Right Bottom)
- Header: Blue post-it below Other Inspirations
- 1 link (Goodreads)
- X range: 1780-1820px
- Y position: 720-880px

## Link Data
- Source file: `data/communityBoardLinks.ts`
- Structure: `CommunityBoardLink` type with optional `isHeader` boolean
- Contains 20 total entries:
  - 4 category headers (non-clickable, blue, larger)
  - 16 clickable links (yellow/amber/orange/lime colors)

## Styling
- **Headers**: 280px wide, blue background (`bg-blue-300`), bold centered text, no hover effect
- **Links**: 220px wide, colored backgrounds with rotation variety, hover scale effect, shadow
- **Cursor feedback**: Grab cursor for dragging, grabbing cursor while dragging

## Behavior Notes
- Cork texture repeats seamlessly as board expands
- All links open in new browser tab (`target="_blank"`)
- Pan boundaries calculated dynamically based on viewport size and current zoom level
- Minimum zoom is calculated to ensure the board always fills the viewport, preventing any background from showing through
- Zoom calculations preserve the board point under the cursor during scale changes
- Pointer events use pointer capture for smooth drag interactions
