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

  // ================================================================ RED
  E['R1-flame'] = { onEnter(s, c, p) { H.loseLife(s, p, 3, p); H.draw(s, p, 1); } };
  E['R1-phoenix'] = { onEnter(s, c, p) { H.gainPower(s, p, H.comboValues(s, p).filter(v => v === 1).length); } };
  E['R1-blood'] = { onEnter(s, c, p) { drawThenDiscard(s, p, 1, 1); } };
  E['R2-flame'] = { onEnter(s, c, p) { H.loseLife(s, p, 2, p); H.loseLife(s, opp(p), 2, p); } };
  E['R2-phoenix'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 1)) H.gainLife(s, p, 2); } };
  E['R2-blood'] = { onEnter(s, c, p) {
    if (P(s, p).power > P(s, opp(p)).power) { H.losePower(s, p, 2); H.draw(s, p, 1); }
  } };
  E['R3-flame'] = { onEnter(s, c, p) {
    if (!H.hasRun(s, p, 3)) return;
    const cands = faceUp(P(s, p).discard);
    const picks = H.chooseCards(s, p, 'Flame Straight: return cards from your discard whose values total exactly 3 (or none)',
      cands, 0, cands.length,
      list => list.length === 0 || list.reduce((t, x) => t + num(x), 0) === 3 ? null : 'The chosen cards must total exactly 3.');
    picks.forEach(x => H.moveToHand(s, x, p));
  } };
  E['R3-phoenix'] = { onEnter(s, c, p) { if (P(s, p).power > P(s, opp(p)).power) H.gainLife(s, p, 3); } };
  E['R3-blood'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 3)) H.gainPower(s, p, 3); } };
  E['R4-flame'] = { onEnter(s, c, p) { if (P(s, p).power > P(s, opp(p)).power) H.gainPower(s, p, 2); } };
  E['R4-phoenix'] = { onEnter(s, c, p) {
    H.loseLife(s, p, 1, p);
    const zeros = P(s, opp(p)).combo.filter(x => H.valueOf(s, x) === 0);
    const t = H.chooseCard(s, p, 'Phoenix Cross: discard a 0 from your opponent\'s combo', zeros);
    if (t) H.discardCard(s, t, p, { cause: p });
  } };
  E['R4-blood'] = { feint(s, c, p) {
    const threes = P(s, p).discard.filter(x => !x.faceDown && num(x) === 3);
    const t = H.chooseCard(s, p, 'Blood Cross: play a 3 from your discard', threes);
    if (t) H.playFromZone(s, p, t);
    H.draw(s, p, 1);
  } };
  E['R5-flame'] = { onEnter(s, c, p) { if (P(s, p).power < P(s, opp(p)).power) H.gainPower(s, p, 4); } };
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
    toss.forEach(k => H.discardCard(s, k, o, {}));
    H.damage(s, o, Math.max(0, x - reduce));
  } };
  E['R6-blood'] = { feint(s, c, p) { H.gainPower(s, p, Math.max(0, 10 - P(s, p).life)); } };
  E['R7-flame'] = { startClash(s, c, p) {
    H.loseLife(s, p, P(s, p).life - 1, p);
    s.clash.noDamage[p] = true;
  } };
  E['R7-phoenix'] = { clashWin(s, c, p) { H.gainLife(s, p, s.clash.damageDealt[p]); } };
  E['R7-blood'] = {};   // Style, handled in engine costOf
  E['R8-flame'] = { endClash(s, c, p) { H.gainLife(s, p, 6); } };
  E['R8-phoenix'] = { endClash(s, c, p) {
    const t = H.chooseCard(s, p, 'Phoenix Roundhouse: choose a card to keep in your combo for next round',
      P(s, p).combo.filter(x => x !== c));
    if (t) { t.keep = true; H.log(s, `${H.label(s, t)} will stay in the combo.`); }
  } };
  E['R8-blood'] = { endClash(s, c, p) { H.draw(s, p, 3); } };
  E['R9-flame'] = { costMod: (s, p, c, cost) => cost - H.comboValues(s, p).filter(v => v === 1).length };
  E['R9-phoenix'] = { costMod: (s, p, c, cost) => cost - s.roundStats.lifeLost[p] };
  E['R9-blood'] = { costMod: (s, p, c, cost) => cost - P(s, p).power };

  // Red characters
  E['C-asher'] = { onPlay(s, p, card) {
    if (H.colorsOf(s, Object.assign({}, card, { faceDown: false })).includes('Red') && num(card) < 4) {
      H.log(s, 'Asher Smith triggers.');
      H.gainPower(s, p, 1);
    }
  } };
  E['C-ember'] = { onPlay(s, p, card) {
    if (num(card) % 2 !== 0) return;
    const ones = P(s, p).discard.filter(x => !x.faceDown && num(x) === 1);
    const t = H.chooseCard(s, p, 'Ember: play a 1 from your discard?', ones, { optional: true });
    if (t) H.playFromZone(s, p, t);
  } };
  E['C-vlad'] = { clashWin(s, p) { H.log(s, 'Vlad Crimson triggers.'); H.gainLife(s, p, 2); } };

  // ================================================================ helpers
  function drawThenDiscard(s, p, d, k) {
    H.draw(s, p, d);
    H.chooseCards(s, p, `Discard ${k} card${k === 1 ? '' : 's'}`, P(s, p).hand.slice(), k, k)
      .forEach(x => H.discardCard(s, x, p, {}));
  }
  Solo.fx = { drawThenDiscard, faceUp, num };
})(typeof window !== 'undefined' ? window : globalThis);
