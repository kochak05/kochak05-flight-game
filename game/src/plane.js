// plane.js — the aircraft: state, flight physics, fuel, rings, landing, crashes.
// One job: move the plane and report what happened. No drawing, no sound.

import { RUNWAY, STRAIT, heightAt, terrainAt } from './world.js';

export const MAX_SPEED = 150; // m/s, about 290 kt at full throttle
export const STALL_SPEED = 32; // m/s, below this the wing stops lifting
export const MAX_BANK = 1.0; // radians, about 57 degrees
export const MAX_PITCH = 0.26; // radians, about 15 degrees
export const RING_RADIUS = 30; // metres across the ring to count
export const RING_ALT_BAND = 48; // metres above/below the ring's altitude

export function newPlane(start) {
  return {
    x: start.x,
    y: start.y,
    heading: start.heading, // radians, 0 = north (+y), clockwise
    altitude: start.altitude, // metres above sea level
    speed: start.speed, // m/s
    verticalSpeed: 0,
    bank: 0,
    pitch: 0,
    throttle: 0.55,
    fuel: start.fuel, // percent
    gearDown: false,
    flaps: false,
    crashed: false,
    crashReason: '',
    landed: false,
    rolling: false,
    outOfBounds: 0,
    stall: false,
    lowFuel: false,
  };
}

// input: { bank: -1..1, pitch: -1..1, throttle: -1..1, brake: bool }
// Returns events for this step: [{ type: 'ring'|'crash'|'touchdown'|'landed'|'stall'|'lowfuel', ... }]
export function stepPlane(plane, input, dt, world, rings) {
  const events = [];
  if (plane.crashed || plane.landed) return events;

  // Rolling on the runway after touchdown: just slow down.
  if (plane.rolling) {
    plane.speed = Math.max(0, plane.speed - 14 * dt);
    plane.y += Math.cos(plane.heading) * plane.speed * dt;
    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    if (plane.speed < 3) {
      plane.landed = true;
      events.push({ type: 'landed' });
    }
    return events;
  }

  // Bank: roll toward the stick, turn rate grows with bank and shrinks with speed.
  const targetBank = input.bank * MAX_BANK;
  plane.bank += (targetBank - plane.bank) * Math.min(1, 2.2 * dt);
  const turnRate = (9.81 * Math.tan(plane.bank)) / Math.max(plane.speed, 25);
  plane.heading += Math.max(-0.7, Math.min(0.7, turnRate)) * dt;

  // Pitch: climb trades speed, descent buys it back.
  const targetPitch = input.pitch * MAX_PITCH;
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, 2.0 * dt);
  plane.throttle = Math.max(
    0,
    Math.min(1, plane.throttle + input.throttle * 0.45 * dt),
  );

  // Speed chases the throttle, drag and pitch fight it.
  const targetSpeed = plane.throttle * MAX_SPEED;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, 0.35 * dt);
  plane.speed -= Math.sin(plane.pitch) * 7 * dt;
  plane.speed -= Math.abs(plane.bank) * 2.2 * dt; // turning bleeds speed
  if (input.brake) plane.speed = Math.max(0, plane.speed - 26 * dt);
  plane.speed = Math.max(0, plane.speed);

  // Lift: below stall speed the wing sinks and the controls go mushy.
  plane.stall = plane.speed < STALL_SPEED && plane.altitude > 4;
  const lift = Math.min(1, plane.speed / STALL_SPEED);
  plane.verticalSpeed = plane.speed * Math.sin(plane.pitch) * 0.9;
  if (plane.stall) plane.verticalSpeed -= (1 - lift) * 9;
  if (input.brake && plane.altitude < 18 && plane.verticalSpeed < 0) {
    plane.verticalSpeed *= 0.35; // flare: the airbrake doubles as a flare near the ground
  }
  plane.altitude += plane.verticalSpeed * dt;
  if (plane.altitude < 0) plane.altitude = 0;

  // Fuel burns with throttle; dry tanks mean gliding only.
  plane.fuel = Math.max(0, plane.fuel - (0.06 + plane.throttle * 0.24) * dt);
  if (plane.fuel <= 0) {
    plane.throttle = Math.max(0, plane.throttle - 0.4 * dt);
  }
  if (plane.fuel < 25 && !plane.lowFuel) {
    plane.lowFuel = true;
    events.push({ type: 'lowfuel' });
  }
  if (plane.stall) events.push({ type: 'stall' });

  // Move across the strait.
  plane.x += Math.sin(plane.heading) * plane.speed * dt;
  plane.y += Math.cos(plane.heading) * plane.speed * dt;

  // Rings: fly through the centre, inside the altitude band.
  for (const ring of rings) {
    if (ring.collected) continue;
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    if (
      Math.hypot(dx, dy) < RING_RADIUS &&
      Math.abs(plane.altitude - ring.alt) < RING_ALT_BAND
    ) {
      ring.collected = true;
      events.push({ type: 'ring', ring });
    }
  }

  // Terrain: too low over land or mountain is a crash.
  const ground = heightAt(world, plane.x, plane.y);
  if (plane.altitude < ground) {
    plane.crashed = true;
    plane.crashReason = ground > 140 ? 'MOUNTAIN' : 'TERRAIN';
    events.push({ type: 'crash', reason: plane.crashReason });
    return events;
  }

  // Water: touching the sea away from the runway is a ditching.
  if (plane.altitude <= 1 && terrainAt(world, plane.x, plane.y) === 'sea') {
    plane.crashed = true;
    plane.crashReason = 'DITCHED IN THE SEA';
    events.push({ type: 'crash', reason: plane.crashReason });
    return events;
  }

  // Leaving the strait: warn, then crash.
  if (
    plane.x < STRAIT.minX ||
    plane.x > STRAIT.maxX ||
    plane.y < STRAIT.minY ||
    plane.y > STRAIT.maxY
  ) {
    plane.outOfBounds += dt;
    if (plane.outOfBounds > 5) {
      plane.crashed = true;
      plane.crashReason = 'LEFT THE STRAIT';
      events.push({ type: 'crash', reason: plane.crashReason });
      return events;
    }
  } else {
    plane.outOfBounds = 0;
  }

  // Runway: gentle, slow and aligned is a touchdown.
  const rw = RUNWAY;
  const rx = plane.x - rw.x;
  const ry = plane.y - rw.y;
  const onStrip =
    Math.abs(rx) < rw.width / 2 + 4 && Math.abs(ry) < rw.length / 2 + 4;
  if (onStrip && plane.altitude < 7) {
    const aligned = Math.abs(plane.heading) < 0.45 || Math.abs(plane.heading - Math.PI * 2) < 0.45;
    const gentle = plane.verticalSpeed > -5;
    const slow = plane.speed < 68;
    if (aligned && gentle && slow) {
      plane.rolling = true;
      plane.altitude = 0;
      plane.verticalSpeed = 0;
      plane.gearDown = true;
      events.push({ type: 'touchdown' });
    } else {
      plane.crashed = true;
      plane.crashReason = !aligned ? 'LANDED SIDEWAYS' : !gentle ? 'TOO HARD' : 'TOO FAST';
      events.push({ type: 'crash', reason: plane.crashReason });
      return events;
    }
  }

  return events;
}

export function knots(plane) {
  return plane.speed * 1.944;
}

export function headingDegrees(plane) {
  const deg = ((plane.heading * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}
