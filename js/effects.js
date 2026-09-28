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

  // ================================================================ BLUE
  const faceDownCount = (s, p) => P(s, p).combo.filter(x => x.faceDown).length;
  const zeroCount = (s, p) => P(s, p).combo.filter(x => H.valueOf(s, x) === 0).length;
  const flipOppUpTo = (s, c, p, max, why) => {
    const t = H.chooseCard(s, p, `${why}: flip a card with value ${max} or less in your opponent's combo`,
      faceUp(P(s, opp(p)).combo).filter(x => H.valueOf(s, x) <= max));
    if (t) H.flip(s, t, p);
  };
  const oppPutsTopFaceDown = (s, p, n) => {
    const o = opp(p);
    for (let i = 0; i < n && P(s, o).deck.length; i++) H.putIntoCombo(s, P(s, o).deck[0], o, true);
  };

  E['U1-river'] = { patience: true, onFlip(s, c, p) { H.losePower(s, opp(p), 2); } };
  E['U1-check'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 1) || H.nextToValue(s, c, 0)) H.gainEnergy(s, p, 1); } };
  E['U1-cyber'] = { patience: true, onFlip(s, c, p) { drawThenDiscard(s, p, 1, 1); } };
  E['U2-river'] = { onEnter(s, c, p) { H.gainPower(s, p, faceDownCount(s, opp(p))); } };
  E['U2-check'] = { onEnter(s, c, p) { flipOppUpTo(s, c, p, 2, 'Check Chop'); } };
  E['U2-cyber'] = { copiesEnter: true, onFlip(s, c, p) { H.copyEnter(s, c, p); } };
  E['U3-river'] = { onEnter(s, c, p) { H.draw(s, p, 1); } };
  E['U3-check'] = { onEnter(s, c, p) {
    const odd = [0, 1].reduce((t, q) => t + H.comboValues(s, q).filter(v => v % 2 === 1).length, 0);
    H.mill(s, p, odd);
  } };
  E['U3-cyber'] = { patience: true, onFlip(s, c, p) { flipOppUpTo(s, c, p, 3, 'Cyber Straight'); } };
  E['U4-river'] = { patience: true, onFlip(s, c, p) { oppPutsTopFaceDown(s, p, 2); } };
  E['U4-check'] = { onFlip(s, c, p) { oppPutsTopFaceDown(s, p, 2); } };
  E['U4-cyber'] = { onEnter(s, c, p) { H.gainPower(s, p, faceDownCount(s, p)); } };
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
    if (zeroCount(s, p) < 2) return;
    const t = H.chooseCard(s, p, 'Cyber Hook: flip a card in your opponent\'s combo', faceUp(P(s, opp(p)).combo));
    if (t) H.flip(s, t, p);
  } };
  E['U6-river'] = { patience: true, onFlip(s, c, p) { H.mill(s, p, 3); } };
  E['U6-check'] = { onEnter(s, c, p) { if (P(s, opp(p)).power > P(s, p).power) H.losePower(s, opp(p), 3); } };
  E['U6-cyber'] = { onEnter(s, c, p) { H.gainPower(s, p, faceDownCount(s, 0) + faceDownCount(s, 1)); } };
  E['U7-river'] = { onEnter(s, c, p) { H.mill(s, p, P(s, p).power); } };
  E['U7-check'] = { onEnter(s, c, p) {
    if (!H.nextToValue(s, c, 0)) return;
    const o = opp(p);
    const t = H.chooseCard(s, o, 'Check Snap: choose one of your combo cards to flip face down', faceUp(P(s, o).combo));
    if (t) H.flip(s, t, p);
  } };
  E['U7-cyber'] = { onEnter(s, c, p) { H.gainLife(s, p, faceDownCount(s, 0) + faceDownCount(s, 1)); } };
  E['U8-river'] = { startClash(s, c, p) {
    const t = H.chooseCard(s, p, 'River Roundhouse: flip a card in your combo? It stays in your combo for next round.',
      faceUp(P(s, p).combo), { optional: true });
    if (t && H.flip(s, t, p, { voluntary: true })) { t.keep = true; H.log(s, 'That card will stay in the combo.'); }
  } };
  E['U8-check'] = { endClash(s, c, p) { if (s.clash.damageDealt[p] <= 2) H.draw(s, p, 2); } };
  E['U8-cyber'] = { onEnter(s, c, p) { if (zeroCount(s, p) >= 2) H.loseEnergy(s, opp(p), 2); } };
  E['U9-river'] = { onEnter(s, c, p) {
    const downs = P(s, p).combo.filter(x => x.faceDown);
    downs.forEach(x => H.moveToHand(s, x, p));
    H.gainEnergy(s, p, downs.length);
  } };
  E['U9-check'] = { onEnter(s, c, p) {
    if (!H.nextToValue(s, c, 0)) return;
    for (let i = 1; i <= 4; i++) {
      const cands = faceUp(P(s, p).combo.concat(P(s, opp(p)).combo));
      const t = H.chooseCard(s, p, `Check Finisher: flip a card (${i} of 4)`, cands);
      if (!t) break;
      H.flip(s, t, p);
    }
  } };
  E['U9-cyber'] = { costMod: (s, p, c, cost) => cost - 2 * faceDownCount(s, p) };

  // Blue characters
  E['C-spring'] = {
    onPlay(s, p, card) {
      if (Solo.def(card).color !== 'Blue' && !(Solo.def(card).alsoColors || []).includes('Blue')) return;
      if (num(card) <= 3) return;
      const t = H.rightmost(s, opp(p));
      if (t && !t.faceDown) { H.log(s, 'Spring Azula triggers.'); H.flip(s, t, p); }
    },
    startClash(s, p) { H.gainPower(s, p, faceDownCount(s, opp(p))); },
  };
  E['C-cian'] = { onPlay(s, p, card) {
    if (num(card) % 2 !== 1) return;
    H.log(s, 'Cian Hack triggers.');
    if (H.isActive(s, card)) H.flip(s, card, p);
    const twos = P(s, p).discard.filter(x => !x.faceDown && num(x) === 2);
    const t = H.chooseCard(s, p, 'Cian Hack: add a 2 from your discard to your hand', twos);
    if (t) H.moveToHand(s, t, p);
  } };
  E['C-victoria'] = { endClash(s, p) { H.log(s, 'Victoria Castle triggers.'); H.draw(s, p, 2); } };   // 1-damage clash win is in engine

  // ================================================================ YELLOW
  const nextToZero = { nextToZero: true };
  E['Y1-sun'] = { onDiscard(s, c, p) { H.gainPower(s, opp(p), 2); H.gainEnergy(s, p, 1); } };
  E['Y1-lion'] = { onDiscard(s, c, p) { H.gainPower(s, p, 1); } };
  E['Y1-flash'] = {};   // reaction, handled in engine flip
  E['Y2-sun'] = { onEnter(s, c, p) { H.gainPower(s, p, Math.floor(P(s, p).hand.length / 2)); } };
  const lionChop = (s, c, p) => { if (H.nextToValue(s, c, 2)) H.gainPower(s, p, 2); };
  E['Y2-lion'] = { onEnter: lionChop, onFlip: lionChop };
  E['Y2-flash'] = nextToZero;
  const sunStraight = (s, c, p) => { if (H.isEndOfRun(s, c)) H.draw(s, p, 1); };
  E['Y3-sun'] = { onEnter: sunStraight, onFlip: sunStraight };
  E['Y3-lion'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 0)) H.losePower(s, opp(p), 2); } };
  E['Y3-flash'] = nextToZero;
  E['Y4-sun'] = {};     // reaction Feint (ruling), handled in engine discardCard
  E['Y4-lion'] = nextToZero;
  E['Y4-flash'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Flash Cross: turn a face-down card in your combo face up', P(s, p).combo.filter(x => x.faceDown));
    if (!t) return;
    H.unflip(s, t);
    if (num(t) > 3) H.moveToHand(s, t, p);
  } };
  E['Y5-sun'] = nextToZero;
  E['Y5-lion'] = {};    // Style, handled in engine discardCard
  E['Y5-flash'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 0)) H.gainPower(s, p, 3); } };
  E['Y6-sun'] = { onEnter(s, c, p) {
    const mine = H.chooseCard(s, p, 'Sun Uppercut: discard a card from your combo to discard a 5-or-less from your opponent\'s combo?',
      P(s, p).combo.slice(), { optional: true });
    if (!mine) return;
    H.discardCard(s, mine, p, {});
    const t = H.chooseCard(s, p, 'Sun Uppercut: discard a card with value 5 or less from your opponent\'s combo',
      P(s, opp(p)).combo.filter(x => H.valueOf(s, x) <= 5));
    if (t) H.discardCard(s, t, p, { cause: p });
  } };
  E['Y6-lion'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 0)) oppPutsTopFaceDown(s, p, 1); } };
  E['Y6-flash'] = nextToZero;
  E['Y7-sun'] = { onDiscard(s, c, p) { H.gainEnergy(s, p, 3); } };
  E['Y7-lion'] = { onEnter(s, c, p) {
    const combo = P(s, p).combo;
    if (combo.length < 2 || !H.yesNo(s, p, 'Lion Snap: discard two cards from your combo to gain +2 energy?')) return;
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
    if (me < them) { H.log(s, 'Sonny Lee triggers.'); H.gainPower(s, p, 1); }
    else if (me > them) { H.log(s, 'Sonny Lee triggers.'); drawThenDiscard(s, p, 1, 1); }
  } };
  E['C-leo'] = { onPlay(s, p, card) {
    if (num(card) % 2 === 1) {
      const top = P(s, p).deck[0];
      if (top) { H.log(s, 'Leo Wildheart triggers.'); H.putIntoCombo(s, top, p, false); }
    } else {
      const t = H.chooseCard(s, p, 'Leo Wildheart: return a face-down card from your combo to your hand?',
        P(s, p).combo.filter(x => x.faceDown), { optional: true });
      if (t) H.moveToHand(s, t, p);
    }
  } };
  E['C-master'] = { startClash(s, p) {
    if (H.hasRun(s, p, 3)) { H.log(s, 'Master Leo: run of 3.'); H.gainPower(s, p, 3); }
    if (H.hasRun(s, p, 5)) {
      const t = H.chooseCard(s, p, 'Master Leo: discard a card in your opponent\'s combo', P(s, opp(p)).combo.slice());
      if (t) H.discardCard(s, t, p, { cause: p });
    }
  } };

  // ================================================================ GREEN
  E['G1-forest'] = { onEnter(s, c, p) { if (H.comboTotal(s, p) > 10) H.gainEnergy(s, p, 2); } };
  E['G1-mantis'] = {};  // reaction, handled in engine discardCard
  E['G1-life'] = {};    // reaction, handled in engine flip
  E['G2-forest'] = { onEnter(s, c, p) { H.gainLife(s, p, P(s, p).power); } };
  E['G2-mantis'] = { patience: true, onFlip(s, c, p) { H.mill(s, p, 2, { faceDown: true }); } };
  E['G2-life'] = { onEnter(s, c, p) { if (H.comboTotal(s, p) > H.comboTotal(s, opp(p))) H.gainPower(s, p, 2); } };
  E['G3-forest'] = { onEnter(s, c, p) {
    const t = H.rightmost(s, opp(p));
    if (t && H.valueOf(s, t) === 0) H.gainEnergy(s, p, 2);
  } };
  E['G3-mantis'] = {};  // Style, handled in engine resolvePlayed
  E['G3-life'] = { onEnter(s, c, p) {
    const t = H.chooseCard(s, p, 'Life Straight: discard a card from your combo to gain +1 energy?', P(s, p).combo.slice(), { optional: true });
    if (t) { H.discardCard(s, t, p, {}); H.gainEnergy(s, p, 1); }
  } };
  E['G4-forest'] = { endClash(s, c, p) { H.gainEnergy(s, p, 3, true); } };
  E['G4-mantis'] = {};  // Style, handled in engine reorderCombo / swaps
  E['G4-life'] = { onEnter(s, c, p) { if (H.isEndOfRun(s, c)) H.gainEnergy(s, p, 5); } };
  E['G5-forest'] = { onEnter(s, c, p) {
    if (!H.nextToValue(s, c, 5)) return;
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
    if (hand.length < 2 || !H.yesNo(s, p, 'Mantis Hook: discard 2 cards face down to gain +3 energy?')) return;
    H.chooseCards(s, p, 'Mantis Hook: choose 2 cards to discard face down', hand.slice(), 2, 2)
      .forEach(x => H.discardCard(s, x, p, { faceDown: true }));
    H.gainEnergy(s, p, 3);
  } };
  E['G5-life'] = { onEnter(s, c, p) {
    const n = H.neighbors(s, c)[0];
    if (!n) return;
    const price = 10 - H.valueOf(s, n);
    if (P(s, p).energy < price || !H.yesNo(s, p, `Life Hook: pay ${price} energy to draw 2 cards?`)) return;
    P(s, p).energy -= price;
    H.log(s, `${H.pname(p)} pays ${price} energy.`);
    H.draw(s, p, 2);
  } };
  E['G6-forest'] = { onEnter(s, c, p) { if (H.nextToValue(s, c, 6)) H.gainPower(s, p, 6); } };
  E['G6-mantis'] = {};  // reaction Feint, handled in engine resolvePlayed
  E['G6-life'] = { onEnter(s, c, p) {
    const mine = H.comboValues(s, p), theirs = H.comboValues(s, opp(p));
    if (!theirs.length || Math.min(...mine) > Math.max(...theirs)) H.gainPower(s, p, 4);
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
  E['G8-forest'] = { startClash(s, c, p) { if (H.pairCount(s, p) > H.pairCount(s, opp(p))) H.gainPower(s, p, 6); } };
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
    if (n > 0) { P(s, p).energy -= n; H.log(s, `${H.pname(p)} spends ${n} energy.`); H.gainPower(s, p, 5 * n); }
  } };

  // Green characters
  E['C-forest'] = { onPlay(s, p, card) {
    if (!Solo._.colorsOf(s, Object.assign({}, card, { faceDown: false })).includes('Green')) return;
    const t = H.rightmost(s, opp(p));
    const v = t ? H.valueOf(s, t) : 0;
    if (num(card) === v + 3) { H.log(s, 'Forest Oak triggers.'); H.gainEnergy(s, p, 1); }
  } };
  E['C-young'] = {
    onPlay(s, p, card) {
      if (num(card) % 2 !== 0) return;
      H.log(s, 'Young Joey Sprout triggers.');
      H.mill(s, p, 1, { faceDown: true });
    },
    endClash(s, p) {
      if (P(s, p).maxEnergy < 18 && P(s, p).discard.filter(x => x.faceDown).length >= 5) {
        P(s, p).maxEnergy = 18;
        H.log(s, 'Young Joey Sprout: max energy is now 18.');
      }
    },
  };
  E['C-jack'] = { onPlay(s, p, card) {
    const left = H.neighbors(s, card)[0];
    const loc = H.where(s, card);
    if (!loc || loc.zone !== 'combo' || !left || loc.idx === 0) return;
    if (H.valueOf(s, P(s, p).combo[loc.idx - 1]) === num(card)) { H.log(s, 'Jack Spades: pair!'); H.gainEnergy(s, p, 1); }
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
  E['K1-death'] = { onFlip(s, c, p) { if (H.colorCount(s, p) >= 3) H.draw(s, p, 1); } };
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
    if (H.activeIn(s, o, 'G4-mantis').length) { H.log(s, 'Mantis Cross: that combo can\'t be moved.'); return; }
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
    if (any) for (let i = 0; i < 2 && P(s, p).deck.length; i++) H.putIntoCombo(s, P(s, p).deck[0], p, true);
  } };
  E['K7-death'] = { onEnter(s, c, p) {
    const downs = P(s, p).combo.filter(x => x.faceDown);
    if (downs.length < 2) return;
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
    endClash(s, c, p) { c.keep = true; H.log(s, 'Ink Finisher stays in the combo.'); },
  };
  E['K9-death'] = {};   // Style, handled in engine valueOf

  // Black characters
  E['C-noct'] = {};     // handled in engine valueOf
  E['C-evelyn'] = {
    onPlay(s, p, card) {
      if (num(card) !== 3) return;
      H.log(s, 'Evelyn Shadow triggers.');
      for (const q of [p, opp(p)]) {
        const t = H.chooseCard(s, q, 'Evelyn Shadow: put a card from your hand face down into your combo', P(s, q).hand.slice());
        if (t) H.putIntoCombo(s, t, q, true);
      }
    },
    startClash(s, p) {
      H.log(s, 'Evelyn Shadow: all face-down cards are turned face up (numbers only).');
      for (const q of [0, 1]) for (const x of P(s, q).combo) if (x.faceDown) { x.faceDown = false; x.silenced = true; }
    },
  };
  E['C-dante'] = { startClash(s, p) {
    const n = H.colorCount(s, p), o = opp(p);
    if (n >= 3) { H.log(s, 'Dante: 3+ colors.'); H.mill(s, o, 5, { discarder: o }); }
    if (n >= 5) { H.log(s, 'Dante: 5 colors.'); H.loseLife(s, o, H.colorCount(s, o), p); }
  } };

  // ================================================================ helpers
  function drawThenDiscard(s, p, d, k) {
    H.draw(s, p, d);
    H.chooseCards(s, p, `Discard ${k} card${k === 1 ? '' : 's'}`, P(s, p).hand.slice(), k, k)
      .forEach(x => H.discardCard(s, x, p, {}));
  }
  Solo.fx = { drawThenDiscard, faceUp, num };
})(typeof window !== 'undefined' ? window : globalThis);
