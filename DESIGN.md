---
name: Jeolee Cupids
description: The established modern pink-and-black Jeolee fan hub.
colors:
  pink: "#f576b5"
  pink-hover: "#e960a4"
  pale-pink: "#f9dce9"
  ground: "#0b0b0f"
  surface: "#19191e"
  field: "#242329"
  white: "#f8f4f6"
  muted: "#c8bec9"
  line: "#716676"
  divider: "#39343e"
  error: "#ffb0c7"
  outline-border: "#d8cfd9"
typography:
  home-display:
    fontFamily: "Pathway, DM, sans-serif"
    fontSize: "clamp(68px,6.55vw,96px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-.035em"
  page-title:
    fontFamily: "Pathway, DM, sans-serif"
    fontSize: "clamp(42px,5vw,68px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-.03em"
  section-title:
    fontFamily: "Pathway, DM, sans-serif"
    fontSize: "clamp(28px,3vw,40px)"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-.025em"
  body:
    fontFamily: "DM, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: "DM, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  news-label:
    fontFamily: "DM, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  field: "12px"
  media: "16px"
  search: "18px"
  panel: "20px"
  card: "24px"
  hero: "28px"
  pill: "99px"
spacing:
  gutter: "clamp(20px,2.2vw,42px)"
  control-gap: "12px"
  media-gap: "18px"
  panel-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ground}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.pink-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-outline-hover:
    backgroundColor: "{colors.field}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.white}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  news-label:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ground}"
    typography: "{typography.news-label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  update-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  receipt:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.field}"
    padding: "20px"
---

# Design System: Jeolee Cupids

## Overview

Jeolee Cupids uses the established modern pink-and-black fan-hub identity: dark photographic surfaces, prominent Pathway Extreme headings, and DM Sans controls and reading text. Existing photographs and creator attribution are part of that identity. The approved direction preserves this world and does not return to a newspaper/editorial aesthetic.

**Key Characteristics:**

- Pink accents over near-black backgrounds.
- Rounded photographic cards and pill controls.
- Strong display headings with readable sans-serif UI.
- Visible sources, creator credits, and dated content.

This is a code-derived record of the implementation at commit `6d68a7502bb3cc1021341edc1d4a25fb1a4c214b`. Read `PRODUCT.md` for product commitments and `.impeccable/surfaces/site-structure.md` for this surface's composition. It does not certify a rendered screenshot, contrast audit, or mobile geometry.

## Colors

The normative palette above follows the effective shared CSS cascade: `style.css`, a route stylesheet where present, `modern.css`, then `site.css`.

### Primary

- **Pink** identifies the wordmark, selected navigation, primary actions, and headings that call out the Jeolee name.
- **Pink hover** is the established primary hover state.
- **Pale pink** carries secondary links, draft status, and the existing light fandom panel.

### Neutral

- **Ground** is the page and header backdrop and the text on pink controls.
- **Surface** groups cards, dialogs, search areas, and empty states.
- **Field** distinguishes editable controls and receipt interiors.
- **White** is the main foreground; **muted** supports descriptions, metadata, and helper text.
- **Line** is the main control and divider border; **divider** is the quieter structural line.
- **Outline border** belongs to the outline action. **Error** identifies form failures and destructive text.

Legacy variable names `--red` and `--red-hover` alias the pink colors in `modern.css`; their names do not establish a separate red palette.

## Typography

**Display Font:** Pathway Extreme, loaded locally under the CSS family `Pathway`. Its font face declares weights 100–900 and font-display swap.

**Body Font:** DM Sans, loaded locally under `DM` at weights 400 and 600, with Arial and sans-serif fallbacks.

The frontmatter captures reused roles, not every route-specific size. Home's display is large and tightly set; page introductions and section headings use the same family with smaller proportions. Buttons, navigation, body copy, search controls, and metadata use DM.

Reading text commonly uses 16–18px with 1.6–1.7 line height. Wiki prose is 17px/1.8 and becomes 16px at the 700px breakpoint; the reading column is capped at 74ch and prose at 75ch. Labels and metadata generally use 13–15px. Input text remains 16px.

## Layout

The Home container and shared header have a maximum width of 1660px. Inner pages use a 1440px shell with the inherited fluid gutter, 32px top padding and 64px bottom padding; the wiki and admin retain their route-specific shells. These are observed values rather than a new spacing scale.

The shared header wraps desktop navigation and a Contribute disclosure. At 760px and below it shows a Menu button; opening it reveals a two-column navigation grid. Its links are at least 48px high in that layout. The Contribute choices move from an anchored popover into document flow.

Home uses section introductions, a two-card-width update strip, a fandom panel, a moment preview grid, and a page preview grid. About uses a two-column introduction and visible biography cards. Updates uses a two-column archive and wrapping search tools. Moments uses three featured cards and a four-column collection grid.

At 1000px and below, moment grids use three columns. At 760px, About columns and the update archive stack, the page previews become one column, and the timeline date moves above its text. At 600px, moment grids use two columns, the update strip uses 90% width cards, and featured moments become a horizontal snap strip. The Home hero changes to a stacked photograph/copy layout at 700px. Existing wiki and admin layouts also stack at 700px.

