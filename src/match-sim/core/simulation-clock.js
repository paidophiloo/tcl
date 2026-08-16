export const DECISION_SLICE_SECONDS = 0.25;
export const HALF_SECONDS = 45 * 60;
export const FULL_TIME_SECONDS = 90 * 60;
export const EXTRA_TIME_HALF_SECONDS = 15 * 60;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Fixed-step accumulator. Playback speed only changes how quickly fixed
 * simulation slices are consumed; it never changes the slice size. */
export class SimulationClock {
  constructor({ realDurationSeconds = 120, speed = 1 } = {}) {
    this.accumulator = 0;
    this.speed = [1, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
    this.clockRate = FULL_TIME_SECONDS / Math.max(30, Number(realDurationSeconds) || 120);
  }

  setSpeed(speed) {
    this.speed = [1, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
    return this.speed;
  }

  pushRealDelta(realDeltaSeconds) {
    this.accumulator += clamp(Number(realDeltaSeconds) || 0, 0, 0.08) * this.clockRate * this.speed;
  }

  canConsume() {
    return this.accumulator + 1e-9 >= DECISION_SLICE_SECONDS;
  }

  consume() {
    if (!this.canConsume()) return 0;
    this.accumulator -= DECISION_SLICE_SECONDS;
    return DECISION_SLICE_SECONDS;
  }

  reset() {
    this.accumulator = 0;
  }
}
