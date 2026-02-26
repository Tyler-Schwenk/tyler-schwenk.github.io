# Community Board

## Overview
The Community Board route (`/inspiration`) is a full-screen interactive corkboard where users can explore curated links by dragging and zooming across a two-axis board. Links are organized into visual groups with category headers.

## Main Route
- `/inspiration`
  - Full-screen 2-axis corkboard implementation
  - Background: `/images/cork bg 2.avif` with repeating texture
  - Navigation header with frog icon in top left to return home
  - Board dimensions: 2400px x 1600px
  - Default view: 0.7x scale at offset (-200, -100)

## Interactive Features
- **Drag to pan**: Click and drag anywhere on the board to navigate
- **Scroll to zoom**: Mouse wheel zooms in/out from cursor position (min: 0.5x, max: 1.8x)
- **Boundary constraints**: Cannot scroll or zoom beyond board edges
- **Cursor-based zoom**: Zoom always centers on the cursor position, not a fixed point
- **Touch support**: Pointer events handle both mouse and touch interactions

## Visual Organization
Links are grouped into three categories with dedicated header post-its:

### Friends Section (Left)
- Header: Blue post-it at top
- 6 friend links below in 2 rows
- X range: 150-720px

### Beloved Local Orgs Section (Middle)
- Header: Blue post-it at top
- 4 organization links below in 2 rows
- X range: 1000-1300px

### Other Inspirations Section (Right)
- Header: Blue post-it at top
- 2 inspiration links below
- X range: 1780-1820px

## Link Data
- Source file: `data/communityBoardLinks.ts`
- Structure: `CommunityBoardLink` type with optional `isHeader` boolean
- Contains 18 total entries:
  - 3 category headers (non-clickable, blue, larger)
  - 15 clickable links (yellow/amber/orange/lime colors)

## Styling
- **Headers**: 280px wide, blue background (`bg-blue-300`), bold centered text, no hover effect
- **Links**: 220px wide, colored backgrounds with rotation variety, hover scale effect, shadow
- **Cursor feedback**: Grab cursor for dragging, grabbing cursor while dragging

## Behavior Notes
- Cork texture repeats seamlessly as board expands
- All links open in new browser tab (`target="_blank"`)
- Pan boundaries calculated dynamically based on viewport size and current zoom level
- Zoom calculations preserve the board point under the cursor during scale changes
- Pointer events use pointer capture for smooth drag interactions
