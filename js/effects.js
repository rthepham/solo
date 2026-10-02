// Card and character abilities, keyed by card id (see js/cards-data.js).
// Each follows the card's line in readings.md (with rulings.md applied).
//
// Hooks on numbered cards (ctrl = the player whose combo the card is in):
//   onEnter(s, card, ctrl)      combo enter
//   patience: true              combo enter: you may flip this card
//   onFlip(s, card, ctrl)       when flipped face down
//   onDiscard(s, card, owner)   when discarded
//   startClash / endClash / clashWin (s, card, ctrl)
//   feint(s, card, ctrl)        Feint action (card already discarded)
//   costMod(s, p, card, cost)   cost changes on the card itself
//   nextToZero / anyColor / alsoColors   placement and color rules
// Style cards (Blood Snap, Ink Chop, ...) and reaction cards (Flash Jab,
// Mantis Jab, ...) are checked by id inside engine.js.
// Hooks on characters: onPlay(s, p, card), startClash / endClash / clashWin (s, p).
(function (root) {
  'use strict';
  const Solo = root.Solo;
  const H = Solo._;
  const { opp, P } = H;
  const E = Solo.EFFECTS;
  const num = card => Solo.DATA[card.id].number;
  const faceUp = cards => cards.filter(c => !c.faceDown);
  const pn = H.pname;
  // Condition helpers: log why an ability did or didn't fire, return the result.
  const chk = H.check;
  const nextTo = (s, c, v, what) => chk(s, H.nextToValue(s, c, v), `next to a ${v} → ${what}.`, `not next to a ${v}, so nothing happens.`);
  const morePower = (s, p, what) => { const a = P(s, p).power, b = P(s, opp(p)).power;
    return chk(s, a > b, `${pn(p)} has more power (${a} vs ${b}) → ${what}.`, `${pn(p)} doesn't have more power (${a} vs ${b}), so nothing happens.`); };

  // ================================================================ RED
  E['R1-flame'] = { onEnter(s, c, p) { H.loseLife(s, p, 3, p); H.draw(s, p, 1); } };
  E['R1-phoenix'] = { onEnter(s, c, p) {
    const n = H.comboValues(s, p).filter(v => v === 1).length;
    if (chk(s, n > 0, `${n} card${n === 1 ? '' : 's'} with value 1 in the combo → +${n} power.`, 'no 1s in the combo, so no power.')) H.gainPower(s, p, n);
  } };
  E['R1-blood'] = { onEnter(s, c, p) { drawThenDiscard(s, p, 1, 1); } };
  E['R2-flame'] = { onEnter(s, c, p) { H.loseLife(s, p, 2, p); H.loseLife(s, opp(p), 2, p); } };
  E['R2-phoenix'] = { onEnter(s, c, p) { if (nextTo(s, c, 1, 'gain 2 life')) H.gainLife(s, p, 2); } };
  E['R2-blood'] = { onEnter(s, c, p) {
    if (morePower(s, p, 'lose 2 power, draw 1')) { H.losePower(s, p, 2); H.draw(s, p, 1); }
  } };
  E['R3-flame'] = { onEnter(s, c, p) {
    if (!chk(s, H.hasRun(s, p, 3), 'the combo has a run of 3 → may return cards totaling 3 from the discard pile.', 'no run of 3 in the combo, so nothing happens.')) return;
    const cands = faceUp(P(s, p).discard);
    const picks = H.chooseCards(s, p, 'Flame Straight: return cards from your discard whose values total exactly 3 (or none)',
      cands, 0, cands.length,
      list => list.length === 0 || list.reduce((t, x) => t + num(x), 0) === 3 ? null : 'The chosen cards must total exactly 3.');
    if (!picks.length) H.log(s, `${pn(p)} returns nothing.`);
    picks.forEach(x => H.moveToHand(s, x, p));
  } };
  E['R3-phoenix'] = { onEnter(s, c, p) { if (morePower(s, p, 'gain 3 life')) H.gainLife(s, p, 3); } };
  E['R3-blood'] = { onEnter(s, c, p) { if (nextTo(s, c, 3, '+3 power')) H.gainPower(s, p, 3); } };
  E['R4-flame'] = { onEnter(s, c, p) { if (morePower(s, p, '+2 power')) H.gainPower(s, p, 2); } };
  E['R4-phoenix'] = { onEnter(s, c, p) {
    H.loseLife(s, p, 1, p);
    const zeros = P(s, opp(p)).combo.filter(x => H.valueOf(s, x) === 0);
    if (!zeros.length) H.log(s, `no 0 in ${pn(opp(p))}'s combo to discard.`);
    const t = H.chooseCard(s, p, 'Phoenix Cross: discard a 0 from your opponent\'s combo', zeros);
    if (t) H.discardCard(s, t, p, { cause: p });
  } };
  E['R4-blood'] = { feint(s, c, p) {
    const threes = P(s, p).discard.filter(x => !x.faceDown && num(x) === 3);
    if (!threes.length) H.log(s, 'no face-up 3 in the discard pile to play.');
    const t = H.chooseCard(s, p, 'Blood Cross: play a 3 from your discard', threes);
    if (t) H.playFromZone(s, p, t);
    H.draw(s, p, 1);
  } };
  E['R5-flame'] = { onEnter(s, c, p) {
    const a = P(s, p).power, b = P(s, opp(p)).power;
    if (chk(s, a < b, `${pn(p)} has less power (${a} vs ${b}) → +4 power.`, `${pn(p)} doesn't have less power (${a} vs ${b}), so nothing happens.`)) H.gainPower(s, p, 4);
  } };
  E['R5-phoenix'] = { onEnter(s, c, p) {
    H.loseLife(s, p, 2, p);
    const t = H.chooseCard(s, p, 'Phoenix Hook: flip a card in your opponent\'s combo', faceUp(P(s, opp(p)).combo));
    if (t) H.flip(s, t, p);
  } };
  E['R5-blood'] = { onEnter(s, c, p) { H.discardHand(s, p); H.draw(s, p, 3); } };
  E['R6-flame'] = {};   // Style, handled in engine loseLife
  E['R6-phoenix'] = { onEnter(s, c, p) {
    const o = opp(p), x = P(s, p).power;
    const hand = P(s, o).hand.slice();
    const toss = H.chooseCards(s, o, `Phoenix Uppercut deals ${x} damage to you. Discard cards from hand to reduce it by their total value?`, hand, 0, hand.length);
    const reduce = toss.reduce((t, k) => t + num(k), 0);
    H.log(s, `deals ${x} damage (${pn(p)}'s power); ${pn(o)} discards ${toss.length} card${toss.length === 1 ? '' : 's'} worth ${reduce} to reduce it.`);
    toss.forEach(k => H.discardCard(s, k, o, {}));
    H.damage(s, o, Math.max(0, x - reduce));
  } };
  E['R6-blood'] = { feint(s, c, p) { H.gainPower(s, p, Math.max(0, 10 - P(s, p).life)); } };
  E['R7-flame'] = { startClash(s, c, p) {
    H.loseLife(s, p, P(s, p).life - 1, p);
    s.clash.noDamage[p] = true;
    H.log(s, `${pn(p)} can't take damage this clash.`);
  } };
  E['R7-phoenix'] = { clashWin(s, c, p) { H.gainLife(s, p, s.clash.damageDealt[p]); } };
  E['R7-blood'] = {};   // Style, handled in engine costOf
  E['R8-flame'] = { endClash(s, c, p) { H.gainLife(s, p, 6); } };
  E['R8-phoenix'] = { endClash(s, c, p) {
    const t = H.chooseCard(s, p, 'Phoenix Roundhouse: choose a card to keep in your combo for next round',
      P(s, p).combo.filter(x => x !== c));
    if (t) {
      t.keep = true;
      if (t.faceDown) H.logPriv(s, t.owner, `${H.upLabel(t)} (face down) will stay in the combo.`, 'a face-down card will stay in the combo.');
      else H.log(s, `${H.label(s, t)} will stay in the combo.`);
    }
  } };
  E['R8-blood'] = { endClash(s, c, p) { H.draw(s, p, 3); } };
  E['R9-flame'] = { costMod: (s, p, c, cost) => cost - H.comboValues(s, p).filter(v => v === 1).length };
  E['R9-phoenix'] = { costMod: (s, p, c, cost) => cost - s.roundStats.lifeLost[p] };
  E['R9-blood'] = { costMod: (s, p, c, cost) => cost - P(s, p).power };

  // Red characters
  E['C-asher'] = { onPlay(s, p, card) {
    if (H.colorsOf(s, Object.assign({}, card, { faceDown: false })).includes('Red') && num(card) < 4) {
      H.log(s, 'played a Red card under 4 → +1 power.');
      H.gainPower(s, p, 1);
    }
  } };
  E['C-ember'] = { onPlay(s, p, card) {
    if (num(card) % 2 !== 0) return;
    const ones = P(s, p).discard.filter(x => !x.faceDown && num(x) === 1);
    const t = H.chooseCard(s, p, 'Ember: play a 1 from your discard?', ones, { optional: true });
    if (t) { H.log(s, 'played an even card → plays a 1 from the discard pile.'); H.playFromZone(s, p, t); }
  } };
  E['C-vlad'] = { clashWin(s, p) { H.gainLife(s, p, 2); } };

  // ================================================================ BLUE
  const faceDownCount = (s, p) => P(s, p).combo.filter(x => x.faceDown).length;
  const zeroCount = (s, p) => P(s, p).combo.filter(x => H.valueOf(s, x) === 0).length;
  const flipOppUpTo = (s, c, p, max, why) => {
    const cands = faceUp(P(s, opp(p)).combo).filter(x => H.valueOf(s, x) <= max);
    if (!cands.length) H.log(s, `no face-up card with value ${max} or less in ${pn(opp(p))}'s combo to flip.`);
    const t = H.chooseCard(s, p, `${why}: flip a card with value ${max} or less in your opponent's combo`, cands);
    if (t) H.flip(s, t, p);
  };
  const oppPutsTopFaceDown = (s, p, n) => {
    const o = opp(p);
    for (let i = 0; i < n && P(s, o).deck.length; i++) H.putIntoCombo(s, P(s, o).deck[0], o, true);
  };

  E['U1-river'] = { patience: true, onFlip(s, c, p) { H.losePower(s, opp(p), 2); } };
  E['U1-check'] = { onEnter(s, c, p) {
    if (chk(s, H.nextToValue(s, c, 1) || H.nextToValue(s, c, 0), 'next to a 1 or 0 → +1 energy.', 'not next to a 1 or 0, so nothing happens.')) H.gainEnergy(s, p, 1);
  } };
  E['U1-cyber'] = { patience: true, onFlip(s, c, p) { drawThenDiscard(s, p, 1, 1); } };
  E['U2-river'] = { onEnter(s, c, p) {
    const n = faceDownCount(s, opp(p));
    if (chk(s, n > 0, `${pn(opp(p))} has ${n} face-down card${n === 1 ? '' : 's'} → +${n} power.`, `${pn(opp(p))} has no face-down cards, so no power.`)) H.gainPower(s, p, n);
  } };
  E['U2-check'] = { onEnter(s, c, p) { flipOppUpTo(s, c, p, 2, 'Check Chop'); } };
  E['U2-cyber'] = { copiesEnter: true, onFlip(s, c, p) { H.copyEnter(s, c, p); } };
  E['U3-river'] = { onEnter(s, c, p) { H.draw(s, p, 1); } };
  E['U3-check'] = { onEnter(s, c, p) {
    const odd = [0, 1].reduce((t, q) => t + H.comboValues(s, q).filter(v => v % 2 === 1).length, 0);
    if (chk(s, odd > 0, `${odd} odd card${odd === 1 ? '' : 's'} in both combos → discard ${odd} from the top of the deck.`, 'no odd cards in either combo, so nothing happens.')) H.mill(s, p, odd);
  } };
  E['U3-cyber'] = { patience: true, onFlip(s, c, p) { flipOppUpTo(s, c, p, 3, 'Cyber Straight'); } };
  E['U4-river'] = { patience: true, onFlip(s, c, p) { oppPutsTopFaceDown(s, p, 2); } };
  E['U4-check'] = { onFlip(s, c, p) { oppPutsTopFaceDown(s, p, 2); } };
  E['U4-cyber'] = { onEnter(s, c, p) {
    const n = faceDownCount(s, p);
    if (chk(s, n > 0, `${n} face-down card${n === 1 ? '' : 's'} in the combo → +${n} power.`, 'no face-down cards in the combo, so no power.')) H.gainPower(s, p, n);
  } };
  E['U5-river'] = { onFlip(s, c, p) {
    const o = opp(p);
    const t = H.chooseCard(s, o, 'River Hook: put a card from your hand face down into your combo', P(s, o).hand.slice());
    if (t) H.putIntoCombo(s, t, o, true);
  } };
  E['U5-check'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Check Hook: flip a card in your combo', faceUp(P(s, p).combo));
    if (t) H.flip(s, t, p);
  } };
  E['U5-cyber'] = { onEnter(s, c, p) {
    const z = zeroCount(s, p);
    if (!chk(s, z >= 2, `${z} zeros in the combo (2 or more) → flip an opponent's card.`, `only ${z} zero${z === 1 ? '' : 's'} in the combo (needs 2), so nothing happens.`)) return;
    const t = H.chooseCard(s, p, 'Cyber Hook: flip a card in your opponent\'s combo', faceUp(P(s, opp(p)).combo));
    if (t) H.flip(s, t, p);
  } };
  E['U6-river'] = { patience: true, onFlip(s, c, p) { H.mill(s, p, 3); } };
  E['U6-check'] = { onEnter(s, c, p) {
    const a = P(s, p).power, b = P(s, opp(p)).power;
    if (chk(s, b > a, `${pn(opp(p))} has more power (${b} vs ${a}) → they lose 3 power.`, `${pn(opp(p))} doesn't have more power (${b} vs ${a}), so nothing happens.`)) H.losePower(s, opp(p), 3);
  } };
  E['U6-cyber'] = { onEnter(s, c, p) {
    const n = faceDownCount(s, 0) + faceDownCount(s, 1);
    if (chk(s, n > 0, `${n} face-down card${n === 1 ? '' : 's'} in both combos → +${n} power.`, 'no face-down cards in either combo, so no power.')) H.gainPower(s, p, n);
  } };
  E['U7-river'] = { onEnter(s, c, p) { H.mill(s, p, P(s, p).power); } };
  E['U7-check'] = { onEnter(s, c, p) {
    if (!nextTo(s, c, 0, `${pn(opp(p))} flips one of their combo cards`)) return;
    const o = opp(p);
    const t = H.chooseCard(s, o, 'Check Snap: choose one of your combo cards to flip face down', faceUp(P(s, o).combo));
    if (t) H.flip(s, t, p);
  } };
  E['U7-cyber'] = { onEnter(s, c, p) {
    const n = faceDownCount(s, 0) + faceDownCount(s, 1);
    if (chk(s, n > 0, `${n} face-down card${n === 1 ? '' : 's'} in both combos → gain ${n} life.`, 'no face-down cards in either combo, so no life.')) H.gainLife(s, p, n);
  } };
  E['U8-river'] = { startClash(s, c, p) {
    const t = H.chooseCard(s, p, 'River Roundhouse: flip a card in your combo? It stays in your combo for next round.',
      faceUp(P(s, p).combo), { optional: true });
    if (!t) H.log(s, `${pn(p)} doesn't flip anything.`);
    if (t && H.flip(s, t, p, { voluntary: true })) { t.keep = true; H.log(s, 'that card will stay in the combo.'); }
  } };
  E['U8-check'] = { endClash(s, c, p) {
    const d = s.clash.damageDealt[p];
    if (chk(s, d <= 2, `${pn(p)} dealt ${d} damage (2 or less) → draw 2.`, `${pn(p)} dealt ${d} damage, so no draw.`)) H.draw(s, p, 2);
  } };
  E['U8-cyber'] = { onEnter(s, c, p) {
    const z = zeroCount(s, p);
    if (chk(s, z >= 2, `${z} zeros in the combo (2 or more) → ${pn(opp(p))} loses 2 energy.`, `only ${z} zero${z === 1 ? '' : 's'} in the combo (needs 2), so nothing happens.`)) H.loseEnergy(s, opp(p), 2);
  } };
  E['U9-river'] = { onEnter(s, c, p) {
    const downs = P(s, p).combo.filter(x => x.faceDown);
    downs.forEach(x => H.moveToHand(s, x, p));
    H.gainEnergy(s, p, downs.length);
  } };
  E['U9-check'] = { onEnter(s, c, p) {
    // Ruling: one card, flipped 4 times. It turns face down once; its "when flipped" triggers 4 times.
    if (!nextTo(s, c, 0, 'choose a card and flip it 4 times')) return;
    const t = H.chooseCard(s, p, 'Check Finisher: choose a card (either combo) to flip 4 times', faceUp(P(s, p).combo.concat(P(s, opp(p)).combo)));
    if (!t) { H.log(s, 'no face-up card to flip.'); return; }
    if (!H.flip(s, t, p)) return;            // stopped by a reaction or Umbra Roundhouse: all four are stopped
    const onFlip = Solo.def(t).onFlip;
    if (!onFlip) { H.log(s, `${H.upLabel(t)} has no "when flipped" ability, so the other 3 flips do nothing.`); return; }
    for (let i = 2; i <= 4; i++) {
      const loc = H.where(s, t);
      if (!loc || loc.zone !== 'combo' || !t.faceDown) { H.log(s, 'the card is no longer flipped in a combo, so the remaining flips stop.'); return; }
      H.log(s, `flip ${i} of 4.`);
      H.trigger(s, `${H.nameOf(t)} (when flipped)`, () => onFlip(s, t, loc.p));
    }
  } };
  E['U9-cyber'] = { costMod: (s, p, c, cost) => cost - 2 * faceDownCount(s, p) };

  // Blue characters
  E['C-spring'] = {
    onPlay(s, p, card) {
      if (Solo.def(card).color !== 'Blue' && !(Solo.def(card).alsoColors || []).includes('Blue')) return;
      if (num(card) <= 3) return;
      const t = H.rightmost(s, opp(p));
      if (t && !t.faceDown) { H.log(s, `played a Blue card over 3 → flip ${pn(opp(p))}'s rightmost card.`); H.flip(s, t, p); }
    },
    startClash(s, p) {
      const n = faceDownCount(s, opp(p));
      if (chk(s, n > 0, `${pn(opp(p))} has ${n} face-down card${n === 1 ? '' : 's'} → +${n} power.`, `${pn(opp(p))} has no face-down cards, so no power.`)) H.gainPower(s, p, n);
    },
  };
  E['C-cian'] = { onPlay(s, p, card) {
    if (num(card) % 2 !== 1) return;
    H.log(s, 'played an odd card → flip it, then take a 2 from the discard pile.');
    if (H.isActive(s, card)) H.flip(s, card, p);
    const twos = P(s, p).discard.filter(x => !x.faceDown && num(x) === 2);
    const t = H.chooseCard(s, p, 'Cian Hack: add a 2 from your discard to your hand', twos);
    if (t) H.moveToHand(s, t, p);
  } };
  E['C-victoria'] = { endClash(s, p) { H.draw(s, p, 2); } };   // 1-damage clash win is in engine

  // ================================================================ YELLOW
  const nextToZero = { nextToZero: true };
  E['Y1-sun'] = { onDiscard(s, c, p) { H.gainPower(s, opp(p), 2); H.gainEnergy(s, p, 1); } };
  E['Y1-lion'] = { onDiscard(s, c, p) { H.gainPower(s, p, 1); } };
  E['Y1-flash'] = {};   // reaction, handled in engine flip
  E['Y2-sun'] = { onEnter(s, c, p) { H.gainPower(s, p, Math.floor(P(s, p).hand.length / 2)); } };
  const lionChop = (s, c, p) => { if (nextTo(s, c, 2, '+2 power')) H.gainPower(s, p, 2); };
  E['Y2-lion'] = { onEnter: lionChop, onFlip: lionChop };
  E['Y2-flash'] = nextToZero;
  const sunStraight = (s, c, p) => { if (chk(s, H.isEndOfRun(s, c), 'it is at the end of a run → draw 1.', 'it is not at the end of a run, so nothing happens.')) H.draw(s, p, 1); };
  E['Y3-sun'] = { onEnter: sunStraight, onFlip: sunStraight };
  E['Y3-lion'] = { onEnter(s, c, p) { if (nextTo(s, c, 0, `${pn(opp(p))} loses 2 power`)) H.losePower(s, opp(p), 2); } };
  E['Y3-flash'] = nextToZero;
  E['Y4-sun'] = {};     // reaction Feint (ruling), handled in engine discardCard
  E['Y4-lion'] = nextToZero;
  E['Y4-flash'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Flash Cross: turn a face-down card in your combo face up', P(s, p).combo.filter(x => x.faceDown));
    if (!t) { H.log(s, 'no face-down card in the combo.'); return; }
    H.unflip(s, t);
    if (chk(s, num(t) > 3, `it is a ${num(t)} (over 3) → it goes to the hand.`, `it is a ${num(t)} (3 or less), so it stays.`)) H.moveToHand(s, t, p);
  } };
  E['Y5-sun'] = nextToZero;
  E['Y5-lion'] = {};    // Style, handled in engine discardCard
  E['Y5-flash'] = { onEnter(s, c, p) { if (nextTo(s, c, 0, '+3 power')) H.gainPower(s, p, 3); } };
  E['Y6-sun'] = { onEnter(s, c, p) {
    const mine = H.chooseCard(s, p, 'Sun Uppercut: discard a card from your combo to discard a 5-or-less from your opponent\'s combo?',
      P(s, p).combo.slice(), { optional: true });
    if (!mine) { H.log(s, `${pn(p)} doesn't use it.`); return; }
    H.discardCard(s, mine, p, {});
    const t = H.chooseCard(s, p, 'Sun Uppercut: discard a card with value 5 or less from your opponent\'s combo',
      P(s, opp(p)).combo.filter(x => H.valueOf(s, x) <= 5));
    if (t) H.discardCard(s, t, p, { cause: p });
  } };
  E['Y6-lion'] = { onEnter(s, c, p) { if (nextTo(s, c, 0, `${pn(opp(p))} puts their top deck card face down in their combo`)) oppPutsTopFaceDown(s, p, 1); } };
  E['Y6-flash'] = nextToZero;
  E['Y7-sun'] = { onDiscard(s, c, p) { H.gainEnergy(s, p, 3); } };
  E['Y7-lion'] = { onEnter(s, c, p) {
    const combo = P(s, p).combo;
    if (combo.length < 2) { H.log(s, 'fewer than 2 cards in the combo, so nothing happens.'); return; }
    if (!H.yesNo(s, p, 'Lion Snap: discard two cards from your combo to gain +2 energy?')) { H.log(s, `${pn(p)} doesn't use it.`); return; }
    H.chooseCards(s, p, 'Lion Snap: choose two cards in your combo to discard', combo.slice(), 2, 2)
      .forEach(x => H.discardCard(s, x, p, {}));
    H.gainEnergy(s, p, 2);
  } };
  E['Y7-flash'] = nextToZero;
  E['Y8-sun'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Sun Roundhouse: discard a card in your opponent\'s combo', P(s, opp(p)).combo.slice());
    if (t) H.discardCard(s, t, p, { cause: p });
  } };
  E['Y8-lion'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Lion Roundhouse: turn a face-down card in your combo face up', P(s, p).combo.filter(x => x.faceDown));
    if (t) H.unflip(s, t);
  } };
  E['Y8-flash'] = { onDiscard(s, c, p) { H.gainPower(s, p, 4); } };
  E['Y9-sun'] = { onEnter(s, c, p) { H.discardHand(s, p); H.draw(s, p, 5); } };
  E['Y9-lion'] = { costMod: (s, p, c, cost) => cost - s.roundStats.discarded[p] };
  E['Y9-flash'] = { onDiscard(s, c, p) {
    const pl = P(s, p);
    const moved = pl.discard.splice(0);
    moved.forEach(x => { x.faceDown = true; });
    pl.deck.push(...moved);
    Solo.RNG.shuffle(s, pl.deck);
    pl.deck.forEach(x => { x.faceDown = false; });
    H.log(s, `Flash Finisher: ${Solo._.pname(p)} shuffles their discard pile (${moved.length} cards) into their deck.`);
  } };

  // Yellow characters
  E['C-sonny'] = { onPlay(s, p, card) {
    if (!Solo._.colorsOf(s, Object.assign({}, card, { faceDown: false })).includes('Yellow')) return;
    const me = P(s, p).power, them = P(s, opp(p)).power;
    if (me < them) { H.log(s, `played Yellow with less power (${me} vs ${them}) → +1 power.`); H.gainPower(s, p, 1); }
    else if (me > them) { H.log(s, `played Yellow with more power (${me} vs ${them}) → draw 1, discard 1.`); drawThenDiscard(s, p, 1, 1); }
  } };
  E['C-leo'] = { onPlay(s, p, card) {
    if (num(card) % 2 === 1) {
      const top = P(s, p).deck[0];
      if (top) { H.log(s, 'played an odd card → the top deck card goes into the combo.'); H.putIntoCombo(s, top, p, false); }
    } else {
      const t = H.chooseCard(s, p, 'Leo Wildheart: return a face-down card from your combo to your hand?',
        P(s, p).combo.filter(x => x.faceDown), { optional: true });
      if (t) H.moveToHand(s, t, p);
    }
  } };
  E['C-master'] = { startClash(s, p) {
    if (chk(s, H.hasRun(s, p, 3), 'the combo has a run of 3 → +3 power.', 'no run of 3 in the combo, so nothing happens.')) H.gainPower(s, p, 3);
    if (H.hasRun(s, p, 5)) {
      H.log(s, 'the combo has a run of 5 → discard a card from the opponent\'s combo.');
      const t = H.chooseCard(s, p, 'Master Leo: discard a card in your opponent\'s combo', P(s, opp(p)).combo.slice());
      if (t) H.discardCard(s, t, p, { cause: p });
    }
  } };

  // ================================================================ GREEN
  E['G1-forest'] = { onEnter(s, c, p) {
    const t = H.comboTotal(s, p);
    if (chk(s, t > 10, `combo total ${t} (over 10) → +2 energy.`, `combo total ${t} (10 or less), so nothing happens.`)) H.gainEnergy(s, p, 2);
  } };
  E['G1-mantis'] = {};  // reaction, handled in engine discardCard
  E['G1-life'] = {};    // reaction, handled in engine flip
  E['G2-forest'] = { onEnter(s, c, p) {
    const n = P(s, p).power;
    if (chk(s, n > 0, `${pn(p)} has ${n} power → gain ${n} life.`, `${pn(p)} has 0 power, so no life.`)) H.gainLife(s, p, n);
  } };
  E['G2-mantis'] = { patience: true, onFlip(s, c, p) { H.mill(s, p, 2, { faceDown: true }); } };
  E['G2-life'] = { onEnter(s, c, p) {
    const a = H.comboTotal(s, p), b = H.comboTotal(s, opp(p));
    if (chk(s, a > b, `combo total ${a} beats ${b} → +2 power.`, `combo total ${a} doesn't beat ${b}, so nothing happens.`)) H.gainPower(s, p, 2);
  } };
  E['G3-forest'] = { onEnter(s, c, p) {
    const t = H.rightmost(s, opp(p));
    if (chk(s, !!t && H.valueOf(s, t) === 0, `${pn(opp(p))}'s last combo card is a 0 → +2 energy.`, `${pn(opp(p))}'s last combo card isn't a 0, so nothing happens.`)) H.gainEnergy(s, p, 2);
  } };
  E['G3-mantis'] = {};  // Style, handled in engine resolvePlayed
  E['G3-life'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Life Straight: discard a card from your combo to gain +1 energy?', P(s, p).combo.slice(), { optional: true });
    if (t) { H.discardCard(s, t, p, {}); H.gainEnergy(s, p, 1); } else H.log(s, `${pn(p)} doesn't use it.`);
  } };
  E['G4-forest'] = { endClash(s, c, p) { H.gainEnergy(s, p, 3, true); } };
  E['G4-mantis'] = {};  // Style, handled in engine reorderCombo / swaps
  E['G4-life'] = { onEnter(s, c, p) { if (chk(s, H.isEndOfRun(s, c), 'it is at the end of a run → +5 energy.', 'it is not at the end of a run, so nothing happens.')) H.gainEnergy(s, p, 5); } };
  E['G5-forest'] = { onEnter(s, c, p) {
    if (!nextTo(s, c, 5, 'discard one of the top 2 deck cards and play the other')) return;
    const top = P(s, p).deck.slice(0, 2);
    if (!top.length) return;
    let keep = top[0];
    if (top.length === 2) {
      const toss = H.chooseCard(s, p, 'Forest Hook: choose the card to discard face down (the other is played for free)', top);
      H.discardCard(s, toss, p, { faceDown: true });
      keep = top.find(x => x !== toss);
    }
    if (H.where(s, keep) && H.where(s, keep).zone === 'deck') H.playFromZone(s, p, keep);
  } };
  E['G5-mantis'] = { patience: true, onFlip(s, c, p) {
    const hand = P(s, p).hand;
    if (hand.length < 2) { H.log(s, 'fewer than 2 cards in hand, so nothing happens.'); return; }
    if (!H.yesNo(s, p, 'Mantis Hook: discard 2 cards face down to gain +3 energy?')) { H.log(s, `${pn(p)} doesn't use it.`); return; }
    H.chooseCards(s, p, 'Mantis Hook: choose 2 cards to discard face down', hand.slice(), 2, 2)
      .forEach(x => H.discardCard(s, x, p, { faceDown: true }));
    H.gainEnergy(s, p, 3);
  } };
  E['G5-life'] = { onEnter(s, c, p) {
    const n = H.neighbors(s, c)[0];
    if (!n) { H.log(s, 'no card next to it, so nothing happens.'); return; }
    const price = 10 - H.valueOf(s, n);
    if (P(s, p).energy < price) { H.log(s, `drawing 2 would cost ${price} energy; ${pn(p)} has only ${P(s, p).energy}.`); return; }
    if (!H.yesNo(s, p, `Life Hook: pay ${price} energy to draw 2 cards?`)) { H.log(s, `${pn(p)} doesn't pay ${price} energy.`); return; }
    H.payEnergy(s, p, price);
    H.draw(s, p, 2);
  } };
  E['G6-forest'] = { onEnter(s, c, p) { if (nextTo(s, c, 6, '+6 power')) H.gainPower(s, p, 6); } };
  E['G6-mantis'] = {};  // reaction Feint, handled in engine resolvePlayed
  E['G6-life'] = { onEnter(s, c, p) {
    const mine = H.comboValues(s, p), theirs = H.comboValues(s, opp(p));
    if (chk(s, !theirs.length || Math.min(...mine) > Math.max(...theirs),
      theirs.length ? `lowest card ${Math.min(...mine)} beats their highest ${Math.max(...theirs)} → +4 power.` : 'the opponent\'s combo is empty → +4 power.',
      `lowest card ${Math.min(...mine)} doesn't beat their highest ${Math.max(...theirs)}, so nothing happens.`)) H.gainPower(s, p, 4);
  } };
  E['G7-forest'] = { onEnter(s, c, p) { H.reorderCombo(s, p, p); H.reorderCombo(s, p, opp(p)); } };
  E['G7-mantis'] = { costMod(s, p, c, cost) {
    const hand = P(s, p).hand;
    return (hand.length === 1 && hand[0] === c && P(s, opp(p)).power > P(s, p).power) ? 0 : cost;
  } };
  E['G7-life'] = { onEnter(s, c, p) {
    for (const q of [p, opp(p)]) {
      for (let i = 0; i < 2 && P(s, q).hand.length; i++) {
        const hand = P(s, q).hand;
        H.discardCard(s, hand[Solo.RNG.int(s, hand.length)], q, { faceDown: false });
      }
    }
  } };
  E['G8-forest'] = { startClash(s, c, p) {
    const a = H.pairCount(s, p), b = H.pairCount(s, opp(p));
    if (chk(s, a > b, `${a} pair${a === 1 ? '' : 's'} vs ${b} → +6 power.`, `${a} pair${a === 1 ? '' : 's'} vs ${b} (needs more), so nothing happens.`)) H.gainPower(s, p, 6);
  } };
  E['G8-mantis'] = {};  // Style, handled in engine engage
  E['G8-life'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Life Roundhouse: return another card in your combo to your hand', P(s, p).combo.filter(x => x !== c));
    if (!t) return;
    const v = H.valueOf(s, t);
    H.moveToHand(s, t, p);
    H.gainEnergy(s, p, v + 1);
  } };
  E['G9-forest'] = { copiesEnter: true, onEnter(s, c, p) { H.copyEnter(s, c, p); } };
  E['G9-mantis'] = { costMod: (s, p, c, cost) => cost - Math.floor(P(s, p).discard.length / 3) };
  E['G9-life'] = { onEnter(s, c, p) {
    const n = H.chooseNumber(s, p, 'Life Finisher: spend how much energy? (+5 power each)', 0, P(s, p).energy);
    if (n > 0) { H.payEnergy(s, p, n); H.gainPower(s, p, 5 * n); } else H.log(s, `${pn(p)} spends no energy.`);
  } };

  // Green characters
  E['C-forest'] = { onPlay(s, p, card) {
    if (!Solo._.colorsOf(s, Object.assign({}, card, { faceDown: false })).includes('Green')) return;
    const t = H.rightmost(s, opp(p));
    const v = t ? H.valueOf(s, t) : 0;
    if (num(card) === v + 3) { H.log(s, `played a Green ${num(card)}, 3 more than the opponent's last card (${v}) → +1 energy.`); H.gainEnergy(s, p, 1); }
  } };
  E['C-young'] = {
    onPlay(s, p, card) {
      if (num(card) % 2 !== 0) return;
      H.log(s, 'played an even card → discard the top deck card face down.');
      H.mill(s, p, 1, { faceDown: true });
    },
    endClash(s, p) {
      if (P(s, p).maxEnergy < 18 && P(s, p).discard.filter(x => x.faceDown).length >= 5) {
        P(s, p).maxEnergy = 18;
        H.log(s, '5+ face-down cards in the discard pile → max energy is now 18.');
      }
    },
  };
  E['C-jack'] = { onPlay(s, p, card) {
    const left = H.neighbors(s, card)[0];
    const loc = H.where(s, card);
    if (!loc || loc.zone !== 'combo' || !left || loc.idx === 0) return;
    if (H.valueOf(s, P(s, p).combo[loc.idx - 1]) === num(card)) { H.log(s, `made a pair (${num(card)} next to ${num(card)}) → +1 energy.`); H.gainEnergy(s, p, 1); }
  } };

  // ================================================================ BLACK
  const plantFromDiscard = (s, c, p) => {
    const t = H.chooseCard(s, p, `${H.nameOf(c)}: put a card from your discard into your opponent's combo`, P(s, p).discard.slice());
    if (t) H.putIntoCombo(s, t, opp(p), false);
  };
  E['K1-umbra'] = { patience: true, onFlip(s, c, p) {
    const first = P(s, opp(p)).combo[0];
    if (first && !first.faceDown) H.flip(s, first, p);
  } };
  E['K1-ink'] = { anyColor: true };
  E['K1-death'] = { onFlip(s, c, p) {
    const n = H.colorCount(s, p);
    if (chk(s, n >= 3, `${n} colors in the combo (3 or more) → draw 1.`, `only ${n} color${n === 1 ? '' : 's'} in the combo (needs 3), so no draw.`)) H.draw(s, p, 1);
  } };
  E['K2-umbra'] = { onEnter: plantFromDiscard };
  E['K2-ink'] = {};     // Style (sabotage), handled in engine costOf
  E['K2-death'] = { onEnter(s, c, p) {
    const cands = faceUp(P(s, p).combo.concat(P(s, opp(p)).combo)).filter(x => H.colorsOf(s, x).includes('Black'));
    const t = H.chooseCard(s, p, 'Death Chop: flip a Black card', cands);
    if (t) H.flip(s, t, p);
  } };
  E['K3-umbra'] = {};   // forced Feint, handled in engine resolvePlayed
  E['K3-ink'] = { onEnter: plantFromDiscard };
  E['K3-death'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Death Straight: flip a card in your combo to draw 2 then discard 1?', faceUp(P(s, p).combo), { optional: true });
    if (t && H.flip(s, t, p, { voluntary: true })) drawThenDiscard(s, p, 2, 1);
  } };
  E['K4-umbra'] = { onEnter(s, c, p) {
    const o = opp(p), combo = P(s, o).combo;
    if (combo.length < 2) return;
    if (H.activeIn(s, o, 'G4-mantis').length) { H.log(s, `Mantis Cross: ${pn(o)}'s combo can't be moved.`); return; }
    const a = combo[0]; combo[0] = combo[combo.length - 1]; combo[combo.length - 1] = a;
    H.log(s, `${H.pname(o)} swaps the first and last cards of their combo.`);
  } };
  E['K4-ink'] = { onFlip(s, c, p) {
    const t = H.chooseCard(s, p, 'Ink Cross: return a face-down card from your combo to your hand', P(s, p).combo.filter(x => x.faceDown));
    if (t) H.moveToHand(s, t, p);
  } };
  E['K4-death'] = { onEnter: plantFromDiscard };
  E['K5-umbra'] = { alsoColors: ['Blue'] };
  E['K5-ink'] = { alsoColors: ['Red'] };
  E['K5-death'] = { alsoColors: ['Green'] };
  E['K6-umbra'] = { onEnter(s, c, p) { H.reorderCombo(s, p, opp(p)); } };
  E['K6-ink'] = {};     // Style (sabotage), handled in engine resolvePlayed
  E['K6-death'] = { onEnter: plantFromDiscard };
  E['K7-umbra'] = { onEnter(s, c, p) { H.draw(s, p, 2); } };
  E['K7-ink'] = { onEnter(s, c, p) {
    let any = false;
    for (const x of faceUp(P(s, p).combo)) if (x !== c && H.flip(s, x, p)) any = true;
    if (!any) H.log(s, 'no other card was flipped, so nothing goes into the combo.');
    if (any) for (let i = 0; i < 2 && P(s, p).deck.length; i++) H.putIntoCombo(s, P(s, p).deck[0], p, true);
  } };
  E['K7-death'] = { onEnter(s, c, p) {
    const downs = P(s, p).combo.filter(x => x.faceDown);
    if (!chk(s, downs.length >= 2, `${downs.length} face-down cards in the combo → turn one face up.`, `only ${downs.length} face-down card${downs.length === 1 ? '' : 's'} in the combo (needs 2), so nothing happens.`)) return;
    H.unflip(s, H.chooseCard(s, p, 'Death Snap: turn one face-down card face up', downs));
  } };
  E['K8-umbra'] = {};   // Style, handled in engine flip
  E['K8-ink'] = {};     // Style (sabotage), handled in engine resolvePlayed
  E['K8-death'] = { onEnter(s, c, p) {
    const chosen = [], colors = new Set();
    while (chosen.length < 5) {
      const cands = P(s, p).discard.filter(x => !x.faceDown && num(x) === 1 && !chosen.includes(x) &&
        !H.colorsOf(s, x).some(col => colors.has(col)));
      const t = H.chooseCard(s, p, `Death Roundhouse: choose a 1 to play (${chosen.length} chosen so far)`, cands,
        { optional: true, noneLabel: 'Done' });
      if (!t) break;
      chosen.push(t);
      H.colorsOf(s, t).forEach(col => colors.add(col));
    }
    chosen.forEach(x => { if (H.where(s, x) && H.where(s, x).zone === 'discard') H.playFromZone(s, p, x); });
  } };
  E['K9-umbra'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Umbra Finisher: put a card from your discard face down into your combo', P(s, p).discard.slice());
    if (t) H.putIntoCombo(s, t, p, true);
  } };
  E['K9-ink'] = {
    onEnter(s, c, p) { H.discardCard(s, c, p, {}); },
    endClash(s, c, p) { c.keep = true; H.log(s, 'it stays in the combo for next round.'); },
  };
  E['K9-death'] = {};   // Style, handled in engine valueOf

  // Black characters
  E['C-noct'] = {};     // handled in engine valueOf
  E['C-evelyn'] = {
    onPlay(s, p, card) {
      if (num(card) !== 3) return;
      H.log(s,'played a 3 → each player puts a card from hand face down into their combo.');
      for (const q of [p, opp(p)]) {
        const t = H.chooseCard(s, q, 'Evelyn Shadow: put a card from your hand face down into your combo', P(s, q).hand.slice());
        if (t) H.putIntoCombo(s, t, q, true);
      }
    },
    startClash(s, p) {
      const shown = [];
      for (const q of [0, 1]) for (const x of P(s, q).combo) if (x.faceDown) { x.faceDown = false; x.silenced = true; shown.push(H.label(s, x)); }
      H.log(s, shown.length ? `all face-down cards are turned face up (numbers only, no abilities): ${shown.join(', ')}.` : 'no face-down cards to reveal.');
    },
  };
  E['C-dante'] = { startClash(s, p) {
    const n = H.colorCount(s, p), o = opp(p);
    if (chk(s, n >= 3, `3+ colors (${n}) in the combo → ${pn(o)} discards the top 5 of their deck.`, `only ${n} color${n === 1 ? '' : 's'} in the combo (needs 3), so nothing happens.`)) H.mill(s, o, 5, { discarder: o });
    if (n >= 5) { H.log(s, `5 colors → ${pn(o)} loses 1 life per color in their combo.`); H.loseLife(s, o, H.colorCount(s, o), p); }
  } };

  // ================================================================ helpers
  function drawThenDiscard(s, p, d, k) {
    H.draw(s, p, d);
    H.chooseCards(s, p, `Discard ${k} card${k === 1 ? '' : 's'}`, P(s, p).hand.slice(), k, k)
      .forEach(x => H.discardCard(s, x, p, {}));
  }
  Solo.fx = { drawThenDiscard, faceUp, num };
})(typeof window !== 'undefined' ? window : globalThis);
