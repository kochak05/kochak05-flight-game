// hud.js — the cockpit instruments and HUD: dials, horizon, compass, fuel, score.
// One job: draw everything that is not the world. All canvas, no DOM.

import { knots, headingDegrees } from './plane.js';

const PANEL = 'rgba(8, 20, 32, 0.62)';
const PANEL_EDGE = 'rgba(140, 200, 255, 0.35)';
const LIT = '#8fd8ff';
const AMBER = '#ffb347';
const GREEN = '#7dff9e';
const RED = '#ff5a5a';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dial(ctx, cx, cy, radius, label, valueText, subText) {
  ctx.save();
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Lit rim: a soft glow ring.
  ctx.strokeStyle = 'rgba(143, 216, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = LIT;
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - radius + 18);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(valueText, cx, cy + 2);
  if (subText) {
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = AMBER;
    ctx.fillText(subText, cx, cy + radius - 10);
  }
  ctx.restore();
}

function needleDial(ctx, cx, cy, radius, fraction, ticks) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  for (const t of ticks) {
    const a = t * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (radius - 12), -Math.cos(a) * (radius - 12));
    ctx.lineTo(Math.sin(a) * (radius - 4), -Math.cos(a) * (radius - 4));
    ctx.stroke();
  }
  const a = fraction * Math.PI * 2;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(a) * (radius - 14), -Math.cos(a) * (radius - 14));
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Artificial horizon: sky and ground halves, rolled by bank, pitched by climb.
function artificialHorizon(ctx, cx, cy, radius, bank, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank);
  const pitchPx = Math.max(-radius, Math.min(radius, -pitch * radius * 2.2));
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-radius - 2, -radius - 2 + pitchPx, radius * 2 + 4, radius + 2 - pitchPx);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-radius - 2, pitchPx, radius * 2 + 4, radius + 2 - pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pitchPx);
  ctx.lineTo(radius, pitchPx);
  ctx.stroke();
  ctx.rotate(bank);
  // Fixed aircraft symbol: wings and nose.
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.55, 0);
  ctx.lineTo(-radius * 0.15, 0);
  ctx.moveTo(radius * 0.15, 0);
  ctx.lineTo(radius * 0.55, 0);
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 5);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const COMPASS_POINTS = [
  [0, 'N'],
  [45, 'NE'],
  [90, 'E'],
  [135, 'SE'],
  [180, 'S'],
  [225, 'SW'],
  [270, 'W'],
  [315, 'NW'],
];

function compassTape(ctx, cx, y, width, headingDeg) {
  ctx.save();
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  roundRect(ctx, cx - width / 2, y, width, 34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - width / 2, y, width, 34);
  ctx.clip();
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -180; d <= 180; d += 15) {
    const deg = ((Math.round(headingDeg) + d + 360) % 360);
    const px = cx + (d / 15) * 34;
    if (px < cx - width / 2 - 10 || px > cx + width / 2 + 10) continue;
    const point = COMPASS_POINTS.find(([p]) => p === deg);
    ctx.fillStyle = point ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.fillText(point ? point[1] : String(deg), px, y + 22);
  }
  // Centre caret and digital heading.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 2);
  ctx.lineTo(cx + 6, y + 2);
  ctx.lineTo(cx, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y + 52);
}

function ringIcons(ctx, cx, y, total, done) {
  ctx.save();
  ctx.textAlign = 'center';
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * 26;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    if (i < done) {
      ctx.fillStyle = '#ffd34d';
      ctx.fill();
      ctx.strokeStyle = '#fff2b0';
    } else {
      ctx.fillStyle = 'rgba(255,211,77,0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,211,77,0.7)';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHud(ctx, W, H, game) {
  const plane = game.plane;
  const leg = game.leg;
  const ringsDone = game.rings.filter((r) => r.collected).length;

  // Airspeed dial (top left) and altimeter (top right).
  dial(ctx, 82, 76, 56, 'AIRSPEED', String(Math.round(knots(plane))), 'KT');
  needleDial(ctx, 82, 76, 56, (knots(plane) % 300) / 300, [0, 0.25, 0.5, 0.75]);
  dial(ctx, W - 82, 76, 56, 'ALTITUDE', String(Math.round(plane.altitude * 3.281)), 'FT');
  needleDial(ctx, W - 82, 76, 56, ((plane.altitude * 3.281) % 1000) / 1000, [0, 0.25, 0.5, 0.75]);

  // Artificial horizon (bottom left).
  artificialHorizon(ctx, 82, H - 76, 52, plane.bank, plane.pitch);
  ctx.fillStyle = LIT;
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', 82, H - 8);

  // Compass tape (bottom right).
  compassTape(ctx, W - 150, H - 96, 260, headingDegrees(plane));

  // Fuel bar (top right, under the altimeter, clear of the compass).
  const fuelW = 150;
  const fx = W - 232;
  const fy = 152;
  ctx.fillStyle = PANEL;
  roundRect(ctx, fx, fy, fuelW, 16, 6);
  ctx.fill();
  const fuelFrac = plane.fuel / 100;
  ctx.fillStyle = fuelFrac < 0.25 ? RED : fuelFrac < 0.5 ? AMBER : GREEN;
  if (fuelFrac > 0) {
    roundRect(ctx, fx + 2, fy + 2, Math.max(6, (fuelW - 4) * fuelFrac), 12, 4);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`FUEL ${Math.round(plane.fuel)}%`, fx, fy - 6);

  // Top centre: leg, score, rings, timer.
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  roundRect(ctx, W / 2 - 190, 12, 380, 64, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(leg.name, W / 2, 32);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText(`SCORE ${game.score}`, W / 2, 56);
  ringIcons(ctx, W / 2, 68, game.rings.length, ringsDone);
  if (leg.timeLimit > 0 && game.state === 'flying') {
    ctx.fillStyle = game.timeLeft < 30 ? RED : '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(
      `${Math.floor(game.timeLeft / 60)}:${String(Math.floor(game.timeLeft % 60)).padStart(2, '0')}`,
      W / 2 + 240,
      40,
    );
  }

  // Throttle bar (bottom centre).
  const tw = 180;
  const tx = W / 2 - tw / 2;
  const ty = H - 30;
  ctx.fillStyle = PANEL;
  roundRect(ctx, tx, ty, tw, 12, 6);
  ctx.fill();
  ctx.fillStyle = plane.throttle > 0.85 ? AMBER : LIT;
  roundRect(ctx, tx + 2, ty + 2, Math.max(4, (tw - 4) * plane.throttle), 8, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%${plane.rolling ? '  ·  GEAR DOWN' : ''}`, W / 2, ty - 6);

  // Warnings.
  let warnY = 96;
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  if (plane.stall && game.state === 'flying') {
    ctx.fillStyle = RED;
    ctx.fillText('⚠ STALL — NOSE DOWN, ADD POWER', W / 2, warnY);
    warnY += 22;
  }
  if (plane.lowFuel && game.state === 'flying') {
    ctx.fillStyle = AMBER;
    ctx.fillText('⚠ LOW FUEL — LAND TO REFUEL', W / 2, warnY);
    warnY += 22;
  }
  if (plane.outOfBounds > 0 && game.state === 'flying') {
    ctx.fillStyle = AMBER;
    ctx.fillText('⚠ TURN BACK — LEAVING THE STRAIT', W / 2, warnY);
  }

  // Floating message (ring, touchdown, ...).
  if (game.message && game.messageTime > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.messageTime);
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(game.message, W / 2, H / 2 - 120);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(game.message, W / 2, H / 2 - 120);
    ctx.restore();
  }
}
