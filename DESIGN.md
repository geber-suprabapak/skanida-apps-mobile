---
name: Skanida Apps Mobile
description: Digital student attendance and leave management pass for SMK Negeri 2 Magelang
colors:
  primary: "#0066ff"
  primary-foreground: "#ffffff"
  slate-dark: "#0f172a"
  neutral-dark: "#171717"
  background: "#ffffff"
  foreground: "#0a0a0a"
  card: "#ffffff"
  card-foreground: "#0a0a0a"
  muted: "#f5f5f5"
  muted-foreground: "#737373"
  border: "#e5e5e5"
  destructive: "#ef4444"
typography:
  display:
    fontFamily: "System"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "System"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "System"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "System"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "System"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "48px"
  button-primary-active:
    backgroundColor: "#0052cc"
  button-secondary:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "48px"
  card-base:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Skanida Apps Mobile

## Overview

**Creative North Star: "The Digital Student Pass"**

Skanida Apps Mobile is a modern, tactile school passport designed for vocational high school students at SMK Negeri 2 Magelang. The visual language balances institutional dependability with the effortless speed required for daily morning and afternoon attendance rituals. It rejects ornate flourishes, frivolous animations, and decorative color fills in favor of a crisp, high-contrast, card-based interface that remains immediately legible under harsh morning outdoor sunlight.

Every viewport prioritizes instant scanability: current time and attendance status lead the hierarchy, while secondary administrative details recede into clean, bordered surfaces. The application feels like a trusted piece of digital student equipment—functional, responsive, and direct.

**Key Characteristics:**
- **High-Contrast Clarity**: Pure white and deep neutrals guarantee immediate outdoor legibility at campus gates.
- **Touch-Prioritized Ergonomics**: Generous tap targets (48x48 dp minimum) built for rapid, reliable single-handed operation.
- **Biometric Focus**: Color is disciplined; Electric Blue is reserved specifically to guide students through the face verification and submission workflow.
- **Tonal Structure**: Surfaces are defined by crisp 1px borders and subtle tonal layering rather than heavy drop shadows.

## Colors

The palette is anchored by a high-contrast neutral canvas, punctuated by a singular vibrant biometric accent and purposeful semantic state indicators.

