// Deck builder: rules, share codes, and playing with a built deck (hotseat and online).
(function () {
  'use strict';
  const { eq, ok } = T;
  const D = Solo.Decks;
  const dt = (name, fn) => T.tests.push({ group: 'decks', card: null, name, fn });

  // A legal deck: 20 different cards x 2.
  const legal = (character = 'C-asher', color = 'Red') => {
    const cards = {};
    Solo.NUMBERS.filter(c => c.color === color).slice(0, 20).forEach(c => { cards[c.id] = 2; });
    return { name: 'Test deck', character, cards };
  };

  dt('Rules: exactly 40 cards, at most 2 copies, a real character', () => {
    eq(D.validate(legal()), []);
    const short = legal(); delete short.cards[Object.keys(short.cards)[0]];
    ok(D.validate(short).some(e => /exactly 40/.test(e)), '38 cards rejected');
    const three = legal(); const k = Object.keys(three.cards); three.cards[k[0]] = 3; three.cards[k[1]] = 1;
    ok(D.validate(three).some(e => /At most 2 copies/.test(e)), '3 copies rejected');
    ok(D.validate(Object.assign(legal(), { character: 'R1-flame' })).some(e => /character/.test(e)), 'a numbered card is not a character');
    const unknown = legal(); delete unknown.cards[Object.keys(unknown.cards)[0]]; unknown.cards['X9-fake'] = 2;
    ok(D.validate(unknown).some(e => /Unknown card/.test(e)), 'unknown card rejected');
    // Any colors may be mixed (the rulebook has no color rule).
    const mixed = { character: 'C-dante', cards: {} };
    Solo.NUMBERS.filter((c, i) => i % 6 === 0).slice(0, 20).forEach(c => { mixed.cards[c.id] = 2; });
    eq(D.validate(mixed), [], 'mixed colors are fine');
  });

  dt('Share codes: round trip (cards, character, name with accents/emoji), and short', () => {
    const deck = legal('C-young', 'Green');
    deck.name = 'Grüne Wut 🌿';
    deck.cards[Object.keys(deck.cards)[0]] = 1;
    deck.cards[Solo.NUMBERS.find(c => c.color === 'Black').id] = 1;
    const code = D.encode(deck);
    ok(/^S1-[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?$/.test(code), 'url-safe code: ' + code);
    ok(code.split('.')[0].length <= 45, 'short: ' + code.length);
    const back = D.decode(code);
    ok(back.ok, back.error);
    eq([back.deck.character, back.deck.name, D.toList(back.deck.cards)], [deck.character, deck.name, D.toList(deck.cards)]);
    eq(D.decode(D.encode({ character: 'C-asher', cards: {} })).deck.name, 'Imported deck', 'no name');
  });

  dt('Share codes: damaged or foreign codes give a clear error', () => {
    const code = D.encode(legal());
    for (const [bad, why] of [['hello', /start with "S1-"/], [code.slice(0, 20), /damaged or incomplete/], ['S1-!!!!', /damaged/], ['S1-' + '_'.repeat(38), /damaged|unknown character/]]) {
      const r = D.decode(bad);
      ok(!r.ok && why.test(r.error), `${bad} -> ${r.error}`);
    }
  });

  dt('Hotseat: a built deck plays (the 40 cards in it are exactly the deck)', () => {
    const deck = legal('C-sonny', 'Yellow');
    const list = D.toList(deck.cards);
    eq(list.length, 40);
    const s = Solo.newGame({ seed: 'built', players: [{ character: deck.character, deck: list }, { character: 'C-asher', deck: Solo.buildDeck('x', 'C-asher', 'mono') }] });
    eq(s.players[0].deck.map(c => c.id).sort(), list.slice().sort());
    const r = Solo.apply(s, { type: 'start' });
    ok(r.ok, r.error);
  });

  dt('Online: the guest\'s built deck is used, and an illegal one is refused with the reason', () => {
    const O = Solo.Online;
    const deck = legal('C-spring', 'Blue');
    const host = new O.HostSession({ host: { character: 'C-asher', style: 'mono' }, seed: 'online-decks' });
    const sent = [];
    const conn = { send: m => sent.push(JSON.parse(JSON.stringify(m))), close() {} };
    host.receive(conn, { t: 'hello', version: Solo.VERSION, token: 'g', character: deck.character, deck: D.toList(deck.cards) });
    ok(host.state, 'game started');
    eq(host.config.players[1].deck.slice().sort(), D.toList(deck.cards).sort(), 'guest deck used');
    ok(host.config.players[1].deck.join() !== D.toList(deck.cards).join(), 'order shuffled with the secret seed');
    // Illegal: 3 copies.
    const cheat = D.toList(deck.cards); cheat[0] = cheat[2]; cheat[1] = cheat[2];
    const host2 = new O.HostSession({ host: { character: 'C-asher', style: 'mono' } });
    const sent2 = [];
    host2.receive({ send: m => sent2.push(m), close() {} }, { t: 'hello', version: Solo.VERSION, token: 'g', character: 'C-spring', deck: cheat });
    ok(!host2.state && sent2[0].t === 'reject' && /At most 2 copies/.test(sent2[0].message), JSON.stringify(sent2[0]));
    // The host can bring a built deck too.
    const host3 = new O.HostSession({ host: { character: deck.character, deck: D.toList(deck.cards) } });
    host3.receive({ send() {}, close() {} }, { t: 'hello', version: Solo.VERSION, token: 'g', character: 'C-asher', style: 'mixed' });
    eq(host3.config.players[0].deck.slice().sort(), D.toList(deck.cards).sort(), 'host deck used');
  });
})();
