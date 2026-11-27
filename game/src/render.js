// render.js — everything the eye sees, in a pseudo-3D chase view.
// One job: draw the world and the plane from a camera behind the aircraft.
// The camera sits behind the plane and looks forward along its heading, so
// the horizon, the sky, the runway and the rings are all ahead of the pilot.

import { RUNWAY } from './world.js';
import { drawHud } from './hud.js';

const W = 1280;
const H = 800;
const FOCAL = 720; // pixels per metre at 1 m ahead of the camera
const CAM = 140; // camera sits this far (m) behind the plane
const PLANE_X = W / 2;
const PLANE_Y = H * 0.64; // the big aircraft, low centre of the frame

// Horizon height: pitch moves it — climb and the horizon drops away.
function horizonY(plane) {
  return H * 0.36 + plane.pitch * 520;
}

// Project a world point (wx, wy, altitude in metres) onto the screen.
// d is the distance ahead of the plane, lateral is the sideways offset.
function project(plane, horizon, wx, wy, alt) {
  const dx = wx - plane.x;
  const dy = wy - plane.y;
  const sin = Math.sin(plane.heading);
  const cos = Math.cos(plane.heading);
  const d = dx * sin + dy * cos; // forward
  const lateral = dx * cos - dy * sin; // right
  const depth = d + CAM;
  if (depth < 20) return null;
  const scale = FOCAL / depth;
  return {
    x: W / 2 + lateral * scale,
    y: horizon + (plane.altitude - alt) * scale,
    scale,
    d,
    lateral,
  };
}

function fadeWithDistance(d, near, far) {
  if (d <= near) return 1;
  if (d >= far) return 0;
  return 1 - (d - near) / (far - near);
}

// ---- sky -----------------------------------------------------------------

function drawSky(ctx, horizon, plane, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
  sky.addColorStop(0, '#2f7fd0');
  sky.addColorStop(0.55, '#7db8e8');
  sky.addColorStop(1, '#cfe8f7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, Math.max(horizon, 1));

  // Sun, high on the right, with a warm glow.
  const sunX = W * 0.76;
  const sunY = Math.max(50, horizon - 150);
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 180);
  glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 226, 140, 0.45)');
  glow.addColorStop(1, 'rgba(255, 226, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 190, sunY - 190, 380, 380);
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
  ctx.fill();
}

// A hazy ridge of far land along the horizon, so the strait reads as a
// place even when no island is near. Deterministic, from the heading.
function drawDistantRidge(ctx, horizon, plane) {
  ctx.fillStyle = 'rgba(74, 110, 138, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 2);
  const base = Math.sin(plane.heading * 2.3) * 18;
  for (let x = 0; x <= W; x += 80) {
    const peak = 14 + 22 * Math.abs(Math.sin(x * 0.011 + plane.heading * 3.1 + base));
    ctx.lineTo(x, horizon - peak);
  }
  ctx.lineTo(W, horizon + 2);
  ctx.closePath();
  ctx.fill();
  // A second, nearer ridge, greener.
  ctx.fillStyle = 'rgba(58, 102, 84, 0.45)';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 2);
  for (let x = 0; x <= W; x += 110) {
    const peak = 6 + 14 * Math.abs(Math.sin(x * 0.017 + plane.heading * 5.7 + 2));
    ctx.lineTo(x, horizon - peak);
  }
  ctx.lineTo(W, horizon + 2);
  ctx.closePath();
  ctx.fill();
}

// ---- sea -----------------------------------------------------------------

