// Core rule tests (rulebook + readings.md §1 + decisions.md).
(function () {
  'use strict';
  const { core, setup, act, play, engage, clash, eq, ok, rejects, canPlay, ids, has, logHas, YES, NO, pick } = T;
  const H = Solo._;

  function freshGame(seed) {
    const cfg = { seed, players: [
      { character: 'C-asher', deck: Solo.buildDeck(seed + '0', 'C-asher', 'mono') },
      { character: 'C-spring', deck: Solo.buildDeck(seed + '1', 'C-spring', 'mono') }] };
    return { cfg, s: Solo.newGame(cfg) };
  }

  core('Card data: 135 numbered cards + 15 characters, 27 per color, numbers 1-9 x3', () => {
    eq(Solo.NUMBERS.length, 135); eq(Solo.CHARACTERS.length, 15);
    for (const col of Solo.COLORS) {
      const cs = Solo.NUMBERS.filter(c => c.color === col);
      eq(cs.length, 27, col);
      for (let n = 1; n <= 9; n++) eq(cs.filter(c => c.number === n).length, 3, col + ' ' + n);
      eq(Solo.CHARACTERS.filter(c => c.color === col).length, 3, col + ' characters');
    }
    ok(Object.keys(Solo.DATA).every(id => Solo.EFFECTS[id]), 'every card has an effect entry');
  });

  core('Decks: 40 cards, max 2 copies per card', () => {
    for (const style of ['mono', 'mixed']) {
      const d = Solo.buildDeck('x', 'C-dante', style);
      eq(d.length, 40);
      const counts = {};
      d.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      ok(Object.values(counts).every(n => n <= 2), 'max 2 copies');
    }
    ok(Solo.buildDeck('x', 'C-dante', 'mono').every(id => Solo.DATA[id].color === 'Black'), 'mono deck is character color');
  });

  core('Setup: 5-card hands, 10 life, 10 energy, 0 power; random first player; mulligan', () => {
    const { s } = freshGame('setup');
    let s2 = act(s, { type: 'start' }, [NO, YES]);
    const first = s2.firstPlayer;
    eq(s2.players.map(p => p.hand.length), [5, 5]);
    eq(s2.players.map(p => [p.life, p.energy, p.power]), [[10, 10, 0], [10, 10, 0]]);
    eq(s2.turn, first);
    eq(s2.players[1 - first].deck.length, 35, 'mulligan keeps deck size');
    logHas(s2, 'mulligans');
  });

  core('Determinism: same seed and actions give identical states; different seeds differ', () => {
    const run = seed => {
      let { s } = freshGame(seed);
      s = act(s, { type: 'start' }, [NO, NO]);
      s = engage(s, s.turn, 2, [(st, req) => req.options.slice(0, 2).map(o => o.value)]);
      return JSON.stringify(s);
    };
    eq(run('alpha') === run('alpha'), true, 'same seed');
    ok(run('alpha') !== run('beta'), 'different seeds give different games');
  });

  core('State is plain JSON (serializable for online play)', () => {
    let { s } = freshGame('json');
    s = act(s, { type: 'start' }, [NO], { allowPending: true });
    ok(s.pending, 'second mulligan pending');
    eq(JSON.parse(JSON.stringify(s)), s);
    const r = Solo.apply(JSON.parse(JSON.stringify(s)), { type: 'choose', player: s.pending.player, value: false });
    ok(r.ok && !r.state.pending, 'a deserialized pending state can be continued');
  });

  core('apply never mutates its input state', () => {
    const s = setup({ p: [{ hand: ['R1-flame'] }] });
    const before = JSON.stringify(s);
    play(s, 0, 'R1-flame');
    eq(JSON.stringify(s), before);
  });

  core('Placement: empty combo accepts anything; otherwise match number or color', () => {
    const s = setup({ p: [{ hand: ['U5-river', 'R5-flame', 'U4-river'], combo: [] }] });
    ok(canPlay(s, 0, 'U5-river').ok, 'empty combo');
    const s2 = setup({ p: [{ hand: ['U5-river', 'R4-flame', 'U4-river'], combo: ['R5-flame'] }] });
    ok(canPlay(s2, 0, 'U5-river').ok, 'same number');
    ok(canPlay(s2, 0, 'R4-flame').ok, 'same color');
    ok(!canPlay(s2, 0, 'U4-river').ok, 'neither matches');
    rejects(s2, { type: 'play', player: 0, uid: s2.players[0].hand[2].uid });
  });

  core('Face-down cards are 0 in the character\'s color (placement and value)', () => {
    const s = setup({ p: [{ char: 'C-spring', hand: ['U7-river', 'R7-flame'], combo: [{ id: 'R9-flame', down: true }] }] });
    eq(H.valueOf(s, s.players[0].combo[0]), 0);
    eq(H.colorsOf(s, s.players[0].combo[0]), ['Blue']);
    ok(canPlay(s, 0, 'U7-river').ok, 'blue matches face-down of a blue character');
    ok(!canPlay(s, 0, 'R7-flame').ok, 'red does not');
  });

  core('Cost: pay energy equal to the value; cannot play without enough energy', () => {
    const s = setup({ p: [{ hand: ['R6-flame'], energy: 5 }] });
    ok(!canPlay(s, 0, 'R6-flame').ok);
    const s2 = setup({ p: [{ hand: ['R6-flame'], energy: 6 }] });
    eq(play(s2, 0, 'R6-flame').players[0].energy, 0);
  });

  core('Turns alternate; acting out of turn is rejected', () => {
    let s = setup({ p: [{ hand: ['R1-blood'] }, { hand: ['R1-blood'] }] });
    rejects(s, { type: 'play', player: 1, uid: s.players[1].hand[0].uid });
    s = engage(s, 0, 0);
    eq(s.turn, 1);
  });

  core('Engage: draw up to 2, then discard that many', () => {
    let s = setup({ p: [{ hand: ['R1-flame', 'R2-flame'] }] });
    s = engage(s, 0, 2, [T.picks('R1-flame', 'R2-flame')]);
    eq(ids(s, 0, 'hand'), ['Y2-flash', 'Y2-flash']);
    eq(ids(s, 0, 'discard'), ['R1-flame', 'R2-flame']);
    eq(s.players[0].deck.length, 13);
  });

  core('Engage then engage (both players, back to back) starts a clash', () => {
    let s = setup({ p: [{ combo: ['R5-flame'] }, { combo: ['R2-flame'] }] });
    s = engage(s, 0, 0);
    ok(s.round === 1, 'no clash after one engage');
    s = engage(s, 1, 0);
    eq(s.round, 2, 'clash happened and a new round began');
    eq(s.players[1].life, 7, 'damage = difference of totals (5 vs 2)');
  });

  core('Engage, play, engage does not start a clash', () => {
    let s = setup({ p: [{}, { hand: ['R1-blood'] }] });
    s = engage(s, 0, 0);
    s = play(s, 1, 'R1-blood');
    s = engage(s, 0, 0);
    eq(s.round, 1);
  });

  core('Clash: damage = difference of (power + combo values); tie = no damage', () => {
    let s = setup({ p: [{ combo: ['R3-flame', 'R4-flame'], power: 2 }, { combo: ['U9-river'] }] });
    s = clash(s);
    eq(s.players[1].life, 10, '9 vs 9 tie');
    let s2 = setup({ p: [{ combo: ['R3-flame'], power: 5 }, { combo: ['U4-river'], power: 1 }] });
    s2 = clash(s2);
    eq(s2.players[1].life, 7, '8 vs 5 deals 3');
  });

  core('Reset: power 0, energy refilled, hands refilled to 5, combos to discard, first player rotates', () => {
    let s = setup({ p: [{ combo: ['R3-flame'], power: 4, energy: 2, hand: ['R1-flame'] }, { combo: ['U2-river'], energy: 0, hand: ['U1-river'] }] });
    s = clash(s, [[], []], { autoReset: false });
    eq(s.players.map(p => p.power), [0, 0]);
    eq(s.players.map(p => p.energy), [10, 10]);
    eq(s.players.map(p => p.hand.length), [5, 5]);
    eq(s.players.map(p => p.combo.length), [0, 0]);
    ok(has(s, 0, 'discard', 'R3-flame') && has(s, 1, 'discard', 'U2-river'));
    eq([s.firstPlayer, s.turn, s.round], [1, 1, 2]);
  });

  core('Reset: players may discard any cards before drawing up to 5', () => {
    let s = setup({ p: [{ hand: ['R1-flame', 'R2-flame', 'R3-flame'] }] });
    s = clash(s, [T.picks('R1-flame', 'R2-flame')], { autoReset: false });
    eq(ids(s, 0, 'discard').slice(0, 2), ['R1-flame', 'R2-flame']);
    eq(s.players[0].hand.length, 5);
  });

  core('Game ends when life reaches 0 (winner recorded, no more actions)', () => {
    let s = setup({ p: [{ combo: ['R9-flame'] }, { life: 3 }] });
    s = clash(s);
    eq([s.phase, s.winner], ['over', 0]);
    rejects(s, { type: 'engage', player: 0, count: 0 });
  });

  core('Game ends at reset step 4 when a deck is empty: most life wins', () => {
    let s = setup({ p: [{ filler: 5, life: 4 }, { filler: 20, life: 6 }] });
    s = clash(s);
    eq([s.phase, s.winner], ['over', 1]);
    let s2 = setup({ p: [{ filler: 5, life: 6 }, { filler: 20, life: 6 }] });
    eq(clash(s2).winner, 'draw', 'equal life is a draw');
  });

  core('Both players at 0 at the same time is a draw', () => {
    let s = setup({ p: [{ hand: ['R2-flame'], life: 2 }, { life: 2 }] });
    s = play(s, 0, 'R2-flame');
    eq([s.phase, s.winner], ['over', 'draw']);
  });

  core('Pending choices: only the named player may answer; bad answers are rejected without changing state', () => {
    let s = setup({ p: [{ hand: ['R1-blood', 'R5-flame'] }] });
    s = play(s, 0, 'R1-blood', [], { allowPending: true });
    ok(s.pending && s.pending.player === 0);
    rejects(s, { type: 'choose', player: 1, value: [] }, 'wrong player');
    rejects(s, { type: 'choose', player: 0, value: [] }, 'must discard exactly 1');
    rejects(s, { type: 'engage', player: 0, count: 0 }, 'no other actions while pending');
    const good = act(s, { type: 'choose', player: 0, value: [s.players[0].hand[0].uid] });
    eq(good.pending, null);
  });

  core('Nothing to choose: a stray choose action is rejected', () => {
    rejects(setup(), { type: 'choose', player: 0, value: 1 });
  });

  core('Energy gains are capped at max unless a card says otherwise', () => {
    const s = setup();
    const s2 = H.clone(s);
    H.gainEnergy(s2, 0, 5);
    eq(s2.players[0].energy, 10);
    H.gainEnergy(s2, 0, 3, true);
    eq(s2.players[0].energy, 13);
  });

  core('Power cannot go below 0', () => {
    let s = setup({ p: [{ hand: ['U6-check'], power: 0 }, { power: 1 }] });
    s = play(s, 0, 'U6-check');
    eq(s.players[1].power, 0);
  });

  core('Feint action discards the card, resolves, and ends the turn', () => {
    let s = setup({ p: [{ combo: ['R6-blood'], life: 7 }] });
    s = T.feint(s, 0, 'R6-blood');
    eq([s.players[0].power, s.turn], [3, 1]);
    ok(has(s, 0, 'discard', 'R6-blood'));
    rejects(setup({ p: [{ combo: ['R1-flame'] }] }), { type: 'feint', player: 0, uid: 1 }, 'non-feint card');
  });

  core('Planted cards go back to their owner\'s discard pile at cleanup', () => {
    let s = setup({ p: [{}, { combo: [{ id: 'R1-flame', owner: 0 }] }] });
    s = clash(s);
    ok(has(s, 0, 'discard', 'R1-flame') && !has(s, 1, 'discard', 'R1-flame'));
  });

  core('Start-of-clash effects resolve first player first, then left to right', () => {
    let s = setup({ first: 1, turn: 1, p: [{ char: 'C-master', combo: ['R1-flame', 'R2-flame', 'R3-flame'] }, { char: 'C-master', combo: ['Y1-sun', 'Y2-sun', 'Y3-sun'] }] });
    s = clash(s);
    const a = s.log.indexOf('Player 2 gains +3 power.'), b = s.log.indexOf('Player 1 gains +3 power.');
    ok(a >= 0 && b >= 0 && a < b, 'Player 2 (first this round) resolves before Player 1');
  });

  core('Hidden information: face-down cards returned to hand are not named in the shared log', () => {
    const s = play(setup({ p: [{ char: 'C-victoria', hand: ['U9-river'], combo: [{ id: 'R7-flame', down: true }] }] }), 0, 'U9-river');
    ok(has(s, 0, 'hand', 'R7-flame'), 'card returned');
    ok(!s.log.some(l => l.includes('Flame Snap')), 'log does not reveal it');
  });

  core('Debug actions: add card, set stat, set character, give turn, clear zone', () => {
    let s = setup();
    s = act(s, { type: 'debug', op: 'add', player: 1, cardId: 'K9-death', zone: 'combo', faceDown: true });
    ok(s.players[1].combo[0].faceDown);
    s = act(s, { type: 'debug', op: 'set', player: 0, stat: 'life', value: 3 });
    s = act(s, { type: 'debug', op: 'character', player: 0, cardId: 'C-dante' });
    s = act(s, { type: 'debug', op: 'turn', player: 1 });
    s = act(s, { type: 'debug', op: 'clear', player: 0, zone: 'deck' });
    eq([s.players[0].life, s.players[0].character, s.turn, s.players[0].deck.length], [3, 'C-dante', 1, 0]);
  });

  core('Full random games finish without errors (smoke test, 40 games)', () => {
    for (let g = 0; g < 40; g++) {
      const seed = 'smoke' + g;
      const chars = Solo.CHARACTERS.map(c => c.id);
      const rnd = { rng: Solo.RNG.seedToInt(seed) };
      const R = n => Solo.RNG.int(rnd, n);
      const cfg = { seed, players: [0, 1].map(p => { const ch = chars[R(chars.length)]; return { character: ch, deck: Solo.buildDeck(seed + p, ch, R(2) ? 'mixed' : 'mono') }; }) };
      let s = Solo.apply(Solo.newGame(cfg), { type: 'start' }).state;
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
        s = r.state;
      }
      eq(s.phase, 'over', `game ${seed} finished`);
    }
  });
})();
