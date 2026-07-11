---
name: Tactical Command Narrative
colors:
  surface: '#101418'
  surface-dim: '#101418'
  surface-bright: '#363a3e'
  surface-container-lowest: '#0b0f13'
  surface-container-low: '#181c20'
  surface-container: '#1c2024'
  surface-container-high: '#262a2f'
  surface-container-highest: '#31353a'
  on-surface: '#e0e2e8'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e0e2e8'
  inverse-on-surface: '#2d3135'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#44ddc1'
  on-secondary: '#00382f'
  secondary-container: '#00bea4'
  on-secondary-container: '#00463b'
  tertiary: '#ffe7e6'
  on-tertiary: '#680014'
  tertiary-container: '#ffc1c0'
  on-tertiary-container: '#b4002b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#68fadd'
  secondary-fixed-dim: '#44ddc1'
  on-secondary-fixed: '#00201a'
  on-secondary-fixed-variant: '#005145'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b3'
  on-tertiary-fixed: '#400009'
  on-tertiary-fixed-variant: '#920021'
  background: '#101418'
  on-background: '#e0e2e8'
  surface-variant: '#31353a'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  panel-gap: 1px
---

## Brand & Style
The design system is engineered for high-stakes environments where rapid information processing is critical. It adopts a **Tactical Glassmorphism** aesthetic—a fusion of modern professional UI with military-grade functional density. The interface must evoke a sense of absolute control, reliability, and technical precision.

The emotional response is one of "calm urgency." Visual depth is achieved through translucent layers that mimic a heads-up display (HUD), while high-contrast accents ensure critical data is never missed. Subtle scanline textures and rhythmic glow effects on active states provide a technical, "living" interface feel without compromising legibility.

## Colors
The color palette is strictly functional, utilizing a deep obsidian base to minimize eye strain in dark environments.
- **Primary (Cyber Blue):** Used for interactive elements, primary data threads, and active HUD overlays.
- **Secondary (Teal):** Used for "Safe" status indicators, secondary confirmations, and environmental data.
- **Tertiary (Red):** Reserved exclusively for alerts, danger zones, and critical system failures.
- **Backgrounds:** The foundation is `#0A0E12`, with layered glass surfaces using varying opacities of the primary color to create hierarchy.

## Typography
This design system utilizes **Inter** for its exceptional legibility in dense interfaces, paired with **Geist** (as a technical mono alternative) for data readouts and tactical labels. 

Headlines should be used sparingly for section anchoring. Labels are frequently set in uppercase with increased letter spacing to mimic military technical manuals. For numerical data and status codes, always use the `mono-data` token to ensure character alignment in high-density tables.

## Layout & Spacing
The layout follows a **High-Density Fixed Grid**. It is optimized for large format control room monitors but must reflow efficiently for ruggedized tablets.

- **Desktop:** A 12-column grid with narrow 16px gutters to maximize screen real estate.
- **Panels:** Intelligence panels and map overlays are separated by 1px "fused" borders rather than wide gaps, creating a unified dashboard feel.
- **Sidebar:** A collapsed icons-only sidebar (64px) expands on hover to 240px.
- **Density:** Padding is kept tight (8px-12px) to ensure as much data as possible is visible above the fold.

## Elevation & Depth
Depth is created through **Luminous Glassmorphism** rather than traditional shadows.
- **Base Level:** `#0A0E12` (Solid).
- **Surface Level (Cards/Panels):** Background blur (20px) with a 10% opacity Cyber Blue tint and a 1px inner stroke of 20% opacity white.
- **Active Level:** Elements "glow" with an outer 4px-12px Cyber Blue neon spread (low opacity) to indicate focus.
- **Scanlines:** A global overlay of 2px height alternating 2% opacity black lines provides a technical screen texture.

## Shapes
The design system employs a **Sharp (0)** roundedness strategy. Every element—from buttons to cards to notification toasts—must have 0px corner radii. This reinforces the "hardened" military-grade nature of the interface. Geometric precision is paramount; use clipped corners (45-degree chamfers) for primary action buttons to enhance the tactical aesthetic.

## Components
- **Tactical Buttons:** Sharp corners. Primary buttons use a Cyber Blue fill with black text. Ghost buttons use a 1px Cyber Blue border and glow on hover.
- **Data Cards:** Translucent background with a "header bar" that has a slightly higher opacity (20%). Bottom-right corner often features a decorative "technical bracket."
- **Status Indicators:** Small circular pips that use a "breathing" animation (slow pulse) for active monitoring.
- **Sidebar Navigation:** Icon-centric. Active states feature a vertical Cyber Blue bar on the left and a subtle gradient fill behind the icon.
- **Intelligence Panels:** Integrated scrollbars must be ultra-thin (4px) and colored in Cyber Blue.
- **Input Fields:** Bottom-border only, or a subtle 4-sided stroke with 5% Cyber Blue fill. Active inputs should trigger a subtle glow across the entire panel.
- **Map Overlays:** Use monochromatic map tiles with primary color vector lines for routes and tertiary color icons for disaster hotspots.