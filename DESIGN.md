---
name: Skanida Apps Mobile
version: 2.0.0-astrayao
description: Digital student attendance and leave management pass for SMK Negeri 2 Magelang
colors:
  primary: "#1B5BFF"
  primary-dark: "#4C82FF"
  primary-foreground: "#FFFFFF"
  pass-top: "#0F2147"
  pass-bottom: "#1A3A75"
  pass-dock: "#0A1734"
  gold-accent: "#E5B95C"
  background-light: "#F2F5FA"
  background-dark: "#070C16"
  surface-light: "#FFFFFF"
  surface-dark: "#0F1727"
  muted-light: "#E8EEF7"
  muted-dark: "#18243C"
  border-light: "#DCE3F0"
  border-dark: "#1F2F4C"
  destructive: "#CC2936"
typography:
  display:
    fontFamily: "Manrope"
    fontSize: "36sp"
    fontWeight: 800
    lineHeight: "42sp"
    letterSpacing: "-0.8sp"
  mono-clock:
    fontFamily: "JetBrains Mono"
    fontSize: "36sp"
    fontWeight: 700
    letterSpacing: "-1.0sp"
  headline:
    fontFamily: "Manrope"
    fontSize: "26sp"
    fontWeight: 800
    lineHeight: "32sp"
  title:
    fontFamily: "Manrope"
    fontSize: "18sp"
    fontWeight: 700
  body:
    fontFamily: "Manrope"
    fontSize: "15sp"
    fontWeight: 400
    lineHeight: "22sp"
  label:
    fontFamily: "Manrope"
    fontSize: "12sp"
    fontWeight: 600
rounded:
  tile: "12dp"
  control: "16dp"
  card: "22dp"
  card-lg: "24dp"
  pass: "28dp"
  full: "999dp"
---

# Design System: Skanida Apps Mobile (v2.0.0-astrayao)

## Overview

**The Indigo-Cobalt Digital Student Pass**

Skanida Apps Mobile is a tactile student pass for SMK Negeri 2 Magelang built with Kotlin and Jetpack Compose. Top-level screens (`Beranda`, `Riwayat`, `Perizinan`, `Pengaturan`) omit redundant top app bars and rely on inline headers with pull-to-refresh. Daily attendance leads with a unified Indigo-Cobalt laminated pass card combining identity, live WIB chronometer, check-in/check-out punch times, and a fused biometric action dock.

## Colors

- **Indigo-Cobalt Pass (`#0F2147` to `#1A3A75`, dock `#0A1734`)**: Laminated credential plate for the Welcome hero, Home Student Pass, and Settings Mini ID Card, accented with fine guilloche arcs and muted gold (`#E5B95C` / `#F0C973`).
- **Cobalt Biometric Accent (`#1B5BFF` light / `#4C82FF` dark)**: Primary CTAs, camera shutter, active calendar selection, Extended FAB, and focused inputs.
- **Tonal Canvas (`#F2F5FA` light / `#070C16` dark)** and **Elevated Card Surface (`#FFFFFF` light / `#0F1727` dark)** separated by `1dp` hairline borders (`#DCE3F0` / `#1F2F4C`).
- **Semantic Status Tokens**:
  - `Hadir / Disetujui`: Emerald (`#0A8F62` / `#34D399`, solid `#10B981` on dark pass badge)
  - `Terlambat / Menunggu`: Amber (`#C26A0A` / `#FBBF24`)
  - `Sakit`: Violet (`#6D28D9` / `#C4B5FD`)
  - `Izin`: Sky (`#026AA2` / `#38BDF8`)
  - `Alpha / Ditolak / Keluar`: Crimson (`#CC2936` / `#F87171`)

## Typography

- **Primary Sans**: `Manrope` (`app/src/main/res/font/manrope_*.ttf`, weights 400–800) for headers, body copy, and buttons.
- **Technical Monospace**: `JetBrains Mono` (`app/src/main/res/font/jetbrains_mono_*.ttf`, weights 500 and 700) for the live WIB clock, NIS badges, timestamps, durations, and numeric counters.

## Navigation and Screen Hierarchy

- **Welcome**: Full-bleed Indigo-Cobalt crest plate with white rounded school logo and `Skanida Apps` title only, followed by `Masuk dengan Akun Sekolah`, `Aktivasi Akun Siswa Baru`, and `Lupa password?`.
- **Beranda**: Top identity strip (`Skanida Apps` + WIB greeting), unified Indigo-Cobalt Pass with live WIB clock and fused biometric CTA dock, compact 2-up Bento (`Linimasa` + current-month `Kehadiran` arc ring), and direct `Berhalangan hadir?` shortcut.
- **Riwayat**: Header with compact month stepper (`< Bulan Tahun >` + Indonesian month-year picker dialog), asymmetric Bento summary (arc ring + 2x2 tonal stat tiles), rounded-square (`12dp`) tonal calendar tiles, selected day detail, and monthly log rows.
- **Perizinan & Ajukan Izin**: Header with daily quota chip, calm amber-bordered active pending card with 3-step progress bar (`Diajukan`, `Ditinjau`, `Keputusan`), detail `ModalBottomSheet` with attachment image, Cobalt Extended FAB `+ Ajukan Izin`, and clean sticky-submit leave form.
- **Pengaturan**: Mini laminated ID card with one-tap NIS clipboard copy, consolidated 2-row menu (`Kelola akun` housing biodata, avatar, face enrollment, and password change; `Pengaturan notifikasi` housing master toggle, 3 local category filters, and device permission settings), horizontal 3-way theme selector (`Sistem | Terang | Gelap`), logout action, and `Skanida Apps · v2.0.0-astrayao` version footer.
