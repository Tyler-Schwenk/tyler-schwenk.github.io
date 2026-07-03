# Design System — Agent Instructions

This skill describes the visual design language for all UI output. Every component, layout, and page should follow the design specs in the module files below. These describe *what the design looks like* — you choose how to implement the styles.

## Style

Neobrutalism: raw, loud, unapologetically blocky. Flat saturated color fields, thick pure-black (or pure-white in dark mode) borders on every surface, and hard "sticker" drop shadows with zero blur that make elements look physically cut out and pasted onto the page. Corners are square. Type is heavy and oversized for headings, plain and legible for body copy. There is no gradient, no glassmorphism, no soft elevation — depth comes entirely from the offset hard shadow, and interactive elements visibly *press flat* against the page on click, like a cardboard cutout being pushed in. The result should feel like a zine, a punk flyer, or a DIY protest sign — deliberately unpolished, high-contrast, and impossible to ignore.

## Before Writing Any Code

1. **Read every module that applies.** For a landing page, read at minimum: `layout.md`, `typography.md`, `colors.md`, `buttons.md`, `cards.md`, `shadows.md`, `radius.md`, `borders.md`. Do NOT write any component markup until you have loaded all relevant modules.

## Critical Rules

- **Stay stack-agnostic.** This design system is technology-agnostic. Do not assume or hardcode any specific stack, framework, or styling library. The rules, colors, and styles must be implementable with any technology.

- **Tokens are AGNOSTIC design tokens, NOT utility classes:** The tokens defined in the `.md` files (like `neutral-primary-soft`, `heading`, `border-default`) are abstract design system tokens, NOT literal class names. Do not assume any predefined class exists — map each token to your project's styling layer yourself.

- **The block/sticker is the soul of this system.** Every content container is a flat rectangle: a bold border, a hard offset shadow, and (unlike softer systems) a background that is often itself a saturated accent color, not just a neutral surface. Color blocks ARE content surfaces here — there is no "wallpaper only" restriction.

- **Square, not soft.** Border-radius is `0` almost everywhere. Never use soft 8–16px rounding on cards, buttons, or inputs. Only true pills, dots, and circular avatars may use full rounding, and only when explicitly wanted — square avatars are the default.

- **Borders are maximum contrast, always.** `border-default` is pure black in light mode and pure white in dark mode — never a muted gray or brown. Borders are thick (3px default, never a 1px hairline) and are the primary structural device of the system.

- **Shadows are hard, flat, and directional — never soft.** No blur, no spread, no alpha-blended blacks. A shadow is a solid offset copy of the border color sitting behind the element (`4px 4px 0 var(--border-color)`). Elevation comes from the offset distance, not blur.

- **The press interaction is mandatory on every clickable block.** At rest, an interactive element sits offset from its shadow (looks "lifted"). On `:active`, the element translates by exactly the shadow's offset and the shadow disappears — it looks physically pressed flat into the page. Hover, optionally, lifts it slightly further (larger offset) before the press. This is the system's signature motion and must be implemented consistently across buttons, cards, and any other clickable block.

- **Cross-reference modules.** A block containing buttons must satisfy both `cards.md` AND `buttons.md`.
- **Dark mode is automatic.** The CSS custom properties resolve differently in light/dark via `@media (prefers-color-scheme: dark)` (or a `data-theme` attribute). Never manually swap colors. Note that borders and shadows flip color (black → white) in dark mode — this is not optional.
- **Every interactive element needs hover, focus, and disabled states** — defined in the relevant module. Focus uses a thick, high-contrast outline (never a soft glow) — brutalism and accessible focus rings are natural allies, lean into it.
- **Use semantic HTML:** proper heading hierarchy (`h1`→`h6`), `<button>` for actions, `<a>` for navigation, ARIA attributes where needed.

## Module Index

### Foundation (read first for any UI work)
- [colors.md](colors.md) — all background, text, and border color tokens
- [typography.md](typography.md) — heading scale, paragraphs, labels, links
- [layout.md](layout.md) — spacing rhythm, containers, animation, visual depth
- [radius.md](radius.md) — border-radius scale
- [shadows.md](shadows.md) — elevation tokens, the hard-shadow + press mechanic
- [borders.md](borders.md) — border widths and styles

### Components
- [buttons.md](buttons.md) — flat block button variants, sizes, states, press feedback
- [button-group.md](button-group.md) — grouped button structure
- [cards.md](cards.md) — sticker/block chrome, panels, interactivity
- [inputs.md](inputs.md) — form controls, labels, states
- [alerts.md](alerts.md) — alert variants
- [badges.md](badges.md) — badge variants, sizes, dismissible chips
- [lists.md](lists.md) — list components
- [avatars.md](avatars.md) — avatar variants, sizes, indicators
- [icon-shapes.md](icon-shapes.md) — icon containers

### Complex Components
- [accordion.md](accordion.md) — accordion variants
- [dropdown.md](dropdown.md) — dropdown menus
- [modals.md](modals.md) — modal dialogs
- [tabs.md](tabs.md) — tab navigation
- [tables.md](tables.md) — table structure
- [pagination.md](pagination.md) — pagination components
- [sidebars.md](sidebars.md) — sidebar navigation
- [radios-checkboxes-toggle.md](radios-checkboxes-toggle.md) — selection controls
- [tooltips-popovers.md](tooltips-popovers.md) — tooltips and popovers
- [content.md](content.md) — grid system, responsiveness

# Accordion

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Wrapper:** full width, 3px border (border-default color), 0 radius — square corners throughout
- **Item separator:** 3px bottom border (border-default) on every item except last (same weight as the outer frame, not a thin divider)

## Trigger (Button)

- **Layout:** flex, space-between, full width
- **Padding:** 20px horizontal, 16px vertical
- **Font:** 15px, bold weight, uppercase, 0.3px letter-spacing
- **Text color:** heading
- **Background:** neutral-primary-soft
- **Hover:** brand-softer background (a visible color shift, not a subtle tint)
- **Focus:** 3px solid border-brand outline, 3px offset
- **Transition:** background-color only, 100ms, no easing curve (linear — brutalism moves abruptly, not smoothly)
- **Open state:** brand-soft background, border-default-strong bottom border shared with the panel

## Panel (Content)

- **Padding:** 20px horizontal, 16px vertical
- **Background:** neutral-primary-soft
- **Top border:** 3px, border-default color
- **Font:** 15px, body color, 1.5 line-height

## Chevron / Marker Icon

- Use a bold `+` / `×` glyph or a heavy chevron, 18x18px, 3px stroke weight if custom-drawn
- Color: body text color
- Closed: `+` or 0deg rotation
- Open: `×` or 180deg rotation
- Transition: none or an instant swap — avoid a soft rotate-ease; a hard snap fits the system better

## Variants

### Default (Collapse)
One panel open at a time. Items stacked inside a single shared 3px-bordered wrapper, 0 radius.

### Separated Cards
Each item is independent — has its own 3px border-default frame, 0 radius, and its own hard offset shadow (`shadow-sm`, see `shadows.md`). 16px bottom margin between items (chunkier than a soft system, since each item now reads as its own block). No shared outer border.

### Always Open
Multiple panels can expand simultaneously. Same styling as Default.

### Flush
No outer border. Trigger and panel have transparent backgrounds. Only 3px bottom border dividers between items. Use inside containers that already provide a bordered frame.

## States

| State | Trigger appearance |
|---|---|
| Closed | heading text, neutral-primary-soft background |
| Open | heading text, brand-soft background |
| Hover | brand-softer background |
| Focus | 3px border-brand outline, 3px offset |
| Disabled | fg-disabled text, not-allowed cursor, no hover/focus |

