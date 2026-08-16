const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value ?? 'touchline')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function seedFrom(...parts) {
  return parts.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('|');
}

export class DeterministicRng {
  constructor(seed = 1) {
    this.state = hashSeed(seed);
  }

  clone() {
    const next = new DeterministicRng(1);
    next.state = this.state;
    return next;
  }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0 || 1;
    return this.state / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(probability) {
    return this.next() < clamp(Number(probability) || 0, 0, 1);
  }

  pick(items = []) {
    return items.length ? items[Math.floor(this.next() * items.length)] : null;
  }

  weighted(items = [], weightOf = () => 1) {
    if (!items.length) return null;
    const weights = items.map(item => Math.max(0, Number(weightOf(item)) || 0));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total <= 1e-9) return this.pick(items);
    let cursor = this.next() * total;
    for (let index = 0; index < items.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return items[index];
    }
    return items.at(-1);
  }

  softmax(options = [], utilityOf = option => option.utility, temperature = 0.2) {
    const temp = Math.max(0.025, Number(temperature) || 0.2);
    const utilities = options.map(option => Number(utilityOf(option)) || 0);
    const max = utilities.length ? Math.max(...utilities) : 0;
    return this.weighted(options, option => {
      const utility = Number(utilityOf(option)) || 0;
      return Math.exp(clamp((utility - max) / temp, -20, 20));
    });
  }
}