function drawSea(ctx, horizon, plane, world, time) {
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, '#2f7fa8');
  sea.addColorStop(0.35, '#14608c');
  sea.addColorStop(1, '#083a5e');
  ctx.fillStyle = sea;
  ctx.fillRect(0, Math.max(horizon, 0), W, H - Math.max(horizon, 0));

  // Sun glitter on the water, a bright path under the sun.
  const glitter = ctx.createLinearGradient(0, horizon, 0, H);
  glitter.addColorStop(0, 'rgba(255, 240, 190, 0.20)');
  glitter.addColorStop(1, 'rgba(255, 240, 190, 0)');
  ctx.fillStyle = glitter;
  ctx.beginPath();
  ctx.moveTo(W * 0.68, horizon);
  ctx.lineTo(W * 0.84, horizon);
  ctx.lineTo(W * 0.95, H);
  ctx.lineTo(W * 0.57, H);
  ctx.closePath();
  ctx.fill();

  // Wave streaks, projected onto the sea surface, fading with distance.
  ctx.lineWidth = 1.5;
  for (const wv of world.waves) {
    const p = project(plane, horizon, wv.x, wv.y, 0);
    if (!p || p.d < 0 || p.d > 2600) continue;
    if (p.x < -80 || p.x > W + 80 || p.y < horizon - 4 || p.y > H + 20) continue;
    const len = wv.len * p.scale;
    if (len < 2) continue;
    ctx.strokeStyle = `rgba(190, 230, 255, ${wv.alpha * fadeWithDistance(p.d, 300, 2400)})`;
    ctx.beginPath();
    ctx.moveTo(p.x - len * 0.5, p.y);
    ctx.lineTo(p.x + len * 0.5, p.y);
    ctx.stroke();
  }
}

// ---- islands ---------------------------------------------------------------

function islandOutlinePoints(island, shrink) {
  const pts = [];
  for (let i = 0; i < island.points; i++) {
    const angle = (i / island.points) * Math.PI * 2;
    const r = island.radii[i] * shrink;
    pts.push({ x: island.cx + Math.cos(angle) * r, y: island.cy + Math.sin(angle) * r });
  }
  return pts;
}

function drawIsland(ctx, plane, horizon, island) {
  const centre = project(plane, horizon, island.cx, island.cy, 0);
  if (!centre || centre.d < -250 || centre.d > 4600) return;
  if (centre.x < -700 || centre.x > W + 700) return;
  const haze = fadeWithDistance(centre.d, 800, 4200);

  // Beach, then grass: the outline projected onto the sea, in perspective.
  const beach = islandOutlinePoints(island, 1.06).map((p) => project(plane, horizon, p.x, p.y, 0)).filter(Boolean);
  const grass = islandOutlinePoints(island, 1.0).map((p) => project(plane, horizon, p.x, p.y, 0)).filter(Boolean);
  if (beach.length < 3 || grass.length < 3) return;
  const poly = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  poly(beach, `rgba(232, 217, 160, ${0.35 + 0.65 * haze})`);
  poly(grass, haze > 0.5 ? '#5d8f57' : '#6f9a6a');

  // The mountain: a shaded peak rising from the island's projected base.
  if (island.peak > 60) {
    const peak = project(plane, horizon, island.cx, island.cy, island.peak);
    if (peak) {
      const xs = grass.map((p) => p.x);
      const baseY = Math.max(...grass.map((p) => p.y));
      const left = peak.x - (Math.max(...xs) - Math.min(...xs)) * 0.35;
      const right = peak.x + (Math.max(...xs) - Math.min(...xs)) * 0.35;
      ctx.beginPath();
      ctx.moveTo(left, baseY);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(right, baseY);
      ctx.closePath();
      ctx.fillStyle = haze > 0.5 ? '#7d6f5e' : '#8a7d6d';
      ctx.fill();
      // Sunlit slope on the right, shadow on the left.
      ctx.beginPath();
      ctx.moveTo(peak.x, peak.y);
      ctx.lineTo(right, baseY);
      ctx.lineTo((peak.x + right) / 2, baseY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 235, 200, 0.22)';
      ctx.fill();
      if (island.peak > 150) {
        const snowY = peak.y + (baseY - peak.y) * 0.22;
        ctx.beginPath();
        ctx.moveTo(peak.x, peak.y);
        ctx.lineTo(peak.x - (right - left) * 0.09, snowY);
        ctx.lineTo(peak.x + (right - left) * 0.09, snowY);
        ctx.closePath();
        ctx.fillStyle = '#eef2f4';
        ctx.fill();
      }
    }
  }
}

function drawIslands(ctx, plane, horizon, world) {
  // Far islands first, so near ones overlap them.
  const sorted = [...world.islands].sort((a, b) => {
    const da = (a.cx - plane.x) * Math.sin(plane.heading) + (a.cy - plane.y) * Math.cos(plane.heading);
    const db = (b.cx - plane.x) * Math.sin(plane.heading) + (b.cy - plane.y) * Math.cos(plane.heading);
    return db - da;
  });
  for (const island of sorted) drawIsland(ctx, plane, horizon, island);
}

