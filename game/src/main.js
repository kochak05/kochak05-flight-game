// main.js — boot and the game loop. One job: run the game at 60 frames a second.

import { createGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = createGame();
const input = createInput(canvas);
const audio = createAudio();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: set the scene, freeze the world, keep rendering.
  setupShot(game, shot);
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (!game.frozen) {
    if (game.state === 'title') {
      if (input.pressedEnter() || input.takeClick()) {
        audio.start();
        game.start();
      }
    } else if (game.state === 'flying') {
      if (input.takeClick()) audio.start();
      game.update(dt, input.read(), audio);
      audio.update(game.plane, true);
    } else if (game.state === 'legdone') {
      if (input.pressedEnter() || input.takeClick()) {
        game.startLeg(game.legIndex + 1);
      }
    } else if (game.state === 'crashed') {
      if (input.pressedRetry()) game.retryLeg();
    } else if (game.state === 'complete') {
      if (input.pressedRetry()) game.start();
    }
  }

  render(ctx, game, game.time);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
