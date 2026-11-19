# Whole-screen living HUD — design

Date: 2026-11-19  
Product: Jarvis (local-jarvis / Roamies overlay)  
Extends: `2026-11-19-whole-screen-mode-design.md` (toggle, persist, hide-off, park stay as locked)

## Goal

Whole-screen mode should feel like a cyan OLED cockpit: an **alive stage** and a **new holographic core**, not a plain black fill with the normal dither Jarvis icon scaled up.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Center presence | **A** — replace dither body while staged; paint a new ring-core + bright hub |
| Cockpit density | **2** — core + alive stage + abstract HUD panels (no helmet, no jet/craft art) |
| Implementation | Stage canvas owns the face; dither skips body draw when staged |
| Config | No new flag; reuse `config.wholeScreen` |
| Normal mode | Unchanged dither look and palette |

## Visual design

### Living core (stage-only face)

- White-hot hub with cyan radial bloom
- Concentric rings (solid + segmented ticks), slow spin
- Soft god-rays from the hub
- Voice/talk: stronger hub pulse and faster ring motion; listen: gentler; idle: slow breathe
- Floor: oval cyan rings under the core for depth
- Scale: about 55–60% of the shorter overlay edge
- `prefers-reduced-motion`: static pose (no spin/tween); theme still drawn

### Alive backdrop

- Opaque deep navy/black fill first (covers desktop through transparent WebView)
- Cyan center bloom + faint edge vignette (not flat black)
- Curved visor frame (top/bottom arcs, side rails)
- Subtle scan/breathe so the background feels alive

### Abstract HUD panels

Left (examples): wire globe, voice waveform, terrain lines, gauges.  
Right (examples): hex AI mark, city bars, arc rings, level bars.  
Style: thin cyan strokes, low fill opacity. No Iron Man helmet. No jet/craft schematics.

### Paint order (LED canvas)

1. Opaque cover  
2. Bloom / vignette  
3. Floor pad  
4. Living core (hub, rings, rays)  
5. Side panels  
6. Visor frame  

Ask bar and speech stay edge-placed so the core stays clear.

## Architecture

```
Panel Appearance toggle (unchanged)
  → act('wholescreen')
Sidecar config.wholeScreen (unchanged)
  → ui({ kind: 'wholescreen', on })
host.js → stage.set + creature.setStage + stage_cover
10-dither.js → if staged: skip LED body; still park/scale; call Roamie.stage.paint
stage.js → full living HUD paint (cover, bloom, floor, core, panels, visor)
```

Summon / tray hide still clears `wholeScreen`, saves, pushes UI off, then hides.

## Components to change

### `showcase/roamies/stage.js`

- Enrich paint: brighter hub, god-rays, denser bloom/floor so the stage is never plain black
- Keep / refine abstract panels already present
- Accept voice + reduced-motion inputs (already in paint options)

### `showcase/roamies/10-dither.js`

- When `staged`, do not draw the dither creature body (and do not leave a clearRect hole that reveals the desktop)
- Continue centering/park/scale and palette/stage hooks as needed for layout
- Call `Roamie.stage.paint` with center, radius, time, voice

### Unchanged behavior owners

- `host.js` wholescreen UI path, `stage_cover` invoke
- Sidecar toggle / persist / hide-off
- Panel Appearance toggle

## Tests

- Existing wholescreen config + about coverage stays green
- Dither: body not drawn while staged (unit or paint-path assertion)
- Optional: stage paint smoke (opaque cover present; paint callable)
- Manual: toggle on → holographic core + alive HUD, no dither icon, desktop covered; toggle off → normal dither; summon hide exits mode

## Error handling / fail-safes

- Missing `Roamie.stage` → do not crash; if staged without stage module, keep opaque cover via existing path if any, else fail soft
- Invalid/missing `wholeScreen` → off
- Reduced motion → static core/HUD, still opaque cover

## Non-goals

- Helmet or jet/craft figurative art
- Separate fullscreen OS window
- Changing default (non–whole-screen) dither appearance
- New persistence key beyond `wholeScreen`

## Success criteria

- Whole-screen shows a new living holographic core, not the scaled dither icon
- Background reads as an alive cyan cockpit, not a flat black rectangle
- Abstract side panels present; no helmet/jet
- Chat/tools remain usable at edges
- Toggle, persist, and summon hide-off behave as in the base whole-screen design
