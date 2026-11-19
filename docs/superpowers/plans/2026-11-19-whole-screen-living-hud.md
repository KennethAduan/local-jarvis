# Whole-screen living HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In whole-screen mode, replace the scaled dither Jarvis with a painted holographic living core on an alive cyan cockpit HUD (abstract side panels, no helmet/jet).

**Architecture:** `stage.js` owns the full stage face (opaque cover, bloom, floor, hub/rings/rays, panels, visor). When `staged`, `10-dither.js` still parks/scales and calls `Roamie.stage.paint`, but skips drawing the LED creature body so the holographic core is the only center presence. Toggle/persist/hide-off stay on existing `wholeScreen` wiring.

**Tech Stack:** Overlay canvas JS (`showcase/roamies/stage.js`, `10-dither.js`), Node sidecar tests (`npm test` / direct `node test/…`), Tauri transparent WebView (opaque canvas cover required).

## Global Constraints

- Center = new painted ring-core + bright hub; dither body hidden while staged.
- Abstract HUD panels only — no Iron Man helmet, no jet/craft figurative art.
- Reuse `config.wholeScreen`; no new persistence key.
- Normal (non–whole-screen) dither look unchanged.
- Opaque navy/black cover first so desktop does not show through WebView2 clearRect.
- Honor `prefers-reduced-motion` (static pose; theme still drawn).
- Do not commit unless the user asks (repo user rule).

## File map

| File | Role |
|------|------|
| `showcase/roamies/stage.js` | Living HUD paint: cover, bloom, floor, hub/rays/rings, panels, visor |
| `showcase/roamies/10-dither.js` | Skip LED body blit when `staged`; keep park/scale + `stage.paint` |
| `showcase/tauri/sidecar/test/stage-hud.test.mjs` | Source + paint-contract tests for living HUD |
| `showcase/desktop.html` | Already loads `stage.js` — verify only |
| Dist copy under `showcase/tauri/…` if rebuild copies roamies assets | Deploy path after edit |

---

### Task 1: Living core + alive backdrop in `stage.js`

**Files:**
- Modify: `showcase/roamies/stage.js`
- Create: `showcase/tauri/sidecar/test/stage-hud.test.mjs`

**Interfaces:**
- Consumes: `Roamie.stage.paint(ctx, { w, h, cx, cy, r, t, voice?, reduced? })` (existing)
- Produces: same signature; paint must draw opaque cover, cyan bloom, white-hot hub, god-rays, floor, rings, abstract panels, visor; no helmet/jet figurative paths

- [ ] **Step 1: Write failing tests**

Create `showcase/tauri/sidecar/test/stage-hud.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const stageSrc = readFileSync(new URL('../../../roamies/stage.js', import.meta.url), 'utf8');
const ditherSrc = readFileSync(new URL('../../../roamies/10-dither.js', import.meta.url), 'utf8');

assert.match(stageSrc, /godRays|god-rays|ray/i, 'living core needs god-rays helper or ray paint');
assert.match(stageSrc, /hub|white-hot|radialGradient/i, 'bright hub required');
assert.doesNotMatch(stageSrc, /helmet|iron.?man|jet\b|spacecraft/i, 'no helmet/jet art');
assert.match(stageSrc, /fillRect\(0,\s*0,\s*w,\s*h\)/, 'opaque full-canvas cover');
assert.match(ditherSrc, /staged[\s\S]{0,200}return/, 'staged path must skip LED body (early return after stage paint)');

console.log('stage-hud source tests: passed');
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd showcase/tauri/sidecar && node test/stage-hud.test.mjs`  
Expected: FAIL (missing god-rays/hub markers and/or dither early-return)

- [ ] **Step 3: Enrich `stage.js` living core + backdrop**

In `showcase/roamies/stage.js`, add helpers and wire them into `paint` (keep existing abstract panels; no helmet/jet):

```js
const hub = (c, cx, cy, r, voice) => {
  const pulse = 1 + voice * 0.08;
  const hr = Math.max(6, r * 0.12 * pulse);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, hr * 4);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(180,245,255,0.55)');
  g.addColorStop(0.7, 'rgba(0,180,255,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(cx, cy, hr * 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath(); c.arc(cx, cy, hr, 0, Math.PI * 2); c.fill();
};

const godRays = (c, cx, cy, r, t, reduced) => {
  if (reduced) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {
    const a = t * 0.15 + (i / 10) * Math.PI * 2;
    ink(c, 0.04 + 0.03 * Math.sin(t + i));
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * r * 2.2, cy + Math.sin(a) * r * 2.2);
    c.lineTo(cx + Math.cos(a + 0.08) * r * 2.2, cy + Math.sin(a + 0.08) * r * 2.2);
    c.closePath(); c.fill();
  }
  c.restore();
};
```

Update opaque cover + bloom so the room is navy/alive, not flat pure black only:

```js
c.fillStyle = 'rgb(0,4,12)';
c.fillRect(0, 0, w, h);
const bloom = c.createRadialGradient(cx, cy, Math.max(8, r * 0.12), cx, cy, Math.max(w, h) * 0.65);
bloom.addColorStop(0, 'rgba(0,160,230,0.38)');
bloom.addColorStop(0.3, 'rgba(0,50,90,0.55)');
bloom.addColorStop(0.65, 'rgb(0,4,12)');
bloom.addColorStop(1, 'rgb(0,0,0)');
c.fillStyle = bloom;
c.fillRect(0, 0, w, h);
```

In `paint`, after bloom and before/with floor and rings:

```js
visor(c, w, h, tt); // keep; may stay last for frame on top — prefer: floor, rays, hub, coreRings, panels, visor last
floorPad(c, cx, cy + r * 1.05, r, tt);
godRays(c, cx, cy, r, tt, reduced);
hub(c, cx, cy, r, voice);
coreRings(c, cx, cy, r, tt, voice);
// … existing panels …
visor(c, w, h, tt);
```

Match paint order from the spec: cover → bloom → floor → core (hub/rings/rays) → panels → visor. Move `visor` to the end if it currently runs early.

- [ ] **Step 4: Re-run source tests for stage markers**

Run: `cd showcase/tauri/sidecar && node test/stage-hud.test.mjs`  
Expected: stage assertions PASS; dither early-return may still FAIL until Task 2

- [ ] **Step 5: Commit only if user asks**

```bash
git add showcase/roamies/stage.js showcase/tauri/sidecar/test/stage-hud.test.mjs
# git commit -m "feat: living holographic core and alive stage HUD"
```

---

### Task 2: Hide dither body while staged

**Files:**
- Modify: `showcase/roamies/10-dither.js` (`draw` ~898–950)
- Modify: `showcase/tauri/sidecar/test/stage-hud.test.mjs` (complete early-return assertion)

**Interfaces:**
- Consumes: `staged` flag; `Roamie.stage.paint`
- Produces: when `staged`, LED `drawImage` / bloom of creature skipped after stage paint

- [ ] **Step 1: Confirm failing dither assertion**

Run: `cd showcase/tauri/sidecar && node test/stage-hud.test.mjs`  
Expected: FAIL on `staged … return` until Step 2 lands

- [ ] **Step 2: Early-return after stage paint**

In `10-dither.js` `draw`, change the staged block so LED body is not blitted:

```js
draw(ctx, env) {
  if (!ready) this.prepare(env);
  const had = ready; ready = false;
  if (!had || !rect) return;
  const bx = m.x + ox, by = m.y + oy;
  if (staged) {
    const voice = Math.max(0.12, Math.min(1, (Roamie.voiceOut?.level?.() ?? 0) || (m.mode === 'talk' ? 0.55 : 0.18)));
    Roamie.stage?.paint?.(ctx, {
      w: env.w, h: env.h, cx: bx, cy: by, r: R, t,
      voice, reduced: !!env.reduced,
    });
    return; // holographic core is the face — do not draw dither LED body
  }
  // … existing LED drawImage / bloom / plug path unchanged …
}
```

Keep `prepare` full-rect behavior when `staged` (`rect = [0,0,gw,gh]`) so the dirty region stays whole-screen.

Optional perf (same task if cheap): in `prepare`, when `staged`, skip filling creature grid cells (leave empty) — not required if early-return alone hides the body.

- [ ] **Step 3: Tighten test**

Ensure `stage-hud.test.mjs` matches the real early return, e.g.:

```js
assert.match(
  ditherSrc,
  /if\s*\(\s*staged\s*\)\s*\{[\s\S]*?Roamie\.stage\?\.paint[\s\S]*?return;/,
  'staged: paint HUD then return before LED blit',
);
```

- [ ] **Step 4: Run tests**

Run: `cd showcase/tauri/sidecar && node test/stage-hud.test.mjs`  
Expected: PASS

Also: `cd showcase/tauri/sidecar && npm test`  
Expected: green (including existing `wholescreen.test.mjs`)

- [ ] **Step 5: Commit only if user asks**

```bash
git add showcase/roamies/10-dither.js showcase/tauri/sidecar/test/stage-hud.test.mjs
# git commit -m "fix: hide dither body in whole-screen living HUD"
```

---

### Task 3: Stage radius + deploy + manual verify

**Files:**
- Modify: `showcase/roamies/10-dither.js` `resize` staged radius if needed (`~0.55–0.58` of min edge per spec)
- Copy/rebuild overlay assets as this repo usually does for `dist` / `build.sh`

**Interfaces:**
- Consumes: `staged` + `env.w/h`
- Produces: `R = Math.max(160, Math.min(env.w, env.h) * 0.58)` (keep current 0.58 if already in range)

- [ ] **Step 1: Confirm radius**

In `resize`, staged branch should be:

```js
if (staged && form !== 'cursor') {
  R = Math.max(160, Math.min(env.w, env.h) * 0.58);
} else {
  R = form === 'cursor' ? 26 : clamp(S * 0.15, 28, 140) * (form === 'small' ? 0.5 : 1);
}
```

No change if already matches.

- [ ] **Step 2: Deploy overlay JS**

Copy updated `showcase/roamies/stage.js` and `10-dither.js` into the running app’s served/dist roamies path used by Tauri (same path prior whole-screen work used). Restart or `reload-dev` so WebView picks up scripts.

- [ ] **Step 3: Manual checklist**

1. Appearance → Whole screen **on**
2. Center = holographic hub/rings (not pixel dither globe)
3. Backdrop = navy bloom + floor + panels (not flat black slab)
4. No helmet / jet art
5. Ask/speech still usable at edges
6. Whole screen **off** → normal dither Jarvis returns
7. Summon hide while on → mode off next show

- [ ] **Step 4: Commit only if user asks**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Replace dither with painted core | Task 2 |
| White-hot hub, rings, god-rays, voice pulse | Task 1 |
| Alive navy bloom / not flat black | Task 1 |
| Abstract panels; no helmet/jet | Task 1 (+ test) |
| Paint order cover→…→visor | Task 1 |
| Skip LED body; no clearRect desktop hole | Task 2 |
| Reuse `wholeScreen` wiring | (unchanged; Task 3 manual) |
| Reduced motion | Task 1 (`godRays` / `tt` already gated) |
| Scale ~55–60% | Task 3 |
| Tests | Tasks 1–2 |
| Manual verify | Task 3 |

No placeholders. Commit steps gated on user request.
