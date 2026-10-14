# Paperclub design system

Visual source: the user-provided Altius style document and 9.27-second scrolling video. This system adapts their warm dark palette, tight sans typography, technical mono accents, hairline panels and peach surface changes to the existing Paperclub application. Source headings, claims, investor logos and landing-page sections are not product content.

## App structure

Seven existing routes, an application sidebar, persistent wallet/search controls and compact data workspaces. Overview remains a protocol dashboard; Terminal remains a chart/risk/order workspace. Profiles, community, rewards, research and treasury keep their existing functions. No marketing hero, sales funnel, fake chart, invented metric or new slogan.

Genre: a technical workbench with reference-derived dark/peach surfaces. Reference design overrides catalog theme rotation. Pages share one system. Main content max-width 1200px; responsive layouts preserve the existing 320/375/414/768 px behavior.

## Colors and surfaces

Obsidian Ember #190501 is the canvas. Dark Cocoa #340a01 lifts operational panels. Molten Core #631303 provides inset primary-button warmth. Signal Red #951c04 is used on light surfaces for actions/errors; Flare Orange #fa5838 marks links, charts, active navigation and focus on dark. Linen #f7f6ff is main text; Warm Ash #baadab is muted text. Vapor Peach #feeae6 provides a light working surface for balance strips, definitions and risk inputs.

The source's dark/light rhythm becomes changes between working modules rather than full-screen landing bands. Light modules locally redefine ink/muted/action/focus tokens. Additional control-border shades are tuned for contrast. Financial values retain explicit labels/signs; PAPER and queued claims remain separate from cash.

## Typography

Inter 400/500/700 replaces the reference's Matter because no licensed Matter files were supplied; it is an explicitly suggested substitute. IBM Plex Mono 400/500 replaces Fabrikatmono. Font files are bundled locally with their license notices. App headings use short route names, roman bold, tight tracking; no promotional statements. Display scale is adapted to app density: 32–44px page names, 22–24px panel headings, 52–72px headline balance, 14–15px body and 12–13px technical metadata.

## Components

- Primary actions: dark cocoa/moltencore inset warmth, Linen text, 4px radius. No bright-orange filled CTA.
- Secondary actions: transparent warm surface, thin contrast-tested boundary, 4px radius; labels remain one line.
- Panels: 8px radius, 1px warm hairline, 24–32px desktop padding, compact mobile padding. No drop shadows or floating marketing cards.
- Tables and balances: tabular figures, technical mono labels and thin rows. Mobile tables retain their field labels.
- Charts: existing actual price/model data with coral lines; no decorative spectrum mistaken for data.
- Navigation: existing routes and sidebar behavior, consistent outline SVG icons, restrained active edge and coral label.
- Feedback: existing wallet dismiss/Escape/six-second expiry behavior stays intact; messages remain bounded on mobile.

## Interaction and accessibility

Existing wallet, points, claims inspector and research controls retain their behavior. Focus appears immediately; controls have 44px targets. Hover/press changes are subtle and use only opacity/transform where animated. No scroll reveals, autoplay decoration, glass blur or motion library. Reduced motion is supported. Checked text pairs target WCAG 4.5:1, control/focus boundaries 3:1. All product text remains English and dates UTC.

## Source of truth and exports

`tokens.css` contains the complete named token system. `apps/web/app/globals.css` retains structural behavior; `ember.css` adapts component geometry and surface rhythm. Functional components/data adapters are preserved. Exports in this document mirror the root tokens for reuse.

### CSS tokens

```css
/* Hallmark · macrostructure: application workbench · tone: technical · anchor hue: ember coral */
:root {
  color-scheme: dark;
  --color-obsidian-ember: oklch(15.1163% 0.040742 41.0058);
  --color-dark-cocoa: oklch(21.9501% 0.070392 36.9884);
  --color-molten-core: oklch(32.8279% 0.115523 33.3257);
  --color-signal-red: oklch(43.512% 0.159239 32.468);
  --color-flare-orange: oklch(67.3978% 0.203285 33.1211);
  --color-warm-blush: oklch(81.7627% 0.097615 31.7444);
  --color-vapor-peach: oklch(95.1931% 0.022552 31.1026);
  --color-linen: oklch(97.648% 0.011965 291.2929);
  --color-warm-ash: oklch(75.7977% 0.015297 28.0457);
  --color-control-dark: oklch(55.9465% 0.132023 35.0814);
  --color-control-light: oklch(56.4073% 0.053575 37.7981);
  --color-light-muted: oklch(48.1307% 0.04043 33.9395);
  --color-warm-rule: oklch(38.7063% 0.066717 32.2592);
  --color-light-rule: oklch(75.1234% 0.045467 37.6627);
  --color-light-inset: oklch(90.7984% 0.035279 35.3381);
  --color-inset-line: oklch(32.8273% 0.072697 33.3737);
  --color-paper: var(--color-obsidian-ember);
  --color-surface: var(--color-dark-cocoa);
  --color-paper-2: var(--color-molten-core);
  --color-ink: var(--color-linen);
  --color-muted: var(--color-warm-ash);
  --color-line: var(--color-warm-rule);
  --color-control-line: var(--color-control-dark);
  --color-accent: var(--color-flare-orange);
  --color-accent-ink: var(--color-linen);
  --color-accent-soft: var(--color-molten-core);
  --color-positive: var(--color-warm-blush);
  --color-positive-soft: var(--color-molten-core);
  --color-error: var(--color-flare-orange);
  --color-error-soft: var(--color-dark-cocoa);
  --color-focus: var(--color-warm-blush);
  --color-transparent: transparent;
  --font-display: 'Inter', 'Segoe UI', sans-serif;
  --font-body: 'Inter', 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-body: 15px;
  --text-panel: 22px;
  --text-page: clamp(32px, 3vw, 44px);
  --text-balance: clamp(52px, 5vw, 72px);
  --radius: 4px;
  --radius-card: 8px;
  --radius-input: 4px;
  --rule-hair: 1px;
  --dur-micro: 120ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --shadow-inset: inset 0 0 20px 0 var(--color-molten-core);
}
```

