// Seeded random generator (mulberry32). The generator's whole state is one
// uint32 stored on the game state (s.rng), so a saved/sent state replays exactly.
(function (root) {
  'use strict';
  const Solo = root.Solo = root.Solo || {};

  function seedToInt(seed) {
    const str = String(seed);
    let h = 2166136261 >>> 0;                 // FNV-1a
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function next(holder) {
    let t = (holder.rng = (holder.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(holder, n) { return Math.floor(next(holder) * n); }

  function shuffle(holder, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(holder, i + 1);
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  Solo.RNG = { seedToInt, next, int, shuffle };
})(typeof window !== 'undefined' ? window : globalThis);