These breakpoints overlap intentionally in the current cascade; use the specific component's source when changing behavior.

## Elevation & Depth

Most content is grouped by dark surface fills, spacing, and rounded edges. Photographs use overlays where text sits over the image. The Home hero retains its dark gradient toward the copy. Floating elements use the existing shadows: dialogs have `0 24px 80px #0009`, toasts have `0 8px 32px #0005`, and the Contribute popover has `0 12px 28px #0005`. The dialog backdrop is `#000d`.

Motion is limited to implemented transitions, image hover scaling, dialog entry, and the optional Home arrival. The shared easing is `cubic-bezier(.16,1,.3,1)`. Reduced-motion CSS disables animations and transitions and restores automatic scrolling. There is no automatic update-carousel advancement.

## Shapes

Pill controls and labels use the pill radius. Editable fields and receipts use the field radius. Media commonly uses the media radius; content panels use panel or card radii. Home's hero uses the hero radius on desktop and the card radius at 700px. Update cards change from card to panel radius at 700px. Dialogs use card radius, with the viewer/add/admin dialogs changing to panel radius at 700px. Circular icon and play buttons retain their circular silhouette.

Borders provide field edges, outlines, and quiet dividers. Do not infer a universal radius from older declarations in `style.css`: `modern.css` and `site.css` own the effective shared treatments.

## Components

The About introduction uses the user-selected `about-jeolee.jpg` in a 4:3 frame at `object-position: 50% 58%` on desktop and mobile, keeping both faces visible. Its original portrait file remains unchanged.


### Buttons and filters

Primary actions pair pink fill with ground text; outline actions use white text, a thin outline border, and a field-colored hover. Shared buttons have a minimum height of 44px. The common button typography, padding, and shape are in the frontmatter; hero and large buttons have explicit route overrides.

Collection filters are pills with surface fill and line borders. Their active state uses pink fill and ground text. Hover and selected styling do not replace the visible focus indicator.

### Inputs and contribution feedback

Inputs and selects use field fill, a line-colored border, 16px text, and a minimum height of 48px. Textareas share the field treatment where declared by wiki/admin route CSS; the update suggestion textarea currently inherits its own route declarations and the generic rounded control rule.

Draft notices use pale pink. Receipt boxes use field fill and the field radius. Errors use the error color and a live alert region. Successful submission changes the form to a review receipt; a receipt confirms submission, not publication.

### Navigation

The pink wordmark links home. The five destinations are real links, and the current destination uses `aria-current="page"` with a pink pill. Desktop links have a minimum height of 44px. The mobile Menu button tracks `aria-expanded`; Escape and outside clicks close the mobile menu, and Escape returns focus when it was open. The native Contribute disclosure groups clip, page, and update contribution destinations.

### Update cards and carousel

Update cards carry a story-type label, a linked Pathway heading, source/date text, and optional imagery and summary. Home's compact cards omit the summary. Illustrative photographs are labeled separately from post imagery. The archive does not clamp headings.

The Home strip scrolls with snap alignment and Previous/Next controls. Position text is announced politely. Disabled navigation buttons use reduced opacity and a default cursor. Story timestamps remain distinct from reader-check timestamps.

### Moment cards and viewer

Moment thumbnails crop with object-fit cover and keep a visible creator caption. The card is a button that opens the dialog viewer; its title underlines on hover. Media is the viewer's focus, with creator identity and original-source access in a separate header. Share controls expose a link to the current moment. Preserve collection and moment URL state.

### About, fandom, and reference panels

Biography cards show their copy directly. The fandom introduction retains the pale-pink surface with ground text, alongside the dark fanbase directory. Wiki page cards use surface fill and rounded panels; the reader uses a contents column, source list, related links, and approved history. Composition stays in the surface brief rather than becoming a rule for every page.

### Focus and accessibility states

The general visible-focus treatment is a 3px pink outline with a 5px offset; primary pink buttons and light fandom panels use white focus. The carousel defines its own 2px pink outline with a 4px offset. Skip links become visible on keyboard focus. Disabled buttons use lower opacity; retain each component's existing cursor behavior.

### Images

Retain the full-size `little-things.png` and `together.png` source files. Build-time AVIF/WebP derivatives use the 480/960/1280 target widths without enlargement. Use the existing picture/srcset helper and explicit intrinsic dimensions where supplied. The asset manifest records derivative lineage and honest provenance limits for inherited rasters.

## Do's and Don'ts

### Do:

- **Do** preserve the modern pink-and-black identity and existing photography.
- **Do** use Pathway for display headings and DM for controls and body copy.
- **Do** retain source links, creator credits, and original dates alongside media and updates.
- **Do** retain visible keyboard focus and honor reduced-motion preferences.

### Don't:

- **Don't** replace this identity with a newspaper/editorial aesthetic.
- **Don't** treat an update check time as the story publication time.
- **Don't** replace retained full-size source photographs with optimized derivatives.
- **Don't** claim browser, contrast, or mobile visual verification from this code-only record.