// ---- runway ----------------------------------------------------------------

function drawRunway(ctx, plane, horizon) {
  const rw = RUNWAY;
  const hw = rw.width / 2;
  const hl = rw.length / 2;
  const corners = [
    project(plane, horizon, rw.x - hw, rw.y - hl, 2),
    project(plane, horizon, rw.x + hw, rw.y - hl, 2),
    project(plane, horizon, rw.x + hw, rw.y + hl, 2),
    project(plane, horizon, rw.x - hw, rw.y + hl, 2),
  ];
  if (corners.some((c) => !c)) return;
  const centre = project(plane, horizon, rw.x, rw.y, 2);
  if (!centre || centre.d < -200 || centre.d > 5000) return;

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fillStyle = '#2b2f36';
  ctx.fill();
  ctx.strokeStyle = '#f5f5f5';
  ctx.lineWidth = Math.max(1, 2 * centre.scale);
  ctx.stroke();

  // Centreline, sampled along the strip so it follows the perspective.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, 3.5 * centre.scale);
  ctx.setLineDash([Math.max(6, 26 * centre.scale), Math.max(5, 22 * centre.scale)]);
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const t = -hl + (i / 12) * rw.length;
    const p = project(plane, horizon, rw.x, rw.y + t, 2);
    if (!p) continue;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Touchdown zone bars near the near threshold.
  for (const side of [-0.6, 0.6]) {
    const a = project(plane, horizon, rw.x + side * hw - 7, rw.y - hl + 120, 2);
    const b = project(plane, horizon, rw.x + side * hw + 7, rw.y - hl + 120, 2);
    if (!a || !b) continue;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, 5 * centre.scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Runway number and name, sized by distance.
  if (centre.d < 2600) {
    const near = project(plane, horizon, rw.x, rw.y - hl + 60, 2);
    if (near) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, Math.round(34 * centre.scale))}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('36', near.x, near.y - 6);
      ctx.font = `bold ${Math.max(11, Math.round(15 * centre.scale))}px Arial, sans-serif`;
      ctx.fillText(rw.name, centre.x, centre.y - Math.max(14, 30 * centre.scale));
    }
  }
}

// ---- rings -----------------------------------------------------------------