# Alerts

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Padding:** 16px
- **Radius:** 0 — sharp, no exceptions
- **Border:** 3px (always bordered, matching the intent color, never softened)
- **Shadow:** `shadow-sm` hard offset in the same intent color (alerts float slightly off the page, unlike inline chrome)
- **Heading:** 15px sans, bold weight, uppercase optional
- **Body:** 14px sans, normal weight, 1.5 line-height
- **Optional leading icon** in a matching intent color, 20px, heavy/bold glyph style

Alerts can also be framed as a small **block** (see `cards.md`) with an accent-color background instead of a neutral one — a danger alert can be a solid red block with black text/border, not just a soft red tint. Reserve the fully saturated treatment for high-priority alerts; use the soft variant for routine inline messages.

## Variants

### Brand
- **Background:** brand-softer (or solid `brand` for a loud/high-priority variant)
- **Border:** border-default (black/white) or border-brand for a monochrome-accent look
- **Text:** black (on light-tinted or brand bg) — always check contrast; never place body text directly on saturated brand yellow without dark text

### Success
- **Background:** success-soft (or solid `success` loud variant)
- **Border:** border-default
- **Text:** fg-success-strong (soft variant) / black (solid variant)

### Danger
- **Background:** danger-soft (or solid `danger` loud variant)
- **Border:** border-default
- **Text:** fg-danger-strong (soft variant) / white (solid variant)

### Warning
- **Background:** warning-soft (or solid `warning` loud variant)
- **Border:** border-default
- **Text:** fg-warning (soft variant) / black (solid variant)

# Avatars

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Squared shape (default):** 0 radius — reads as a photo bolted to the page
- **Circular shape:** fully rounded (999px), used only when a round portrait is explicitly wanted
- **Default size:** 40x40px
- **Image fit:** cover
- **Frame:** every avatar carries a 3px border-default frame, regardless of shape — the border is never optional here

Prefer the **squared** (0 radius) shape as the system default.

## Sizes

| Size | Dimensions | Border |
|---|---|---|
| Extra Small | 20x20px | 2px |
| Small | 28x28px | 2px |
| Base | 40x40px | 3px |
| Large | 52x52px | 3px |
| XL | 64x64px | 4px |
| 2XL | 80x80px | 4px |

## Bordered / Emphasis Avatar

- Add a `shadow-sm` hard offset shadow behind the avatar for a "pinned photo" look — optional, use for a featured/profile-header avatar, not for dense lists.

## Stacked Avatars

