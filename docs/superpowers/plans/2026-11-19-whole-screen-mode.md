# Whole-screen mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Appearance toggle that parks a large centered JARVIS on the overlay with OLED cyan HUD theme only (no side panels), clears on summon hide, and restores normal follow/size when off.

**Architecture:** Sidecar owns `config.wholeScreen` and pushes `ui({ kind: 'wholescreen', on })`. Overlay host applies theme layer + agent stage park/scale. Summon hide in the overlay turns mode off locally and notifies the sidecar so config persists off.

**Tech Stack:** Existing Tauri overlay JS (`showcase/roamies`), Node sidecar (`sidekick.mjs`), panel (`panel.js`), Node test runner (`npm test` in sidecar).

## Global Constraints

- Theme only: OLED vignette + cyan accents + faint floor ring; no Iron Man helmet; no decorative HUD side panels.
- Toggle in Appearance, not a Size option; Size preserved underneath.
- Persist `wholeScreen`; summon hide clears it and saves.
- Cursor form ignored while staged (default body art at stage scale).
- Honor `prefers-reduced-motion`.
- Do not commit unless the user asks (repo user rule).

## File map

| File | Role |
|------|------|
| `showcase/tauri/sidecar/wholescreen.mjs` | Pure helpers: normalize flag, clear-on-hide |
| `showcase/tauri/sidecar/test/wholescreen.test.mjs` | Unit tests for helpers + about/panel strings |
| `showcase/tauri/sidecar/sidekick.mjs` | Config, panel act, ui_ready seed, hide message |
| `showcase/tauri/sidecar/about.mjs` | Manual text |
| `showcase/panel/panel.js` | Appearance toggle |
| `showcase/roamies/stage.js` | Theme layer DOM/CSS |
| `showcase/desktop.html` | Load `stage.js` |
| `showcase/roamies/10-dither.js` | `setStage(on)` radius formula |
| `showcase/roamies/agent.js` | `setWholeScreen(on)` park/unfollow |
| `showcase/roamies/host.js` | Handle ui + summon hide notify |
| `showcase/roamies/ask-bar.js` | Edge place when `Roamie.wholeScreen` |

---

### Task 1: Pure helpers + about/panel copy tests

**Files:**
- Create: `showcase/tauri/sidecar/wholescreen.mjs`
- Create: `showcase/tauri/sidecar/test/wholescreen.test.mjs`
- Modify: `showcase/tauri/sidecar/about.mjs`
- Modify: `showcase/tauri/sidecar/test/about.test.mjs` (optional if covered in wholescreen.test)
- Modify: `showcase/panel/panel.js` (toggle UI — can land in Task 2; test asserts string exists after Task 2)

**Interfaces:**
- Produces: `normalizeWholeScreen(value: unknown): boolean`, `clearWholeScreenOnHide(config: { wholeScreen?: boolean }): boolean`

- [ ] **Step 1: Write failing tests**

```js
import assert from 'node:assert/strict';
import { normalizeWholeScreen, clearWholeScreenOnHide } from '../wholescreen.mjs';
import { aboutRoamies } from '../about.mjs';
import { readFileSync } from 'node:fs';

assert.equal(normalizeWholeScreen(true), true);
assert.equal(normalizeWholeScreen(false), false);
assert.equal(normalizeWholeScreen('yes'), false);
assert.equal(normalizeWholeScreen(undefined), false);

const cfg = { wholeScreen: true };
assert.equal(clearWholeScreenOnHide(cfg), true);
assert.equal(cfg.wholeScreen, false);
assert.equal(clearWholeScreenOnHide(cfg), false);

assert.match(aboutRoamies({ mac: true, voice: true, hotkeys: true }), /whole-screen/i);

const panel = readFileSync(new URL('../../../panel/panel.js', import.meta.url), 'utf8');
assert.match(panel, /wholescreen/);
assert.match(panel, /Whole screen/);
console.log('wholescreen tests: passed');
```

- [ ] **Step 2: Run test — expect FAIL** (module / about / panel missing)

Run: `cd showcase/tauri/sidecar && node test/wholescreen.test.mjs`  
Expected: FAIL (module not found or about/panel mismatch)

- [ ] **Step 3: Implement helpers + about string**

`wholescreen.mjs`:

```js
export const normalizeWholeScreen = (v) => v === true;

/** If mode is on, turn it off on the config object. Returns whether it changed. */
export function clearWholeScreenOnHide(config) {
  if (!normalizeWholeScreen(config?.wholeScreen)) return false;
  config.wholeScreen = false;
  return true;
}
```

In `about.mjs`, change Appearance sentence to:  
`Appearance controls size and whole-screen mode; the character is always JARVIS.`

