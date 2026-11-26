// input.js — keyboard and mouse, one job: tell the game what the player is doing.

export function createInput(canvas) {
  const keys = new Set();
  let brake = false;
  let clicked = false;

  function onKeyDown(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.key.toLowerCase());
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  function onMouseDown(e) {
    e.preventDefault();
    brake = true;
    clicked = true;
  }
  function onMouseUp() {
    brake = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function held(...names) {
    return names.some((n) => keys.has(n));
  }

  return {
    // Bank left/right, pitch up/down, throttle up/down, airbrake/flare.
    read() {
      return {
        bank: (held('arrowright', 'd') ? 1 : 0) - (held('arrowleft', 'a') ? 1 : 0),
        pitch: (held('arrowup') ? 1 : 0) - (held('arrowdown') ? 1 : 0),
        throttle: (held('w') ? 1 : 0) - (held('s') ? 1 : 0),
        brake: brake || held(' '),
      };
    },
    pressedEnter() {
      return held('enter');
    },
    pressedRetry() {
      return held('r');
    },
    // True once after a click, then clears.
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
  };
}