### Tailwind theme

```css
@theme {
  --color-obsidian-ember: oklch(15.1163% 0.040742 41.0058);
  --color-dark-cocoa: oklch(21.9501% 0.070392 36.9884);
  --color-molten-core: oklch(32.8279% 0.115523 33.3257);
  --color-signal-red: oklch(43.512% 0.159239 32.468);
  --color-flare-orange: oklch(67.3978% 0.203285 33.1211);
  --color-warm-blush: oklch(81.7627% 0.097615 31.7444);
  --color-vapor-peach: oklch(95.1931% 0.022552 31.1026);
  --color-linen: oklch(97.648% 0.011965 291.2929);
  --color-warm-ash: oklch(75.7977% 0.015297 28.0457);
  --color-control-dark: oklch(55.9465% 0.132023 35.0814);
  --color-control-light: oklch(56.4073% 0.053575 37.7981);
  --color-light-muted: oklch(48.1307% 0.04043 33.9395);
  --color-warm-rule: oklch(38.7063% 0.066717 32.2592);
  --color-light-rule: oklch(75.1234% 0.045467 37.6627);
  --color-light-inset: oklch(90.7984% 0.035279 35.3381);
  --color-inset-line: oklch(32.8273% 0.072697 33.3737);
  --color-paper: var(--color-obsidian-ember);
  --color-surface: var(--color-dark-cocoa);
  --color-paper-2: var(--color-molten-core);
  --color-ink: var(--color-linen);
  --color-muted: var(--color-warm-ash);
  --color-line: var(--color-warm-rule);
  --color-control-line: var(--color-control-dark);
  --color-accent: var(--color-flare-orange);
  --color-accent-ink: var(--color-linen);
  --color-accent-soft: var(--color-molten-core);
  --color-positive: var(--color-warm-blush);
  --color-positive-soft: var(--color-molten-core);
  --color-error: var(--color-flare-orange);
  --color-error-soft: var(--color-dark-cocoa);
  --color-focus: var(--color-warm-blush);
  --color-transparent: transparent;
  --font-display: 'Inter', 'Segoe UI', sans-serif;
  --font-body: 'Inter', 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 24px;
  --spacing-6: 32px;
  --spacing-7: 48px;
  --spacing-8: 64px;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-body: 15px;
  --text-panel: 22px;
  --text-page: clamp(32px, 3vw, 44px);
  --text-balance: clamp(52px, 5vw, 72px);
  --radius: 4px;
  --radius-card: 8px;
  --radius-input: 4px;
  --rule-hair: 1px;
  --dur-micro: 120ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### DTCG token export

```json
{
  "color-obsidian-ember": {
    "$type": "color",
    "$value": "oklch(15.1163% 0.040742 41.0058)"
  },
  "color-dark-cocoa": {
    "$type": "color",
    "$value": "oklch(21.9501% 0.070392 36.9884)"
  },
  "color-molten-core": {
    "$type": "color",
    "$value": "oklch(32.8279% 0.115523 33.3257)"
  },
  "color-signal-red": {
    "$type": "color",
    "$value": "oklch(43.5120% 0.159239 32.4680)"
  },
  "color-flare-orange": {
    "$type": "color",
    "$value": "oklch(67.3978% 0.203285 33.1211)"
  },
  "color-warm-blush": {
    "$type": "color",
    "$value": "oklch(81.7627% 0.097615 31.7444)"
  },
  "color-vapor-peach": {
    "$type": "color",
    "$value": "oklch(95.1931% 0.022552 31.1026)"
  },
  "color-linen": {
    "$type": "color",
    "$value": "oklch(97.6480% 0.011965 291.2929)"
  },
  "color-warm-ash": {
    "$type": "color",
    "$value": "oklch(75.7977% 0.015297 28.0457)"
  },
  "color-control-dark": {
    "$type": "color",
    "$value": "oklch(55.9465% 0.132023 35.0814)"
  },
  "color-control-light": {
    "$type": "color",
    "$value": "oklch(56.4073% 0.053575 37.7981)"
  },
  "color-light-muted": {
    "$type": "color",
    "$value": "oklch(48.1307% 0.040430 33.9395)"
  },
  "color-warm-rule": {
    "$type": "color",
    "$value": "oklch(38.7063% 0.066717 32.2592)"
  },
  "color-light-rule": {
    "$type": "color",
    "$value": "oklch(75.1234% 0.045467 37.6627)"
  },
  "color-light-inset": {
    "$type": "color",
    "$value": "oklch(90.7984% 0.035279 35.3381)"
  },
  "color-inset-line": {
    "$type": "color",
    "$value": "oklch(32.8273% 0.072697 33.3737)"
  },
  "color-paper": {
    "$type": "color",
    "$value": "var(--color-obsidian-ember)"
  },
  "color-surface": {
    "$type": "color",
    "$value": "var(--color-dark-cocoa)"
  },
  "color-paper-2": {
    "$type": "color",
    "$value": "var(--color-molten-core)"
  },
  "color-ink": {
    "$type": "color",
    "$value": "var(--color-linen)"
  },
  "color-muted": {
    "$type": "color",
    "$value": "var(--color-warm-ash)"
  },
  "color-line": {
    "$type": "color",
    "$value": "var(--color-warm-rule)"
  },
  "color-control-line": {
    "$type": "color",
    "$value": "var(--color-control-dark)"
  },
  "color-accent": {
    "$type": "color",
    "$value": "var(--color-flare-orange)"
  },
  "color-accent-ink": {
    "$type": "color",
    "$value": "var(--color-linen)"
  },
  "color-accent-soft": {
    "$type": "color",
    "$value": "var(--color-molten-core)"
  },
  "color-positive": {
    "$type": "color",
    "$value": "var(--color-warm-blush)"
  },
  "color-positive-soft": {
    "$type": "color",
    "$value": "var(--color-molten-core)"
  },
  "color-error": {
    "$type": "color",
    "$value": "var(--color-flare-orange)"
  },
  "color-error-soft": {
    "$type": "color",
    "$value": "var(--color-dark-cocoa)"
  },
  "color-focus": {
    "$type": "color",
    "$value": "var(--color-warm-blush)"
  },
  "color-transparent": {
    "$type": "color",
    "$value": "transparent"
  },
  "font-display": {
    "$type": "fontFamily",
    "$value": "'Inter', 'Segoe UI', sans-serif"
  },
  "font-body": {
    "$type": "fontFamily",
    "$value": "'Inter', 'Segoe UI', sans-serif"
  },
  "font-mono": {
    "$type": "fontFamily",
    "$value": "'IBM Plex Mono', ui-monospace, monospace"
  },
  "space-1": {
    "$type": "dimension",
    "$value": "4px"
  },
  "space-2": {
    "$type": "dimension",
    "$value": "8px"
  },
  "space-3": {
    "$type": "dimension",
    "$value": "12px"
  },
  "space-4": {
    "$type": "dimension",
    "$value": "16px"
  },
  "space-5": {
    "$type": "dimension",
    "$value": "24px"
  },
  "space-6": {
    "$type": "dimension",
    "$value": "32px"
  },
  "space-7": {
    "$type": "dimension",
    "$value": "48px"
  },
  "space-8": {
    "$type": "dimension",
    "$value": "64px"
  },
  "text-xs": {
    "$type": "dimension",
    "$value": "12px"
  },
  "text-sm": {
    "$type": "dimension",
    "$value": "14px"
  },
  "text-body": {
    "$type": "dimension",
    "$value": "15px"
  },
  "text-panel": {
    "$type": "dimension",
    "$value": "22px"
  },
  "text-page": {
    "$type": "dimension",
    "$value": "clamp(32px, 3vw, 44px)"
  },
  "text-balance": {
    "$type": "dimension",
    "$value": "clamp(52px, 5vw, 72px)"
  },
  "radius": {
    "$type": "dimension",
    "$value": "4px"
  },
  "radius-card": {
    "$type": "dimension",
    "$value": "8px"
  },
  "radius-input": {
    "$type": "dimension",
    "$value": "4px"
  },
  "rule-hair": {
    "$type": "dimension",
    "$value": "1px"
  },
  "dur-micro": {
    "$type": "duration",
    "$value": "120ms"
  },
  "ease-out": {
    "$type": "cubicBezier",
    "$value": "cubic-bezier(0.16, 1, 0.3, 1)"
  },
  "ease-in": {
    "$type": "cubicBezier",
    "$value": "cubic-bezier(0.7, 0, 0.84, 0)"
  },
  "ease-in-out": {
    "$type": "cubicBezier",
    "$value": "cubic-bezier(0.65, 0, 0.35, 1)"
  },
  "shadow-inset": {
    "$type": "dimension",
    "$value": "inset 0 0 20px 0 var(--color-molten-core)"
  }
}
```

### shadcn semantic mapping

```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --muted: var(--color-paper-2);
  --muted-foreground: var(--color-muted);
  --border: var(--color-line);
  --input: var(--color-control-line);
  --ring: var(--color-focus);
  --radius: var(--radius-card);
}
```