- [ ] **Step 4: Panel toggle (so panel asserts pass)** — see Task 2 Step 1; run tests again after Task 2 if splitting.

- [ ] **Step 5: Run tests — expect PASS** (after Task 2 panel toggle exists)

---

### Task 2: Sidecar config + panel act + ui seed + overlay notify

**Files:**
- Modify: `showcase/tauri/sidecar/sidekick.mjs` (DEFAULTS ~115–125, `panelState` ~1992, act handler near `sound`, `ui_ready` ~2507, stdin handler)
- Modify: `showcase/panel/panel.js` (`appearancePage` ~557–561)

**Interfaces:**
- Consumes: `normalizeWholeScreen`, `clearWholeScreenOnHide` from `wholescreen.mjs`
- Produces: `ui({ kind: 'wholescreen', on: boolean })`, panel `wholeScreen: boolean`, act id `wholescreen`

- [ ] **Step 1: Panel Appearance toggle**

In `appearancePage()`, after Size group:

```js
group('Stage', 'Fill the screen with me.', null,
  toggle('Whole screen', 'Large centered JARVIS. Size still applies when you leave.', !!state.wholeScreen, () => act('wholescreen'), 'wholescreen')),
```

- [ ] **Step 2: Wire sidecar**

Import helpers. Add `wholeScreen: false` to `DEFAULTS`. After load: `config.wholeScreen = normalizeWholeScreen(config.wholeScreen)`.

In `panelState()` add: `wholeScreen: normalizeWholeScreen(config.wholeScreen),`

Act handler (near `sound`):

```js
else if (id === 'wholescreen') {
  config.wholeScreen = !normalizeWholeScreen(config.wholeScreen);
  saveConfig();
  ui({ kind: 'wholescreen', on: config.wholeScreen });
  menu();
}
```

`ui_ready` seed after look:

```js
ui({ kind: 'wholescreen', on: normalizeWholeScreen(config.wholeScreen) });
```

Stdin: when overlay reports hide cleared mode:

```js
else if (m.type === 'wholescreen_off') {
  if (clearWholeScreenOnHide(config)) { saveConfig(); ui({ kind: 'wholescreen', on: false }); menu(); }
}
```

- [ ] **Step 3: Run** `node test/wholescreen.test.mjs` and `node test/about.test.mjs` — PASS

---

### Task 3: Overlay theme layer (`stage.js`)

**Files:**
- Create: `showcase/roamies/stage.js`
- Modify: `showcase/desktop.html` (script before host / after sidekick)

**Interfaces:**
- Produces: `Roamie.stage.set(on: boolean)`, `Roamie.wholeScreen` boolean

- [ ] **Step 1: Implement stage theme**

```js
(() => {
  const R = window.Roamie;
  const css = `
.rj-stage { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at 50% 45%, rgba(8,40,70,.55) 0%, rgba(0,0,0,.82) 55%, rgba(0,0,0,.92) 100%);
  transition: opacity .35s ease; }
.rj-stage.on { opacity: 1; }
.rj-stage::after { content: ''; position: absolute; left: 50%; bottom: 8%; width: min(42vw, 520px); height: min(18vw, 160px);
  transform: translateX(-50%); border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(120,255,226,.22), 0 0 40px rgba(47,168,255,.18) inset;
  opacity: .55; }