function drawRings(ctx, plane, horizon, rings) {
  const sorted = [...rings].sort((a, b) => {
    const da = (a.x - plane.x) * Math.sin(plane.heading) + (a.y - plane.y) * Math.cos(plane.heading);
    const db = (b.x - plane.x) * Math.sin(plane.heading) + (b.y - plane.y) * Math.cos(plane.heading);
    return db - da;
  });
  for (const ring of sorted) {
    const p = project(plane, horizon, ring.x, ring.y, ring.alt);
    if (!p || p.d < -40 || p.d > 5200) continue;
    const r = 30 * p.scale; // the ring is 30 m across in the world
    if (r < 5) {
      // Too far for a circle: a bright gold diamond marks it instead.
      ctx.fillStyle = ring.collected ? '#7dff9e' : '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 7);
      ctx.lineTo(p.x + 7, p.y);
      ctx.lineTo(p.x, p.y + 7);
      ctx.lineTo(p.x - 7, p.y);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    if (p.x < -r - 40 || p.x > W + r + 40 || p.y < -r - 40 || p.y > H + r + 40) continue;
    const gold = ring.collected ? '#7dff9e' : '#ffd34d';
    // Glow, then the gold ring, then a bright inner rim.
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = ring.collected ? 'rgba(125, 255, 158, 0.25)' : 'rgba(255, 211, 77, 0.30)';
    ctx.lineWidth = Math.max(6, r * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = gold;
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 242, 176, 0.9)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    if (!ring.collected && p.d < 1500) {
      ctx.fillStyle = '#fff2b0';
      ctx.font = `bold ${Math.max(12, Math.round(r * 0.22))}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      // The label sits above the ring, unless that would run under the
      // top HUD panel — then it goes below the ring instead.
      const labelY = p.y - r - 10 < 92 ? p.y + r + 20 : p.y - r - 10;
      ctx.fillText(`${ring.alt}m  ·  ${Math.round(p.d)}m`, p.x, labelY);
    }
  }
}

// A chevron at the screen edge pointing at the next ring when it is off-frame.
function drawNextRingGuide(ctx, plane, horizon, rings) {
  const next = rings.find((r) => !r.collected);
  if (!next) return;
  const p = project(plane, horizon, next.x, next.y, next.alt);
  if (!p) return;
  if (p.x >= 60 && p.x <= W - 60 && p.y >= 90 && p.y <= H - 90) return;
  const cx = Math.max(60, Math.min(W - 60, p.x));
  const cy = Math.max(110, Math.min(H - 110, p.y));
  const dir = p.x < 60 ? -1 : p.x > W - 60 ? 1 : 0;
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`RING ${Math.round(p.d)}m ${dir < 0 ? '◀' : dir > 0 ? '▶' : '▲'}`, cx, cy - 14);
  ctx.beginPath();
  ctx.moveTo(cx + dir * 14, cy);
  ctx.lineTo(cx - dir * 10, cy - 9);
  ctx.lineTo(cx - dir * 10, cy + 9);
  ctx.closePath();
  ctx.fill();
}

// ---- clouds ----------------------------------------------------------------

function drawClouds(ctx, plane, horizon, world, time) {
  for (let i = 0; i < world.clouds.length; i++) {
    const cloud = world.clouds[i];
    const cx = cloud.x + time * cloud.speed;
    const alt = 480 + (i % 3) * 90;
    const p = project(plane, horizon, cx, cloud.y, alt);
    if (!p || p.d < -100 || p.d > 5200) continue;
    if (p.y > horizon + 10) continue; // clouds live in the sky
    const s = cloud.size * p.scale;
    if (s < 6 || p.x < -s || p.x > W + s || p.y < -s) continue;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * fadeWithDistance(p.d, 500, 4200) + 0.15})`;
    for (let j = 0; j < cloud.puffs; j++) {
      const px = p.x + (j - cloud.puffs / 2) * s * 0.42;
      const py = p.y + Math.sin(j * 2.1 + i) * s * 0.1;
      ctx.beginPath();
      ctx.ellipse(px, py, s * 0.42, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- the aircraft ----------------------------------------------------------
// Drawn big, low centre, in detail: fuselage, swept wings, canopy, tail,
// engines, nav lights. Bank rolls it; pitch squashes it slightly.

function drawPlane(ctx, plane, time) {
  const cx = PLANE_X;
  const cy = PLANE_Y;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.45);
  const pitchSquash = 1 - Math.abs(plane.pitch) * 0.35;
  const S = 1.55; // ~180 px long, ~220 px across the wings
  ctx.scale(S, S * pitchSquash);

  // Wings: swept, with tip lights.
  ctx.fillStyle = '#dfe6ee';
  ctx.strokeStyle = '#8d99a8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.lineTo(-72, 34);
  ctx.lineTo(-66, 46);
  ctx.lineTo(-4, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(72, 34);
  ctx.lineTo(66, 46);
  ctx.lineTo(4, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tailplane and fin.
  ctx.fillStyle = '#c8d2de';
  ctx.beginPath();
  ctx.moveTo(-4, 40);
  ctx.lineTo(-30, 58);
  ctx.lineTo(-26, 64);
  ctx.lineTo(0, 48);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 40);
  ctx.lineTo(30, 58);
  ctx.lineTo(26, 64);
  ctx.lineTo(0, 48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b23a';
  ctx.beginPath();
  ctx.moveTo(-3, 42);
  ctx.lineTo(0, 66);
  ctx.lineTo(3, 42);
  ctx.closePath();
  ctx.fill();

  // Fuselage: tapered body with a nose and a stripe.
  const body = ctx.createLinearGradient(-8, 0, 8, 0);
  body.addColorStop(0, '#f4f7fa');
  body.addColorStop(0.5, '#ffffff');
  body.addColorStop(1, '#c3ccd6');
  ctx.fillStyle = body;
  ctx.strokeStyle = '#7c8794';
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.quadraticCurveTo(7, -30, 8, -6);
  ctx.lineTo(8, 34);
  ctx.quadraticCurveTo(6, 46, 0, 48);
  ctx.quadraticCurveTo(-6, 46, -8, 34);
  ctx.lineTo(-8, -6);
  ctx.quadraticCurveTo(-7, -30, 0, -52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8b23a';
  ctx.fillRect(-8, 8, 16, 4);

  // Canopy: the pilot's window.
  ctx.fillStyle = '#1d6fb8';
  ctx.beginPath();
  ctx.ellipse(0, -26, 5, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-1.5, -30, 1.8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engines under the wings.
  ctx.fillStyle = '#9aa7b5';
  ctx.beginPath();
  ctx.arc(-26, 22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(26, 22, 5, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights: red left, green right, blinking white tail.
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(-70, 40, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2dff5e';
  ctx.beginPath();
  ctx.arc(70, 40, 3, 0, Math.PI * 2);
  ctx.fill();
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 64, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Landing gear when down.
  if (plane.gearDown || plane.rolling) {
    ctx.strokeStyle = '#333a42';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 30);
    ctx.lineTo(-10, 40);
    ctx.moveTo(6, 30);
    ctx.lineTo(10, 40);
    ctx.moveTo(0, 36);
    ctx.lineTo(0, 46);
    ctx.stroke();
  }
  ctx.restore();

  // Speed streaks past the wings when fast.
  if (plane.speed > 85) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (const sx of [-150, 150]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx, cy - 40);
      ctx.lineTo(cx + sx, cy + 30);
      ctx.stroke();
    }
  }
}

function drawOverlay(ctx, title, lines, hint) {
  ctx.fillStyle = 'rgba(4, 12, 22, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 70);
  ctx.font = '20px Arial, sans-serif';
  let y = H / 2 - 20;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 30;
  }
  if (hint) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(hint, W / 2, y + 24);
  }
}

export function render(ctx, game, time) {
  const plane = game.plane;
  const horizon = horizonY(plane);

  // The world rolls with the bank; the HUD never does.
  ctx.save();
  ctx.translate(W / 2, horizon);
  ctx.rotate(-plane.bank * 0.55);
  ctx.translate(-W / 2, -horizon);
  drawSky(ctx, horizon, plane, time);
  drawDistantRidge(ctx, horizon, plane);
  drawSea(ctx, horizon, plane, game.world, time);
  drawIslands(ctx, plane, horizon, game.world);
  drawRunway(ctx, plane, horizon);
  drawRings(ctx, plane, horizon, game.rings);
  drawClouds(ctx, plane, horizon, game.world, time);
  ctx.restore();

  drawNextRingGuide(ctx, plane, horizon, game.rings);
  drawPlane(ctx, plane, time);
  drawHud(ctx, W, H, game);

  // A soft vignette to hold the frame together.
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  if (game.state === 'title') {
    drawOverlay(ctx, 'STRAIT RUN', [
      'A chase-view flight game over an island strait.',
      'Thread the gold rings, mind your fuel, and land on the runway.',
      '',
      '← → / A D  bank      ↑ ↓  pitch      W / S  throttle',
      'CLICK or SPACE  airbrake / flare      R  retry a leg',
    ], 'Press ENTER or click to fly');
  } else if (game.state === 'crashed') {
    drawOverlay(ctx, 'CRASHED', [
      `Reason: ${plane.crashReason}`,
      `Leg score lost — total score kept: ${game.score}`,
      '',
      `${game.leg.name} — try it again.`,
    ], 'Press R to retry the leg');
  } else if (game.state === 'legdone') {
    drawOverlay(ctx, 'LEG COMPLETE', [
      game.legCompleteText,
      `Total score: ${game.score}`,
      '',
      game.nextLeg ? `Next: ${game.nextLeg.name}` : 'That was the last leg.',
    ], game.nextLeg ? 'Press ENTER for the next leg' : 'Press ENTER to see your total');
  } else if (game.state === 'complete') {
    drawOverlay(ctx, 'STRAIT RUN COMPLETE', [
      `Final score: ${game.score}`,
      `Rings flown: ${game.totalRings}   Landings: ${game.totalLandings}`,
      '',
      'Thanks for flying the strait.',
    ], 'Press R to fly it all again');
  }
}
