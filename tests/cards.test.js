// One or more tests per card (135 numbered + 15 characters), each checking the
// behaviour described by that card's line in readings.md / rulings.md.
(function () {
  'use strict';
  const { card, setup, act, play, engage, feint, clash, eq, ok, rejects, canPlay, ids, has, find, logHas, YES, NO, NONE, pick, picks } = T;
  const H = Solo._;
  const D = (id) => ({ id, down: true });
  const cost = (s, p, id) => Solo.costOf(s, p, s.players[p].hand.find(c => c.id === id));
  const discardViaEngage = (s, id) => engage(s, 0, 1, [picks(id)]);

  // ================================================================= RED
  card('R1-flame', 'Combo enter: lose 3 life, then draw 1', () => {
    const s = play(setup({ p: [{ hand: ['R1-flame'] }] }), 0, 'R1-flame');
    eq([s.players[0].life, s.players[0].hand.length], [7, 1]);
  });
  card('R1-phoenix', 'Combo enter: +1 power per value-1 card in your combo (itself included)', () => {
    const s = play(setup({ p: [{ hand: ['R1-phoenix'], combo: ['R1-blood', 'R1-flame'] }] }), 0, 'R1-phoenix');
    eq(s.players[0].power, 3);
  });
  card('R1-blood', 'Combo enter: draw 1, then discard 1', () => {
    const s = play(setup({ p: [{ hand: ['R1-blood', 'R5-blood'] }] }), 0, 'R1-blood', [picks('R5-blood')]);
    eq([ids(s, 0, 'hand'), ids(s, 0, 'discard')], [['Y2-flash'], ['R5-blood']]);
  });
  card('R2-flame', 'Combo enter: you lose 2 and your opponent loses 2', () => {
    const s = play(setup({ p: [{ hand: ['R2-flame'] }] }), 0, 'R2-flame');
    eq(s.players.map(p => p.life), [8, 8]);
  });
  card('R2-phoenix', 'Combo enter: next to a 1 -> gain 2 life (not otherwise)', () => {
    eq(play(setup({ p: [{ hand: ['R2-phoenix'], combo: ['R1-blood'] }] }), 0, 'R2-phoenix').players[0].life, 12);
    eq(play(setup({ p: [{ hand: ['R2-phoenix'], combo: ['R3-blood'] }] }), 0, 'R2-phoenix').players[0].life, 10);
  });
  card('R2-blood', 'Combo enter: if more power than opponent, lose 2 power and draw', () => {
    const s = play(setup({ p: [{ hand: ['R2-blood'], power: 3 }, { power: 1 }] }), 0, 'R2-blood');
    eq([s.players[0].power, s.players[0].hand.length], [1, 1]);
    const s2 = play(setup({ p: [{ hand: ['R2-blood'], power: 1 }, { power: 1 }] }), 0, 'R2-blood');
    eq([s2.players[0].power, s2.players[0].hand.length], [1, 0]);
  });
  card('R3-flame', 'Combo enter: with a run of 3, return discard cards totalling exactly 3', () => {
    const s0 = setup({ p: [{ hand: ['R3-flame'], combo: ['R1-blood', 'R2-blood'], discard: ['R1-flame', 'R2-flame', 'R3-phoenix'] }] });
    const pend = play(s0, 0, 'R3-flame', [], { allowPending: true });
    rejects(pend, { type: 'choose', player: 0, value: pend.pending.request.options.filter(o => ['R2-flame', 'R3-phoenix'].includes(H.findUid(pend, o.value).id)).map(o => o.value) }, 'total 5 rejected');
    const s = play(s0, 0, 'R3-flame', [picks('R1-flame', 'R2-flame')]);
    eq(ids(s, 0, 'hand').sort(), ['R1-flame', 'R2-flame']);
    const noRun = play(setup({ p: [{ hand: ['R3-flame'], combo: ['R5-blood'], discard: ['R3-phoenix'] }] }), 0, 'R3-flame');
    eq(noRun.players[0].hand.length, 0, 'no run, no effect');
  });
  card('R3-phoenix', 'Combo enter: if more power than opponent, gain 3 life', () => {
    eq(play(setup({ p: [{ hand: ['R3-phoenix'], power: 2 }] }), 0, 'R3-phoenix').players[0].life, 13);
    eq(play(setup({ p: [{ hand: ['R3-phoenix'] }] }), 0, 'R3-phoenix').players[0].life, 10);
  });
  card('R3-blood', 'Combo enter: next to a 3 -> +3 power', () => {
    eq(play(setup({ p: [{ hand: ['R3-blood'], combo: ['R3-flame'] }] }), 0, 'R3-blood').players[0].power, 3);
    eq(play(setup({ p: [{ hand: ['R3-blood'], combo: ['R4-flame'] }] }), 0, 'R3-blood').players[0].power, 0);
  });
  card('R4-flame', 'Combo enter: if more power than opponent, +2 power', () => {
    eq(play(setup({ p: [{ hand: ['R4-flame'], power: 1 }] }), 0, 'R4-flame').players[0].power, 3);
  });
  card('R4-phoenix', 'Combo enter: lose 1 life, discard a 0 from the opponent\'s combo', () => {
    const s = play(setup({ p: [{ hand: ['R4-phoenix'] }, { combo: [D('U1-river'), 'U4-cyber'] }] }), 0, 'R4-phoenix');
    eq([s.players[0].life, ids(s, 1, 'combo'), ids(s, 1, 'discard')], [9, ['U4-cyber'], ['U1-river']]);
  });
  card('R4-blood', 'Feint: play a 3 from your discard (combo enter triggers), then draw', () => {
    const s = feint(setup({ p: [{ combo: ['R4-blood'], discard: ['R3-phoenix'], power: 1 }] }), 0, 'R4-blood');
    eq([ids(s, 0, 'combo'), ids(s, 0, 'discard'), s.players[0].hand.length, s.players[0].life, s.turn], [['R3-phoenix'], ['R4-blood'], 1, 13, 1]);
  });
  card('R5-flame', 'Combo enter: if less power than opponent, +4 power', () => {
    eq(play(setup({ p: [{ hand: ['R5-flame'] }, { power: 2 }] }), 0, 'R5-flame').players[0].power, 4);
    eq(play(setup({ p: [{ hand: ['R5-flame'] }] }), 0, 'R5-flame').players[0].power, 0);
  });
  card('R5-phoenix', 'Combo enter: lose 2 life, flip an opponent\'s combo card', () => {
    const s = play(setup({ p: [{ hand: ['R5-phoenix'] }, { combo: ['U4-cyber'] }] }), 0, 'R5-phoenix');
    eq([s.players[0].life, s.players[1].combo[0].faceDown], [8, true]);
  });
  card('R5-blood', 'Combo enter: discard your hand, draw 3', () => {
    const s = play(setup({ p: [{ hand: ['R5-blood', 'U1-river', 'U2-river'] }] }), 0, 'R5-blood');
    eq([ids(s, 0, 'discard'), ids(s, 0, 'hand')], [['U1-river', 'U2-river'], ['Y2-flash', 'Y2-flash', 'Y2-flash']]);
  });
  card('R6-flame', 'Style: life you would lose from your own effects is gained instead', () => {
    const s = play(setup({ p: [{ hand: ['R1-flame'], combo: ['R6-flame'] }] }), 0, 'R1-flame');
    eq(s.players[0].life, 13);
    const s2 = play(setup({ p: [{ combo: ['R6-flame'] }, { hand: ['R2-flame'] }], turn: 1 }), 1, 'R2-flame');
    eq(s2.players[0].life, 8, 'opponent\'s effects still hurt');
  });
  card('R6-phoenix', 'Combo enter: damage = your power; opponent may discard to reduce it', () => {
    const s = play(setup({ p: [{ hand: ['R6-phoenix'], power: 5 }, { hand: ['U2-river', 'U1-river'] }] }), 0, 'R6-phoenix', [picks('U2-river')]);
    eq([s.players[1].life, ids(s, 1, 'discard')], [7, ['U2-river']]);
  });
  card('R6-blood', 'Feint: gain power = 10 - current life', () => {
    eq(feint(setup({ p: [{ combo: ['R6-blood'], life: 6 }] }), 0, 'R6-blood').players[0].power, 4);
  });
  card('R7-flame', 'Start of clash: drop to 1 life; take no damage this clash', () => {
    const s = clash(setup({ p: [{ combo: ['R7-flame'], life: 8 }, { combo: ['U9-river'] }] }));
    eq(s.players[0].life, 1);
    logHas(s, "can't take damage");
  });
  card('R7-phoenix', 'Clash win: gain life equal to damage dealt', () => {
    const s = clash(setup({ p: [{ char: 'C-master', combo: ['R7-phoenix'] }, { combo: ['U2-river'] }] }));
    eq(s.players.map(p => p.life), [15, 5]);
  });
  card('R7-blood', 'Style: your Red cards cost 1 less', () => {
    const s = setup({ p: [{ hand: ['R9-blood', 'U9-river'], combo: ['R7-blood'] }] });
    eq([cost(s, 0, 'R9-blood'), cost(s, 0, 'U9-river')], [8, 9]);
  });
  card('R8-flame', 'End of clash: gain 6 life', () => {
    eq(clash(setup({ p: [{ combo: ['R8-flame'] }, { combo: ['Y8-flash'] }] })).players[0].life, 16);
  });
  card('R8-phoenix', 'End of clash: another card stays in your combo for next round', () => {
    const s = clash(setup({ p: [{ combo: ['R1-blood', 'R8-phoenix'] }, { life: 20 }] }));
    eq(ids(s, 0, 'combo'), ['R1-blood']);
    ok(has(s, 0, 'discard', 'R8-phoenix'));
  });
  card('R8-blood', 'End of clash: draw 3 (after refilling to 5)', () => {
    eq(clash(setup({ p: [{ combo: ['R8-blood'] }, { combo: ['Y8-flash'] }] })).players[0].hand.length, 8);
  });
  card('R9-flame', 'Costs 1 less per 1 in your combo', () => {
    eq(cost(setup({ p: [{ hand: ['R9-flame'], combo: ['R1-blood', 'R1-flame'] }] }), 0, 'R9-flame'), 7);
  });
  card('R9-phoenix', 'Costs 1 less per life lost this round', () => {
    let s = play(setup({ p: [{ hand: ['R1-flame', 'R9-phoenix'] }] }), 0, 'R1-flame');
    s = act(s, { type: 'debug', op: 'turn', player: 0 });
    eq(cost(s, 0, 'R9-phoenix'), 6);
  });
  card('R9-blood', 'Costs 1 less per power you have', () => {
    eq(cost(setup({ p: [{ hand: ['R9-blood'], power: 4 }] }), 0, 'R9-blood'), 5);
  });
  card('C-asher', 'Asher Smith: playing a Red 1-3 gives +1 power', () => {
    eq(play(setup({ p: [{ char: 'C-asher', hand: ['R3-blood'] }] }), 0, 'R3-blood').players[0].power, 1);
    eq(play(setup({ p: [{ char: 'C-asher', hand: ['R5-flame'] }] }), 0, 'R5-flame').players[0].power, 0);
  });
  card('C-ember', 'Ember: playing an even card lets you play a 1 from discard (its combo enter triggers)', () => {
    const s = play(setup({ p: [{ char: 'C-ember', hand: ['R2-phoenix'], discard: ['R1-phoenix'] }] }), 0, 'R2-phoenix', [pick('R1-phoenix')]);
    eq([ids(s, 0, 'combo'), s.players[0].power], [['R2-phoenix', 'R1-phoenix'], 1]);
  });
  card('C-vlad', 'Vlad Crimson: clash win gains 2 life', () => {
    eq(clash(setup({ p: [{ combo: ['R5-blood'] }, { char: 'C-master', combo: ['R1-blood'] }] })).players.map(p => p.life), [12, 6]);
  });

  // ================================================================= BLUE (Victoria: blue face-downs, no play triggers)
  const V = 'C-victoria';
  card('U1-river', 'Patience; when flipped: opponent loses 2 power', () => {
    const s = play(setup({ p: [{ hand: ['U1-river'] }, { power: 3 }] }), 0, 'U1-river', [YES]);
    eq([s.players[1].power, s.players[0].combo[0].faceDown], [1, true]);
  });
  card('U1-check', 'Combo enter: next to a 1 or 0 -> +1 energy', () => {
    eq(play(setup({ p: [{ hand: ['U1-check'], combo: ['U1-river'], energy: 5 }] }), 0, 'U1-check').players[0].energy, 5);
    eq(play(setup({ p: [{ char: V, hand: ['U1-check'], combo: [D('U5-river')], energy: 5 }] }), 0, 'U1-check').players[0].energy, 5);
    eq(play(setup({ p: [{ hand: ['U1-check'], combo: ['U3-river'], energy: 5 }] }), 0, 'U1-check').players[0].energy, 4);
  });
  card('U1-cyber', 'Patience; when flipped: draw 1 then discard 1', () => {
    const s = play(setup({ p: [{ hand: ['U1-cyber', 'R9-blood'] }] }), 0, 'U1-cyber', [YES, picks('R9-blood')]);
    eq([ids(s, 0, 'hand'), ids(s, 0, 'discard')], [['Y2-flash'], ['R9-blood']]);
  });
  card('U2-river', 'Combo enter: +1 power per face-down card in opponent\'s combo', () => {
    eq(play(setup({ p: [{ hand: ['U2-river'] }, { combo: [D('U1-river'), D('U1-check'), 'U3-river'] }] }), 0, 'U2-river').players[0].power, 2);
  });
  card('U2-check', 'Combo enter: flip a 2-or-less in opponent\'s combo', () => {
    const s = play(setup({ p: [{ hand: ['U2-check'] }, { combo: ['R2-flame', 'R5-flame'] }] }), 0, 'U2-check');
    eq(s.players[1].combo.map(c => c.faceDown), [true, false]);
  });
  card('U2-cyber', 'When flipped: copy a combo enter of another card in your combo', () => {
    const s = play(setup({ p: [{ hand: ['U5-check'], combo: ['U3-river', 'U2-cyber'] }] }), 0, 'U5-check', [pick('U2-cyber'), pick('U3-river')]);
    eq(s.players[0].hand.length, 1, 'River Straight\'s draw was copied');
  });
  card('U3-river', 'Combo enter: draw 1', () => {
    eq(play(setup({ p: [{ hand: ['U3-river'] }] }), 0, 'U3-river').players[0].hand.length, 1);
  });
  card('U3-check', 'Combo enter: mill cards = number of odd-valued cards in both combos', () => {
    const s = play(setup({ p: [{ hand: ['U3-check'], combo: ['U1-river'] }, { combo: ['R3-flame', 'R4-flame'] }] }), 0, 'U3-check');
    eq([s.players[0].discard.length, s.players[0].deck.length], [3, 12]);
  });
  card('U3-cyber', 'Patience; when flipped: flip a 3-or-less in opponent\'s combo', () => {
    const s = play(setup({ p: [{ hand: ['U3-cyber'] }, { combo: ['R3-flame', 'R5-flame'] }] }), 0, 'U3-cyber', [YES]);
    eq(s.players[1].combo.map(c => c.faceDown), [true, false]);
  });
  card('U4-river', 'Patience; when flipped: opponent puts top 2 of their deck face down in their combo', () => {
    const s = play(setup({ p: [{ hand: ['U4-river'] }] }), 0, 'U4-river', [YES]);
    eq([s.players[1].combo.map(c => c.faceDown), s.players[1].deck.length], [[true, true], 13]);
  });
  card('U4-check', 'When flipped (no Patience): opponent puts top 2 face down in their combo', () => {
    const s = play(setup({ p: [{ hand: ['U5-check'], combo: ['U4-check'] }] }), 0, 'U5-check', [pick('U4-check')]);
    eq(s.players[1].combo.length, 2);
    const noPatience = play(setup({ p: [{ hand: ['U4-check'] }] }), 0, 'U4-check');
    ok(!noPatience.players[0].combo[0].faceDown, 'no Patience prompt');
  });
  card('U4-cyber', 'Combo enter: +1 power per face-down card in your combo', () => {
    eq(play(setup({ p: [{ char: V, hand: ['U4-cyber'], combo: [D('U1-river'), D('U2-river')] }] }), 0, 'U4-cyber').players[0].power, 2);
  });
  card('U5-river', 'When flipped: opponent puts a card from hand face down into their combo', () => {
    const s = play(setup({ p: [{ hand: ['U5-check'], combo: ['U5-river'] }, { hand: ['R1-flame', 'R2-flame'] }] }), 0, 'U5-check', [pick('U5-river'), pick('R2-flame')]);
    eq([ids(s, 1, 'combo'), s.players[1].combo[0].faceDown, ids(s, 1, 'hand')], [['R2-flame'], true, ['R1-flame']]);
  });
  card('U5-check', 'Combo enter: flip a card in your combo (its when-flipped triggers)', () => {
    const s = play(setup({ p: [{ hand: ['U5-check'], combo: ['U1-river'] }, { power: 2 }] }), 0, 'U5-check', [pick('U1-river')]);
    eq([s.players[0].combo[0].faceDown, s.players[1].power], [true, 0]);
  });
  card('U5-cyber', 'Combo enter: with two 0s in your combo, flip an opponent\'s card', () => {
    const s = play(setup({ p: [{ char: V, hand: ['U5-cyber'], combo: [D('U1-river'), D('U1-check')] }, { combo: ['R4-flame'] }] }), 0, 'U5-cyber');
    eq(s.players[1].combo[0].faceDown, true);
    const one = play(setup({ p: [{ char: V, hand: ['U5-cyber'], combo: [D('U1-river')] }, { combo: ['R4-flame'] }] }), 0, 'U5-cyber');
    eq(one.players[1].combo[0].faceDown, false);
  });
  card('U6-river', 'Patience; when flipped: mill 3', () => {
    const s = play(setup({ p: [{ hand: ['U6-river'] }] }), 0, 'U6-river', [YES]);
    eq([s.players[0].discard.length, s.players[0].deck.length], [3, 12]);
  });
  card('U6-check', 'Combo enter: if opponent has more power, they lose 3 power', () => {
    eq(play(setup({ p: [{ hand: ['U6-check'], power: 1 }, { power: 5 }] }), 0, 'U6-check').players[1].power, 2);
  });
  card('U6-cyber', 'Combo enter: +1 power per face-down in both combos', () => {
    eq(play(setup({ p: [{ char: V, hand: ['U6-cyber'], combo: [D('U1-river')] }, { combo: [D('R1-flame'), D('R2-flame')] }] }), 0, 'U6-cyber').players[0].power, 3);
  });
  card('U7-river', 'Combo enter: mill X = your power', () => {
    eq(play(setup({ p: [{ hand: ['U7-river'], power: 4 }] }), 0, 'U7-river').players[0].discard.length, 4);
  });
  card('U7-check', 'Combo enter: next to a 0, opponent flips one of their cards (their choice)', () => {
    const s = play(setup({ p: [{ char: V, hand: ['U7-check'], combo: [D('U1-river')] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'U7-check', [pick('R2-flame')]);
    eq(s.players[1].combo.map(c => c.faceDown), [false, true]);
  });
  card('U7-cyber', 'Combo enter: gain life = face-down cards in all combos', () => {
    eq(play(setup({ p: [{ char: V, hand: ['U7-cyber'], combo: [D('U1-river')] }, { combo: [D('R1-flame'), D('R2-flame')] }] }), 0, 'U7-cyber').players[0].life, 13);
  });
  card('U8-river', 'Start of clash: may flip a combo card; it stays for next round', () => {
    const s = clash(setup({ p: [{ combo: ['U1-check', 'U8-river'] }, { combo: ['Y1-sun'] }] }), [pick('U1-check')]);
    eq([ids(s, 0, 'combo'), s.players[0].combo[0].faceDown], [['U1-check'], true]);
  });
  card('U8-check', 'End of clash: if you dealt 2 or less damage, draw 2', () => {
    eq(clash(setup({ p: [{ combo: ['U8-check'] }, { combo: ['Y8-flash'] }] })).players[0].hand.length, 7);
    eq(clash(setup({ p: [{ combo: ['U8-check'] }, { combo: ['Y1-flash'] }] })).players[0].hand.length, 5, 'dealt 7: no draw');
  });
  card('U8-cyber', 'Combo enter: with two 0s in your combo, opponent loses 2 energy', () => {
    eq(play(setup({ p: [{ char: V, hand: ['U8-cyber'], combo: [D('U1-river'), D('U2-river')] }] }), 0, 'U8-cyber').players[1].energy, 8);
  });
  card('U9-river', 'Combo enter: return all your face-down cards to hand, +1 energy each', () => {
    const s = play(setup({ p: [{ char: V, hand: ['U9-river'], combo: [D('U1-river'), D('U2-river')] }] }), 0, 'U9-river');
    eq([ids(s, 0, 'hand'), s.players[0].energy], [['U1-river', 'U2-river'], 3]);
  });
  card('U9-check', 'Combo enter (ruling): next to a 0, flip one card 4 times: its "when flipped" triggers 4 times', () => {
    // Your own River Jab: the opponent loses 2 Power, four times. Only that card is flipped.
    const s = play(setup({ p: [{ char: V, hand: ['U9-check'], combo: ['U1-river', D('U2-river')] }, { combo: ['R1-flame'], power: 10 }] }), 0, 'U9-check',
      [pick('U1-river')]);
    eq([s.players[1].power, T.find(s, 0, 'combo', 'U1-river').faceDown, s.players[1].combo[0].faceDown], [2, true, false]);
    eq(T.logText(s).filter(l => l.startsWith('River Jab (when flipped)')).length, 4, 'triggered 4 times');
    // Draw-then-discard Patience card: 4 draws and 4 discards.
    const c = play(setup({ p: [{ char: V, hand: ['U9-check'], combo: ['U1-cyber', D('U2-river')] }] }), 0, 'U9-check',
      [pick('U1-cyber')]);   // each discard is automatic: only the card just drawn is in hand
    eq([c.players[0].hand.length, c.players[0].discard.length], [0, 4]);
    // A card without a "when flipped" ability is just flipped.
    const r = play(setup({ p: [{ char: V, hand: ['U9-check'], combo: [D('U1-river')] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'U9-check', [pick('R1-flame')]);
    eq(r.players[1].combo.map(x => x.faceDown), [true, false]);
    logHas(r, 'so the other 3 flips do nothing');
    // Not next to a 0: nothing.
    const n = play(setup({ p: [{ char: V, hand: ['U9-check'], combo: ['U9-river'] }, { combo: ['R1-flame'] }] }), 0, 'U9-check');
    eq(n.players[1].combo[0].faceDown, false);
  });
  card('U9-check', 'Ruling: picking an opponent\'s card triggers it for them; Flash Jab stops all four flips', () => {
    const base = () => setup({ p: [{ char: V, hand: ['U9-check'], combo: [D('U2-river')], power: 10 }, { combo: ['Y1-flash', 'U1-river'] }] });
    const used = play(base(), 0, 'U9-check', [pick('U1-river'), YES]);
    eq([used.players[0].power, T.find(used, 1, 'combo', 'U1-river').faceDown, T.has(used, 1, 'discard', 'Y1-flash')], [10, false, true]);
    const declined = play(base(), 0, 'U9-check', [pick('U1-river'), NO]);
    eq(declined.players[0].power, 2, 'River Jab is theirs: Player 1 loses 2 Power four times');
  });
  card('U9-cyber', 'Costs 2 less per face-down card in your combo', () => {
    eq(cost(setup({ p: [{ hand: ['U9-cyber'], combo: [D('U1-river'), D('U2-river')] }] }), 0, 'U9-cyber'), 5);
  });
  card('C-spring', 'Spring Azula: Blue 4+ flips opponent\'s last card; start of clash +1 power per opponent face-down', () => {
    const s = play(setup({ p: [{ char: 'C-spring', hand: ['U4-cyber'] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'U4-cyber');
    eq(s.players[1].combo.map(c => c.faceDown), [false, true]);
    const c = clash(setup({ p: [{ char: 'C-spring' }, { combo: [D('R1-flame'), D('R2-flame')] }] }));
    eq(c.players[1].life, 8);
  });
  card('C-cian', 'Cian Hack: odd card is flipped after its abilities; take a 2 from discard', () => {
    const s = play(setup({ p: [{ char: 'C-cian', hand: ['U3-river'], discard: ['R2-flame'] }] }), 0, 'U3-river');
    eq([s.players[0].combo[0].faceDown, ids(s, 0, 'hand').sort()], [true, ['R2-flame', 'Y2-flash']]);
  });
  card('C-victoria', 'Victoria Castle: end of clash draw 2 extra; clash win deals only 1', () => {
    const s = clash(setup({ p: [{ char: V, combo: ['U9-river'] }, { combo: ['U1-river'] }] }));
    eq([s.players[1].life, s.players[0].hand.length], [9, 7]);
  });

  // ================================================================= YELLOW
  const M = 'C-master';   // yellow face-downs, only start-of-clash abilities
  card('Y1-sun', 'When discarded: opponent +2 power, you +1 energy', () => {
    const s = discardViaEngage(setup({ p: [{ hand: ['Y1-sun'], energy: 5 }] }), 'Y1-sun');
    eq([s.players[1].power, s.players[0].energy], [2, 6]);
  });
  card('Y1-lion', 'When discarded: +1 power', () => {
    eq(discardViaEngage(setup({ p: [{ hand: ['Y1-lion'] }] }), 'Y1-lion').players[0].power, 1);
  });
  card('Y1-flash', 'Reaction Feint: discard it instead of one of your cards being flipped', () => {
    const s = play(setup({ turn: 1, p: [{ combo: ['Y1-flash', 'Y3-lion'] }, { hand: ['R5-phoenix'] }] }), 1, 'R5-phoenix', [pick('Y3-lion'), YES]);
    eq([ids(s, 0, 'combo'), s.players[0].combo[0].faceDown, ids(s, 0, 'discard')], [['Y3-lion'], false, ['Y1-flash']]);
  });
  card('Y2-sun', 'Combo enter: +1 power per 2 cards in hand', () => {
    eq(play(setup({ p: [{ hand: ['Y2-sun', 'R1-flame', 'R2-flame', 'R3-flame', 'R4-flame', 'R5-flame'] }] }), 0, 'Y2-sun').players[0].power, 2);
  });
  card('Y2-lion', 'Combo enter or when flipped: next to a 2 -> +2 power', () => {
    eq(play(setup({ p: [{ hand: ['Y2-lion'], combo: ['Y2-flash'] }] }), 0, 'Y2-lion').players[0].power, 2);
    const s = play(setup({ turn: 1, p: [{ combo: ['Y2-flash', 'Y2-lion'] }, { hand: ['R5-phoenix'] }] }), 1, 'R5-phoenix', [pick('Y2-lion')]);
    eq(s.players[0].power, 2, 'when flipped');
  });
  const zeroTest = id => () => {
    const s = setup({ p: [{ hand: [id, 'U2-river'], combo: [D('R1-flame')] }] });
    ok(canPlay(s, 0, id).ok, 'playable next to a 0 of another color');
    ok(!canPlay(s, 0, 'U2-river').ok, 'a normal card is not');
    ok(!canPlay(setup({ p: [{ hand: [id], combo: ['U1-river'] }] }), 0, id).ok, 'still needs a match next to non-zero');
  };
  card('Y2-flash', 'Can be played next to a 0 regardless of color', zeroTest('Y2-flash'));
  card('Y3-sun', 'Combo enter or flipped: end of a 3-card run -> draw 1', () => {
    eq(play(setup({ p: [{ hand: ['Y3-sun'], combo: ['Y1-lion', 'Y2-lion'] }] }), 0, 'Y3-sun').players[0].hand.length, 1);
    eq(play(setup({ p: [{ hand: ['Y3-sun'], combo: ['Y1-lion', 'Y5-lion'] }] }), 0, 'Y3-sun').players[0].hand.length, 0);
  });
  card('Y3-lion', 'Combo enter: next to a 0, opponent loses 2 power', () => {
    eq(play(setup({ p: [{ char: M, hand: ['Y3-lion'], combo: [D('Y1-sun')] }, { power: 3 }] }), 0, 'Y3-lion').players[1].power, 1);
  });
  card('Y3-flash', 'Can be played next to a 0 regardless of color', zeroTest('Y3-flash'));
  card('Y4-sun', 'Ruling: reaction Feint - when you discard another card, discard Sun Cross to return it', () => {
    const s = engage(setup({ p: [{ combo: ['Y4-sun'], hand: ['Y9-sun'] }] }), 0, 1, [picks('Y9-sun'), YES]);
    eq([ids(s, 0, 'hand').sort(), ids(s, 0, 'discard'), ids(s, 0, 'combo'), s.turn], [['Y2-flash', 'Y9-sun'], ['Y4-sun'], [], 1]);
  });
  card('Y4-lion', 'Can be played next to a 0 regardless of color', zeroTest('Y4-lion'));
  card('Y4-flash', 'Combo enter: turn a face-down card up; 4+ goes to hand, 3- stays', () => {
    const s = play(setup({ p: [{ char: M, hand: ['Y4-flash'], combo: [D('Y9-flash')] }] }), 0, 'Y4-flash');
    eq([ids(s, 0, 'hand'), ids(s, 0, 'combo')], [['Y9-flash'], ['Y4-flash']]);
    const s2 = play(setup({ p: [{ char: M, hand: ['Y4-flash'], combo: [D('Y2-sun')] }] }), 0, 'Y4-flash');
    eq([ids(s2, 0, 'combo'), s2.players[0].combo[0].faceDown], [['Y2-sun', 'Y4-flash'], false]);
  });
  card('Y5-sun', 'Can be played next to a 0 regardless of color', zeroTest('Y5-sun'));
  card('Y5-lion', 'Style: whenever you discard a card, +1 energy', () => {
    eq(engage(setup({ p: [{ combo: ['Y5-lion'], hand: ['R1-flame'], energy: 5 }] }), 0, 2, [picks('Y2-flash', 'Y2-flash')]).players[0].energy, 7);
  });
  card('Y5-flash', 'Combo enter: next to a 0 -> +3 power', () => {
    eq(play(setup({ p: [{ char: M, hand: ['Y5-flash'], combo: [D('Y1-sun')] }] }), 0, 'Y5-flash').players[0].power, 3);
  });
  card('Y6-sun', 'Combo enter: discard one of yours to discard an opponent\'s 5-or-less', () => {
    const s = play(setup({ p: [{ hand: ['Y6-sun'], combo: ['Y1-lion'] }, { combo: ['R5-flame', 'R9-flame'] }] }), 0, 'Y6-sun', [pick('Y1-lion')]);
    eq([ids(s, 1, 'combo'), ids(s, 1, 'discard'), s.players[0].power], [['R9-flame'], ['R5-flame'], 1]);
  });
  card('Y6-lion', 'Combo enter: next to a 0, opponent puts their top card face down in their combo', () => {
    const s = play(setup({ p: [{ char: M, hand: ['Y6-lion'], combo: [D('Y1-sun')] }] }), 0, 'Y6-lion');
    eq([s.players[1].combo.length, s.players[1].combo[0].faceDown, s.players[1].deck.length], [1, true, 14]);
  });
  card('Y6-flash', 'Can be played next to a 0 regardless of color', zeroTest('Y6-flash'));
  card('Y7-sun', 'When discarded: +3 energy', () => {
    eq(discardViaEngage(setup({ p: [{ hand: ['Y7-sun'], energy: 5 }] }), 'Y7-sun').players[0].energy, 8);
  });
  card('Y7-lion', 'Combo enter: may discard two combo cards to gain +2 energy', () => {
    const s = play(setup({ p: [{ hand: ['Y7-lion'], combo: ['Y2-flash', 'Y3-flash'] }] }), 0, 'Y7-lion', [YES, picks('Y2-flash', 'Y3-flash')]);
    eq([ids(s, 0, 'combo'), s.players[0].energy], [['Y7-lion'], 5]);
  });
  card('Y7-flash', 'Can be played next to a 0 regardless of color', zeroTest('Y7-flash'));
  card('Y8-sun', 'Combo enter: discard a card in the opponent\'s combo', () => {
    const s = play(setup({ p: [{ hand: ['Y8-sun'] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'Y8-sun', [pick('R2-flame')]);
    eq(ids(s, 1, 'combo'), ['R1-flame']);
  });
  card('Y8-lion', 'Combo enter: turn a face-down card in your combo face up', () => {
    const s = play(setup({ p: [{ char: M, hand: ['Y8-lion'], combo: [D('Y1-sun')] }] }), 0, 'Y8-lion');
    eq(s.players[0].combo[0].faceDown, false);
  });
  card('Y8-flash', 'When discarded: +4 power', () => {
    eq(discardViaEngage(setup({ p: [{ hand: ['Y8-flash'] }] }), 'Y8-flash').players[0].power, 4);
  });
  card('Y9-sun', 'Combo enter: discard hand, draw 5', () => {
    const s = play(setup({ p: [{ hand: ['Y9-sun', 'R1-flame', 'R2-flame'] }] }), 0, 'Y9-sun');
    eq([s.players[0].hand.length, s.players[0].discard.length], [5, 2]);
  });
  card('Y9-lion', 'Ruling: costs 1 less per card YOU discarded this round (opponent\'s don\'t count)', () => {
    let t = setup({ p: [{ hand: ['Y9-lion'] }] });
    t = engage(t, 0, 2, [picks('Y2-flash', 'Y2-flash')]);
    t = act(t, { type: 'debug', op: 'turn', player: 1 });
    t = engage(t, 1, 2);
    eq(t.round, 1);
    eq(cost(t, 0, 'Y9-lion'), 7);
  });
  card('Y9-flash', 'When discarded: shuffle your whole discard pile (face down) into your deck', () => {
    const s = discardViaEngage(setup({ p: [{ hand: ['Y9-flash'], discard: ['R1-flame', 'R2-flame'] }] }), 'Y9-flash');
    eq([s.players[0].discard.length, s.players[0].deck.length], [0, 17]);
    ok(s.players[0].deck.some(c => c.id === 'Y9-flash'));
  });
  card('C-sonny', 'Sonny Lee: Yellow play: less power -> +1; more power -> draw then discard', () => {
    eq(play(setup({ p: [{ char: 'C-sonny', hand: ['Y2-flash'] }, { power: 2 }] }), 0, 'Y2-flash').players[0].power, 1);
    const s = play(setup({ p: [{ char: 'C-sonny', hand: ['Y2-flash', 'R9-flame'], power: 3 }] }), 0, 'Y2-flash', [picks('R9-flame')]);
    eq(ids(s, 0, 'discard'), ['R9-flame']);
  });
  card('C-leo', 'Leo Wildheart: odd -> top deck card into combo; even -> may take a face-down back', () => {
    const s = play(setup({ p: [{ char: 'C-leo', hand: ['Y1-lion'] }] }), 0, 'Y1-lion');
    eq(ids(s, 0, 'combo'), ['Y1-lion', 'Y2-flash']);
    const s2 = play(setup({ p: [{ char: 'C-leo', hand: ['Y2-sun'], combo: [D('R1-flame')] }] }), 0, 'Y2-sun', [pick('R1-flame')]);
    eq(ids(s2, 0, 'hand'), ['R1-flame']);
  });
  card('C-master', 'Master Leo: run of 3 -> +3 power; run of 5 -> discard an opponent\'s combo card', () => {
    eq(clash(setup({ p: [{ char: M, combo: ['Y1-sun', 'Y2-sun', 'Y3-sun'] }, { combo: ['Y8-flash'] }] })).players[1].life, 9);
    const s = clash(setup({ p: [{ char: M, combo: ['Y1-sun', 'Y2-sun', 'Y3-sun', 'Y4-sun', 'Y5-sun'] }, { combo: ['R9-flame', 'R1-flame'], life: 30 }] }), [pick('R9-flame')]);
    eq(s.players[1].life, 30 - (15 + 3 - 1));
  });

  // ================================================================= GREEN
  card('G1-forest', 'Combo enter: your combo total > 10 -> +2 energy', () => {
    eq(play(setup({ p: [{ hand: ['G1-forest'], combo: ['G5-forest', 'G6-forest'], energy: 5 }] }), 0, 'G1-forest').players[0].energy, 6);
    eq(play(setup({ p: [{ hand: ['G1-forest'], combo: ['G5-forest'], energy: 5 }] }), 0, 'G1-forest').players[0].energy, 4);
  });
  card('G1-mantis', 'If the opponent would discard a card from your combo, discard Mantis Jab instead', () => {
    const s = play(setup({ turn: 1, p: [{ combo: ['G1-mantis', 'G4-forest'] }, { hand: ['Y8-sun'] }] }), 1, 'Y8-sun', [pick('G4-forest'), YES]);
    eq([ids(s, 0, 'combo'), ids(s, 0, 'discard')], [['G4-forest'], ['G1-mantis']]);
  });
  card('G1-life', 'If the opponent would flip a card in your combo, discard Life Jab instead', () => {
    const s = play(setup({ turn: 1, p: [{ combo: ['G1-life', 'G4-forest'] }, { hand: ['R5-phoenix'] }] }), 1, 'R5-phoenix', [pick('G4-forest'), YES]);
    eq([ids(s, 0, 'combo'), s.players[0].combo[0].faceDown], [['G4-forest'], false]);
  });
  card('G2-forest', 'Combo enter: gain life = your power', () => {
    eq(play(setup({ p: [{ hand: ['G2-forest'], power: 3 }] }), 0, 'G2-forest').players[0].life, 13);
  });
  card('G2-mantis', 'Patience; when flipped: mill 2 face down', () => {
    const s = play(setup({ p: [{ hand: ['G2-mantis'] }] }), 0, 'G2-mantis', [YES]);
    eq(s.players[0].discard.map(c => c.faceDown), [true, true]);
  });
  card('G2-life', 'Combo enter: your combo total > opponent\'s -> +2 power', () => {
    eq(play(setup({ p: [{ hand: ['G2-life'], combo: ['G9-forest'] }, { combo: ['R5-flame'] }] }), 0, 'G2-life').players[0].power, 2);
    eq(play(setup({ p: [{ hand: ['G2-life'] }, { combo: ['R5-flame'] }] }), 0, 'G2-life').players[0].power, 0);
  });
  card('G3-forest', 'Combo enter: opponent\'s last card is 0 -> +2 energy', () => {
    eq(play(setup({ p: [{ hand: ['G3-forest'] }, { combo: [D('R1-flame')] }] }), 0, 'G3-forest').players[0].energy, 9);
    eq(play(setup({ p: [{ hand: ['G3-forest'] }, { combo: ['R1-flame'] }] }), 0, 'G3-forest').players[0].energy, 7);
  });
  card('G3-mantis', 'Style: when you play a card, may pay 1 energy so each player draws', () => {
    const s = play(setup({ p: [{ hand: ['G4-forest'], combo: ['G3-mantis'] }] }), 0, 'G4-forest', [YES]);
    eq([s.players[0].energy, s.players[0].hand.length, s.players[1].hand.length], [5, 1, 1]);
  });
  card('G3-life', 'Combo enter: may discard a combo card for +1 energy', () => {
    eq(play(setup({ p: [{ hand: ['G3-life'], combo: ['G1-forest'] }] }), 0, 'G3-life', [pick('G1-forest')]).players[0].energy, 8);
  });
  card('G4-forest', 'End of clash: +3 energy, can exceed max', () => {
    eq(clash(setup({ p: [{ combo: ['G4-forest'] }, { combo: ['Y4-lion'] }] })).players[0].energy, 13);
  });
  card('G4-mantis', 'Style: cards in your combo can\'t be moved (reordered/swapped)', () => {
    const s = play(setup({ turn: 1, p: [{ combo: ['G4-mantis', 'G1-forest'] }, { hand: ['K4-umbra'] }] }), 1, 'K4-umbra');
    eq(ids(s, 0, 'combo'), ['G4-mantis', 'G1-forest']);
  });
  card('G4-life', 'Combo enter: at the end of a run -> +5 energy', () => {
    eq(play(setup({ p: [{ hand: ['G4-life'], combo: ['G2-forest', 'G3-forest'], energy: 5 }] }), 0, 'G4-life').players[0].energy, 6);
  });
  card('G5-forest', 'Combo enter: next to a 5, look at top 2: discard one face down, play the other free', () => {
    const s = play(setup({ p: [{ hand: ['G5-forest'], combo: ['G5-mantis'], deck: ['G1-forest', 'G2-life'] }] }), 0, 'G5-forest', [pick('G2-life')]);
    eq([ids(s, 0, 'combo'), s.players[0].discard[0].faceDown, s.players[0].energy], [['G5-mantis', 'G5-forest', 'G1-forest'], true, 7]);
  });
  card('G5-mantis', 'Patience; when flipped: may discard 2 face down for +3 energy', () => {
    const s = play(setup({ p: [{ hand: ['G5-mantis', 'R1-flame', 'R2-flame'] }] }), 0, 'G5-mantis', [YES, YES]);
    eq([s.players[0].energy, s.players[0].discard.map(c => c.faceDown)], [8, [true, true]]);
  });
  card('G5-life', 'Combo enter: pay 10 - neighbor value to draw 2', () => {
    const s = play(setup({ p: [{ hand: ['G5-life'], combo: ['G3-forest'], energy: 20 }] }), 0, 'G5-life', [YES]);
    eq([s.players[0].energy, s.players[0].hand.length], [8, 2]);
  });
  card('G6-forest', 'Combo enter: next to a 6 -> +6 power', () => {
    eq(play(setup({ p: [{ hand: ['G6-forest'], combo: ['G6-life'] }] }), 0, 'G6-forest').players[0].power, 6);
  });
  card('G6-mantis', 'Reaction Feint: opponent plays a 4-or-less -> they discard a card from their combo', () => {
    const s = play(setup({ p: [{ hand: ['R2-phoenix'] }, { combo: ['G6-mantis'] }] }), 0, 'R2-phoenix', [YES]);
    eq([ids(s, 0, 'combo'), ids(s, 1, 'discard')], [[], ['G6-mantis']]);
    const big = play(setup({ p: [{ hand: ['R5-flame'] }, { combo: ['G6-mantis'] }] }), 0, 'R5-flame');
    eq(ids(big, 1, 'combo'), ['G6-mantis'], 'no trigger on a 5');
  });
  card('G6-life', 'Combo enter: all your numbers greater than the opponent\'s -> +4 power', () => {
    eq(play(setup({ p: [{ hand: ['G6-life'], combo: ['G7-forest'] }, { combo: ['R5-flame'] }] }), 0, 'G6-life').players[0].power, 4);
    eq(play(setup({ p: [{ hand: ['G6-life'], combo: ['G7-forest'] }, { combo: ['R7-flame'] }] }), 0, 'G6-life').players[0].power, 0);
  });
  card('G7-forest', 'Combo enter: reorder both combos', () => {
    const s = play(setup({ p: [{ hand: ['G7-forest'], combo: ['G1-forest', 'G2-forest'] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'G7-forest',
      [pick('G7-forest'), pick('G1-forest'), pick('R2-flame')]);
    eq([ids(s, 0, 'combo'), ids(s, 1, 'combo')], [['G7-forest', 'G1-forest', 'G2-forest'], ['R2-flame', 'R1-flame']]);
  });
  card('G7-mantis', 'Free if it is your only card and the opponent has more power', () => {
    eq(cost(setup({ p: [{ hand: ['G7-mantis'] }, { power: 3 }] }), 0, 'G7-mantis'), 0);
    eq(cost(setup({ p: [{ hand: ['G7-mantis', 'R1-flame'] }, { power: 3 }] }), 0, 'G7-mantis'), 7);
  });
  card('G7-life', 'Combo enter: each player discards 2 random cards face up', () => {
    const s = play(setup({ p: [{ hand: ['G7-life', 'R1-flame', 'R2-flame', 'R3-flame'] }, { hand: ['U1-river', 'U2-river', 'U3-river'] }] }), 0, 'G7-life');
    eq([s.players[0].hand.length, s.players[1].hand.length, s.players[1].discard.every(c => !c.faceDown)], [1, 1, true]);
  });
  card('G8-forest', 'Start of clash: more pairs than opponent -> +6 power', () => {
    eq(clash(setup({ p: [{ combo: ['G2-forest', 'G2-life', 'G8-forest'] }, { combo: ['Y8-flash'], life: 20 }] })).players[1].life, 10);
  });
  card('G8-mantis', 'Style: engaging without starting a clash gives +1 energy', () => {
    eq(engage(setup({ p: [{ combo: ['G8-mantis'], energy: 5 }] }), 0, 0).players[0].energy, 6);
  });
  card('G8-life', 'Combo enter: return another combo card to hand, gain its value + 1 energy', () => {
    const s = play(setup({ p: [{ hand: ['G8-life'], combo: ['G5-forest'] }] }), 0, 'G8-life');
    eq([ids(s, 0, 'hand'), s.players[0].energy], [['G5-forest'], 8]);
  });
  card('G9-forest', 'Combo enter: copy another card\'s combo enter', () => {
    eq(play(setup({ p: [{ hand: ['G9-forest'], combo: ['G2-forest'], power: 3 }] }), 0, 'G9-forest').players[0].life, 13);
  });
  card('G9-mantis', 'Costs 1 less per 3 cards in your discard', () => {
    eq(cost(setup({ p: [{ hand: ['G9-mantis'], discard: ['R1-flame', 'R1-flame', 'R1-flame', 'R2-flame', 'R2-flame', 'R2-flame', 'R3-flame'] }] }), 0, 'G9-mantis'), 7);
  });
  card('G9-life', 'Combo enter: spend any energy, +5 power each', () => {
    eq(play(setup({ p: [{ hand: ['G9-life'] }] }), 0, 'G9-life', [1]).players[0].power, 5);
  });
  card('C-forest', 'Ruling: Forest Oak gains +1 energy only when the Green card is EXACTLY 3 higher', () => {
    eq(play(setup({ p: [{ char: 'C-forest', hand: ['G5-forest'] }, { combo: ['R2-flame'] }] }), 0, 'G5-forest').players[0].energy, 6);
    eq(play(setup({ p: [{ char: 'C-forest', hand: ['G5-forest'] }, { combo: ['R1-flame'] }] }), 0, 'G5-forest').players[0].energy, 5);
  });
  card('C-young', 'Young Joey Sprout: even play mills 1 face down; 5 face-down in discard -> max energy 18', () => {
    const s = play(setup({ p: [{ char: 'C-young', hand: ['G2-forest'] }] }), 0, 'G2-forest');
    eq(s.players[0].discard.map(c => c.faceDown), [true]);
    const c = clash(setup({ p: [{ char: 'C-young', discard: [D('R1-flame'), D('R1-flame'), D('R1-flame'), D('R1-flame'), D('R1-flame')] }] }));
    eq(c.players[0].maxEnergy, 18);
  });
  card('C-jack', 'Jack Spades: playing a pair gives +1 energy', () => {
    eq(play(setup({ p: [{ char: 'C-jack', hand: ['G3-life'], combo: ['G3-forest'] }] }), 0, 'G3-life', [NONE]).players[0].energy, 8);
  });

  // ================================================================= BLACK
  card('K1-umbra', 'Patience; when flipped: opponent flips the first card of their combo', () => {
    const s = play(setup({ p: [{ hand: ['K1-umbra'] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'K1-umbra', [YES]);
    eq(s.players[1].combo.map(c => c.faceDown), [true, false]);
  });
  card('K1-ink', 'Can be played next to any color', () => {
    const s = setup({ p: [{ hand: ['K1-ink', 'K2-umbra'], combo: ['R5-flame'] }] });
    ok(canPlay(s, 0, 'K1-ink').ok && !canPlay(s, 0, 'K2-umbra').ok);
  });
  card('K1-death', 'When flipped: draw if 3+ colors in your combo', () => {
    const s = play(setup({ p: [{ char: 'C-noct', hand: ['U5-check'], combo: ['R1-flame', 'K1-death', 'U1-river'] }] }), 0, 'U5-check', [pick('K1-death')]);
    eq(s.players[0].hand.length, 1);
  });
  const plantTest = id => () => {
    const s = play(setup({ p: [{ hand: [id], discard: ['R9-flame'] }] }), 0, id);
    eq([ids(s, 1, 'combo'), s.players[1].combo[0].owner], [['R9-flame'], 0]);
  };
  card('K2-umbra', 'Combo enter: put a card from your discard into the opponent\'s combo', plantTest('K2-umbra'));
  card('K2-ink', 'Style (sabotage): cards cost 1 more to play into the combo it is in', () => {
    const s = setup({ turn: 1, p: [{}, { hand: ['R3-flame'], combo: [{ id: 'K2-ink', owner: 0 }] }] });
    eq(cost(s, 1, 'R3-flame'), 4);
  });
  card('K2-death', 'Combo enter: flip a Black card', () => {
    const s = play(setup({ p: [{ hand: ['K2-death'] }, { combo: ['K5-umbra'] }] }), 0, 'K2-death', [pick('K5-umbra')]);
    eq(s.players[1].combo[0].faceDown, true);
  });
  card('K3-umbra', 'Forced: discarded when a card greater than 3 is played into its combo', () => {
    const s = play(setup({ turn: 1, p: [{}, { hand: ['K5-umbra'], combo: ['K3-umbra'] }] }), 1, 'K5-umbra');
    eq([ids(s, 1, 'combo'), ids(s, 1, 'discard')], [['K5-umbra'], ['K3-umbra']]);
    const small = play(setup({ turn: 1, p: [{}, { hand: ['K2-umbra'], combo: ['K3-umbra'] }] }), 1, 'K2-umbra');
    ok(has(small, 1, 'combo', 'K3-umbra'), 'stays for a 2');
  });
  card('K3-ink', 'Combo enter: put a card from your discard into the opponent\'s combo', plantTest('K3-ink'));
  card('K3-death', 'Combo enter: may flip a combo card to draw 2 then discard 1', () => {
    const s = play(setup({ p: [{ hand: ['K3-death', 'R1-flame'], combo: ['K1-ink'] }] }), 0, 'K3-death', [pick('K1-ink'), picks('R1-flame')]);
    eq([s.players[0].combo[0].faceDown, ids(s, 0, 'discard'), s.players[0].hand.length], [true, ['R1-flame'], 2]);
  });
  card('K4-umbra', 'Combo enter: opponent swaps first and last combo cards', () => {
    const s = play(setup({ p: [{ hand: ['K4-umbra'] }, { combo: ['R1-flame', 'R2-flame', 'R3-flame'] }] }), 0, 'K4-umbra');
    eq(ids(s, 1, 'combo'), ['R3-flame', 'R2-flame', 'R1-flame']);
  });
  card('K4-ink', 'When flipped: return a face-down card from your combo to hand', () => {
    const s = play(setup({ p: [{ hand: ['K2-death'], combo: ['K4-ink'] }] }), 0, 'K2-death', [pick('K4-ink')]);
    eq(ids(s, 0, 'hand'), ['K4-ink']);
  });
  card('K4-death', 'Combo enter: put a card from your discard into the opponent\'s combo', plantTest('K4-death'));
  card('K5-umbra', 'Also Blue', () => {
    ok(canPlay(setup({ p: [{ hand: ['K5-umbra'], combo: ['U3-river'] }] }), 0, 'K5-umbra').ok);
  });
  card('K5-ink', 'Also Red', () => {
    ok(canPlay(setup({ p: [{ hand: ['K5-ink'], combo: ['R3-flame'] }] }), 0, 'K5-ink').ok);
  });
  card('K5-death', 'Also Green', () => {
    ok(canPlay(setup({ p: [{ hand: ['K5-death'], combo: ['G3-forest'] }] }), 0, 'K5-death').ok);
    ok(!canPlay(setup({ p: [{ hand: ['K5-death'], combo: ['Y3-sun'] }] }), 0, 'K5-death').ok);
  });
  card('K6-umbra', 'Combo enter: rearrange the opponent\'s combo', () => {
    const s = play(setup({ p: [{ hand: ['K6-umbra'] }, { combo: ['R1-flame', 'R2-flame'] }] }), 0, 'K6-umbra', [pick('R2-flame')]);
    eq(ids(s, 1, 'combo'), ['R2-flame', 'R1-flame']);
  });
  card('K6-ink', 'Style (sabotage): cards entering its combo don\'t trigger combo enter', () => {
    const s = play(setup({ turn: 1, p: [{}, { hand: ['K7-umbra'], combo: [{ id: 'K6-ink', owner: 0 }] }] }), 1, 'K7-umbra');
    eq(s.players[1].hand.length, 0, 'Umbra Snap drew nothing');
  });
  card('K6-death', 'Combo enter: put a card from your discard into the opponent\'s combo', plantTest('K6-death'));
  card('K7-umbra', 'Combo enter: draw 2', () => {
    eq(play(setup({ p: [{ hand: ['K7-umbra'] }] }), 0, 'K7-umbra').players[0].hand.length, 2);
  });
  card('K7-ink', 'Combo enter: flip all other combo cards; then put top 2 face down in combo', () => {
    const s = play(setup({ p: [{ hand: ['K7-ink'], combo: ['K5-umbra', 'K5-ink'] }] }), 0, 'K7-ink');
    eq(s.players[0].combo.map(c => c.faceDown), [true, true, false, true, true]);
  });
  card('K7-death', 'Combo enter: with 2+ face-down cards, turn one face up', () => {
    const s = play(setup({ p: [{ char: 'C-noct', hand: ['K7-death'], combo: [D('R1-flame'), D('K5-ink')] }] }), 0, 'K7-death', [pick('K5-ink')]);
    eq(s.players[0].combo.map(c => c.faceDown), [true, false, false]);
  });
  card('K8-umbra', 'Style: cards in its combo can\'t be flipped', () => {
    const s = play(setup({ turn: 1, p: [{ combo: ['K8-umbra', 'K5-ink'] }, { hand: ['R5-phoenix'] }] }), 1, 'R5-phoenix', [pick('K5-ink')]);
    ok(s.players[0].combo.every(c => !c.faceDown));
  });
  card('K8-ink', 'Style (sabotage): combo owner mills 1 whenever they play a card into it', () => {
    const s = play(setup({ turn: 1, p: [{}, { hand: ['K5-umbra'], combo: [{ id: 'K8-ink', owner: 0 }] }] }), 1, 'K5-umbra');
    eq([s.players[1].discard.length, s.players[1].deck.length], [1, 14]);
  });
  card('K8-death', 'Combo enter: play up to five 1s of different colors from discard (effects resolve)', () => {
    const s = play(setup({ p: [{ hand: ['K8-death'], discard: ['R1-phoenix', 'Y1-lion', 'R1-blood', 'U1-check'] }] }), 0, 'K8-death', [pick('R1-phoenix'), pick('Y1-lion'), NONE]);
    eq([ids(s, 0, 'combo'), s.players[0].power, ids(s, 0, 'discard')], [['K8-death', 'R1-phoenix', 'Y1-lion'], 1, ['R1-blood', 'U1-check']]);
  });
  card('K9-umbra', 'Combo enter: put a card from your discard face down in your combo', () => {
    const s = play(setup({ p: [{ hand: ['K9-umbra'], discard: ['R9-flame'] }] }), 0, 'K9-umbra');
    eq([ids(s, 0, 'combo'), s.players[0].combo[1].faceDown], [['K9-umbra', 'R9-flame'], true]);
  });
  card('K9-ink', 'Combo enter: discard itself; end of clash: stays in combo if still there', () => {
    const s = play(setup({ p: [{ hand: ['K9-ink'] }] }), 0, 'K9-ink');
    eq([ids(s, 0, 'combo'), ids(s, 0, 'discard')], [[], ['K9-ink']]);
    const c = clash(setup({ p: [{}, { combo: [{ id: 'K9-ink', owner: 0 }] }] }));
    eq(ids(c, 1, 'combo'), ['K9-ink']);
  });
  card('K9-death', 'Style: face-down cards in its combo get +3 value', () => {
    const s = setup({ p: [{ combo: ['K9-death', D('R1-flame')] }] });
    eq([H.valueOf(s, s.players[0].combo[1]), H.comboTotal(s, 0)], [3, 12]);
  });
  card('C-noct', 'Noct Umbra: face-down cards in your combo are worth 2', () => {
    const s = setup({ p: [{ char: 'C-noct', combo: [D('R9-flame')], hand: ['R2-flame'] }] });
    eq(H.valueOf(s, s.players[0].combo[0]), 2);
    ok(canPlay(s, 0, 'R2-flame').ok, 'a 2 matches the face-down card by number');
  });
  card('C-evelyn', 'Evelyn Shadow: playing a 3 makes each player put a card face down; start of clash reveals all', () => {
    let s = play(setup({ p: [{ char: 'C-evelyn', hand: ['R3-phoenix', 'R1-flame'] }, { hand: ['U9-river'] }] }), 0, 'R3-phoenix');
    eq([s.players[0].combo.map(c => c.faceDown), s.players[1].combo.map(c => c.faceDown)], [[false, true], [true]]);
    s = clash(s);
    eq(s.players[0].life, 5, 'revealed: 3+1 vs 9');
  });
  card('C-dante', 'Dante: 3 colors -> opponent mills 5; 5 colors -> opponent loses life per color in their combo', () => {
    const s = clash(setup({ p: [{ char: 'C-dante', combo: ['R1-blood', 'U1-river', 'Y1-lion'] }] }));
    logHas(s, 'Dante (start of clash): 3+ colors');
    eq(s.players[1].deck.length, 5, '15 - 5 milled - 5 drawn');
    const f = clash(setup({ p: [{ char: 'C-dante', combo: ['R1-blood', 'U1-river', 'Y1-lion', 'G1-forest', 'K1-ink'] }, { combo: ['R1-flame', 'U1-check'], life: 30 }] }));
    eq(f.players[1].life, 30 - 2 - 3);
  });
})();
