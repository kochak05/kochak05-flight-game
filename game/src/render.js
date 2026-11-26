// render.js — everything the eye sees: sea, islands, runway, rings, clouds, aircraft.
// One job: draw the world and the plane from the camera's point of view.

import { RUNWAY } from './world.js';
import { drawHud } from './hud.js';

const W = 1280;
const H = 800;

// Zoom in pixels per metre: high altitude sees more of the strait.
function zoomFor(altitude) {
  return Math.max(0.14, 0.62 - altitude * 0.0009);
}

function worldToScreen(plane, zoom, wx, wy) {
  const dx = wx - plane.x;
  const dy = wy - plane.y;
  const cos = Math.cos(plane.heading);
  const sin = Math.sin(plane.heading);
  // Rotate so the heading points up the screen.
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return { x: W / 2 + rx * zoom, y: H * 0.58 - ry * zoom };
}

function islandPath(ctx, island, scale) {
  ctx.beginPath();
  for (let i = 0; i <= island.points; i++) {
    const idx = i % island.points;
    const angle = (idx / island.points) * Math.PI * 2;
    const r = island.radii[idx] * scale;
    const x = island.cx + Math.cos(angle) * r;
    const y = island.cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawSea(ctx, plane, zoom, world, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0e4a75');
  grad.addColorStop(0.55, '#0d5a8a');
  grad.addColorStop(1, '#0a3f63');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Wave strokes, only those near the view.
  const viewR = Math.hypot(W, H) / zoom + 200;
  ctx.lineWidth = 1.5;
  for (const wv of world.waves) {
    const dx = wv.x - plane.x;
    const dy = wv.y - plane.y;
    if (Math.abs(dx) > viewR || Math.abs(dy) > viewR) continue;
    const p = worldToScreen(plane, zoom, wv.x, wv.y);
    ctx.strokeStyle = `rgba(180, 225, 255, ${wv.alpha})`;
    ctx.beginPath();
    const len = wv.len * zoom;
    ctx.moveTo(p.x - Math.cos(wv.angle) * len * 0.5, p.y - Math.sin(wv.angle) * len * 0.5);
    ctx.lineTo(p.x + Math.cos(wv.angle) * len * 0.5, p.y + Math.sin(wv.angle) * len * 0.5);
    ctx.stroke();
  }

  // Sun glitter: a bright band that follows the view.
  const glitter = ctx.createRadialGradient(W * 0.72, H * 0.2, 10, W * 0.72, H * 0.2, 320);
  glitter.addColorStop(0, 'rgba(255, 240, 190, 0.14)');
  glitter.addColorStop(1, 'rgba(255, 240, 190, 0)');
  ctx.fillStyle = glitter;
  ctx.fillRect(0, 0, W, H);
}

function drawIslands(ctx, plane, zoom, world) {
  const viewR = Math.hypot(W, H) / zoom + 800;
  for (const island of world.islands) {
    const dx = island.cx - plane.x;
    const dy = island.cy - plane.y;
    if (Math.abs(dx) > viewR || Math.abs(dy) > viewR) continue;

    // Transform each outline point into screen space.
    const outline = (scale) => {
      ctx.beginPath();
      for (let i = 0; i <= island.points; i++) {
        const idx = i % island.points;
        const angle = (idx / island.points) * Math.PI * 2;
        const r = island.radii[idx] * scale;
        const p = worldToScreen(plane, zoom, island.cx + Math.cos(angle) * r, island.cy + Math.sin(angle) * r);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };

    // Beach, then grass, then the mountain crown.
    outline(1.06);
    ctx.fillStyle = '#e8d9a0';
    ctx.fill();
    outline(1.0);
    const grass = ctx.createRadialGradient(
      worldToScreen(plane, zoom, island.cx, island.cy).x,
      worldToScreen(plane, zoom, island.cx, island.cy).y,
      4,
      worldToScreen(plane, zoom, island.cx, island.cy).x,
      worldToScreen(plane, zoom, island.cx, island.cy).y,
      island.radius * zoom,
    );
    grass.addColorStop(0, '#7fb069');
    grass.addColorStop(1, '#4d7c4a');
    ctx.fillStyle = grass;
    ctx.fill();
    if (island.peak > 60) {
      outline(0.45);
      ctx.fillStyle = '#8a7a68';
      ctx.fill();
      outline(0.22);
      ctx.fillStyle = '#e8e4da';
      ctx.fill();
    }
  }
}

function drawRunway(ctx, plane, zoom) {
  const rw = RUNWAY;
  const hw = rw.width / 2;
  const hl = rw.length / 2;
  const corners = [
    worldToScreen(plane, zoom, rw.x - hw, rw.y - hl),
    worldToScreen(plane, zoom, rw.x + hw, rw.y - hl),
    worldToScreen(plane, zoom, rw.x + hw, rw.y + hl),
    worldToScreen(plane, zoom, rw.x - hw, rw.y + hl),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fillStyle = '#2b2f36';
  ctx.fill();
  ctx.strokeStyle = '#f5f5f5';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Centreline dashes and threshold bars.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, 3 * zoom * 4);
  ctx.setLineDash([26 * zoom, 22 * zoom]);
  const a = worldToScreen(plane, zoom, rw.x, rw.y - hl + 30);
  const b = worldToScreen(plane, zoom, rw.x, rw.y + hl - 30);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Touchdown zone: two white bars near the southern threshold.
  const tz1 = worldToScreen(plane, zoom, rw.x - hw * 0.6, rw.y - hl + 120);
  const tz2 = worldToScreen(plane, zoom, rw.x + hw * 0.6, rw.y - hl + 120);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, 5 * zoom * 4);
  ctx.beginPath();
  ctx.moveTo(tz1.x - 14 * zoom, tz1.y);
  ctx.lineTo(tz1.x + 14 * zoom, tz1.y);
  ctx.moveTo(tz2.x - 14 * zoom, tz2.y);
  ctx.lineTo(tz2.x + 14 * zoom, tz2.y);
  ctx.stroke();

  // Runway label, readable when close.
  if (zoom > 0.25) {
    const label = worldToScreen(plane, zoom, rw.x, rw.y + hl + 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rw.name, label.x, label.y);
  }
}

function drawRings(ctx, plane, zoom, rings) {
  for (const ring of rings) {
    const p = worldToScreen(plane, zoom, ring.x, ring.y);
    const r = 30 * zoom;
    if (p.x < -120 || p.x > W + 120 || p.y < -120 || p.y > H + 120) continue;
    // Shadow on the ground below the ring, offset by its altitude.
    const shadow = worldToScreen(plane, zoom, ring.x + ring.alt * 0.12, ring.y - ring.alt * 0.12);
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();
    // The gold ring itself, slightly squashed for a floating look.
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ring.collected ? 'rgba(125, 255, 158, 0.9)' : '#ffd34d';
    ctx.lineWidth = Math.max(3, 7 * zoom);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 242, 176, 0.85)';
    ctx.lineWidth = Math.max(1, 2.5 * zoom);
    ctx.stroke();
    if (!ring.collected) {
      ctx.fillStyle = '#fff2b0';
      ctx.font = `bold ${Math.max(11, 13 * zoom * 2)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${ring.alt}m`, p.x, p.y - r * 0.62 - 8);
    }
  }
}

