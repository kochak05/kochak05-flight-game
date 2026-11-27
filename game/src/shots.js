// shots.js — screenshot scenes: put the game in its best light, deterministically.
// One job: set up a frozen frame for the headless camera. Never used in normal play.

import { newPlane } from './plane.js';

// Run the physics a fixed number of steps with a scripted stick, so the frame
// settles the same way every time it is taken.
function settle(game, steps, input) {
  const audio = {
    ring() {},
    warning() {},
    touchdown() {},
    crash() {},
  };
  for (let i = 0; i < steps; i++) {
    game.update(1 / 60, input, audio);
    if (game.state !== 'flying') break;
  }
  // Freeze: the camera keeps rendering, the world stops moving.
  game.time = 42;
}

export function setupShot(game, name) {
  if (name === 'cover') {
    // Leg 1, late in the strait: four rings flown, the last ring and the
    // runway both ahead, full HUD lit. High enough to see the runway.
    game.start();
    game.plane = newPlane({
      x: 60,
      y: 9280,
      heading: 0,
      altitude: 180,
      speed: 100,
      fuel: 62,
    });
    game.plane.throttle = 0.7;
    game.rings.forEach((r, i) => {
      r.collected = i < 4;
    });
    game.legScore = 400;
    game.score = 400;
    game.totalRings = 4;
    game.state = 'flying';
    game.time = 42;
    settle(game, 30, { bank: 0.04, pitch: 0, throttle: 0, brake: false });
    game.showMessage('', 0);
  } else if (name === 'rings') {
    // Mid-flight through a ring: the plane sits inside the gold circle,
    // instruments lit, next ring and islands ahead. The ring ahead is
    // leg 1's third ring at (-300, 6000); the plane is lined up on it.
    game.start();
    game.plane = newPlane({
      x: -295,
      y: 5940,
      heading: 0.05,
      altitude: 180,
      speed: 112,
      fuel: 78,
    });
    game.plane.throttle = 0.75;
    game.rings.forEach((r, i) => {
      r.collected = i < 2;
    });
    game.legScore = 200;
    game.score = 200;
    game.totalRings = 2;
    game.state = 'flying';
    game.time = 42;
    settle(game, 12, { bank: 0, pitch: 0, throttle: 0, brake: false });
    game.showMessage('RING +100', 1.4);
  } else if (name === 'landing') {
    // Final approach: gear down, slow, on the centreline, runway filling
    // the view ahead, touchdown zone in sight.
    game.start();
    game.plane = newPlane({
      x: 4,
      y: 10300,
      heading: 0,
      altitude: 60,
      speed: 56,
      fuel: 41,
    });
    game.plane.throttle = 0.28;
    game.plane.gearDown = true;
    game.rings.forEach((r) => {
      r.collected = true;
    });
    game.legScore = 500;
    game.score = 500;
    game.totalRings = 5;
    game.state = 'flying';
    game.time = 42;
    settle(game, 40, { bank: 0, pitch: -0.25, throttle: 0, brake: false });
    game.plane.gearDown = true;
    game.showMessage('', 0);
  } else {
    game.state = 'title';
    game.time = 42;
  }
  // The shot is frozen: render keeps drawing, nothing moves.
  game.frozen = true;
}
