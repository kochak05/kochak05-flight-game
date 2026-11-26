// game.js — the game itself: states, legs, score, messages, timing.
// One job: hold the rules and drive the plane. Drawing lives in render.js.

import { LEGS, buildWorld } from './world.js';
import { newPlane, stepPlane } from './plane.js';

export function createGame() {
  const game = {
    world: buildWorld(),
    state: 'title', // title | flying | legdone | crashed | complete
    legIndex: 0,
    leg: LEGS[0],
    rings: LEGS[0].rings.map((r) => ({ ...r, collected: false })),
    plane: newPlane(LEGS[0].start),
    score: 0,
    legScore: 0,
    timeLeft: 0,
    time: 0,
    message: '',
    messageTime: 0,
    legCompleteText: '',
    nextLeg: null,
    totalRings: 0,
    totalLandings: 0,
  };

  function showMessage(text, seconds = 2) {
    game.message = text;
    game.messageTime = seconds;
  }

  function startLeg(index) {
    const leg = LEGS[index];
    game.legIndex = index;
    game.leg = leg;
    game.plane = newPlane(leg.start);
    game.rings = leg.rings.map((r) => ({ ...r, collected: false }));
    game.legScore = 0;
    game.timeLeft = leg.timeLimit;
    game.state = 'flying';
    game.message = '';
    game.messageTime = 0;
    showMessage(leg.name, 2.5);
  }

  function finishLeg() {
    const leg = game.leg;
    let bonus = 500; // landing
    let text = 'Landing +500';
    if (leg.precision) {
      const offCentre = Math.abs(game.plane.x);
      const neat = Math.max(0, 300 - Math.round(offCentre * 6));
      bonus += neat;
      text += `  ·  precision +${neat}`;
    }
    if (leg.timeLimit > 0) {
      const timeBonus = Math.round(game.timeLeft) * 5;
      bonus += timeBonus;
      text += `  ·  time +${timeBonus}`;
    }
    game.legScore += bonus;
    game.score += bonus;
    game.totalLandings += 1;
    game.legCompleteText = `${text}   ·   leg total ${game.legScore}`;
    const next = LEGS[game.legIndex + 1] ?? null;
    game.nextLeg = next;
    game.state = next ? 'legdone' : 'complete';
  }

  game.showMessage = showMessage;
  game.startLeg = startLeg;

  game.start = function start() {
    game.score = 0;
    game.totalRings = 0;
    game.totalLandings = 0;
    startLeg(0);
  };

  game.retryLeg = function retryLeg() {
    startLeg(game.legIndex);
  };

  game.update = function update(dt, input, audio) {
    game.time += dt;
    if (game.messageTime > 0) game.messageTime -= dt;
    if (game.state !== 'flying') return;

    if (game.leg.timeLimit > 0) {
      game.timeLeft -= dt;
      if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        game.state = 'crashed';
        game.plane.crashed = true;
        game.plane.crashReason = 'OUT OF TIME';
        audio.crash();
        return;
      }
    }

    const events = stepPlane(game.plane, input, dt, game.world, game.rings);
    for (const e of events) {
      if (e.type === 'ring') {
        game.legScore += 100;
        game.score += 100;
        game.totalRings += 1;
        showMessage('RING +100', 1.4);
        audio.ring();
      } else if (e.type === 'lowfuel') {
        showMessage('LOW FUEL', 2);
        audio.warning();
      } else if (e.type === 'stall') {
        audio.warning();
      } else if (e.type === 'touchdown') {
        showMessage('TOUCHDOWN!', 1.6);
        audio.touchdown();
      } else if (e.type === 'landed') {
        finishLeg();
      } else if (e.type === 'crash') {
        game.state = 'crashed';
        audio.crash();
      }
    }
  };

  return game;
}
