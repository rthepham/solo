// Deck building: rules check and share codes. No UI here (see js/ui.js).
//
// A deck is { name, character, cards: { cardId: copies } }.
// Rules (rulebook "Deck Building"): one character, exactly 40 numbered cards,
// at most 2 copies of each card.
//
// Share code: "S1-" + base64url(byte 0 = character index, bytes 1..27 = the
// copies of every numbered card in id order, 5 cards per byte in base 3),
// then optionally "." + base64url(UTF-8 name). About 40 characters.
(function (root) {
  'use strict';
  const Solo = root.Solo;
  const Decks = Solo.Decks = {};
  const SIZE = 40, MAX_COPIES = 2, PREFIX = 'S1-';
  Decks.SIZE = SIZE;
  Decks.MAX_COPIES = MAX_COPIES;

  // Stable orders for codes. Changing the card list means a new code version.
  const CARD_IDS = Solo.NUMBERS.map(c => c.id).sort();
  const CHAR_IDS = Solo.CHARACTERS.map(c => c.id).sort();

  Decks.count = cards => Object.values(cards || {}).reduce((t, n) => t + n, 0);
  Decks.toList = cards => Object.keys(cards).sort().flatMap(id => Array(cards[id]).fill(id));
  Decks.fromList = list => list.reduce((m, id) => { m[id] = (m[id] || 0) + 1; return m; }, {});

  // Returns a list of problems (empty = legal deck).
  Decks.validate = function (deck) {
    const errs = [];
    if (!deck || typeof deck !== 'object') return ['Not a deck.'];
    const ch = Solo.DATA[deck.character];
    if (!ch || ch.kind !== 'character' || !Solo.EFFECTS[deck.character]) errs.push('Pick a character.');
    const cards = deck.cards && typeof deck.cards === 'object' ? deck.cards : {};
    for (const [id, n] of Object.entries(cards)) {
      const d = Solo.DATA[id];
      if (!d || d.kind !== 'number' || !Solo.EFFECTS[id]) errs.push(`Unknown card "${id}".`);
      else if (!Number.isInteger(n) || n < 0) errs.push(`Bad number of copies for ${d.name}.`);
      else if (n > MAX_COPIES) errs.push(`At most ${MAX_COPIES} copies of ${d.name} (has ${n}).`);
    }
    const total = Decks.count(cards);
    if (total !== SIZE) errs.push(`A deck needs exactly ${SIZE} cards (this one has ${total}).`);
    return errs;
  };

  // Same check for a plain list of 40 card ids (what an online guest sends).
  Decks.validateList = (character, list) => Array.isArray(list) && list.every(id => typeof id === 'string')
    ? Decks.validate({ character, cards: Decks.fromList(list) }) : ['The deck must be a list of card ids.'];

  // ---------------------------------------------------------------- codes
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = str => {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    return Array.from(atob(s + '==='.slice((s.length + 3) % 4)), ch => ch.charCodeAt(0));
  };

  Decks.encode = function (deck) {
    const bytes = [Math.max(0, CHAR_IDS.indexOf(deck.character))];
    for (let i = 0; i < CARD_IDS.length; i += 5) {
      let v = 0;
      for (let k = 4; k >= 0; k--) v = v * 3 + Math.min(MAX_COPIES, (deck.cards[CARD_IDS[i + k]] || 0));
      bytes.push(v);
    }
    let code = PREFIX + b64(bytes);
    if (deck.name) code += '.' + b64(Array.from(new TextEncoder().encode(String(deck.name).slice(0, 40))));
    return code;
  };

  // Returns { ok: true, deck } or { ok: false, error }. The deck may still break the rules; check with validate().
  Decks.decode = function (code) {
    const bad = error => ({ ok: false, error });
    const s = String(code || '').trim();
    if (!s.startsWith(PREFIX)) return bad('That is not a Solo deck code (they start with "S1-").');
    const [body, namepart] = s.slice(PREFIX.length).split('.');
    let bytes;
    try { bytes = unb64(body); } catch (e) { return bad('The deck code is damaged or incomplete (was it copied completely?).'); }
    if (bytes.length !== 1 + Math.ceil(CARD_IDS.length / 5)) return bad('The deck code is damaged or incomplete (was it copied completely?).');
    const character = CHAR_IDS[bytes[0]];
    if (!character) return bad('The deck code names an unknown character.');
    const cards = {};
    for (let b = 1; b < bytes.length; b++) {
      let v = bytes[b];
      if (v > 242) return bad('The deck code is damaged.');
      for (let k = 0; k < 5; k++) {
        const n = v % 3; v = Math.floor(v / 3);
        const id = CARD_IDS[(b - 1) * 5 + k];
        if (n && id) cards[id] = n;
      }
    }
    let name = '';
    if (namepart) { try { name = new TextDecoder().decode(new Uint8Array(unb64(namepart))); } catch (e) { name = ''; } }
    return { ok: true, deck: { name: name || 'Imported deck', character, cards } };
  };
})(typeof window !== 'undefined' ? window : globalThis);
