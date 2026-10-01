// Minimal test harness for the Solo engine. Runs in any browser (tests.html)
// and in headless Chrome (tools/run-tests.ps1).
(function (root) {
  'use strict';
  const H = Solo._;
  const T = root.T = { tests: [] };

  T.card = (cardId, name, fn) => T.tests.push({ group: 'card', card: cardId, name, fn });
  T.core = (name, fn) => T.tests.push({ group: 'core', card: null, name, fn });

  // ------------------------------------------------------------------ setup
  // spec: { turn, first, p: [ { char, hand, combo, discard, deck, filler, life, energy, power, maxEnergy }, {...} ] }
  // Card entries are ids or { id, down: true, owner: n }.
  T.setup = function (spec = {}) {
    const s = Solo.newGame({ seed: spec.seed || 'test', players: [{ character: 'C-vlad', deck: [] }, { character: 'C-vlad', deck: [] }], firstPlayer: 0 });
    s.phase = 'action';
    s.turn = spec.turn || 0;
    s.firstPlayer = spec.first || 0;
    [0, 1].forEach(p => {
      const ps = (spec.p || [])[p] || {};
      const pl = s.players[p];
      pl.character = ps.char || 'C-vlad';
      const mk = x => {
        const id = typeof x === 'string' ? x : x.id;
        const c = H.makeCard(s, id, x.owner === undefined ? p : x.owner);
        if (x.down) c.faceDown = true;
        return c;
      };
      pl.hand = (ps.hand || []).map(mk);
      pl.combo = (ps.combo || []).map(mk);
      pl.discard = (ps.discard || []).map(mk);
      const filler = ps.filler === undefined ? 15 : ps.filler;
      pl.deck = (ps.deck || []).map(mk).concat(Array.from({ length: filler }, () => mk('Y2-flash')));
      ['life', 'energy', 'power', 'maxEnergy'].forEach(k => { if (ps[k] !== undefined) pl[k] = ps[k]; });
    });
    s.log = [];
    return s;
  };

  // ------------------------------------------------------------------ acting
  // Applies an action, then answers every prompt from `answers` in order.
  // "Reset:" discard prompts are answered with [] automatically.
  // Fails on a rejected action, an unexpected prompt, or unused answers.
  T.act = function (s, action, answers = [], opts = {}) {
    let r = Solo.apply(s, action);
    if (!r.ok) throw new Error('Action rejected: ' + r.error);
    s = r.state;
    const q = answers.slice();
    while (s.pending) {
      const req = s.pending.request;
      let v;
      if (opts.autoReset !== false && /^Reset:/.test(req.prompt)) v = [];
      else if (!q.length) {
        if (opts.allowPending) return s;
        throw new Error('Unexpected prompt: "' + req.prompt + '"');
      } else {
        v = q.shift();
        if (typeof v === 'function') v = v(s, req);
      }
      r = Solo.apply(s, { type: 'choose', player: s.pending.player, value: v });
      if (!r.ok) throw new Error(`Answer rejected for "${req.prompt}": ${r.error}`);
      s = r.state;
    }
    if (q.length) throw new Error('Unused answers (a prompt did not appear): ' + q.length);
    return s;
  };

  T.play = (s, p, id, answers, opts) => {
    const c = s.players[p].hand.find(x => x.id === id);
    if (!c) throw new Error(`${id} not in Player ${p + 1}'s hand`);
    return T.act(s, { type: 'play', player: p, uid: c.uid }, answers, opts);
  };
  T.engage = (s, p, count, answers, opts) => T.act(s, { type: 'engage', player: p, count }, answers, opts);
  T.feint = (s, p, id, answers) => {
    const c = s.players[p].combo.find(x => x.id === id);
    if (!c) throw new Error(`${id} not in Player ${p + 1}'s combo`);
    return T.act(s, { type: 'feint', player: p, uid: c.uid }, answers);
  };
  // Starts a clash: pretends the other player just engaged, then the turn player engages (draw 0).
  T.clash = (s, answers, opts) => {
    const s2 = H.clone(s);
    s2.lastAction = { type: 'engage', player: 1 - s2.turn };
    return T.act(s2, { type: 'engage', player: s2.turn, count: 0 }, answers, opts);
  };

  // Answer helpers
  T.YES = true; T.NO = false; T.NONE = null;
  const optionFor = (s, req, id, used) => {
    const o = req.options.find(o => typeof o.value === 'number' && !used.includes(o.value) && (H.findUid(s, o.value) || {}).id === id);
    if (!o) throw new Error(`No option for ${id} in "${req.prompt}"`);
    used.push(o.value);
    return o.value;
  };
  T.pick = id => (s, req) => optionFor(s, req, id, []);
  T.picks = (...ids) => (s, req) => { const used = []; return ids.map(id => optionFor(s, req, id, used)); };

  // ------------------------------------------------------------------ queries & asserts
  T.ids = (s, p, zone) => s.players[p][zone].map(c => c.id);
  T.find = (s, p, zone, id) => s.players[p][zone].find(c => c.id === id);
  T.has = (s, p, zone, id) => !!T.find(s, p, zone, id);
  T.eq = (a, b, msg) => {
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) throw new Error(`${msg || 'values differ'}: expected ${jb}, got ${ja}`);
  };
  T.ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  // Log lines as one player sees them (viewer 0 or 1), or everything ('all').
  T.logText = (s, viewer = 'all') => Solo.logView(s, viewer).map(e => e.text);
  T.logHas = (s, text, viewer) => T.ok(T.logText(s, viewer).some(l => l.includes(text)), `log should contain "${text}"`);
  T.logLacks = (s, text, viewer) => T.ok(!T.logText(s, viewer).some(l => l.includes(text)), `log should not contain "${text}"`);
  T.rejects = (s, action, msg) => {
    const r = Solo.apply(s, action);
    T.ok(!r.ok, msg || 'action should be rejected');
    return r.error;
  };
  T.canPlay = (s, p, id) => {
    const c = s.players[p].hand.find(x => x.id === id);
    return Solo.canPlay(s, p, c.uid);
  };

  // ------------------------------------------------------------------ run
  T.run = function () {
    return T.tests.map(t => {
      try { t.fn(); return { group: t.group, card: t.card, name: t.name, pass: true }; }
      catch (e) { return { group: t.group, card: t.card, name: t.name, pass: false, error: String(e && e.message || e) }; }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
