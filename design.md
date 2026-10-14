# Paperclub design system

The latest user direction restores the original light paper / cobalt palette and replaces the old sidebar structure. The supplied Altius video contributes horizontal navigation, broad full-width sections, centered protocol data and contrasting surface bands. The product remains a seven-route application.

## Structure and spacing

Top navigation with persistent wallet controls; a mobile menu below 1120px. A 1200px usable content width sits inside a 1264px container. Overview now contains a centered live protocol-liquidity band, four summary balances, interactive BTC/ETH charts, community actions and a collapsed integration-status disclosure. Terminal keeps the actual chart/risk/sandbox workflow. Other routes retain their functioning controls in broad workspaces.

`#main` has one vertical rhythm: 32px between all direct children, 24px on mobile. Child outer margins are reset centrally, including chart components that render fragments. Panels use 32px desktop / 24px mobile internal padding. Split sections and market cards have 24px gutters. Heading-to-paragraph and paragraph-to-paragraph gaps are 16px. No touching Research blocks.

## Palette and typography

Exact original palette: paper #f4f6fa, surface #fdfefe, ink #19243a, muted #56647a and cobalt #244cda. Positive/error colors remain distinct. Only named CSS tokens supply colors and fonts. Control borders add a contrast-tested neutral; decorative separators retain the original soft grey. No warm/dark palette remains active.

Locally bundled Inter 400/500/700 and IBM Plex Mono 400/500, with OFL notices in the public font-licenses directory. Short English functional headings, roman type, 14–15px body and 12px metadata. No slogans, fake metrics or decorative charts masquerading as data.

## Interaction

Market cards read the existing public market API, refresh every 15 seconds while the page is visible, expose 1h/24h periods and show historical candle prices on pointer inspection. Failed feeds preserve cached data with explicit status. Market links select BTC or ETH in Terminal. No fabricated balance or zero substitutes for unavailable data. Integration checks remain visible in an expandable disclosure.

The mobile menu closes on route change, Escape and desktop resize. Wallet notices retain their dismissal, Escape, six-second expiry and clearing on route/account/network changes. Existing search, campaign, research and reward controls remain functional. Reduced motion is honored. Live trading, token deployment and custody remain disabled.

## Implementation and portable exports

`tokens.css` is the source of truth. `globals.css` contains the original component base; `product.css` supplies the new application geometry. Routes and financial adapters are preserved. No hosting or publication is part of this change.

### CSS

```css
/* Hallmark · macrostructure: horizontal app · anchor hue: original cobalt */
:root {
  color-scheme: light;
  --color-paper: #f4f6fa;
  --color-surface: #fdfefe;
  --color-paper-2: #edf1f7;
  --color-ink: #19243a;
  --color-muted: #56647a;
  --color-line: #dce2ec;
  --color-control-line: #7e8da2;
  --color-accent: #244cda;
  --color-accent-ink: #ffffff;
  --color-accent-soft: #e9efff;
  --color-positive: #24624b;
  --color-positive-soft: #e8f3ed;
  --color-error: #a22f37;
  --color-error-soft: #faecee;
  --color-focus: #122966;
  --color-transparent: transparent;
  --color-inverse-muted: #e9efff;
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
  --text-balance: clamp(48px, 6vw, 80px);
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

### Tailwind v4

```css
@theme {
  --color-paper: #f4f6fa;
  --color-surface: #fdfefe;
  --color-paper-2: #edf1f7;
  --color-ink: #19243a;
  --color-muted: #56647a;
  --color-line: #dce2ec;
  --color-control-line: #7e8da2;
  --color-accent: #244cda;
  --color-accent-ink: #ffffff;
  --color-accent-soft: #e9efff;
  --color-positive: #24624b;
  --color-positive-soft: #e8f3ed;
  --color-error: #a22f37;
  --color-error-soft: #faecee;
  --color-focus: #122966;
  --color-transparent: transparent;
  --color-inverse-muted: #e9efff;
  --font-display: 'Inter', 'Segoe UI', sans-serif;
  --font-body: 'Inter', 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-body: 15px;
  --text-panel: 22px;
  --text-page: clamp(32px, 3vw, 44px);
  --text-balance: clamp(48px, 6vw, 80px);
  --radius: 4px;
  --radius-card: 8px;
  --radius-input: 4px;
}
```

### DTCG color and font tokens

```json
{
  "color": {
    "paper": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9568627450980393, 0.9647058823529412, 0.9803921568627451],
        "alpha": 1
      }
    },
    "surface": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9921568627450981, 0.996078431372549, 0.996078431372549],
        "alpha": 1
      }
    },
    "paper-2": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9294117647058824, 0.9450980392156862, 0.9686274509803922],
        "alpha": 1
      }
    },
    "ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.09803921568627451, 0.1411764705882353, 0.22745098039215686],
        "alpha": 1
      }
    },
    "muted": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.33725490196078434, 0.39215686274509803, 0.47843137254901963],
        "alpha": 1
      }
    },
    "line": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.8627450980392157, 0.8862745098039215, 0.9254901960784314],
        "alpha": 1
      }
    },
    "control-line": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.49411764705882355, 0.5529411764705883, 0.6352941176470588],
        "alpha": 1
      }
    },
    "accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.1411764705882353, 0.2980392156862745, 0.8549019607843137],
        "alpha": 1
      }
    },
    "accent-ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 1.0, 1.0],
        "alpha": 1
      }
    },
    "accent-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9137254901960784, 0.9372549019607843, 1.0],
        "alpha": 1
      }
    },
    "positive": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.1411764705882353, 0.3843137254901961, 0.29411764705882354],
        "alpha": 1
      }
    },
    "positive-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9098039215686274, 0.9529411764705882, 0.9294117647058824],
        "alpha": 1
      }
    },
    "error": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.6352941176470588, 0.1843137254901961, 0.21568627450980393],
        "alpha": 1
      }
    },
    "error-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9803921568627451, 0.9254901960784314, 0.9333333333333333],
        "alpha": 1
      }
    },
    "focus": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.07058823529411765, 0.1607843137254902, 0.4],
        "alpha": 1
      }
    },
    "inverse-muted": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.9137254901960784, 0.9372549019607843, 1.0],
        "alpha": 1
      }
    }
  },
  "font": {
    "display": {
      "$type": "fontFamily",
      "$value": ["Inter", "Segoe UI", "sans-serif"]
    },
    "body": {
      "$type": "fontFamily",
      "$value": ["Inter", "Segoe UI", "sans-serif"]
    },
    "mono": {
      "$type": "fontFamily",
      "$value": ["IBM Plex Mono", "ui-monospace", "monospace"]
    }
  }
}
```

### shadcn/ui semantic variables

```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --card: var(--color-surface);
  --card-foreground: var(--color-ink);
  --popover: var(--color-surface);
  --popover-foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --secondary: var(--color-paper-2);
  --secondary-foreground: var(--color-ink);
  --muted: var(--color-paper-2);
  --muted-foreground: var(--color-muted);
  --accent: var(--color-accent-soft);
  --accent-foreground: var(--color-accent);
  --destructive: var(--color-error);
  --border: var(--color-line);
  --input: var(--color-control-line);
  --ring: var(--color-focus);
  --radius: 4px;
}
```