### Primary
- **Electric Blue** (#0066FF): The signature interactive and verification accent. Used exclusively for camera shutters, attendance submission CTAs, face enrollment indicators, and active verification progress.

### Secondary
- **Midnight Slate** (#0F172A): Institutional authority neutral. Used for hero status summary containers, high-emphasis card headers, and dark surface framing.

### Neutral
- **Canvas White** (#FFFFFF): Primary background for cards, modals, and screen surfaces in light mode.
- **Onyx Dark** (#0A0A0A): Core foreground text in light mode, and root canvas background in dark mode.
- **Surface Neutral** (#171717): Primary component surface and high-contrast element background in dark mode.
- **Soft Stone** (#F5F5F5): Muted card backgrounds, disabled control fills, and secondary button states.
- **Muted Steel** (#737373): Secondary typography, metadata timestamps, input placeholders, and inactive icons.
- **Hairline Border** (#E5E5E5): 1px structural dividing lines and container outlines.

### Semantic Status
- **Success Green** (#10B981): Check-in confirmed, punctuality indicator (`Hadir`), and active system health.
- **Warning Amber** (#F59E0B): Punctuality alert (`Terlambat`), pending verification, and compensated time warning.
- **Crimson Destructive** (#EF4444): Verification failure, rejected permit status, and out-of-bounds geofence error.

### Named Rules
**The Biometric Blue Rule.** Electric Blue (`#0066FF`) is reserved strictly for primary attendance actions, camera viewfinder indicators, face enrollment progress, and active verification state. It is never spent on decorative iconography, generic links, or background cards.

**The Sunlight Legibility Rule.** Foreground text and critical status indicators must maintain a minimum contrast ratio of 4.5:1 (AAA preferred for status badges) against their immediate background surface to ensure legibility in outdoor morning sunlight.

## Typography

**Display Font:** System San Francisco / Roboto (with system sans-serif fallback)  
**Body Font:** System San Francisco / Roboto (with system sans-serif fallback)  
**Label/Mono Font:** System Monospace (for time and coordinates)

**Character:** Clean, humanist system typography that respects native OS Dynamic Type scaling and accessibility settings, prioritizing immediate legibility over stylistic experimentation.

### Hierarchy
- **Display** (800, 36px / 2.25rem, line-height 1.1): Large time clock, live check-in timer, and primary attendance confirmation headlines.
- **Headline** (600, 30px / 1.875rem, line-height 1.2): Screen titles and major section headers.
- **Title** (600, 20px / 1.25rem, line-height 1.25): Card titles, modal headers, and module group labels.
- **Body** (400, 16px / 1.0rem, line-height 1.5): Standard student information, instructions, permit descriptions, and status paragraphs.
- **Label** (600, 12px / 0.75rem, letter-spacing 0.02em, uppercase): Status badges, table column markers, metadata tags, and input field labels.

### Named Rules
**The One-Glance Time Rule.** The live clock and attendance status badge must render at least two typographic scale steps larger than surrounding schedule metadata, enabling students to verify their check-in eligibility in a single glance.

## Layout

Layout follows a mobile-first, single-column stream designed for portrait orientation on Android and iOS devices.

- **Safe-Area Insets**: All interactive content strictly respects device safe-area insets, notch cutouts, Dynamic Island, and home indicator bars.
- **Spatial Rhythm**: Base grid unit is 4px. Standard internal padding within cards is 24px (`p-6`); screen margins follow 16px (`px-4`) on mobile up to 24px (`px-6`) on compact tablets.
- **Vertical Hierarchy**: Top app bar anchors screen identity and profile avatar, followed immediately by the Primary Status / Action card, followed by the daily schedule and secondary workflow shortcuts.
- **Density**: Moderate-to-high density in information panels (schedule, history logs) balanced by generous breathing room around primary action controls.

## Elevation & Depth

Skanida Apps Mobile relies primarily on flat, tonal layering rather than heavy skeuomorphic drop shadows. Depth is communicated through contrasting background tones and clean 1px structural borders.

### Shadow Vocabulary
- **Subtle Resting** (`shadow-sm shadow-black/5`): Applied to primary buttons, interactive cards, and text inputs to separate them gently from the screen canvas.
- **Elevated Modal** (`shadow-lg shadow-black/10`): Reserved for floating bottom sheets, confirmation dialogs, and the attendance success popup.

### Named Rules
**The Border-First Elevation Rule.** Surfaces establish elevation through 1px borders (`border border-border`) and surface contrast rather than multi-layered drop shadows. Shadows serve only as a faint tactile response to touch or modal presentation.

## Shapes

- **Radius Scale**:
  - Buttons & Inputs: `rounded-md` (8px / `calc(var(--radius) - 2px)`).
  - Cards & Module Containers: `rounded-xl` (12px) to `rounded-2xl` (16px).
  - Badges & Chips: `rounded-md` (6px) or `rounded-full` (9999px) for pill-style indicators.
  - Avatar & Shutter Trigger: `rounded-full` (circle).
- **Form Language**: Friendly, rounded-rectangle geometry that balances modern software aesthetics with compact mobile framing.

## Components

### Buttons
- **Shape**: Medium-rounded (`rounded-md`, 8px radius).
- **Primary**: Full-width or solid action, Electric Blue (`#0066FF`) with white text (`#FFFFFF`), minimum height of 48px (`h-12`) for gate-speed accessibility.
- **Hover / Active**: Opacity step down to 90% (`active:bg-primary/90`) on press.
- **Secondary / Ghost**: Soft Stone fill (`#F5F5F5`) with dark foreground, or transparent borderless button for cancel actions.

### Cards / Containers
- **Corner Style**: 12px to 16px radius (`rounded-xl` / `rounded-2xl`).
- **Background**: White (`#FFFFFF`) in light mode; Deep Charcoal (`#171717`) or Midnight Slate (`#0F172A`) in dark mode.
- **Border**: 1px subtle stroke (`border border-border`).
- **Internal Padding**: 24px (`p-6`) on dashboard cards, 16px (`p-4`) on compact history items.

### Badges & Status Chips
- **Style**: Compact padding (`px-2.5 py-1`), pill or 6px radius, bold 12px text.
- **Variants**:
  - `Hadir`: Success Green background tint with dark green text.
  - `Terlambat`: Warning Amber background tint with dark amber text.
  - `Izin / Sakit`: Slate or Indigo tint with dark slate text.
  - `Ditolak / Gagal`: Destructive Red tint with red text.

### Inputs / Fields
- **Style**: 48px height (`h-12`), 1px border (`border-input`), smooth 8px radius (`rounded-md`), internal padding `px-4`.
- **Focus State**: Accent ring shift (`focus:ring-2 focus:ring-ring`).
- **Placeholder**: High-legibility muted steel (`#737373`).

### Camera & Shutter Controls
- **Viewfinder**: Full-screen or centered portrait aspect frame with white corner brackets.
- **Shutter Action**: Prominent circular button (64x64 dp) in Electric Blue (`#0066FF`) with white interior icon, centered at bottom of viewport.

## Do's and Don'ts

### Do:
- **Do** maintain a minimum 48x48 dp touch target for all tappable elements to support rapid gate check-in.
- **Do** isolate Electric Blue (`#0066FF`) to biometric verification, camera actions, and primary attendance submit buttons.
- **Do** display time strictly in Western Indonesia Time (WIB, UTC+7) synchronized with server time.
- **Do** provide immediate, actionable feedback on geofence check failure (e.g., distance to campus perimeter).
- **Do** use native platform dialogs, sheets, and system back navigation.

### Don't:
- **Don't** use Electric Blue for decorative illustrations, secondary card borders, or inactive tabs.
- **Don't** apply heavy, multi-colored drop shadows or complex skeuomorphic gradients.
- **Don't** trap the user or override the native Android back gesture or iOS swipe-back navigation.
- **Don't** hide critical attendance statuses or error details behind nested submenus.
- **Don't** use ambiguous or bureaucratic jargon; keep copy in direct, student-friendly Bahasa Indonesia.
