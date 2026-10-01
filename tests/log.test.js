// Action log tests: the engine's log explains what happened and why, and
// each player's view never names the other player's hidden cards.
(function () {
  'use strict';
  const { setup, play, clash, eq, ok, pick, YES, NO, logText, logHas, logLacks } = T;
  const H = Solo._;
  const logT = T.logT = (name, fn) => T.tests.push({ group: 'log', card: null, name, fn });
  const D = (id, owner) => ({ id, down: true, owner });
  // Index of the first line containing `text` (in the 'all' view), or -1.
  const at = (s, text, from = 0) => logText(s).findIndex((l, i) => i >= from && l.includes(text));

  logT('Clash breakdown: totals, winner, damage, and start / win / end-of-clash effects in order', () => {
    // G8-forest (start: more pairs → +6 power), R7-phoenix (clash win: gain life = damage), R8-flame (end of clash: +6 life).
    const s = clash(setup({ p: [
      { combo: ['G8-forest', 'Y8-flash', 'R7-phoenix'], power: 2 },
      { combo: ['R8-flame', 'U3-river'], power: 1, life: 30 }] }));
    const start = at(s, 'Clash! (round 1)');
    const pairs = at(s, 'Forest Roundhouse (start of clash): 1 pair vs 0 → +6 power.');
    const t1 = at(s, 'Player 1: power 8 + combo 23 (8+8+7) = 31.');
    const t2 = at(s, 'Player 2: power 1 + combo 11 (8+3) = 12.');
    const win = at(s, 'Player 1 wins the clash, 31 to 12.');
    const dmg = at(s, 'Player 2 takes 19 damage');
    const cw = at(s, 'Phoenix Snap (clash win): Player 1 gains 19 life');
    const reset = at(s, 'End of clash / reset');
    const end = at(s, 'Flame Roundhouse (end of clash): Player 2 gains 6 life');
    ok([start, pairs, t1, t2, win, dmg, cw, reset, end].every(i => i >= 0), 'all clash lines present: ' + [start, pairs, t1, t2, win, dmg, cw, reset, end]);
    ok(start < pairs && pairs < t1 && t1 < t2 && t2 < win && win < dmg && dmg < cw && cw < reset && reset < end, 'lines in order');
  });

  logT('Clash breakdown: a tie says no damage', () => {
    const s = clash(setup({ p: [{ combo: ['R5-flame'] }, { combo: ['U5-river'] }] }));
    logHas(s, 'The clash is a tie, 5 to 5: no damage.');
  });

  logT('Check Roundhouse: both branches are explained', () => {
    const low = clash(setup({ p: [{ combo: ['U8-check'] }, { combo: ['Y7-flash'] }] }));   // 8 vs 7 → 1 damage
    logHas(low, 'Check Roundhouse (end of clash): Player 1 dealt 1 damage (2 or less) → draw 2.');
    logHas(low, 'Check Roundhouse (end of clash): Player 1 draws 2 cards');
    const high = clash(setup({ p: [{ combo: ['U8-check'] }, { combo: ['Y4-flash'] }] }));
    logHas(high, 'Check Roundhouse (end of clash): Player 1 dealt 4 damage, so no draw.');
    ok(!logText(high).some(l => l.startsWith('Check Roundhouse (end of clash): Player 1 draws')), 'no draw line');
  });

  logT('Reaction: Flash Jab used, and Flash Jab declined', () => {
    const base = () => setup({ turn: 1, p: [{ combo: ['Y1-flash', 'Y3-lion'] }, { hand: ['R5-phoenix'] }] });
    const used = play(base(), 1, 'R5-phoenix', [pick('Y3-lion'), YES]);
    logHas(used, 'Flash Jab (reaction): Player 1 discards Flash Jab so Yellow 3 Lion Straight isn\'t flipped.');
    logHas(used, 'Flash Jab: Player 1 discards Yellow 1 Flash Jab from their combo.');
    logLacks(used, 'is flipped face down');
    const declined = play(base(), 1, 'R5-phoenix', [pick('Y3-lion'), NO]);
    logHas(declined, "Flash Jab: Player 1 doesn't use it.");
    logHas(declined, "Phoenix Hook: Yellow 3 Lion Straight in Player 1's combo is flipped face down.");
  });

  logT('Planted sabotage: Ink Straight plants Ink Chop, and Ink Chop\'s extra cost is shown', () => {
    let s = setup({ turn: 1, p: [{ hand: ['R2-flame'] }, { hand: ['K3-ink'], discard: ['K2-ink'] }] });
    s = play(s, 1, 'K3-ink');
    logHas(s, "Ink Straight: Black 2 Ink Chop is put from Player 2's discard pile into Player 1's combo.");
    s = play(s, 0, 'R2-flame');
    logHas(s, 'Player 1 plays Red 2 Flame Chop for 3 energy (printed 2, +1 Ink Chop) (energy 10 → 7), next to Black 2 Ink Chop, matching number 2.');
  });

  logT('Hidden info: a face-down card returned to hand is named only to its owner', () => {
    const s = play(setup({ p: [{ char: 'C-victoria', hand: ['U9-river'], combo: [{ id: 'R7-flame', down: true }] }] }), 0, 'U9-river');
    logHas(s, 'Red 7 Flame Snap (face down) goes from their combo to Player 1\'s hand.', 0);
    logHas(s, "River Finisher: A face-down card goes from their combo to Player 1's hand.", 1);
    logLacks(s, 'Flame Snap', 1);
  });

  logT('Hidden info: draws, face-down puts and face-down discards are private', () => {
    let s = setup({ p: [{ hand: ['U3-river'], deck: ['R9-blood'] }, {}] });
    s = play(s, 0, 'U3-river');                       // River Straight: draw 1
    logHas(s, 'Player 1 draws 1 card: Red 9 Blood Finisher.', 0);
    logHas(s, 'Player 1 draws 1 card.', 1);
    logLacks(s, 'Blood Finisher', 1);
    // Mantis Hook (Patience, then discard 2 face down)
    let m = setup({ p: [{ hand: ['G5-mantis', 'R9-flame', 'R8-blood'] }] });
    m = play(m, 0, 'G5-mantis', [YES, YES]);
    logHas(m, 'Player 1 discards Red 9 Flame Finisher face down.', 0);
    logLacks(m, 'Flame Finisher', 1);
    logLacks(m, 'Blood Roundhouse', 1);
    logHas(m, 'Player 1 discards a card face down.', 1);
  });

  logT('Failed conditions are logged ("why nothing happened")', () => {
    const s = play(setup({ p: [{ hand: ['R3-blood'], combo: ['R5-flame'] }] }), 0, 'R3-blood');
    logHas(s, 'Blood Straight: not next to a 3, so nothing happens.');
  });

  logT('Debug actions are logged and marked as debug', () => {
    let s = setup();
    s = T.act(s, { type: 'debug', op: 'set', player: 0, stat: 'life', value: 3 });
    s = T.act(s, { type: 'debug', op: 'add', player: 1, cardId: 'K9-death', zone: 'hand' });
    const v = Solo.logView(s, 0);
    ok(v.length === 2 && v.every(e => e.dbg && e.text.startsWith('[debug]')), 'two debug entries');
    logHas(s, '[debug] Player 1 life = 3.');
    logLacks(s, 'Death Finisher', 0);
    logHas(s, 'Death Finisher', 1);
  });

  // Plays random games and checks, after every action, that no line in a
  // player's view names a card that player has never been able to see.
  logT('Hidden info (random games): no player view names a card hidden from that player', () => {
    const names = Solo.NUMBERS.map(c => ({ id: c.id, name: c.name }));
    for (let g = 0; g < 20; g++) {
      const seed = 'leak' + g;
      const rnd = { rng: Solo.RNG.seedToInt(seed) };
      const R = n => Solo.RNG.int(rnd, n);
      const chars = Solo.CHARACTERS.map(c => c.id);
      const cfg = { seed, players: [0, 1].map(p => { const ch = chars[R(chars.length)]; return { character: ch, deck: Solo.buildDeck(seed + p, ch, R(2) ? 'mixed' : 'mono') }; }) };
      let s = Solo.apply(Solo.newGame(cfg), { type: 'start' }).state;
      const seen = [new Set(), new Set()];
      const checked = [0, 0];
      const look = st => {
        for (const v of [0, 1]) {
          for (const pl of st.players) for (const z of ['hand', 'deck', 'combo', 'discard']) for (const c of pl[z]) {
            if (c.owner === v || (z !== 'hand' && z !== 'deck' && !c.faceDown)) seen[v].add(c.id);
          }
          if (st.pending && st.pending.player === v) st.pending.request.options.forEach(o => {
            const c = typeof o.value === 'number' && H.findUid(st, o.value);
            if (c && !o.label.startsWith('face-down')) seen[v].add(c.id);
          });
        }
      };
      const verify = st => {
        look(st);
        for (const v of [0, 1]) {
          const view = Solo.logView(st, v);
          for (let i = checked[v]; i < view.length; i++) {
            // A card can be shown publicly mid-action (discarded face up, then
            // returned to hand by Sun Cross / Cian Hack). Public entries that
            // reveal a card by the rules count as seeing it.
            const e = st.log[i];
            if (e.p === undefined && /( plays | discards | is put from |turned face up| is flipped face down)/.test(e.t) &&
                !e.t.replace(' is flipped face down', '').includes('face down')) {
              for (const n of names) if (e.t.includes(n.name)) seen[v].add(n.id);
            }
            for (const n of names) if (!seen[v].has(n.id) && view[i].text.includes(n.name))
              throw new Error(`game ${seed}: Player ${v + 1} sees "${n.name}" in: ${view[i].text}`);
          }
          checked[v] = view.length;
        }
      };
      verify(s);
      let n = 0;
      while (s.phase !== 'over' && n++ < 3000) {
        let a;
        if (s.pending) {
          const q = s.pending.request;
          const v = q.kind === 'one' ? q.options[R(q.options.length)].value
            : q.kind === 'many' ? q.options.slice(0, q.min + R(q.max - q.min + 1)).map(o => o.value) : q.min + R(q.max - q.min + 1);
          a = { type: 'choose', player: s.pending.player, value: v };
        } else {
          const p = s.turn, playable = s.players[p].hand.filter(c => Solo.canPlay(s, p, c.uid).ok), f = Solo.feintable(s, p);
          a = playable.length && R(4) ? { type: 'play', player: p, uid: playable[R(playable.length)].uid }
            : f.length && !R(4) ? { type: 'feint', player: p, uid: f[0].uid } : { type: 'engage', player: p, count: R(3) };
        }
        let r = Solo.apply(s, a);
        if (!r.ok && a.type === 'choose') {
          const q = s.pending.request;
          for (const v of (q.kind === 'many' ? [[]] : q.options.map(o => o.value))) { r = Solo.apply(s, { type: 'choose', player: s.pending.player, value: v }); if (r.ok) break; }
        }
        if (!r.ok) throw new Error(`game ${seed}: ${r.error}`);
        // A replayed choice rebuilds the log from the action's start; re-check from there.
        if (r.state.log.length < s.log.length) { checked[0] = checked[1] = Math.min(checked[0], r.state.log.length); }
        s = r.state;
        verify(s);
      }
    }
  });
})();
