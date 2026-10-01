// Solo rules engine.
//
// All game state is one plain JSON object. Every move is an action object
// passed to Solo.apply(state, action), which checks legality and returns
// { ok, error, state } with a NEW state (the input is never mutated).
//
// Choices (pick a card, yes/no, ...) are resolved by replay: when an effect
// needs an answer, the engine stops and stores { base, action, answers } in
// state.pending. A later { type:'choose', player, value } action re-runs the
// original action from `base` with the answers so far. Because randomness
// lives in state.rng, the replay is deterministic.
(function (root) {
  'use strict';
  const Solo = root.Solo = root.Solo || {};
  const RNG = Solo.RNG;

  // ---------------------------------------------------------------- data
  const DATA = {};
  (root.SOLO_CARD_DATA || []).forEach(c => { DATA[c.id] = c; });
  Solo.DATA = DATA;
  Solo.EFFECTS = Solo.EFFECTS || {};     // filled by effects.js
  Solo.CHARACTERS = Object.values(DATA).filter(c => c.kind === 'character');
  Solo.NUMBERS = Object.values(DATA).filter(c => c.kind === 'number');
  Solo.COLORS = ['Red', 'Blue', 'Yellow', 'Green', 'Black'];

  function def(cardOrId) {
    const id = typeof cardOrId === 'string' ? cardOrId : cardOrId.id;
    const d = DATA[id];
    if (!d) throw new Error('Unknown card id ' + id);
    return Object.assign({}, d, Solo.EFFECTS[id] || {});
  }
  Solo.def = def;

  // -------------------------------------------------------------- signals
  function NeedChoice(player, request) { this.player = player; this.request = request; }
  function Illegal(message) { this.message = message; }
  function GameOver() {}

  let CTX = null;   // { answers, i, src } while an action is being resolved

  const clone = o => JSON.parse(JSON.stringify(o));
  const opp = p => 1 - p;
  const P = (s, p) => s.players[p];
  const pname = p => 'Player ' + (p + 1);

  // ------------------------------------------------------------ action log
  // The log is built here, by the engine, as actions resolve. Each entry:
  //   t    public text (what everyone sees)
  //   p    if set, player p sees `pt` instead of `t` (hidden information)
  //   src  name of the card/character whose ability produced the entry
  //   k    'head' for section headers (round, clash), dbg: true for debug actions
  // Solo.logView(state, viewer) turns entries into the text one player may see.
  function log(s, text, opts) {
    const e = { t: text };
    const src = opts && opts.src !== undefined ? opts.src : (CTX && CTX.src.length ? CTX.src[CTX.src.length - 1] : null);
    if (src && !text.startsWith(src + ':')) e.src = src;
    if (opts) {
      if (opts.p !== undefined) { e.p = opts.p; e.pt = opts.pt; }
      if (opts.k) e.k = opts.k;
      if (opts.dbg) e.dbg = true;
    }
    s.log.push(e);
  }
  // Player p reads privText; everyone else reads pubText.
  function logPriv(s, p, privText, pubText) { log(s, pubText, { p, pt: privText }); }
  function head(s, text) { log(s, text, { k: 'head', src: null }); }
  // Logs why a conditional ability did or didn't do something; returns cond.
  function check(s, cond, yes, no) { log(s, cond ? yes : no); return cond; }

  // Runs an ability with `name` as the source of everything it logs.
  // If it logged nothing, says so (unless quiet: character "when you play"
  // abilities are checked on every play and would only add noise).
  function trigger(s, name, fn, quiet) {
    if (!CTX) return fn();
    const n = s.log.length;
    CTX.src.push(name);
    try {
      fn();
      if (!quiet && s.log.length === n) log(s, 'no effect.');
    } finally { CTX.src.pop(); }
  }

  function entryText(e, viewer) {
    const t = e.p !== undefined && (viewer === 'all' || viewer === e.p) ? e.pt : e.t;
    return (e.src ? e.src + ': ' : '') + t;
  }
  // viewer: 0 or 1 for that player's view, 'all' for everything (debug/tests).
  // Entries already rendered for one player (online views) carry m: true for "only you see this".
  function logView(s, viewer) {
    return s.log.map(e => ({ text: entryText(e, viewer), head: e.k === 'head', dbg: !!e.dbg,
                             mine: !!e.m || (e.p !== undefined && e.p === viewer) }));
  }

  function nameOf(card) { return DATA[card.id].name; }
  function label(s, card, viewer) {
    const d = DATA[card.id];
    if (card.faceDown && viewer !== undefined && viewer !== card.owner) return 'face-down card';
    const base = d.kind === 'number' ? `${d.color} ${d.number} ${d.name}` : d.name;
    return card.faceDown ? base + ' (face down)' : base;
  }
  const upLabel = card => label(null, Object.assign({}, card, { faceDown: false }));
  const ZONE = { hand: 'hand', combo: 'combo', discard: 'discard pile', deck: 'deck' };
  // "their" when the zone belongs to the player doing the action.
  const zoneText = (loc, actor) => `${loc.p === actor ? 'their' : pname(loc.p) + "'s"} ${ZONE[loc.zone]}`;

  // ------------------------------------------------------------ new game
  function makeCard(s, id, owner) {
    return { uid: s.nextUid++, id, owner, faceDown: false, silenced: false, keep: false };
  }

  function emptyPlayer(character) {
    return { character, life: 10, energy: 10, maxEnergy: 10, power: 0,
             deck: [], hand: [], combo: [], discard: [] };
  }

  // config: { seed, players: [{ character, deck: [ids] }, { ... }], firstPlayer? }
  function newGame(config) {
    const s = {
      version: 1, seed: String(config.seed), rng: RNG.seedToInt(config.seed),
      nextUid: 1, round: 1, firstPlayer: 0, turn: 0, phase: 'setup',
      lastAction: null, players: [], log: [], winner: null, pending: null,
      roundStats: { lifeLost: [0, 0], discarded: [0, 0] }, clash: null,
      firstPlayerOverride: config.firstPlayer === undefined ? null : config.firstPlayer,
    };
    config.players.forEach((pc, p) => {
      const pl = emptyPlayer(pc.character);
      s.players.push(pl);
      pl.deck = pc.deck.map(id => makeCard(s, id, p));
    });
    s.players.forEach(pl => RNG.shuffle(s, pl.deck));
    log(s, `New game, seed "${s.seed}".`);
    return s;
  }

  // Builds a 40-card deck (max 2 copies per card) from the seed.
  // style 'mono': 20 random cards of the character's color x2.
  // style 'mixed': 20 random cards from all colors x2.
  function buildDeck(seed, character, style) {
    const holder = { rng: RNG.seedToInt(seed + '|' + character + '|' + style) };
    const color = DATA[character].color;
    const pool = Solo.NUMBERS.filter(c => Solo.EFFECTS[c.id] && (style === 'mixed' || c.color === color)).map(c => c.id);
    RNG.shuffle(holder, pool);
    const picks = pool.slice(0, 20);
    return picks.concat(picks);
  }

  // ------------------------------------------------------------ choices
  // request: { prompt, kind: 'one'|'many'|'number', options:[{value,label}], min, max }
  function ask(s, player, request, validate) {
    if (CTX && CTX.i < CTX.answers.length) {
      const a = CTX.answers[CTX.i++];
      checkAnswer(request, a);
      if (validate) {
        const err = validate(a);
        if (err) throw new Illegal(err);
      }
      return a;
    }
    throw new NeedChoice(player, request);
  }

  function checkAnswer(req, a) {
    if (req.kind === 'number') {
      if (typeof a !== 'number' || a !== Math.floor(a) || a < req.min || a > req.max)
        throw new Illegal(`Choose a whole number from ${req.min} to ${req.max}.`);
      return;
    }
    const values = req.options.map(o => o.value);
    if (req.kind === 'many') {
      if (!Array.isArray(a)) throw new Illegal('Expected a list of choices.');
      if (new Set(a).size !== a.length) throw new Illegal('Duplicate choice.');
      if (a.some(v => !values.includes(v))) throw new Illegal('Invalid choice.');
      if (a.length < req.min || a.length > req.max)
        throw new Illegal(req.min === req.max ? `Choose exactly ${req.min}.` : `Choose ${req.min} to ${req.max}.`);
      return;
    }
    if (!values.includes(a)) throw new Illegal('Invalid choice.');
  }

  function yesNo(s, player, prompt) {
    return ask(s, player, { prompt, kind: 'one', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] });
  }

  // Returns a card or null. Mandatory single options are chosen automatically.
  function chooseCard(s, player, prompt, cards, opts = {}) {
    if (!cards.length) return null;
    if (!opts.optional && cards.length === 1) return cards[0];
    const options = cards.map(c => ({ value: c.uid, label: label(s, c, player) + locText(s, c) }));
    if (opts.optional) options.push({ value: null, label: opts.noneLabel || 'None' });
    const uid = ask(s, player, { prompt, kind: 'one', options });
    return uid === null ? null : cards.find(c => c.uid === uid);
  }

  function chooseCards(s, player, prompt, cards, min, max, validate) {
    max = Math.min(max, cards.length);
    min = Math.min(min, max);
    if (!cards.length || max === 0) return [];
    if (min === max && max === cards.length && !validate) return cards.slice();
    const options = cards.map(c => ({ value: c.uid, label: label(s, c, player) + locText(s, c) }));
    const uids = ask(s, player, { prompt, kind: 'many', options, min, max },
      validate ? (a => validate(a.map(u => cards.find(c => c.uid === u)))) : null);
    return uids.map(u => cards.find(c => c.uid === u));
  }

  function chooseNumber(s, player, prompt, min, max) {
    if (min === max) return min;
    return ask(s, player, { prompt, kind: 'number', min, max, options: [] });
  }

  function locText(s, c) {
    const loc = where(s, c);
    if (!loc) return '';
    const zone = { hand: 'hand', combo: 'combo', discard: 'discard', deck: 'deck' }[loc.zone];
    return ` [${pname(loc.p)} ${zone}${loc.zone === 'combo' ? ' #' + (loc.idx + 1) : ''}]`;
  }

  // ------------------------------------------------------------ queries
  function where(s, card) {
    for (let p = 0; p < 2; p++) {
      for (const zone of ['hand', 'combo', 'discard', 'deck']) {
        const idx = s.players[p][zone].indexOf(card);
        if (idx >= 0) return { p, zone, idx };
      }
    }
    return null;
  }

  function findUid(s, uid) {
    for (const pl of s.players)
      for (const zone of ['hand', 'combo', 'discard', 'deck']) {
        const c = pl[zone].find(x => x.uid === uid);
        if (c) return c;
      }
    return null;
  }

  function inCombo(s, card) { const l = where(s, card); return !!l && l.zone === 'combo'; }
  function charOf(s, p) { return P(s, p).character; }
  function charColor(s, p) { return DATA[charOf(s, p)].color; }

  // Face-up, not silenced copies of a card id in player p's combo.
  function activeIn(s, p, id) {
    return P(s, p).combo.filter(c => c.id === id && !c.faceDown && !c.silenced);
  }
  function isActive(s, card) { return inCombo(s, card) && !card.faceDown && !card.silenced; }

  function valueOf(s, card) {
    if (card.faceDown) {
      const loc = where(s, card);
      if (loc && loc.zone === 'combo') {
        let v = charOf(s, loc.p) === 'C-noct' ? 2 : 0;
        v += 3 * activeIn(s, loc.p, 'K9-death').length;
        return v;
      }
      return 0;
    }
    return DATA[card.id].number || 0;
  }

  function colorsOf(s, card) {
    if (card.faceDown) {
      const loc = where(s, card);
      return [charColor(s, loc && loc.zone === 'combo' ? loc.p : card.owner)];
    }
    const d = def(card);
    return [d.color].concat(d.alsoColors || []);
  }

  function comboTotal(s, p) { return P(s, p).combo.reduce((t, c) => t + valueOf(s, c), 0); }
  function clashTotal(s, p) { return P(s, p).power + comboTotal(s, p); }
  function comboValues(s, p) { return P(s, p).combo.map(c => valueOf(s, c)); }

  function neighbors(s, card) {
    const loc = where(s, card);
    if (!loc || loc.zone !== 'combo') return [];
    const combo = P(s, loc.p).combo;
    return [combo[loc.idx - 1], combo[loc.idx + 1]].filter(Boolean);
  }
  function nextToValue(s, card, v) { return neighbors(s, card).some(n => valueOf(s, n) === v); }

  // Runs: 3+ adjacent cards with consecutive numbers, ascending or descending.
  function longestRun(vals) {
    if (!vals.length) return 0;
    let best = 1, up = 1, dn = 1;
    for (let i = 1; i < vals.length; i++) {
      up = vals[i] === vals[i - 1] + 1 ? up + 1 : 1;
      dn = vals[i] === vals[i - 1] - 1 ? dn + 1 : 1;
      best = Math.max(best, up, dn);
    }
    return best;
  }
  function hasRun(s, p, len) { return longestRun(comboValues(s, p)) >= len; }
  function isEndOfRun(s, card) {
    const loc = where(s, card);
    if (!loc || loc.zone !== 'combo') return false;
    const v = comboValues(s, loc.p), i = loc.idx;
    const seq = (a, b, c) => (b === a + 1 && c === b + 1) || (b === a - 1 && c === b - 1);
    return (i >= 2 && seq(v[i - 2], v[i - 1], v[i])) || (i + 2 < v.length && seq(v[i + 2], v[i + 1], v[i]));
  }
  function pairCount(s, p) {
    const v = comboValues(s, p);
    let n = 0;
    for (let i = 1; i < v.length; i++) if (v[i] === v[i - 1]) n++;
    return n;
  }
  function colorCount(s, p) {
    const set = new Set();
    P(s, p).combo.forEach(c => colorsOf(s, c).forEach(col => set.add(col)));
    return set.size;
  }
  function rightmost(s, p) { const c = P(s, p).combo; return c[c.length - 1] || null; }

  // ------------------------------------------------------------ placement & cost
  function placementOk(s, p, card) {
    const last = rightmost(s, p);
    if (!last) return true;
    const d = def(card);
    const lv = valueOf(s, last);
    if (d.number === lv) return true;
    if (d.anyColor) return true;
    if (d.nextToZero && lv === 0) return true;
    const lc = colorsOf(s, last);
    return colorsOf(s, card).some(c => lc.includes(c));
  }

  // Cost and the reasons it differs from the printed number (for the log).
  function costParts(s, p, card) {
    const d = def(card);
    const parts = [];
    let c = d.number;
    if (d.costMod) { const m = d.costMod(s, p, card, c); if (m !== c) parts.push(`${m - c > 0 ? '+' : ''}${m - c} own ability`); c = m; }
    const bs = colorsOf(s, card).includes('Red') ? activeIn(s, p, 'R7-blood').length : 0;
    if (bs) { c -= bs; parts.push(`-${bs} Blood Snap`); }
    const ic = activeIn(s, p, 'K2-ink').length;
    if (ic) { c += ic; parts.push(`+${ic} Ink Chop`); }
    return { cost: Math.max(0, c), parts };
  }
  function costOf(s, p, card) { return costParts(s, p, card).cost; }

  // Why a card may go next to the rightmost combo card (for the log).
  function placementText(s, p, card) {
    const last = rightmost(s, p);
    if (!last) return 'starting the combo';
    const d = def(card), lv = valueOf(s, last);
    const lastName = last.faceDown ? `a face-down card (${lv})` : upLabel(last);
    if (d.number === lv) return `next to ${lastName}, matching number ${lv}`;
    const shared = colorsOf(s, card).filter(c => colorsOf(s, last).includes(c));
    if (shared.length) return `next to ${lastName}, matching ${shared[0]}`;
    if (d.anyColor) return `next to ${lastName} (it can go next to any color)`;
    return `next to ${lastName} (it can go next to a 0)`;
  }

  function canPlay(s, p, uid) {
    if (s.phase !== 'action') return { ok: false, reason: 'Not in the action phase.' };
    if (s.pending) return { ok: false, reason: 'A choice is pending.' };
    if (s.turn !== p) return { ok: false, reason: `It is ${pname(s.turn)}'s turn.` };
    const card = P(s, p).hand.find(c => c.uid === uid);
    if (!card) return { ok: false, reason: 'That card is not in your hand.' };
    const cost = costOf(s, p, card);
    if (!placementOk(s, p, card)) {
      const last = rightmost(s, p);
      return { ok: false, cost, reason: `Must match the number (${valueOf(s, last)}) or color (${colorsOf(s, last).join('/')}) of your rightmost combo card.` };
    }
    if (cost > P(s, p).energy) return { ok: false, cost, reason: `Costs ${cost} energy; you have ${P(s, p).energy}.` };
    return { ok: true, cost };
  }

  function feintable(s, p) {
    return P(s, p).combo.filter(c => isActive(s, c) && def(c).feint);
  }

  // ------------------------------------------------------------ stat changes
  function gainLife(s, p, n) { if (n > 0) { P(s, p).life += n; log(s, `${pname(p)} gains ${n} life (now ${P(s, p).life}).`); } }
  // src = the player whose effect causes the loss (for Flame Uppercut).
  function loseLife(s, p, n, src) {
    if (n <= 0) return;
    if (src === p && activeIn(s, p, 'R6-flame').length) {
      P(s, p).life += n;
      log(s, `Flame Uppercut: ${pname(p)} gains ${n} life instead of losing it (now ${P(s, p).life}).`);
      return;
    }
    P(s, p).life -= n;
    s.roundStats.lifeLost[p] += n;
    log(s, `${pname(p)} loses ${n} life (now ${P(s, p).life}).`);
  }
  function damage(s, p, n) {
    if (n <= 0) return;
    P(s, p).life -= n;
    s.roundStats.lifeLost[p] += n;
    log(s, `${pname(p)} takes ${n} damage (life now ${P(s, p).life}).`);
  }
  function gainPower(s, p, n) { if (n > 0) { P(s, p).power += n; log(s, `${pname(p)} gains +${n} power (now ${P(s, p).power}).`); } }
  function losePower(s, p, n) {
    if (n <= 0) return;
    const before = P(s, p).power;
    P(s, p).power = Math.max(0, before - n);
    log(s, `${pname(p)} loses ${before - P(s, p).power} power${before < n ? ` (had only ${before})` : ''} (now ${P(s, p).power}).`);
  }
  function gainEnergy(s, p, n, overMax) {
    if (n <= 0) return;
    const pl = P(s, p);
    const before = pl.energy;
    pl.energy = overMax ? pl.energy + n : Math.max(pl.energy, Math.min(pl.maxEnergy, pl.energy + n));
    log(s, `${pname(p)} gains ${pl.energy - before} energy${pl.energy - before < n ? ' (capped at max)' : ''} (now ${pl.energy}).`);
  }
  function loseEnergy(s, p, n) {
    if (n <= 0) return;
    P(s, p).energy = Math.max(0, P(s, p).energy - n);
    log(s, `${pname(p)} loses ${n} energy (now ${P(s, p).energy}).`);
  }
  // Paying energy for an ability (not a card's play cost).
  function payEnergy(s, p, n) {
    P(s, p).energy -= n;
    log(s, `${pname(p)} pays ${n} energy (now ${P(s, p).energy}).`);
  }

  // ------------------------------------------------------------ card movement
  function removeCard(s, card) {
    const loc = where(s, card);
    if (loc) P(s, loc.p)[loc.zone].splice(loc.idx, 1);
    return loc;
  }

  function draw(s, p, n) {
    const got = [];
    for (let k = 0; k < n; k++) {
      const c = P(s, p).deck.shift();
      if (!c) break;
      c.faceDown = false;
      P(s, p).hand.push(c);
      got.push(c);
    }
    const k = got.length;
    if (n > 0) {
      const what = `${pname(p)} draws ${k} card${k === 1 ? '' : 's'}`, short = k < n ? ' (deck ran out)' : '';
      if (k) logPriv(s, p, `${what}: ${got.map(c => label(s, c)).join(', ')}${short}.`, `${what}${short}.`);
      else log(s, `${what}${short}.`);
    }
    return k;
  }

  // Is this card's identity hidden from the other player where it is now?
  function hiddenAt(card, loc) { return card.faceDown || (!!loc && (loc.zone === 'hand' || loc.zone === 'deck')); }

  function moveToHand(s, card, p) {
    const loc = removeCard(s, card);
    const wasHidden = card.faceDown || (loc && loc.zone === 'deck');
    Object.assign(card, { faceDown: false, silenced: false, keep: false, owner: p });
    P(s, p).hand.push(card);
    const from = loc ? ` from ${zoneText(loc, p)}` : '';
    if (wasHidden) logPriv(s, p, `${label(s, card)} (face down) goes${from} to ${pname(p)}'s hand.`, `A face-down card goes${from} to ${pname(p)}'s hand.`);
    else log(s, `${label(s, card)} goes${from} to ${pname(p)}'s hand.`);
  }

  function putIntoCombo(s, card, p, faceDown) {
    const loc = removeCard(s, card);
    Object.assign(card, { faceDown: !!faceDown, silenced: false, keep: false });
    P(s, p).combo.push(card);
    const from = loc ? ` from ${zoneText(loc)}` : '';
    if (faceDown) logPriv(s, card.owner, `${upLabel(card)} is put face down${from} into ${pname(p)}'s combo.`, `A card is put face down${from} into ${pname(p)}'s combo.`);
    else log(s, `${label(s, card)} is put${from} into ${pname(p)}'s combo.`);
  }

  // Discard a card from any zone. `discarder` is the player doing the discarding.
  // opts.cause: player whose effect caused it (for Mantis Jab); opts.faceDown.
  function discardCard(s, card, discarder, opts = {}) {
    const loc = where(s, card);
    if (!loc || loc.zone === 'discard') return false;
    if (loc.zone === 'combo' && opts.cause !== undefined && opts.cause !== loc.p) {
      for (const mj of activeIn(s, loc.p, 'G1-mantis')) {
        if (mj === card) continue;
        const what = card.faceDown ? 'a face-down card' : upLabel(card);
        if (yesNo(s, loc.p, `Mantis Jab: discard Mantis Jab instead of ${label(s, card, loc.p)}?`)) {
          log(s, `Mantis Jab (reaction): ${pname(loc.p)} discards Mantis Jab instead of ${what}.`, { src: null });
          trigger(s, 'Mantis Jab', () => discardCard(s, mj, loc.p, {}), true);
          return false;
        }
        log(s, `Mantis Jab: ${pname(loc.p)} doesn't use it.`, { src: null });
      }
    }
    const wasHidden = hiddenAt(card, loc);
    removeCard(s, card);
    const faceDown = opts.faceDown !== undefined ? !!opts.faceDown : (loc.zone === 'combo' ? card.faceDown : false);
    Object.assign(card, { faceDown, silenced: false, keep: false });
    P(s, card.owner).discard.push(card);
    s.roundStats.discarded[discarder]++;
    const from = loc.zone === 'deck' ? ` from the top of ${pname(loc.p)}'s deck`
      : loc.zone === 'combo' ? ` from ${zoneText(loc, discarder)}` : (loc.p !== discarder ? ` from ${zoneText(loc)}` : '');
    if (faceDown) logPriv(s, card.owner, `${pname(discarder)} discards ${upLabel(card)} face down${from}.`, `${pname(discarder)} discards a card face down${from}.`);
    else log(s, `${pname(discarder)} discards ${label(s, card)}${from}${wasHidden && loc.zone === 'combo' ? ' (revealed)' : ''}.`);
    const d = def(card);
    if (d.onDiscard) trigger(s, `${nameOf(card)} (when discarded)`, () => d.onDiscard(s, card, card.owner));
    const lh = activeIn(s, discarder, 'Y5-lion').length;
    if (lh) trigger(s, 'Lion Hook', () => { for (let i = 0; i < lh; i++) gainEnergy(s, discarder, 1); });
    if (!opts.fromSunCross && card.owner === discarder) {
      for (const sc of activeIn(s, discarder, 'Y4-sun')) {
        const now = where(s, card);
        if (sc === card || !now || now.zone !== 'discard') break;
        if (yesNo(s, discarder, `Sun Cross: discard Sun Cross from your combo to return ${label(s, card, discarder)} to your hand?`)) {
          log(s, `Sun Cross (reaction): ${pname(discarder)} discards Sun Cross to take back the card.`, { src: null });
          trigger(s, 'Sun Cross', () => {
            discardCard(s, sc, discarder, { fromSunCross: true });
            moveToHand(s, card, discarder);
          }, true);
          break;
        }
        log(s, `Sun Cross: ${pname(discarder)} doesn't use it.`, { src: null });
      }
    }
    return true;
  }

  function mill(s, p, n, opts = {}) {
    const discarder = opts.discarder === undefined ? p : opts.discarder;
    let k = 0;
    for (; k < n; k++) {
      const c = P(s, p).deck[0];
      if (!c) break;
      discardCard(s, c, discarder, { faceDown: !!opts.faceDown });
    }
    return k;
  }

  function discardHand(s, p) {
    while (P(s, p).hand.length) discardCard(s, P(s, p).hand[0], p, {});
  }

  // Flip a face-up combo card face down. by = player causing it.
  // opts.voluntary: the owner chose to flip it (Patience, "you may flip") - Flash Jab not offered.
  function flip(s, card, by, opts = {}) {
    const loc = where(s, card);
    if (!loc || loc.zone !== 'combo' || card.faceDown) return false;
    const p = loc.p;
    if (activeIn(s, p, 'K8-umbra').length) { log(s, `Umbra Roundhouse: ${label(s, card)} can't be flipped.`, { src: null }); return false; }
    const react = (rc, name) => {
      if (yesNo(s, p, `${name}: discard ${name} instead of letting ${label(s, card)} be flipped?`)) {
        log(s, `${name} (reaction): ${pname(p)} discards ${name} so ${label(s, card)} isn't flipped.`, { src: null });
        trigger(s, name, () => discardCard(s, rc, p, {}), true);
        return true;
      }
      log(s, `${name}: ${pname(p)} doesn't use it.`, { src: null });
      return false;
    };
    if (by !== p) {
      for (const lj of activeIn(s, p, 'G1-life')) if (react(lj, 'Life Jab')) return false;
    }
    if (!opts.voluntary) {
      for (const fj of activeIn(s, p, 'Y1-flash')) if (react(fj, 'Flash Jab')) return false;
    }
    card.faceDown = true;
    log(s, `${upLabel(card)} in ${pname(p)}'s combo is flipped face down.`);
    const d = def(card);
    if (d.onFlip && !opts.noTrigger) trigger(s, `${nameOf(card)} (when flipped)`, () => d.onFlip(s, card, p));
    return true;
  }

  function unflip(s, card) {
    if (!card.faceDown) return false;
    card.faceDown = false;
    log(s, `${label(s, card)} is turned face up.`);
    return true;
  }

  // Let `chooser` rearrange player p's combo (ignoring placement rules).
  function reorderCombo(s, chooser, p) {
    const combo = P(s, p).combo;
    if (activeIn(s, p, 'G4-mantis').length) { log(s, `Mantis Cross: ${pname(p)}'s combo can't be moved.`); return; }
    if (combo.length < 2) return;
    const remaining = combo.slice(), order = [];
    while (remaining.length > 1) {
      const c = chooseCard(s, chooser, `Rearrange ${pname(p)}'s combo: choose the card for position ${order.length + 1}`, remaining);
      order.push(c);
      remaining.splice(remaining.indexOf(c), 1);
    }
    order.push(remaining[0]);
    P(s, p).combo = order;
    log(s, `${pname(chooser)} rearranges ${pname(p)}'s combo.`);
  }

  // ------------------------------------------------------------ playing
  function playFromHand(s, p, card) {
    const { cost, parts } = costParts(s, p, card);
    const before = P(s, p).energy;
    const placed = placementText(s, p, card);
    P(s, p).energy -= cost;
    removeCard(s, card);
    card.faceDown = false;
    P(s, p).combo.push(card);
    const why = parts.length ? ` (printed ${DATA[card.id].number}, ${parts.join(', ')})` : '';
    log(s, `${pname(p)} plays ${label(s, card)} for ${cost} energy${why} (energy ${before} → ${P(s, p).energy}), ${placed}.`);
    resolvePlayed(s, p, card);
  }

  // "Play" from discard/deck: free, rightmost, ignores placement, combo enter triggers.
  function playFromZone(s, p, card) {
    const loc = removeCard(s, card);
    Object.assign(card, { faceDown: false, silenced: false, keep: false });
    P(s, p).combo.push(card);
    log(s, `${pname(p)} plays ${label(s, card)}${loc ? ` from ${zoneText(loc, p)}` : ''} for free, at the right end of the combo.`);
    resolvePlayed(s, p, card);
  }

  function resolvePlayed(s, p, card) {
    const d = def(card);
    const blocked = activeIn(s, p, 'K6-ink').some(c => c !== card);
    if (blocked) log(s, `Ink Uppercut: ${label(s, card)}'s combo-enter ability doesn't trigger.`, { src: null });
    else {
      if (d.onEnter) trigger(s, nameOf(card), () => d.onEnter(s, card, p));
      if (d.patience && isActive(s, card)) {
        trigger(s, `${nameOf(card)} (Patience)`, () => {
          if (yesNo(s, p, `Patience: flip ${label(s, card)} face down?`)) flip(s, card, p, { voluntary: true });
          else log(s, `${pname(p)} doesn't flip it.`);
        });
      }
    }
    checkDeath(s);
    const ch = Solo.EFFECTS[charOf(s, p)];
    if (ch && ch.onPlay) trigger(s, DATA[charOf(s, p)].name, () => ch.onPlay(s, p, card), true);
    for (const ms of activeIn(s, p, 'G3-mantis')) {
      if (ms === card || P(s, p).energy < 1) continue;
      trigger(s, 'Mantis Straight', () => {
        if (yesNo(s, p, 'Mantis Straight: pay 1 energy so each player draws a card?')) {
          payEnergy(s, p, 1);
          draw(s, p, 1); draw(s, opp(p), 1);
        } else log(s, `${pname(p)} doesn't pay.`);
      });
    }
    for (const ir of activeIn(s, p, 'K8-ink')) {
      if (ir !== card) trigger(s, 'Ink Roundhouse', () => mill(s, p, 1));
    }
    for (const us of activeIn(s, p, 'K3-umbra')) {
      if (us !== card && d.number > 3) trigger(s, 'Umbra Straight', () => {
        log(s, `a card over 3 was played, so Umbra Straight must be discarded.`);
        discardCard(s, us, p, {});
      });
    }
    const o = opp(p);
    if (d.number < 5) {
      for (const mu of activeIn(s, o, 'G6-mantis')) {
        if (yesNo(s, o, `Mantis Uppercut (Feint): discard it to make ${pname(p)} discard a card from their combo?`)) {
          log(s, `Mantis Uppercut (reaction): ${pname(o)} discards it because ${pname(p)} played a ${d.number}.`, { src: null });
          trigger(s, 'Mantis Uppercut', () => {
            discardCard(s, mu, o, {});
            const c = chooseCard(s, p, 'Mantis Uppercut: choose a card in your combo to discard', P(s, p).combo);
            if (c) discardCard(s, c, p, { cause: o });
          }, true);
          break;
        }
        log(s, `Mantis Uppercut: ${pname(o)} doesn't use it.`, { src: null });
      }
    }
    checkDeath(s);
  }

  // Copy (resolve again) the combo-enter ability of another face-up card in p's combo.
  // "This card" in the copied text refers to the copying card.
  function copyEnter(s, card, p) {
    const cands = P(s, p).combo.filter(c => c !== card && isActive(s, c) && def(c).onEnter && !def(c).copiesEnter);
    const src = chooseCard(s, p, `${nameOf(card)}: choose a combo-enter ability to copy`, cands);
    if (!src) { log(s, 'no combo-enter ability to copy.'); return; }
    log(s, `copies ${label(s, src)}'s combo-enter ability.`);
    trigger(s, `${nameOf(card)} (as ${nameOf(src)})`, () => def(src).onEnter(s, card, p));
  }

  // ------------------------------------------------------------ flow
  function checkDeath(s) {
    const dead = [0, 1].filter(p => P(s, p).life <= 0);
    if (!dead.length) return;
    s.phase = 'over';
    s.winner = dead.length === 2 ? 'draw' : opp(dead[0]);
    head(s, dead.length === 2 ? 'Both players reach 0 life: the game is a draw.' : `${pname(dead[0])} reaches 0 life. ${pname(opp(dead[0]))} wins!`);
    throw new GameOver();
  }

  function endByDeck(s) {
    const [a, b] = [P(s, 0).life, P(s, 1).life];
    s.phase = 'over';
    s.winner = a === b ? 'draw' : (a > b ? 0 : 1);
    const empty = [0, 1].filter(p => !P(s, p).deck.length).map(pname).join(' and ');
    head(s, `${empty}'s deck is empty at the end of the reset. Life ${a} to ${b}: ${s.winner === 'draw' ? 'draw.' : pname(s.winner) + ' wins with more life.'}`);
    throw new GameOver();
  }

  function startGame(s) {
    if (s.phase !== 'setup') throw new Illegal('The game has already started.');
    s.firstPlayer = s.firstPlayerOverride !== null ? s.firstPlayerOverride : RNG.int(s, 2);
    log(s, `${pname(s.firstPlayer)} goes first.`);
    for (const p of [0, 1]) draw(s, p, 5);
    for (const p of [s.firstPlayer, opp(s.firstPlayer)]) {
      if (yesNo(s, p, 'Mulligan? (put your hand on the bottom of your deck and draw 5 new cards)')) {
        const hand = P(s, p).hand.splice(0);
        P(s, p).deck.push(...hand);
        log(s, `${pname(p)} mulligans: their hand goes to the bottom of their deck.`);
        draw(s, p, 5);
      } else log(s, `${pname(p)} keeps their hand.`);
    }
    for (const pl of s.players) { pl.life = 10; pl.energy = 10; pl.power = 0; }
    s.phase = 'action';
    s.turn = s.firstPlayer;
    head(s, `Round 1 begins. ${pname(s.turn)} acts first.`);
  }

  const HOOK_TEXT = { startClash: 'start of clash', endClash: 'end of clash', clashWin: 'clash win' };
  function runTriggers(s, hook) {
    for (const p of [s.firstPlayer, opp(s.firstPlayer)]) {
      if (s.phase === 'over') return;
      const ch = Solo.EFFECTS[charOf(s, p)];
      if (ch && ch[hook]) trigger(s, `${DATA[charOf(s, p)].name} (${HOOK_TEXT[hook]})`, () => ch[hook](s, p));
      checkDeath(s);
      for (const card of P(s, p).combo.slice()) {
        const d = def(card);
        if (d[hook] && isActive(s, card) && where(s, card).p === p) {
          trigger(s, `${nameOf(card)} (${HOOK_TEXT[hook]})`, () => d[hook](s, card, p));
          checkDeath(s);
        }
      }
    }
  }

  function totalText(s, p) {
    const vals = comboValues(s, p);
    const combo = vals.length ? `combo ${vals.reduce((a, b) => a + b, 0)} (${vals.join('+')})` : 'combo 0 (empty)';
    return `${pname(p)}: power ${P(s, p).power} + ${combo} = ${clashTotal(s, p)}.`;
  }

  function runClash(s) {
    head(s, `Clash! (round ${s.round})`);
    s.phase = 'clash';
    s.clash = { noDamage: [false, false], damageDealt: [0, 0], winner: null };
    runTriggers(s, 'startClash');
    const t = [clashTotal(s, 0), clashTotal(s, 1)];
    log(s, totalText(s, 0));
    log(s, totalText(s, 1));
    if (t[0] !== t[1]) {
      const w = t[0] > t[1] ? 0 : 1, l = opp(w);
      let dmg = Math.abs(t[0] - t[1]);
      log(s, `${pname(w)} wins the clash, ${t[w]} to ${t[l]}.`);
      if (charOf(s, w) === 'C-victoria') { dmg = 1; log(s, 'Victoria Castle: the clash deals only 1 damage.', { src: null }); }
      if (s.clash.noDamage[l]) { dmg = 0; log(s, `Flame Snap: ${pname(l)} can't take damage this clash.`, { src: null }); }
      s.clash.winner = w;
      s.clash.damageDealt[w] = dmg;
      if (dmg) damage(s, l, dmg);
      else log(s, `${pname(l)} takes no damage.`);
      checkDeath(s);
      const ch = Solo.EFFECTS[charOf(s, w)];
      if (ch && ch.clashWin) trigger(s, `${DATA[charOf(s, w)].name} (clash win)`, () => ch.clashWin(s, w));
      for (const card of P(s, w).combo.slice()) {
        const d = def(card);
        if (d.clashWin && isActive(s, card)) trigger(s, `${nameOf(card)} (clash win)`, () => d.clashWin(s, card, w));
      }
      checkDeath(s);
    } else log(s, `The clash is a tie, ${t[0]} to ${t[1]}: no damage.`);
    resetPhase(s);
  }

  function resetPhase(s) {
    s.phase = 'reset';
    head(s, 'End of clash / reset');
    for (const pl of s.players) { pl.energy = Math.max(pl.energy, pl.maxEnergy); pl.power = 0; }
    log(s, `Energy refills (Player 1: ${P(s, 0).energy}, Player 2: ${P(s, 1).energy}) and power resets to 0.`);
    for (const p of [s.firstPlayer, opp(s.firstPlayer)]) {
      const hand = P(s, p).hand;
      const toss = chooseCards(s, p, 'Reset: choose any cards to discard, then you draw up to 5', hand.slice(), 0, hand.length);
      toss.forEach(c => discardCard(s, c, p, {}));
      draw(s, p, Math.max(0, 5 - P(s, p).hand.length));
    }
    runTriggers(s, 'endClash');
    for (const pl of s.players) {
      const kept = pl.combo.filter(c => c.keep);
      const gone = pl.combo.filter(c => !c.keep);
      gone.forEach(c => {
        c.silenced = false;
        P(s, c.owner).discard.push(c);
      });
      kept.forEach(c => { c.keep = false; c.silenced = false; });
      pl.combo = kept;
      const p = s.players.indexOf(pl);
      if (gone.length || kept.length) {
        const keptText = kept.map(c => c.faceDown ? 'a face-down card' : upLabel(c)).join(', ');
        log(s, `${pname(p)}'s combo is cleared: ${gone.length} card${gone.length === 1 ? '' : 's'} to the discard pile${kept.length ? `; ${keptText} stay${kept.length === 1 ? 's' : ''}` : ''}.`);
      }
    }
    if (s.players.some(pl => pl.deck.length === 0)) endByDeck(s);
    s.round++;
    s.firstPlayer = opp(s.firstPlayer);
    s.turn = s.firstPlayer;
    s.lastAction = null;
    s.roundStats = { lifeLost: [0, 0], discarded: [0, 0] };
    s.clash = null;
    s.phase = 'action';
    head(s, `Round ${s.round} begins. ${pname(s.turn)} is first.`);
  }

  function requireTurn(s, a) {
    if (s.phase !== 'action') throw new Illegal('Not in the action phase.');
    if (a.player !== s.turn) throw new Illegal(`It is ${pname(s.turn)}'s turn.`);
  }

  function endAction(s, type, p) {
    s.lastAction = { type, player: p };
    s.turn = opp(p);
  }

  function perform(s, a) {
    switch (a.type) {
      case 'start': return startGame(s);
      case 'play': {
        requireTurn(s, a);
        const chk = canPlay(s, a.player, a.uid);
        if (!chk.ok) throw new Illegal(chk.reason);
        playFromHand(s, a.player, P(s, a.player).hand.find(c => c.uid === a.uid));
        return endAction(s, 'play', a.player);
      }
      case 'engage': {
        requireTurn(s, a);
        const n = a.count === undefined ? 2 : a.count;
        if (![0, 1, 2].includes(n)) throw new Illegal('Engage draws 0, 1 or 2 cards.');
        const p = a.player;
        log(s, n ? `${pname(p)} engages: draws ${n}, then discards ${n}.` : `${pname(p)} engages without drawing.`);
        const k = draw(s, p, n);
        const hand = P(s, p).hand;
        chooseCards(s, p, `Engage: discard ${k} card${k === 1 ? '' : 's'}`, hand.slice(), k, k)
          .forEach(c => discardCard(s, c, p, {}));
        if (s.lastAction && s.lastAction.type === 'engage' && s.lastAction.player === opp(p)) {
          log(s, 'Both players engaged back to back, so the clash starts.');
          return runClash(s);
        }
        const ms = activeIn(s, p, 'G8-mantis').length;
        if (ms) trigger(s, 'Mantis Snap', () => { for (let i = 0; i < ms; i++) gainEnergy(s, p, 1); });
        return endAction(s, 'engage', p);
      }
      case 'feint': {
        requireTurn(s, a);
        const card = P(s, a.player).combo.find(c => c.uid === a.uid);
        if (!card || !isActive(s, card) || !def(card).feint) throw new Illegal('That card has no Feint you can use.');
        log(s, `${pname(a.player)} uses ${nameOf(card)}'s Feint.`);
        discardCard(s, card, a.player, {});
        trigger(s, `${nameOf(card)} (Feint)`, () => def(card).feint(s, card, a.player));
        checkDeath(s);
        return endAction(s, 'feint', a.player);
      }
      case 'debug': return debugAction(s, a);
      default: throw new Illegal('Unknown action ' + a.type);
    }
  }

  function debugAction(s, a) {
    const p = a.player;
    // Debug entries are marked; hidden cards stay private to their owner.
    const dlog = (text, who, pubText) => log(s, '[debug] ' + (pubText || text), who === undefined
      ? { dbg: true, src: null } : { dbg: true, src: null, p: who, pt: '[debug] ' + text });
    switch (a.op) {
      case 'add': {
        if (!DATA[a.cardId] || DATA[a.cardId].kind !== 'number') throw new Illegal('Unknown numbered card.');
        const c = makeCard(s, a.cardId, p);
        c.faceDown = !!a.faceDown && (a.zone === 'combo' || a.zone === 'discard');
        const pl = P(s, p);
        if (a.zone === 'hand') pl.hand.push(c);
        else if (a.zone === 'combo') pl.combo.push(c);
        else if (a.zone === 'discard') pl.discard.push(c);
        else if (a.zone === 'deckTop') pl.deck.unshift(c);
        else throw new Illegal('Unknown zone.');
        const hidden = c.faceDown || a.zone === 'hand' || a.zone === 'deckTop';
        dlog(`${label(s, c)} added to ${pname(p)}'s ${a.zone}.`, hidden ? p : undefined, hidden ? `a card added to ${pname(p)}'s ${a.zone}.` : '');
        return;
      }
      case 'set': {
        if (!['life', 'energy', 'power', 'maxEnergy'].includes(a.stat)) throw new Illegal('Unknown stat.');
        const v = Math.floor(Number(a.value));
        if (!isFinite(v)) throw new Illegal('Not a number.');
        P(s, p)[a.stat] = v;
        dlog(`${pname(p)} ${a.stat} = ${v}.`);
        return;
      }
      case 'character': {
        if (!DATA[a.cardId] || DATA[a.cardId].kind !== 'character') throw new Illegal('Unknown character.');
        P(s, p).character = a.cardId;
        dlog(`${pname(p)} is now ${DATA[a.cardId].name}.`);
        return;
      }
      case 'remove': {
        const c = findUid(s, a.uid);
        if (!c) throw new Illegal('No such card.');
        const loc = removeCard(s, c);
        const hidden = hiddenAt(c, loc);
        dlog(`removed ${label(s, c)} from ${zoneText(loc)}.`, hidden ? c.owner : undefined, hidden ? `removed a card from ${zoneText(loc)}.` : '');
        return;
      }
      case 'clear': {
        if (!['hand', 'combo', 'discard', 'deck'].includes(a.zone)) throw new Illegal('Unknown zone.');
        P(s, p)[a.zone] = [];
        dlog(`cleared ${pname(p)}'s ${a.zone}.`);
        return;
      }
      case 'turn': {
        if (s.phase !== 'action') throw new Illegal('Not in the action phase.');
        s.turn = p; s.lastAction = null;
        dlog(`it is now ${pname(p)}'s turn.`);
        return;
      }
      case 'flip': {
        const c = findUid(s, a.uid);
        if (!c || !inCombo(s, c)) throw new Illegal('Card is not in a combo.');
        c.faceDown = !c.faceDown;
        dlog(`turned ${upLabel(c)} ${c.faceDown ? 'face down' : 'face up'}.`);
        return;
      }
      default: throw new Illegal('Unknown debug op.');
    }
  }

  // ------------------------------------------------------------ apply
  function apply(state, action) {
    const fail = error => ({ ok: false, error, state });
    if (!action || typeof action.type !== 'string') return fail('Malformed action.');
    if (state.phase === 'over') return fail('The game is over.');
    let base, act, answers;
    if (state.pending) {
      if (action.type !== 'choose') return fail(`Waiting for ${pname(state.pending.player)} to choose.`);
      if (action.player !== state.pending.player) return fail(`It is ${pname(state.pending.player)}'s choice.`);
      base = state.pending.base; act = state.pending.action;
      answers = state.pending.answers.concat([action.value]);
    } else {
      if (action.type === 'choose') return fail('There is nothing to choose.');
      base = state; act = action; answers = [];
    }
    const s = clone(base);
    s.pending = null;
    CTX = { answers, i: 0, src: [] };
    try {
      perform(s, act);
    } catch (e) {
      if (e instanceof NeedChoice) {
        s.pending = { player: e.player, request: e.request, base, action: act, answers };
        CTX = null;
        return { ok: true, state: s };
      }
      CTX = null;
      if (e instanceof Illegal) return fail(e.message);
      if (e instanceof GameOver) return { ok: true, state: s };
      throw e;
    }
    CTX = null;
    return { ok: true, state: s };
  }

  // Rebuilds a game from its config and action list (used to restore an online host).
  function replay(config, actions) {
    let s = newGame(config);
    for (const a of actions) {
      const r = apply(s, a);
      if (!r.ok) throw new Error('Replay failed at ' + JSON.stringify(a) + ': ' + r.error);
      s = r.state;
    }
    return s;
  }

  // Who needs to act next (for the UI's pass-the-device screen).
  function actor(s) {
    if (s.phase === 'over') return null;
    if (s.pending) return s.pending.player;
    if (s.phase === 'setup') return null;
    return s.turn;
  }

  Solo.newGame = newGame;
  Solo.buildDeck = buildDeck;
  Solo.apply = apply;
  Solo.replay = replay;
  // Online players must run the same rules: bump this whenever rules, cards or the protocol change.
  Solo.VERSION = 'solo-2026.10.01-1';
  Solo.actor = actor;
  Solo.logView = logView;
  Solo.logText = entryText;
  Solo.canPlay = canPlay;
  Solo.feintable = feintable;
  Solo.costOf = costOf;
  Solo.clashTotal = clashTotal;

  // Helpers used by effects.js and the tests.
  Solo._ = {
    opp, P, pname, log, logPriv, check, trigger, payEnergy, label, upLabel, nameOf, makeCard, emptyPlayer, clone,
    ask, yesNo, chooseCard, chooseCards, chooseNumber,
    where, findUid, inCombo, charOf, charColor, activeIn, isActive,
    valueOf, colorsOf, comboTotal, clashTotal, comboValues, neighbors, nextToValue,
    longestRun, hasRun, isEndOfRun, pairCount, colorCount, rightmost,
    placementOk, costOf, gainLife, loseLife, damage, gainPower, losePower, gainEnergy, loseEnergy,
    removeCard, draw, moveToHand, putIntoCombo, discardCard, mill, discardHand, flip, unflip,
    reorderCombo, playFromZone, copyEnter, checkDeath, Illegal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