function drawClouds(ctx, plane, zoom, world, time) {
  for (const cloud of world.clouds) {
    const cx = cloud.x + time * cloud.speed;
    const p = worldToScreen(plane, zoom, cx, cloud.y);
    const s = cloud.size * zoom;
    if (p.x < -s || p.x > W + s || p.y < -s || p.y > H + s) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    for (let i = 0; i < cloud.puffs; i++) {
      const px = p.x + (i - cloud.puffs / 2) * s * 0.42;
      const py = p.y + Math.sin(i * 2.1) * s * 0.1;
      ctx.beginPath();
      ctx.ellipse(px, py, s * 0.42, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The aircraft, drawn in detail: fuselage, swept wings, tail, canopy, engines.
function drawPlane(ctx, plane, time) {
  const cx = W / 2;
  const cy = H * 0.58;
  // Ground shadow: offset and fade grow with altitude.
  const shadowOff = Math.min(46, plane.altitude * 0.12);
  const shadowAlpha = Math.max(0.08, 0.3 - plane.altitude * 0.0004);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(cx + shadowOff, cy + shadowOff * 0.7, 52, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.45);
  const pitchSquash = 1 - Math.abs(plane.pitch) * 0.35;
  ctx.scale(1, pitchSquash);

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
  const zoom = zoomFor(plane.altitude);
  drawSea(ctx, plane, zoom, game.world, time);
  drawIslands(ctx, plane, zoom, game.world);
  drawRunway(ctx, plane, zoom);
  drawRings(ctx, plane, zoom, game.rings);
  drawClouds(ctx, plane, zoom, game.world, time);
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