- Displayed in a row (flex)
- Each avatar: 40x40px, squared, 3px border in border-buffer color (so the border reads against whatever sits behind it)
- Overlap: -12px negative margin on all except first (tighter overlap than a soft system reads awkwardly with thick borders touching — keep enough gap that borders don't visually merge)

### Stacked Counter
- Same size as avatars (40x40px), squared, 3px border
- Background: dark-strong (near-black), text: white, 13px font, bold weight
- Same overlap margin as other avatars

## Avatar with Text

- Flex row, 12px gap between avatar and text
- Avatar: 40x40px, squared, 3px border, cover fit
- Name: heading color, bold weight
- Subtitle: 14px, body-subtle color

# Badges

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Border:** 2px (always bordered — thinner than the 3px "structural" border scale since badges are small, but still clearly bordered, never borderless)
- **Default radius:** 0 (sharp)
- **Pill radius:** 999px, for an explicit "tag" flavor
- **Font:** bold sans, uppercase, 0.3px letter-spacing; mono is appropriate for version/system tags (e.g. `v1.0`, `README.TXT`)

## Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Default (small) | 11px | 8px | 3px |
| Large | 13px | 10px | 5px |

## Variants

### Brand
- **Background:** brand (solid, loud — badges are one of the few places a fully saturated fill at small size reads fine)
- **Border:** border-default
- **Text:** black

### Alternative (Neutral Soft)
- **Background:** neutral-primary-soft
- **Border:** border-default
- **Text:** heading

### Gray (Neutral Medium)
- **Background:** neutral-secondary-medium
- **Border:** border-default
- **Text:** heading

### Danger
- **Background:** danger (solid)
- **Border:** border-default
- **Text:** white

### Success
- **Background:** success (solid)
- **Border:** border-default
- **Text:** black

### Warning
- **Background:** warning (solid)
- **Border:** border-default
- **Text:** black

### Dark
- **Background:** dark
- **Border:** border-default (white in dark mode, black in light — keep it visible against the dark fill either way, using border-buffer if needed)
- **Text:** white

## Pill Badges

Use 999px radius instead of 0 on any variant. Border stays the same weight.

## Badges with Icons

- Icon size (default): 12x12px
- Icon size (large): 14x14px
- Icon spacing: 5px margin next to label

## Icon-only Badge

Square shape — equalize dimensions to 24x24px, no horizontal text padding.

## Dismissible Badges

Badge content + a close button. Close button hover backgrounds per variant:

| Variant | Close button hover background |
|---|---|
| Brand | brand-strong |
| Alternative | neutral-tertiary |
| Gray | neutral-quaternary |
| Danger | danger-strong |
| Success | success-strong |
| Warning | warning-strong |

## Dot / Notification Badge

- Positioned absolutely: -6px top, -6px right
- Size: 14x14px, fully rounded (999px)
- 2px border in border-buffer color
- Background: danger

# Borders

Borders are not a supporting detail here — they're the entire structural language. **Every surface, control, and panel carries a heavy, high-contrast border.** There is no "subtle divider" default; the thinnest border in the system is still clearly visible.

## Width Scale

| Context | Width |
|---|---|
| Dividers, nested/internal separators | 2px |
| Default (blocks, buttons, inputs, badges are 2px, everything else) | 3px |
| Heavy emphasis / hero blocks, page frame | 4–5px |
| Focus outline | 3px (outline, offset 2–3px from the control) |

## Rules

- Use **solid** borders everywhere. No dashed, no dotted (a dropzone/empty-state placeholder may use a thick dashed border as the one deliberate exception).
- The border color is always **pure black in light mode, pure white in dark mode** — `border-default`. There is no muted/subtle border token for structural use; the one exception is `border-default-subtle` (mid-gray), reserved for the quietest internal dividers where even a thick black rule would be visual noise (e.g. a table's zebra-row separator).
- Status borders use the fully saturated status hue directly (`border-danger` = the same red as `danger`, not a softened variant) — brutalism borders don't get softened for status either.
- Components in the same family must use matching border widths.
- Never mix a 2px and 3px border within a single component instance.
- Borders are always visible — shadows never substitute for a border; every bordered element also has its border, even when it also carries a hard shadow.

## Usage

| Context | Width / Color |
|---|---|
| Blocks / cards / panels | 3px `border-default` (4–5px for hero/feature blocks) |
| Menu bar / page frame | 3–4px `border-default`, full edge (not just bottom — brutalism frames the whole bar) |
| Inputs / selects / textareas | 3px `border-default`; border stays black/white on focus (color doesn't change — the focus **outline** is the feedback, see below) |
| Buttons | 3px border matching the variant (see `buttons.md`) — almost always `border-default`, regardless of fill color |
| Dividers | 2px `border-default-subtle` |
| Focus outline | 3px solid, in a contrasting accent (commonly `border-brand` or a bright blue), 2–3px offset, on every interactive element |

# Button Groups

> Dependencies: `buttons.md`, `colors.md`, `radius.md`

## Core Specs

- **Wrapper:** inline-flex, 0 radius, no shadow on the wrapper itself (the group's outer edge can carry one shared `shadow-sm` if the whole group should read as one pressable block; otherwise leave flat)
- **Children overlap:** -3px left margin on all except first (borders merge into a single seam, matching the 3px border width exactly so no double-thick seam appears)
- **Buttons inside the group must NOT have individual shadows** — only the group as a whole gets one, if any.

## Anatomy

### Wrapper
- Display: inline-flex
- Radius: 0
- Shadow: none by default

### All Buttons
- No radius on any button in the group (unlike softer systems, there's no "rounded end caps" — square all the way across is the point)
- -3px left margin on all except first, to overlap borders into one crisp seam

## Rules

- Buttons inside groups follow all styles from `buttons.md` (background, border, focus outline) except individual shadows and the press-translate motion (the group moves/presses as a unit if you choose to add the shared shadow; otherwise buttons inside a flat group have no press animation at all, since there's no shadow to remove)
- Icon-only buttons: 18–20px icon, match height of text buttons

# Buttons

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `borders.md`

Brutalist buttons are **flat color blocks that visibly lift off the page and slam back down when pressed.** No gradients, no glossy states — the entire feedback language is: border + hard offset shadow at rest, shadow grows slightly on hover, and on press the button snaps flush against the surface (shadow gone, button translated by the exact shadow offset).

## Core Specs (all buttons except ghost and disabled)

- **Radius:** 0. Use `full` (999px) only for an explicit pill button variant.
- **Border:** 3px solid, `border-default` (black in light, white in dark) regardless of fill color.
- **Shadow:** `shadow-sm` (4px 4px 0 border-color) at rest. On `:hover`, grow to `shadow-md` (6px 6px 0) — the button looks like it's lifting further off the page. On `:active`, shadow becomes `shadow-none` and the button translates `translate(4px, 4px)` (matching the rest-state offset) — flush against the page, pressed in.
- **Font:** bold sans, weight 700, uppercase, 0.4px letter-spacing.
- **Box sizing:** border-box.
- **Transition:** transform and box-shadow, 80–100ms, linear (no ease curve — the motion should feel abrupt/mechanical, not springy).
- **Focus:** 3px solid contrasting-accent outline, 3px offset. Visible always on keyboard focus; never rely on the shadow alone for focus feedback.

## Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Extra small | 12px | 10px | 5px |
| Small | 13px | 12px | 7px |
| Base (default) | 14px | 16px | 9px |
| Large | 16px | 20px | 11px |
| Extra large | 18px | 26px | 14px |

## Variants

### Primary
- **Background:** brand (solid, loud — electric yellow or whichever brand hue is configured)
- **Border:** border-default
- **Text:** black in light mode, black in dark mode too — brand yellow needs dark text in both modes for contrast; don't flip to white text on this fill
- **Hover:** shadow grows, background unchanged (or brightens by ~5%) — the *shadow* is the primary hover signal, not a color shift
- **Active:** translate + shadow-none (the press)
- **Focus ring:** 3px contrasting-accent outline, offset 3px

### Secondary
- **Background:** a second loud accent (e.g. hot pink) — solid
- **Border:** border-default
- **Text:** white
- **Hover / Active:** same press mechanic as Primary

### Tertiary (neutral block)
- **Background:** neutral-primary-soft
- **Border:** border-default
- **Text:** heading color
- **Hover / Active:** same press mechanic as Primary

### Success
- **Background:** success token (solid)
- **Border:** border-default
- **Text:** black
- **Hover / Active:** same press mechanic

### Danger
- **Background:** danger token (solid)
- **Border:** border-default
- **Text:** white
- **Hover / Active:** same press mechanic

### Warning
- **Background:** warning token (solid)
- **Border:** border-default
- **Text:** black
- **Hover / Active:** same press mechanic

### Ghost (NO fill, NO shadow at rest)
- **Background:** transparent
- **Border:** 3px border-default (unlike a soft system's borderless ghost, this system's ghost still keeps its border — a truly borderless clickable element reads as broken here)
- **Text:** heading color
- **Hover:** brand-softer background fill, shadow-sm appears (ghost buttons "activate" their shadow only on hover)
- **Active:** translate + shadow-none
- **Focus ring:** 3px contrasting-accent outline, offset 3px
- Used for low-emphasis actions and dense toolbars where a full block per button would be too loud.

### Disabled (NO hover, NO active, NO shadow)
- **Background:** disabled token
- **Border:** border-default-subtle
- **Text:** fg-disabled color
- **Cursor:** not-allowed
- **Shadow:** none — disabled buttons sit flush against the page, signaling "can't be pressed further"
- **No hover, no focus ring, no press**

## Icons in Buttons

- Icon size: 18–20px, bold/heavy glyph style (thin-line icons undercut the aesthetic — prefer filled or heavy-stroke icon sets)
- Spacing: 8px gap between icon and label
- Layout: inline-flex, vertically centered
- Icon-only buttons stay square (equal padding), 0 radius, same shadow/press mechanic as text buttons

# Cards / Blocks

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `borders.md`, `typography.md`

In this system a "card" is a **block** — a flat rectangle that looks physically cut out and pasted onto the page. There's no title-bar chrome or window metaphor here; the block's identity comes entirely from its thick border and hard offset shadow. Backgrounds are fair game to be a fully saturated accent color, not just a neutral surface — a bright pink or cyan block reads as normal, not as an exception.

## Anatomy

```
   ┌───────────────────────────────┐        ← 3px border-default frame, 0 radius
   │                               │
   │  Block content —              │        ← neutral OR saturated accent background
   │  heading, body, actions       │
   │                               │
   └───────────────────────────────┘
     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ← hard offset shadow (shadow-md), no blur
```

## Core Specs

- **Frame:** 3px solid `border-default`, 0 radius. A hero/feature block may use a heavier 4–5px border for emphasis.
- **Background:** `neutral-primary-soft` for a "quiet" block, or any saturated accent token (`brand`, `pink`, `cyan`, `lime`, etc. — see `colors.md`) for a "loud" block. Mix both across a page freely; that contrast is the point.
- **Body padding:** 20–24px.
- **Shadow:** `shadow-md` (6px 6px 0 border-color) for a block sitting in-flow on the page. `shadow-lg` (8px 8px 0) for a floating/prominent block (modal, hero card). `shadow-none` only for a block deliberately shown as "already pressed" (e.g. a selected/active state).

## Block Heading

- A content heading *inside* the block uses the display scale (see `typography.md`): desktop 24–32px, mobile 20–24px, bold-to-black weight, heading color.
- Never skip heading levels — the page hierarchy must logically arrive at the block heading level.

## Variants

### Block Card (default)
- Full anatomy: border + shadow + padding.
- In-flow: `shadow-md`. Floating (modal, popover-like): `shadow-lg`.

### Outline Block (quiet/secondary)
- Same border and shape, but no shadow — sits flush against the page. Use for secondary/nested content inside a louder parent block, so it doesn't compete for elevation.

### Accent Block
- Same anatomy, background is a fully saturated accent color instead of neutral. Text color must be chosen for contrast (black on light accents like yellow/lime/cyan; white on dark-saturated accents like purple/navy — check each hue).

## States

### Static (no interactivity)
- No hover styles. Non-interactive blocks must NOT have hover background/shadow changes.

### Interactive (clickable block / opens something)
- Same base styles.
- Hover: shadow grows one step (e.g. `shadow-md` → `shadow-lg`), block does NOT move on hover (only the shadow signals "liftable").
- Active: translate by the *rest-state* shadow offset, shadow drops to `shadow-none` — the full press.
- Cursor: pointer.

## Rules

- Default container = **block**: thick border, hard offset shadow, 0 radius, padding.
- Frame: always 3px `border-default` minimum; heavier for hero content.
- Background: neutral OR saturated accent — both are first-class, unlike systems that reserve color for accents only.
- In-flow blocks use `shadow-md`; floating blocks use `shadow-lg`; pressed/selected blocks use `shadow-none`.
- Non-interactive blocks: no hover styles, no press animation.
- Never round corners beyond `full` on true pills/dots/circular avatars — cards and panels are always 0 radius.

# Color Tokens

A high-contrast, saturated palette: pure black-and-white structure (surfaces, ink, borders) punched through with loud flat accent colors used freely as content backgrounds, not just highlights. Light mode reads like a white zine page; dark mode like a blackout poster under a single work light.

## Background Tokens

### Neutral
| Token | Light | Dark |
|---|---|---|
| neutral-primary-soft | #FFFFFF | #0A0A0A |
| neutral-primary | #FFFFFF | #000000 |
| neutral-primary-medium | #F0F0F0 | #141414 |
| neutral-primary-strong | #E0E0E0 | #1F1F1F |
| neutral-secondary-soft | #F5F5F5 | #171717 |
| neutral-secondary | #EBEBEB | #1F1F1F |
| neutral-secondary-medium | #D9D9D9 | #2B2B2B |
| neutral-secondary-strong | #C4C4C4 | #383838 |
| neutral-tertiary-soft | #EDEDED | #1A1A1A |
| neutral-tertiary | #D9D9D9 | #262626 |
| neutral-tertiary-medium | #C4C4C4 | #333333 |
| neutral-quaternary | #A8A8A8 | #4D4D4D |
| gray | #6B6B6B | #8C8C8C |

### Brand (electric yellow — the signature loud accent)
| Token | Light | Dark |
|---|---|---|
| brand-softer | #FFFBE0 | #332B00 |
| brand-soft | #FFF0A8 | #4D3F00 |
| brand | #FFE100 | #FFE100 |
| brand-medium | #FFD500 | #FFD500 |
| brand-strong | #E6BE00 | #FFEE66 |

### Status
| Token | Light | Dark |
|---|---|---|
| success-soft | #D6FFEA | #062B16 |
| success | #00C853 | #00E676 |
| success-medium | #7CFFC4 | #0F5C2E |
| success-strong | #007A33 | #6FFFB0 |
| danger-soft | #FFE1E1 | #2E0A0A |
| danger | #FF3131 | #FF5252 |
| danger-medium | #FF9999 | #7A1717 |
| danger-strong | #B30000 | #FF8A8A |
| warning-soft | #FFE9CC | #331F05 |
| warning | #FF9F1C | #FFB74D |
| warning-medium | #FFC978 | #7A4B0A |
| warning-strong | #B36800 | #FFD180 |

### Block / Accent Surface Colors (theme-switchable, used directly as content backgrounds)
These are the defining trait of this system — flat, fully saturated colors meant to be used AS card/badge/section backgrounds, not just as small accents. Same hue both modes; only pair each with the correct text color for contrast (noted below).

| Token | Value | Text that reads on it |
|---|---|---|
| pink | #FF3EA5 | white |
| cyan | #00E5FF | black |
| lime | #B4FF00 | black |
| purple | #7C3AED | white |
| orange | #FF5C00 | black |
| blue | #2F6FFF | white |
| red | #FF3131 | white |
| yellow | #FFE100 | black |

### Code / Terminal surfaces
| Token | Light | Dark | Role |
|---|---|---|---|
| code-bg | #000000 | #000000 | Code blocks / terminal background (always black, both modes) |
| code-text | #39FF14 | #39FF14 | Code blocks / terminal foreground — neon lime, terminal-hacker feel |

### Utility
| Token | Light | Dark |
|---|---|---|
| dark | #000000 | #F5F5F5 |
| dark-strong | #000000 | #FFFFFF |
| disabled | #E0E0E0 | #1F1F1F |

## Text Color Tokens

### Base
| Token | Light | Dark |
|---|---|---|
| white | #FFFFFF | #FFFFFF |
| black | #000000 | #000000 |
| heading | #000000 | #FFFFFF |
| body | #1A1A1A | #F2F2F2 |
| body-subtle | #4D4D4D | #B3B3B3 |

### Brand
| Token | Light | Dark |
|---|---|---|
| fg-brand-subtle | #B39400 | #FFF0A8 |
| fg-brand | #8A6D00 | #FFE100 |
| fg-brand-strong | #6B5400 | #FFF3A0 |

### Status
| Token | Light | Dark |
|---|---|---|
| fg-success | #007A33 | #6FFFB0 |
| fg-success-strong | #005C26 | #B3FFD9 |
| fg-danger | #B30000 | #FF8A8A |
| fg-danger-strong | #800000 | #FFC2C2 |
| fg-warning-subtle | #B36800 | #FFC978 |
| fg-warning | #8A4E00 | #FFD180 |
| fg-disabled | #8C8C8C | #666666 |

### Informational / Accent
| Token | Light | Dark |
|---|---|---|
| fg-pink | #C4227D | #FF7DC2 |
| fg-cyan | #007A8A | #6FF5FF |
| fg-lime | #5C8A00 | #D4FF7A |
| fg-purple | #5B21B6 | #C4A3FF |
| fg-orange | #B34600 | #FFA366 |
| fg-blue | #1F4FCC | #A3C0FF |

## Border Color Tokens

Structure over subtlety: one workhorse border color, always at maximum contrast against its surface.

| Token | Light | Dark |
|---|---|---|
| border-buffer | #FFFFFF | #000000 |
| border-default-subtle | #D9D9D9 | #333333 |
| border-default | #000000 | #FFFFFF |
| border-default-strong | #000000 | #FFFFFF |
| border-success | #00C853 | #00E676 |
| border-danger | #FF3131 | #FF5252 |
| border-warning | #FF9F1C | #FFB74D |
| border-brand | #FFE100 | #FFE100 |
| border-pink | #FF3EA5 | #FF3EA5 |
| border-cyan | #00E5FF | #00E5FF |
| border-lime | #B4FF00 | #B4FF00 |
| border-purple | #7C3AED | #7C3AED |

## Semantic Usage Rules

- **Block backgrounds:** neutral-primary-soft for quiet content, any Block/Accent Surface color for loud content. Both are equally valid content surfaces — there is no "wallpaper only" restriction in this system.
- Page/section backgrounds: neutral-primary-soft (default). A full-bleed saturated accent section is fine for a hero/feature moment — use sparingly so it retains impact.
- Primary buttons: `brand` fill with black text, in both light and dark mode.
- Secondary buttons: a second loud accent (commonly `pink`) with white text.
- Headings: heading text color. Body text: body color. Captions/meta: body-subtle.
- Links / CTAs: `fg-brand` text color (a readable deep-gold in light, the bright yellow itself in dark), thick underline.
- Default borders: `border-default` — pure black (light) / pure white (dark). This is non-negotiable structural chrome.
- Status borders match intent at full saturation: success → border-success, danger → border-danger, warning → border-warning.
- Code / terminal panes: `code-bg` (always black) with `code-text` (neon lime) foreground.
- Disabled: `disabled` background + `fg-disabled` text, shadow removed.

## Prohibited

- No raw hex/rgb values in component code — always use design tokens.
- No gradients, anywhere, for any purpose.
- No soft/blurred shadows — every shadow token in this system is a hard, zero-blur offset.
- No border-radius above `0` on cards, buttons, inputs, or panels (pills/dots/circular avatars are the only exception).
- No manual light/dark value swapping — let the CSS custom properties handle it.
- No muted/desaturated "safe" accent colors — the accent palette is deliberately loud; don't tone it down to look more "professional."

# Content & Grid System

> Dependencies: `layout.md`, `typography.md`

## Containers

| Type | Max width | Horizontal padding |
|---|---|---|
| Standard | 1100px | 16px (mobile) / 24px (desktop) |
| Block body | block width | 20–24px body padding |
| Internal (reading) | 720px | — (45–75 char line length) |

## Vertical Padding

| Breakpoint | Vertical padding |
|---|---|
| Mobile | 32px |
| Tablet (≥768px) | 48px |
| Desktop (≥1024px) | 64px or 96px for hero/feature sections |

## Grid System

Mobile-first with flexible desktop configurations. Gaps are chunkier than a soft system's — thick borders need visible breathing room to read as distinct cut-out blocks rather than a single merged shape.

| Context | Gap |
|---|---|
| Standard content/cards (blocks) | 24–32px |
| Compact widgets/metadata | 16px |
| Dense icon/tag grid | 12px |

### Responsive Columns

| Breakpoint | Columns |
|---|---|
| Mobile (default) | 1–2 |
| Small/Tablet (≥640px) | 2–4 |
| Desktop (≥1024px) | 3–12 |

Full support for 6, 7, 8, 9+ column grids where needed.

## Breakpoints

| Name | Width |
|---|---|
| Small | 640px |
| Medium | 768px |
| Large | 1024px |
| Extra large | 1280px |
| 2x Extra large | 1536px |

## Rules

- Always design mobile-first.
- Blocks need real gap between them (24px+) so their borders and shadows don't visually collide.
- Lists: 24px indentation, 10px vertical gap between items.
- Body copy: 16px, 1.6 line-height (sans).
- All interactive links follow the brand thick-underline/highlight-on-hover protocol.

# Dropdown

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `inputs.md`

## Core Specs

### Chevron / Marker Icon
- Size: 18x18px, bold/heavy glyph
- Spacing: 6px left margin, -2px right margin
- Color: inherits from trigger button

### Menu Container
- Background: neutral-primary-soft
- Border: 3px, border-default
- Radius: 0
- Shadow: `shadow-md` hard offset (see `shadows.md`)
- Z-index: elevated above content

### Menu List
- Padding: 4px
- Font: 14px sans, body color, bold weight

### Menu Item
- Layout: inline-flex, vertically centered, full width
- Padding: 10px horizontal, 8px vertical
- Radius: 0
- Hover: brand-soft background, heading text
- Transition: background-color, 80ms, linear

## Trigger Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Small | 14px | 12px | 8px |
| Base | 14px | 16px | 10px |
| Large | 16px | 20px | 12px |

## Icon-only Trigger

- Padding: 8px
- Min size: 44x44px
- Icon: 22x22px

## Variants

### Default
- Menu width: 200px, items have 0 radius

### With Divider
- 2px top border (border-default-subtle) between child groups, skip first group

### With Header
- Header padding: 16px horizontal, 12px vertical
- Bottom border: 3px border-default
- Name: heading color, 15px, bold weight
- Email: body-subtle color, 14px, truncated

### With Icons
- Icon before label: 18x18px, 8px right margin, body color
- On hover, icon color changes to heading

### With Checkbox / Radio
- Inputs: 18x18px, 0 radius (checkbox) or full radius (radio), 3px border, focus outline in border-brand
- Helper text: 13px, body-subtle color, 2px top margin

### With Search
- Search input at top of menu following `inputs.md` specs
- Left icon: 12px left padding, input 36px left padding

### Scrollable
- Max height: 200px, vertical scroll overflow

## States

| State | Appearance |
|---|---|
| Focused trigger | 3px border-brand outline, 3px offset |
| Hover item | brand-soft background, heading text |
| Active/open item | brand-medium background, heading text |
| Disabled item | fg-disabled text, not-allowed cursor, no pointer events |

# Icon Shapes

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- Box sizing: border-box
- Icon must be perfectly centered (inline-flex, centered both axes)
- Squared (default): 0 radius, with a 3px border-default frame
- Circle: fully rounded (999px), used only when explicitly wanted

Prefer the **squared** (0 radius) shape — it matches the block-chrome aesthetic.

## Sizes

| Size | Container | Icon |
|---|---|---|
| XS | 28x28px | 16x16px |
| SM | 36x36px | 18x18px |
| MD | 44x44px | 22x22px |
| LG | 52x52px | 26x26px |
| XL | 60x60px | 30x30px |

## Color Variants

### Brand
- Shape: squared (0 radius)
- Background: brand (solid)
- Border: border-default
- Icon color: black

### Gray
- Shape: squared (0 radius)
- Background: neutral-secondary-soft
- Border: border-default
- Icon color: body

### Danger
- Shape: squared (0 radius)
- Background: danger (solid)
- Border: border-default
- Icon color: white

### Success
- Shape: squared (0 radius)
- Background: success (solid)
- Border: border-default
- Icon color: black

### Warning
- Shape: squared (0 radius)
- Background: warning (solid)
- Border: border-default
- Icon color: black

# Inputs

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Display:** block, full width
- **Radius:** 0 — sharp
- **Border:** 3px, border-default (thick, black/white — an input is a block like anything else in this system)
- **Background:** neutral-primary-soft
- **Shadow:** none at rest (inputs are recessed-feeling through the border weight alone, not elevation)
- **Font:** 15px sans, heading color
- **Padding:** 12px horizontal, 10px vertical
- **Placeholder:** body-subtle color
- **Transition:** box-shadow only, 80ms, linear

## Label

- Display: block
- Font: 13px sans, bold weight, uppercase, 0.3px letter-spacing, heading color
- Margin bottom: 8px
- Label `htmlFor` must match the input `id`

## States

### Default
- Border: border-default
- Background: neutral-primary-soft

### Hover
- No change (reserve feedback for focus — hover on a form field isn't a meaningful state in this system)

### Focus
- Border: border-default (unchanged — color isn't the feedback)
- Shadow: `shadow-sm` hard offset appears in `border-brand` color (the input visually "pops" off the page while focused — the same press-mechanic vocabulary as buttons, just inverted: focus adds the shadow instead of removing it)
- Outline: 3px solid border-brand, 3px offset

### Success
- Border: border-success
- Focus shadow: `shadow-sm` in border-success

### Error / Danger
- Border: border-danger
- Focus shadow: `shadow-sm` in border-danger

### Disabled
- Background: disabled
- Text: fg-disabled
- Cursor: not-allowed
- Shadow: none, even on attempted focus

## Input with Icons

- Icon size: 18x18px
- Icon color: body
- Container: relative positioned wrapper
- Start icon: absolutely positioned left, 12px left padding — input gets 40px left padding
- End icon: absolutely positioned right, 12px right padding — input gets 40px right padding
- Icons vertically centered within the wrapper

## Rules

- Every input must have a unique `id`
- Every label must have a matching `htmlFor`
- Padding: 12px horizontal, 10px vertical unless overridden for icon variants
- No arbitrary hex or hardcoded colors

# Layout & Spacing

This system composes pages as a **collage of blocks** on a plain neutral canvas: white in light mode, black in dark mode. There's no wallpaper/window-chrome metaphor — the page itself is the canvas, and content is a series of hard-bordered, hard-shadowed rectangles placed on it with generous gaps so each one reads as a distinct cut-out piece.

## Spacing Rhythm

Base unit: **4px**. Spacing values are multiples of 4px, but brutalist layouts tend to favor the chunkier steps (16px/24px/32px) more often than the fine ones — this isn't a dense, utilitarian system, it's a poster-like one.

| Context | Value |
|---|---|
| Page frame border | 3–4px |
| Block body padding | 20px or 24px |
| Section vertical padding (within a page) | 64px or 96px |
| Section header → content | 32px or 48px |
| Heading → paragraph | 16px |
| Flex/grid row gap | 16px or 24px |
| Card/block grid gap | 24px or 32px |
| Container horizontal padding | 16px (mobile) / 24px (desktop) |

## Container

Standard content container: max-width 1100px, centered, 24px horizontal padding. Inside a block, content respects the block's body padding instead.

## The Page Canvas

A typical page is composed as:
1. **Canvas** — the plain neutral page background (white light / black dark). No texture, no gradient.
2. **Page frame / nav bar** (optional) — a heavy 3–4px bordered bar, flat neutral or brand-colored fill, holding the brand mark and nav items.
3. **Blocks** — one or more hard-bordered, hard-shadowed rectangles (see `cards.md`) placed on the canvas with generous gaps. Mix neutral and saturated-accent blocks freely across a page for visual rhythm.
4. **Hero moments** (optional) — a single full-bleed saturated-accent section is fine for a page's opening statement; keep it to one per page so it retains punch.

## Content Composition Order

Inside each block/section, follow this order:
1. Heading (`h1`–`h3`, heavy display weight)
2. Leading paragraph
3. Normal paragraph(s)
4. Lists, CTA buttons, or component grids

## Motion & Animation

- Prefer CSS-native: `transition`, `animation`, `@keyframes`. Use a motion library only when CSS cannot achieve the behavior.
- Motion is **abrupt, not springy.** Durations are short (80–150ms), easing is linear or a very slight ease-out — never a bouncy/elastic curve. The signature motion is the button/card press (see `buttons.md`, `shadows.md`): shadow disappears, element translates flush, done.
- Avoid decorative animation (parallax, floating elements, gentle fades). If something moves, it should be because the user did something to it.

## Backgrounds & Visual Depth

- Depth comes from **borders + hard offset shadows only** — never gradients, blur, or glass.
- The plain canvas provides contrast for the blocks sitting on it; blocks themselves may be neutral or a saturated accent fill.
- No decorative texture (grain, scanlines, dithering) — this system's "raw" feeling comes from flatness and contrast, not surface texture.
- Every decorative element must serve a compositional purpose (depth, separation, emphasis) — brutalism is intentional, not sloppy.

## Must

- Canvas = plain neutral background only; content lives in bordered, shadowed blocks placed on top.
- Consistent 4px-based spacing, favoring the chunkier steps; generous gaps between blocks (24px+).
- Every block carries a 3px+ `border-default` frame.
- Layouts readable and properly spaced on both desktop and mobile (blocks stack full-width on small screens).

# Lists

> Dependencies: `colors.md`

## Core Specs

- Item spacing: 20px vertical gap between list items (generous — matches the system's chunky rhythm)
- Text: body color

## List Icons

- Size: 22x22px
- Prevent squishing: no shrink
- Spacing: 8px right margin between icon and text
- Active/featured icon: fg-brand color
- Neutral icon: body color

## Inactive / Disabled Items

Strikethrough text with body-subtle color decoration on the list item.

## Pattern

Vertical flex list with 20px gap. Each item is a flex row with centered alignment — icon (22x22, no-shrink, 8px right margin) followed by a span of body-colored text.

# Modals

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `buttons.md`, `inputs.md`

A modal is a **floating block** — same anatomy as a card (see `cards.md`), just elevated further with a bigger shadow, centered over a dimmed canvas.

## Core Specs

### Overlay (Backdrop)
- Fixed, covers full screen
- Z-index: 40
- Background: black at ~70% opacity (heavier dim than a soft system — the modal needs to read as unmistakably "on top")
- Backdrop blur: none — this system doesn't use blur anywhere

### Content Container (Block)
- Background: neutral-primary-soft
- Border: 3–4px border-default
- Radius: 0
- Shadow: `shadow-lg` (8px 8px 0 border-color)
- Padding: 0 (header/body/footer manage their own padding)

## Anatomy

### Header
- Background: neutral-primary-soft (or a saturated accent for a "loud" modal, e.g. a delete-confirmation could use a solid danger-red header)
- Padding: 16px 20px
- Bottom border: 3px border-default
- Title: 16–18px, bold weight, heading color (left aligned), uppercase optional
- Close control: square icon-button (see `icon-shapes.md`), 3px border, `shadow-sm`, presses flush on click — same button mechanic as everywhere else, just icon-only

### Body
- Padding: 24px
- Vertical spacing between elements: 20px
- Heading inside body (if any): display scale per `typography.md`
- Text: 15px sans, 1.6 line-height, body color

### Footer
- Top border: 3px border-default
- Padding: 16px 24px
- Action buttons right-aligned (primary + secondary per `buttons.md`)

## Variants

### Default (Information)
Standard header + body + footer with primary/secondary action buttons.

### Pop-up (Confirmation)
A blunt confirmation dialog. Centered text, prominent icon, reduced padding:
- Body: 24px padding, text centered
- Icon: centered, 16px bottom margin, 52x52px, in a squared icon-shape per `icon-shapes.md` (use the `danger` variant for destructive confirmations — no ambiguity)

### Form Modal
Body contains inputs following `inputs.md`. Vertical spacing between form elements: 20px.

## Rules

- Backdrop covers full screen with fixed positioning, heavy black dim, no blur
- Content is a block: neutral-primary-soft background, 3–4px border-default frame, 0 radius, `shadow-lg`
- Header/Footer separated by 3px border-default borders
- Close control must be present, labeled, and functional
- Accessibility: `role="dialog"`, implement focus trap in code
- Dark mode automatic via token system (border/shadow flip to white)

# Pagination

> Dependencies: `colors.md`, `radius.md`

## Container

Font: 14px sans, bold weight (mono is fine for page numbers, tabular-nums). Items displayed as flex with -3px overlap for seamless borders (matching the 3px border width).

## Pagination Item

- Layout: flex, centered both axes
- Size: 40x40px
- Text: body color, bold weight
- Background: neutral-primary-soft
- Border: 3px, border-default
- Hover: brand-soft background, heading text
- Focus: 3px border-brand outline, 3px offset
- Overlap: -3px left margin

## Previous / Next Buttons

- Horizontal padding: 14px, height: 40px
- No radius on any item — square all the way across, no rounded end caps

## Active Page Item

- Text: black
- Background: brand (solid)
- Hover text: stays the same

## Rules

- Display as flex with -3px child overlap for seamless borders
- Items: neutral-primary-soft background, border-default border, body text
- Active: brand background with black text
- No rounded corners anywhere in the pagination row
- All items need hover and focus states (focus = 3px border-brand outline, offset 3px)

# Radios, Checkboxes & Toggles

> Dependencies: `colors.md`, `radius.md`

## Checkbox

- Size: 22x22px (bigger than a typical soft system — small controls disappear against thick borders otherwise)
- Radius: 0 (square, no exception)
- Border: 3px, border-default
- Background: neutral-primary-soft
- Checked: brand fill, black checkmark (bold/thick stroke)
- Focus: 3px border-brand outline, 3px offset

### Disabled
- Border: border-default-subtle
- Text: fg-disabled

## Radio

- Size: 22x22px
- Radius: fully rounded (999px) — the one deliberate exception, radios read as circles even in a square-first system
- Border: 3px, border-default
- Background: neutral-primary-soft
- Focus: 3px border-brand outline, 3px offset
- Checked: border-default (unchanged), indicator: solid black (or brand) dot filling ~50% of the circle

### Disabled
- Border: border-default-subtle
- Text: fg-disabled

Group all radio items under the same `name` attribute.

## Toggle

### Track
- **Not** fully rounded — a 0-radius rectangle track is more on-brand than a rounded pill, though a rounded track is an acceptable softer variant if the product needs it
- 3px border-default
- Background: neutral-tertiary
- Focus-within: 3px border-brand outline, 3px offset
- Checked track: brand background
- Disabled track: neutral-tertiary-soft background

### Thumb
- Square (0 radius) to match the track, or circular if the track is rounded — keep thumb and track shape consistent
- Background: white (light) / black (dark) — always the inverse of the track's border color, for contrast
- Border: 2px border-default

### Disabled
- Track: neutral-tertiary-soft background
- Label: fg-disabled text

## Rules

- All selection inputs must have `id` matching label `htmlFor`
- Focus states use a 3px border-brand outline offset 3px (no soft glow, ever)
- Selection controls carry a visible 3px border-default at rest — never borderless
- Disabled states: no hover/focus interaction

# Border Radius

This is a **square-cornered** system by default. Radius exists almost nowhere — the entire visual language depends on hard, crisp corners meeting hard, crisp borders.

| Token | Value | Default usage |
|---|---|---|
| none (base) | 0 | Blocks, cards, buttons, inputs, modals, menus, badges, panels, pagination — nearly everything |
| chunky (optional) | 6px | An intentional softer variant for a "sticker" card look, used sparingly and only when explicitly chosen — not a default |
| full | 999px | Pills, status dots, toggle thumbs (if track is rounded), radio dots, circular avatars (when explicitly wanted) |

## Rules

- **0 is the default radius across the entire product.** When in doubt, use 0.
- Never use 8–16px "soft modern" rounding as a default — it directly contradicts the system.
- The optional `chunky` (6px) token exists for teams who want a slightly softened brutalist flavor on select surfaces (e.g. badges) — it must be a deliberate, limited choice, not applied broadly.
- Radius must be consistent within each component family — don't mix `none` and `chunky` within one component's variants.
- Only true pills, dots, toggles (if rounded track chosen), and circular avatars may use `full`.

# Shadows

Shadows here are **hard, flat, and directional** — a solid offset copy of the element's border color, with zero blur and zero spread. They are the system's primary elevation and interaction language: an element's shadow tells you it's liftable, and losing its shadow on press tells you it's been pushed flat into the page.

Shadow color is `border-default` by default (black in light mode, white in dark mode) so shadow and border always match. An interactive element may optionally use an accent-colored shadow (e.g. brand yellow) for extra pop — resolved via custom properties `--shadow-color` if you want it configurable per-component.

| Token | Light value | Dark value | Use |
|---|---|---|---|
| shadow-none | none | none | Flush/pressed state, disabled controls, flat in-page dividers |
| shadow-sm | `4px 4px 0 #000000` | `4px 4px 0 #FFFFFF` | Buttons, inputs (on focus), badges-with-shadow, small blocks |
| shadow-md | `6px 6px 0 #000000` | `6px 6px 0 #FFFFFF` | Default in-flow cards/blocks, dropdown menus |
| shadow-lg | `8px 8px 0 #000000` | `8px 8px 0 #FFFFFF` | Modals, hero blocks, floating/prominent cards |

## The Press Mechanic

This is the system's signature interaction and applies to every clickable block/button:

1. **Rest:** element sits at `shadow-sm` or `shadow-md` (component-dependent), offset from the page.
2. **Hover** (optional but recommended): shadow grows one step (e.g. `shadow-sm` → `shadow-md`) — the element looks like it's lifting further off the page.
3. **Active/press:** shadow becomes `shadow-none`, and the element is translated via `transform: translate(Npx, Npx)` where N matches the *rest-state* shadow's offset exactly (4px for `shadow-sm`, 6px for `shadow-md`). The element now sits flush against the page — visually "pressed in."
4. **Release:** returns to rest state.

Implement this with a CSS transition on `transform` and `box-shadow` (linear, 80–100ms) rather than a spring/ease curve — the motion should read as mechanical and instant, not soft.

## Component Mapping

| Component type | Rest shadow | Notes |
|---|---|---|
| Buttons | shadow-sm | Full press mechanic on `:active` |
| Inputs | shadow-none (shadow-sm appears only on focus) | Focus is the only state that adds elevation |
| Badges, chips, list rows | shadow-none | Flat, in-flow chrome — no shadow needed at this scale |
| Cards / blocks (in-flow) | shadow-md | Grows to shadow-lg on hover if interactive |
| Dropdowns, popovers, tooltips | shadow-md | Static elevation, no press mechanic (these aren't "pressed") |
| Modals, hero blocks | shadow-lg | Static elevation |
| Pressed / selected / disabled state | shadow-none | Always flush |

## Rules

- Every shadow is a **flat, zero-blur offset** — never use `blur-radius` or `spread-radius` above 0.
- Shadow color always matches the border color of the element it belongs to, unless an accent-colored shadow is a deliberate stylistic choice.
- The press mechanic (shadow removal + translate) is mandatory on every clickable button/card — it's not optional flourish, it's the system's core feedback language.
- Never stack two shadow tokens on one element.
- Dark mode shadows are white, not a dimmed/transparent black — full contrast in both modes.

# Sidebars

> Dependencies: `colors.md`, `radius.md`, `typography.md`, `badges.md`, `alerts.md`

## Core Specs

- Background: neutral-primary-soft
- Right border: 3px, border-default (for left-sidebar); left border for right-sidebar
- Width: 264px

## Anatomy

### Outer Container
Hidden on mobile, visible at small breakpoint. Needs a toggle/trigger for mobile.

### Inner Wrapper
- Full height, vertical scroll overflow
- Padding: 16px horizontal, 20px vertical

### Navigation List
- Vertical spacing: 10px between items
- Font weight: bold

### Navigation Item
- Layout: flex, vertically centered
- Padding: 10px horizontal, 9px vertical
- Text: heading color
- Radius: 0
- Border: 2px transparent at rest, becomes 2px border-default on hover/active (the border itself is the hover signal, not just a background tint)
- Hover: brand-softer background, border-default border appears
- Transition: background-color and border-color, 80ms, linear
- Icon: 20x20px, body color, hover → heading color
- Label: 12px left margin from icon (sans, 14px, bold)

### Active Item
- Background: brand-soft
- Border: 2px border-default
- Text: fg-brand-strong

### Separator
- 20px top padding, 20px top margin
- Top border: 3px border-default
- 10px vertical spacing below

### Bottom CTA / Card
- Padding: 20px
- Top margin: 24px
- Radius: 0
- Border: 3px border-default
- Shadow: shadow-sm
- Background: brand-softer
- Can also use any alert variant from `alerts.md`

## Rules

- Responsive: hidden on mobile with a trigger mechanism
- Icons: 22x22px, body color (hover: heading color)
- Multi-level menus: indent with 44px left padding
- Spacing follows 4px grid, favoring chunkier steps
- Only neutral, brand, or status/accent tokens — no arbitrary colors

# Tables

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Wrapper

- Horizontal scroll overflow
- Background: neutral-primary-soft
- Radius: 0
- Border: 3px, border-default
- Shadow: `shadow-md` if the table is presented as its own floating block; `shadow-none` if it's inline content within a larger block

## Table Element

- Full width, left-aligned text (right-aligned for RTL)
- Font: 14px sans, body color (mono is appropriate for numeric/ID columns, tabular-nums)

## Table Head

- Font: 13px sans, heading color, bold weight, uppercase, 0.3px letter-spacing
- Background: brand-soft (a colored head row is on-brand here, not just a neutral gray) or neutral-secondary for a quieter table
- Bottom border: 3px border-default
- Cell padding: 16px horizontal, 12px vertical

## Table Body

- Row background: neutral-primary-soft
- Row bottom border: 2px border-default-subtle (omit on last row to avoid doubling with wrapper border)
- Row hover: brand-softer background
- Row header: bold weight, heading color, no-wrap
- Cell padding: 16px horizontal, 12px vertical

## Rules

- Wrapper must have horizontal scroll overflow for responsive scrolling
- Last row: omit bottom border to avoid doubling with wrapper border
- Row headers: always `scope="row"` for semantic structure
- Hover on rows is recommended (brand-softer background) since it's cheap contrast and reads well
- No arbitrary hex codes — use token colors only

# Tabs

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Core Specs

- Typography: 14px sans, bold weight, body color, uppercase optional
- Transitions: background-color and border-color, 80ms, linear

## Variants

### 1. Underline (Default)

**Wrapper:** bottom border, 3px border-default

**Tab Item:**
- Padding: 14px horizontal, 12px vertical
- Bottom border: 4px, transparent at rest
- No radius
- Transition: border-color, 80ms, linear

| State | Appearance |
|---|---|
| Active | fg-brand-strong text, 4px border-brand bottom border |
| Inactive | transparent bottom border; hover → heading text, border-default-subtle bottom border |
| Disabled | fg-disabled text, not-allowed cursor |

### 2. Blocks (Pills variant, squared)

**Tab Item:**
- Padding: 14px horizontal, 9px vertical
- Radius: 0
- Border: 3px border-default
- Shadow: shadow-sm at rest, shadow-none + translate on active/selected (the tab itself gets pressed-in when selected — a nice literal use of the press mechanic)
- Font weight: bold

| State | Appearance |
|---|---|
| Active | brand background, black text, shadow-none (visually "pressed in" / currently selected) |
| Inactive | neutral-primary-soft background, shadow-sm; hover → brand-softer background |
| Disabled | fg-disabled text, not-allowed cursor, shadow-none |

### 3. Full Width

Children overlap with -3px left margin on all except first (matching border width).

**Tab Item:**
- Full width, centered text
- Padding: 14px horizontal, 12px vertical
- Background: neutral-primary-soft
- Border: 3px, border-default
- Transition: background-color, 80ms, linear
- Hover: brand-softer background, heading text

| State | Appearance |
|---|---|
| Active | brand background, black text |
| First item | no radius (square, matches the rest) |
| Last item | no radius (square, matches the rest) |

## Tabs with Icons

- Icon size: 18x18px or 22x22px
- Spacing: 8px right margin
- Layout: inline-flex, centered
- Icons inherit the text color of the tab state

# Tooltips & Popovers

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Tooltips

### Core Specs
- Padding: 8px horizontal, 6px vertical
- Font: 12px sans, bold weight
- Radius: 0
- Border: 2px (matches variant)
- Shadow: `shadow-sm` hard offset
- Transition: opacity, 80ms, linear

### Dark (Default)
- Background: dark (black in light mode, white-on-black-inverted... i.e. use `dark` token: black bg)
- Text: white
- Border: border-default

### Light
- Background: neutral-primary-medium
- Text: heading color
- Border: 2px, border-default

## Popovers

A popover is a small floating **block**: bordered, square, with a hard offset shadow.

### Core Specs
- Background: neutral-primary-soft
- Radius: 0
- Shadow: `shadow-md`
- Border: 3px, border-default
- Transition: opacity, 80ms, linear

### Header / Title
- Padding: 10px horizontal, 8px vertical
- Background: brand-soft (or neutral-secondary for a quieter popover)
- Bottom border: 3px border-default
- Font: 13–14px sans, bold weight, heading color

### Body / Content
- Standard: 12px horizontal, 10px vertical padding; 14px, body color
- Rich: 18px padding; 14px, body color

## Arrows

- Size: 10x10px rotated 45deg, with a 2px border-default on the exposed edges — a chunkier arrow than a soft system's, to match the border weight
- Color must match the background of the tooltip/popover variant

## Rules

- Tooltips & popovers: 0 radius, always bordered, never blurred
- Floating shadow: `shadow-sm` for tooltips, `shadow-md` for popovers
- Dark tooltips: black background, white text
- Light tooltips/popovers: semantic neutral background + border tokens
- Arrows match parent background color and border

# Typography

> Dependencies: `colors.md`

Two typefaces (plus mono) carry the system:

- **Display / Headings — a heavy grotesk** (e.g. *Archivo Black* or *Space Grotesk* at its heaviest weight, fallback system sans-serif/Arial Black). Big, tight, and blunt — headings should look shouted, not spoken.
- **Body / UI — a clean, plain grotesk** (e.g. *Inter*, fallback system sans-serif). Used for paragraphs, labels, buttons, navigation — legible and quiet so it doesn't compete with the headings.
- **Mono — a plain monospace** (e.g. *JetBrains Mono*, fallback ui-monospace/monospace). Used for code, terminal panes, timestamps, file metadata, and short "system" labels.

## Core Rules

- **Headings use the heavy display font**, heading text color, black/extra-bold weight (800–900). Tight line-height for a poster-like density. Uppercase is an acceptable and on-brand treatment for `h1`/`h2`, optional below that.
- **Body copy uses the plain sans font**, body text color. Reserve saturated accent color for short emphasis only, never for a full paragraph.
- **Mono is intentional, not decorative** — reserve it for code, timestamps, metadata, file names, and short system labels.
- **Semantic HTML:** Use `h1`–`h6` in order, never skip levels.

## Heading Scale (display)

### Desktop

| Element | Size | Line-height | Letter-spacing | Margin-bottom |
|---|---|---|---|---|
| `h1` | 64px | 0.95 | -1px | 24px |
| `h2` | 48px | 1.0 | -0.5px | — |
| `h3` | 36px | 1.05 | — | — |
| `h4` | 28px | 1.1 | — | — |
| `h5` | 22px | 1.15 | — | — |
| `h6` | 18px | 1.2 | — | — |

### Responsive

| Element | Tablet (≥768px) | Mobile (default) |
|---|---|---|
| `h1` | 44px | 34px |
| `h2` | 36px | 28px |
| `h3` | 30px | 24px |
| `h4` | 24px | 20px |
| `h5` | 20px | 18px |
| `h6` | 17px | 16px |

Mobile-first: start with mobile sizes, scale up at tablet and desktop breakpoints. Never reduce a heading's line-height below 0.9.

## Paragraphs (sans)

### Leading Paragraph
- Size: 19px
- Weight: normal
- Color: body
- Line-height: 1.6
- Max width: ~70 characters

### Normal Paragraph
- Size: 16px
- Weight: normal
- Color: body
- Line-height: 1.6
- Max width: ~65 characters

### Small Supporting Copy
- Size: 13px
- Weight: normal
- Color: body-subtle
- Line-height: 1.5
- Use only for helper text, legal text, captions, metadata.

## UI Labels (sans, unless noted)

| Context | Size | Weight |
|---|---|---|
| Button labels | 14–16px, uppercase | 700 (bold) |
| Input labels | 13–14px, uppercase | 700 (bold) |
| Menu-bar items | 13–14px, uppercase | 700 |
| Block heading (in-body) | display scale | 800–900 |
| Captions / meta / badges | 11–13px, uppercase | 700 |
| Timestamps / file names / system labels | 12–13px | 500, **mono**, tabular-nums |

Do not apply paragraph line-height to control labels.

## Mono Usage

- Code blocks & inline code: mono, `code-text` (neon lime) on `code-bg` (black).
- Terminal / console panes: mono, `code-text` foreground on `code-bg`.
- Timestamps, durations, counts: mono with tabular figures so digits don't shift.
- Short uppercase "system" tags (e.g. `README.TXT`, `v1.0`): mono, uppercase, 0.4px letter-spacing.

## Links

- **Inline links:** Same size as surrounding text, `fg-brand` color, thick 2px solid underline (not the browser default thin underline), hover → background flips to solid `brand` yellow with black text (a "highlighter" effect) instead of just removing the underline.
- **CTA links:** `fg-brand` color, bold weight, thick underline, same highlighter hover treatment.

## Emphasis

- `<strong>` for high-priority emphasis in body text — bold weight jump is already large in this system, so it reads clearly.
- `<em>` for tone emphasis only, not visual hierarchy.
- All-caps is a default treatment for headings and UI labels here, not just short tags — use it freely, it's on-brand.

## Dark Mode

Hierarchy and typefaces stay identical. Only color tokens change (automatic via CSS custom properties) — including borders and shadows flipping from black to white. Size, weight, and spacing remain constant.
