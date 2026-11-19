// Whole-screen HUD drawn onto the LED canvas (WebView2 transparent windows ignore HTML/canvas stacked under
// clearRect holes — only opaque pixels on the active overlay canvas cover the desktop).
(() => {
  const R = window.Roamie;
  if (!R) return;

  const CY = 'rgba(0,200,255,';
  const CYA = (a) => `${CY}${a})`;
  const ink = (ctx, a) => { ctx.strokeStyle = CYA(a); ctx.fillStyle = CYA(a); };

  const panel = (c, x, y, pw, ph) => {
    c.save();
    ink(c, 0.35); c.lineWidth = 1;
    const n = 10;
    c.beginPath();
    c.moveTo(x + n, y); c.lineTo(x + pw - n, y); c.lineTo(x + pw, y + n);
    c.lineTo(x + pw, y + ph - n); c.lineTo(x + pw - n, y + ph); c.lineTo(x + n, y + ph);
    c.lineTo(x, y + ph - n); c.lineTo(x, y + n); c.closePath();
    c.stroke();
    ink(c, 0.14); c.fill();
    ink(c, 0.55);
    for (const [ax, ay, dx, dy] of [[x, y, 1, 1], [x + pw, y, -1, 1], [x, y + ph, 1, -1], [x + pw, y + ph, -1, -1]]) {
      c.beginPath(); c.moveTo(ax, ay + dy * 14); c.lineTo(ax, ay); c.lineTo(ax + dx * 14, ay); c.stroke();
    }
    c.restore();
  };

  const wireGlobe = (c, cx, cy, rad, t) => {
    c.save(); ink(c, 0.55); c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
    for (let i = -2; i <= 2; i++) {
      const a = (i / 3) * Math.PI * 0.45;
      c.beginPath(); c.ellipse(cx, cy, Math.max(2, rad * Math.cos(a)), rad, 0, 0, Math.PI * 2); c.stroke();
    }
    const yaw = t * 0.35;
    for (let i = 0; i < 6; i++) {
      const a = yaw + (i / 6) * Math.PI;
      c.beginPath(); c.ellipse(cx, cy, Math.max(2, rad * Math.abs(Math.cos(a))), rad, a, 0, Math.PI * 2);
      c.globalAlpha = 0.35 + 0.25 * Math.abs(Math.sin(a)); c.stroke();
    }
    c.restore();
  };

  const waveform = (c, x, y, pw, ph, t, voice) => {
    c.save(); ink(c, 0.7); c.lineWidth = 1.4; c.beginPath();
    const mid = y + ph / 2, n = 48;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const amp = (0.25 + voice * 0.75) * ph * 0.42 * (0.55 + 0.45 * Math.sin(u * 9 + t * 6));
      const yy = mid + Math.sin(u * 18 - t * 8) * amp * Math.sin(Math.PI * u);
      if (i === 0) c.moveTo(x + u * pw, yy); else c.lineTo(x + u * pw, yy);
    }
    c.stroke(); c.restore();
  };

  const terrain = (c, x, y, pw, ph, t) => {
    c.save(); ink(c, 0.45); c.lineWidth = 1;
    for (let row = 0; row < 5; row++) {
      c.beginPath();
      const yy = y + ph * (0.2 + row * 0.16);
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const bump = Math.sin(u * 7 + row + t * 0.4) * ph * 0.08 + Math.sin(u * 13 - t) * ph * 0.04;
        const px = x + u * pw, py = yy - bump * (1 - row * 0.12);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
    c.restore();
  };

  const gauges = (c, x, y, s, t) => {
    c.save();
    for (let i = 0; i < 3; i++) {
      const cx = x + i * (s + 10) + s / 2, cy = y + s / 2;
      const p = 0.35 + 0.25 * Math.sin(t * 1.2 + i);
      ink(c, 0.25); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, s * 0.38, 0, Math.PI * 2); c.stroke();
      ink(c, 0.75); c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, s * 0.38, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.stroke();
    }
    c.restore();
  };

  const city = (c, x, y, pw, ph, t) => {
    c.save(); ink(c, 0.5); c.lineWidth = 1;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, bw = pw / n * 0.55;
      const bh = ph * (0.25 + 0.7 * (0.5 + 0.5 * Math.sin(i * 1.7 + t * 0.2)));
      const bx = x + u * pw - bw / 2, by = y + ph - bh;
      c.strokeRect(bx, by, bw, bh);
    }
    c.restore();
  };

  const rings = (c, x, y, s, t) => {
    c.save();
    for (let i = 0; i < 3; i++) {
      const cx = x + i * (s + 12) + s / 2, cy = y + s / 2;
      const p = (0.4 + 0.3 * Math.sin(t + i * 1.1) + 1) % 1;
      ink(c, 0.2); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, s * 0.36, 0, Math.PI * 2); c.stroke();
      ink(c, 0.8); c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, s * 0.36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.25 + p * 0.55)); c.stroke();
    }
    c.restore();
  };

  const bars = (c, x, y, pw, ph, t) => {
    c.save();
    const n = 12, gap = 3, bw = (pw - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const bh = ph * (0.2 + 0.75 * (0.5 + 0.5 * Math.sin(t * 3 + i * 0.7)));
      ink(c, 0.15 + 0.55 * (bh / ph));
      c.fillRect(x + i * (bw + gap), y + ph - bh, bw, bh);
    }
    c.restore();
  };

  const aiMark = (c, cx, cy, s, t) => {
    c.save(); ink(c, 0.7); c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.stroke();
    ink(c, 0.45);
    c.beginPath(); c.arc(cx, cy, s * 0.45, t, t + Math.PI * 1.2); c.stroke();
    c.beginPath(); c.arc(cx, cy, s * 0.7, -t * 1.3, -t * 1.3 + Math.PI * 0.9); c.stroke();
    ink(c, 0.9); c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();
    c.restore();
  };

  const coreRings = (c, cx, cy, r, t, voice) => {
    c.save();
    const pulse = 1 + voice * 0.06;
    for (let i = 0; i < 5; i++) {
      const rr = r * (1.12 + i * 0.1) * pulse;
      ink(c, 0.18 + i * 0.08); c.lineWidth = i === 0 ? 2 : 1;
      c.beginPath();
      if (i % 2 === 0) {
        const a0 = t * (0.4 + i * 0.15);
        for (let k = 0; k < 24; k++) {
          const a1 = a0 + (k / 24) * Math.PI * 2, a2 = a1 + Math.PI * 2 / 48;
          c.moveTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
          c.lineTo(cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr);
        }
      } else c.arc(cx, cy, rr, 0, Math.PI * 2);
      c.stroke();
    }
    ink(c, 0.4); c.lineWidth = 1;
    const tickR = r * 1.55 * pulse;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 + t * 0.15;
      const inner = i % 5 === 0 ? tickR - 10 : tickR - 5;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      c.lineTo(cx + Math.cos(a) * tickR, cy + Math.sin(a) * tickR);
      c.stroke();
    }
    c.restore();
  };

  const floorPad = (c, cx, cy, r, t) => {
    c.save();
    for (let i = 0; i < 4; i++) {
      ink(c, 0.12 + i * 0.08); c.lineWidth = 1;
      c.beginPath(); c.ellipse(cx, cy, r * (0.7 + i * 0.18), r * (0.18 + i * 0.04), 0, 0, Math.PI * 2); c.stroke();
    }
    ink(c, 0.25 + 0.1 * Math.sin(t * 2));
    c.beginPath(); c.ellipse(cx, cy, r * 1.35, r * 0.32, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  };

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

  const visor = (c, tw, th, t) => {
    c.save(); ink(c, 0.35); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(tw * 0.08, th * 0.08); c.quadraticCurveTo(tw * 0.5, th * 0.02, tw * 0.92, th * 0.08); c.stroke();
    c.beginPath(); c.moveTo(tw * 0.12, th * 0.11); c.quadraticCurveTo(tw * 0.5, th * 0.05, tw * 0.88, th * 0.11); c.stroke();
    c.beginPath(); c.moveTo(tw * 0.06, th * 0.92); c.quadraticCurveTo(tw * 0.5, th * 0.98, tw * 0.94, th * 0.92); c.stroke();
    for (const side of [-1, 1]) {
      const x = side < 0 ? tw * 0.04 : tw * 0.96;
      c.beginPath();
      c.moveTo(x, th * 0.22); c.lineTo(x + side * tw * 0.03, th * 0.28);
      c.lineTo(x + side * tw * 0.03, th * 0.72); c.lineTo(x, th * 0.78); c.stroke();
    }
    ink(c, 0.15 + 0.05 * Math.sin(t));
    c.fillRect(0, 0, tw, th * 0.04); c.fillRect(0, th * 0.96, tw, th * 0.04);
    c.restore();
  };

  const paint = (c, o) => {
    const { w, h, cx, cy, r, t, voice = 0.2, reduced = false } = o;
    const tt = reduced ? 0 : t;

    // Opaque cover first — this is what hides the desktop in a transparent WebView.
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgb(0,4,12)';
    c.fillRect(0, 0, w, h);
    const bloom = c.createRadialGradient(cx, cy, Math.max(8, r * 0.12), cx, cy, Math.max(w, h) * 0.65);
    bloom.addColorStop(0, 'rgba(0,160,230,0.38)');
    bloom.addColorStop(0.3, 'rgba(0,50,90,0.55)');
    bloom.addColorStop(0.65, 'rgb(0,4,12)');
    bloom.addColorStop(1, 'rgb(0,0,0)');
    c.fillStyle = bloom;
    c.fillRect(0, 0, w, h);

    floorPad(c, cx, cy + r * 1.05, r, tt);
    godRays(c, cx, cy, r, tt, reduced);
    hub(c, cx, cy, r, voice);
    coreRings(c, cx, cy, r, tt, voice);

    const pw = Math.min(220, w * 0.16);
    const left = w * 0.04, right = w - pw - w * 0.04, top = h * 0.12;

    panel(c, left, top, pw, pw * 0.95);
    wireGlobe(c, left + pw / 2, top + pw * 0.48, pw * 0.32, tt);
    panel(c, left, top + pw * 1.05, pw, pw * 0.55);
    waveform(c, left + 12, top + pw * 1.12, pw - 24, pw * 0.4, tt, voice);
    panel(c, left, top + pw * 1.7, pw, pw * 0.7);
    terrain(c, left + 10, top + pw * 1.78, pw - 20, pw * 0.55, tt);
    gauges(c, left + 8, top + pw * 2.5, Math.min(48, pw * 0.28), tt);

    panel(c, right, top, pw, pw * 0.85);
    aiMark(c, right + pw / 2, top + pw * 0.42, pw * 0.28, tt);
    panel(c, right, top + pw * 0.95, pw, pw * 0.75);
    city(c, right + 10, top + pw * 1.05, pw - 20, pw * 0.55, tt);
    rings(c, right + 8, top + pw * 1.85, Math.min(48, pw * 0.28), tt);
    panel(c, right, top + pw * 2.35, pw, pw * 0.65);
    bars(c, right + 12, top + pw * 2.45, pw - 24, pw * 0.45, tt);
    visor(c, w, h, tt);
  };

  R.wholeScreen = false;
  R.stage = {
    set(on) { R.wholeScreen = !!on; },
    paint,
  };
})();
