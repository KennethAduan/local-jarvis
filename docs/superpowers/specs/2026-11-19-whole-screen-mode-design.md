# Whole-screen mode (theme-only) — design

Date: 2026-11-19  
Product: Jarvis (local-jarvis / Roamies overlay)

## Goal

Add a **whole-screen mode** where JARVIS is a large centered presence on the monitor, with chat and tools still usable around it. Theme draws from a cyan OLED HUD reference (no Iron Man helmet, no decorative side panels in this version).

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Layout intent | Big centered globe; speech/ask stay usable at edges |
| Control | Appearance **toggle** (not a Size option) |
| Persistence | Persist `wholeScreen` in config |
| Exit via summon | Hide also turns mode **off** and saves |
| Visual scope | Theme only: OLED vignette + cyan glow + faint floor ring |
| Out of scope | HUD side panels, helmet art, new OS window, changing normal-mode palette |

## Behavior

1. Appearance → toggle **Whole screen**.
2. When on:
   - Globe parks at screen center.
   - Scale ≈ 70% of the shorter overlay edge.
   - Cursor-follow is off.
   - Existing Size (Default / Small / Cursor) is preserved underneath; cursor form is ignored while staged (use default body art at stage scale).
   - Speech bubbles and ask bar use edge placement so the core stays clear.
3. Theme layer (whole-screen only): deep OLED black vignette, cyan/teal accent aligned with existing JARVIS LED colors (`#78ffe2` family), soft floor ring under the globe. Normal overlay look is unchanged when mode is off.
4. Persistence: `config.wholeScreen` survives quit/relaunch.
5. Summon / tray hide: if mode is on, set `wholeScreen` to false, save, push UI off, then hide. Next show uses normal size/follow.
6. Game mode and notch: whole-screen overrides while active; turning off restores those rules.
7. Motion: one scale-and-settle enter; faster exit; honor `prefers-reduced-motion` (snap, no tween).
8. Multi-monitor: stage uses the active overlay’s bounds only.

## Architecture

Overlay stage mode on the existing transparent always-on-top webview. No new window.

```
Panel (Appearance toggle)
    → act('wholescreen')
Sidecar (config.wholeScreen + save)
    → ui({ kind: 'wholescreen', on })
Overlay host.js
    → stage theme layer + agent park/scale/unfollow
```

Hide path also clears the flag before (or with) hide.

## Components

### Panel — `showcase/panel/panel.js`

- Appearance page: toggle **Whole screen** with a short hint (e.g. large centered JARVIS; size still applies when you leave).
- Panel state includes `wholeScreen` boolean.
- Use a proper control with accessible name and pressed/on state (same pattern as other toggles).

### Sidecar — `showcase/tauri/sidecar/sidekick.mjs`

- Add `wholeScreen: false` to defaults.
- Handle `wholescreen` act: flip, `saveConfig()`, `ui({ kind: 'wholescreen', on })`, refresh panel/menu as needed.
- Seed overlay on connect/start with current flag (same pattern as size/look).
- On hide (summon hide / equivalent hide paths): if `wholeScreen`, set false, save, emit `ui` off, then hide.
- Update `about.mjs` so Appearance mentions whole-screen mode (keeps `about_roamies` accurate).

### Overlay

- `showcase/roamies/host.js`: handle `kind: 'wholescreen'`.
- Stage theme: vignette + floor ring only (theme-only scope).
- Agent / dither creature: center park, stage scale, disable cursor follow while on; restore follow and Size form when off.
- Ask bar / speech: edge-aware placement while staged.

### Tests

- Config default false; toggle persists; hide clears and persists.
- About text includes whole-screen wording.
- Manual: toggle on/off; summon hide exits mode; relaunch restores if left on without hide; chat readable at edges.

## Error handling / fail-safes

- Missing or invalid `wholeScreen` → treat as off.
- Toggle on while hidden → save on; next show opens already staged.
- Reduced motion → instant park/unpark, theme still applies.

## Non-goals (this iteration)

- Decorative globe/city/terrain/gauge side panels from the reference image.
- Iron Man or helmet imagery.
- Separate fullscreen OS window.
- Changing cyan palette for default (non–whole-screen) overlay.

## Success criteria

- User can enter/leave whole-screen from Appearance.
- Globe is large, centered, themed; tools/chat still usable.
- Hide via summon leaves mode off on next show.
- Preference persists across relaunch when not cleared by hide.
- CI/unit coverage for config + about string; no regressions to Size/Look.
