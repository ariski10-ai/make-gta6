// Input: browser keyboard provider + scripted provider for shots.
export function blankInput() {
  return { up: false, down: false, left: false, right: false, run: false, interact: false, interactPressed: false, attack: false, attackPressed: false, pausePressed: false, confirmPressed: false, savePressed: false, restartPressed: false, continuePressed: false };
}
export class KeyboardInput {
  constructor(target) {
    this.keys = {};
    this.pressed = {};
    this.input = blankInput();
    if (target && target.addEventListener) {
      target.addEventListener('keydown', (e) => {
        if (!this.keys[e.code]) this.pressed[e.code] = true;
        this.keys[e.code] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      });
      target.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    }
  }
  poll() {
    const k = this.keys, pr = this.pressed, i = blankInput();
    i.up = !!(k.KeyW || k.ArrowUp); i.down = !!(k.KeyS || k.ArrowDown);
    i.left = !!(k.KeyA || k.ArrowLeft); i.right = !!(k.KeyD || k.ArrowRight);
    i.run = !!(k.ShiftLeft || k.ShiftRight);
    i.interact = !!k.KeyE; i.interactPressed = !!pr.KeyE;
    i.attack = !!k.Space; i.attackPressed = !!pr.Space;
    i.pausePressed = !!(pr.KeyP || pr.Escape);
    i.confirmPressed = !!(pr.Enter || pr.NumpadEnter);
    i.savePressed = !!pr.KeyS;
    i.restartPressed = !!pr.KeyR;
    i.continuePressed = !!pr.KeyC;
    this.pressed = {};
    return i;
  }
}
// Scripted input: fn(tick) returns partial input merged onto blank.
export class ScriptedInput {
  constructor(fn) { this.fn = fn; }
  poll(tick) {
    const base = blankInput();
    const part = this.fn ? this.fn(tick) || {} : {};
    return Object.assign(base, part);
  }
}