@media (prefers-reduced-motion: reduce) { .rj-stage { transition: none; } }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  let el = null;
  const ensure = () => {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'rj-stage';
    el.setAttribute('aria-hidden', 'true');
    const stage = document.getElementById('stage');
    (stage?.parentNode ?? document.body).insertBefore(el, stage ?? null);
    return el;
  };
  R.wholeScreen = false;
  R.stage = {
    set(on) {
      R.wholeScreen = !!on;
      ensure().classList.toggle('on', R.wholeScreen);
    },
  };
})();
```

- [ ] **Step 2: Add script tag** in `desktop.html` after `12-sidekick.js`, before boot (or after agent stack):

```html
<script src="roamies/stage.js"></script>
```

Also ensure `host.js` is loaded where production loads it (bundle / shell). If host is injected by Tauri separately, only touch the page the shell serves — check `bundle.sh` / desktop asset list and add `stage.js` there too if required.

---

### Task 4: Creature stage scale + agent park

**Files:**
- Modify: `showcase/roamies/10-dither.js` (`resize` ~593–602, kit API)
- Modify: `showcase/roamies/agent.js` (api + follow branch ~1214–1217)

**Interfaces:**
- Produces: `creature.setStage(on: boolean)`, `agent.setWholeScreen(on: boolean)`, `agent.wholeScreen` getter

- [ ] **Step 1: `setStage` on dither kit**

Add `let staged = false` near `userForm`.

```js
setStage(on) {
  staged = !!on;
  if (staged && form === 'cursor') swapForm('default');
  else if (!staged) swapForm(userForm);
  else if (lastEnv) self.resize(lastEnv);
},
```

In `resize`, replace R assignment:

```js
if (staged && form !== 'cursor') {
  R = clamp(Math.min(env.w, env.h) * 0.35, 80, Math.min(env.w, env.h) * 0.42);
} else {
  R = form === 'cursor' ? 26 : clamp(S * 0.15, 28, 140) * (form === 'small' ? 0.5 : 1);
}
m.radius = R * (o.ears || o.antenna ? 1.35 : 1.25);
```

- [ ] **Step 2: Agent API**

Inside agent factory, track `let whole = false`.

```js
setWholeScreen(on) {
  whole = !!on;
  k.setStage?.(whole);
  if (whole) {
    ensureShown();
    const S = bounds();
    const cx = (S.l + S.r) / 2, cy = (S.t + S.b) / 2;
    setStation(cx, cy); // must clear byCursor — use existing setStation that parks
    station.byCursor = null;
    fol.on = false; m.drive = null;
    m.goTo?.(cx, cy);
    presence.summoned = true; presence.lastActive = now;
  } else if (lastEnv || true) {
    k.setStage?.(false);
  }
},
get wholeScreen() { return whole; },
```

In update follow branch, skip cursor follow when `whole`:

```js
else if (!held && !whole && station.byCursor && presence.ptr) { follow(env, dt); station.flee = 0; }
else if (whole && !held && !pen.held) {
  fol.on = false; m.drive = null;
  const S = bounds();
  const cx = (S.l + S.r) / 2, cy = (S.t + S.b) / 2;
  if (Math.hypot(m.x - cx, m.y - cy) > 4) { setStation(cx, cy); m.goTo(cx, cy); }
}
else { fol.on = false; m.drive = null; }
```

Inspect `setStation` signature — if it sets `byCursor` from args, call the park form that leaves `byCursor` falsy.

- [ ] **Step 3: Manual smoke** after host wiring (Task 5)

---

### Task 5: Host wiring + summon hide clears config

**Files:**
- Modify: `showcase/roamies/host.js` (`__roamieHost` size/look block ~505, summon ~534)

- [ ] **Step 1: Handle ui message**

```js
if (m.kind === 'wholescreen') {
  Roamie.stage?.set(!!m.on);
  getAgent()?.setWholeScreen?.(!!m.on);
  return;
}
```

- [ ] **Step 2: Summon hide clears mode**

```js
if (m.kind === 'summon') {
  const a = getAgent();
  if (m.show || !a.visible) { if (a.show({ summoned: true })) a.act('wave'); }
  else {
    if (Roamie.wholeScreen || a.wholeScreen) {
      Roamie.stage?.set(false);
      a.setWholeScreen?.(false);
      send({ type: 'wholescreen_off' });
    }
    a.hide();
  }
  return;
}
```

- [ ] **Step 3: Ask-bar edge place when staged**

In `ask-bar.js` `R.askBarPlace`, if `R.wholeScreen`, place near bottom-center of bounds instead of beside cursor:

```js
if (R.wholeScreen) {
  const x = Math.round((bounds.l + bounds.r - w) / 2);
  const y = Math.round(bounds.b - h - 24);
  return [Math.max(bounds.l, x), Math.max(bounds.t, y)];
}
```

Speech bubbles already clamp to safe screen; optional follow-up only if they cover the core.

- [ ] **Step 4: Ensure `stage.js` is in the Tauri bundle** (search `bundle.sh` / asset copy for `desktop.html` scripts; add `stage.js` next to peers)

- [ ] **Step 5: Run sidecar tests**

```bash
cd showcase/tauri/sidecar && npm test
```

Expected: all green including wholescreen + about.

- [ ] **Step 6: Manual check** (Windows Git Bash per JARVIS.md)

```bash
cd showcase/tauri/sidecar && npm run build
cd .. && ./reload-dev.sh
```

Then: Appearance → Whole screen on; globe center + vignette; summon hide; reopen normal; toggle on, quit/relaunch still staged.

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Appearance toggle | 2 |
| Persist config | 2 |
| Summon hide clears | 1 helpers + 5 host + 2 stdin |
| Center + ~70% scale | 4 (`0.35` radius ≈ 70% diameter) |
| Theme only OLED/cyan/ring | 3 |
| Size preserved / cursor ignored staged | 4 |
| about text | 1 |
| Tests | 1, 2, 5 |
| No side panels / no new window | — (non-goals, no tasks) |
