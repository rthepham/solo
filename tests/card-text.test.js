// Short card text (js/card-text.js): present for every card, short, consistent,
// and every number on the card also appears in the card's full rules reading.
(function () {
  'use strict';
  const { ok } = T;
  const tt = (name, fn) => T.tests.push({ group: 'card text', card: null, name, fn });
  const TEXT = Solo.CARD_TEXT;
  const ids = Object.keys(Solo.DATA);

  tt('Every card has short text, and nothing extra', () => {
    const missing = ids.filter(id => !TEXT[id]);
    ok(!missing.length, 'missing: ' + missing.join(', '));
    const extra = Object.keys(TEXT).filter(id => !Solo.DATA[id]);
    ok(!extra.length, 'unknown ids: ' + extra.join(', '));
  });

  tt('Short text is short and in one style', () => {
    const starts = new RegExp('^(' + Solo.CARD_KEYWORDS.join('|') + '|Costs \\d+ less|Can be played next to|Also counts as|Free to play|When you play|Your face-down)');
    for (const id of ids) {
      const t = TEXT[id];
      const max = Solo.DATA[id].kind === 'character' ? 175 : 125;
      ok(t.length <= max, `${id} is ${t.length} characters (max ${max})`);
      ok(starts.test(t), `${id} should start with a keyword: "${t}"`);
      ok(/[.)]$/.test(t), `${id} should end with a full stop`);
      ok(!/\[|UNCLEAR|RULING/.test(t), `${id} has a note in it`);
      ok(!/\bpower\b/.test(t) && !/\bEnergy\b/.test(t), `${id}: write "Power" and "energy"`);
    }
  });

  tt('Every number on a card also appears in its full rules', () => {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    for (const id of ids) {
      const d = Solo.DATA[id];
      const rules = d.reading + ' ' + (d.text || '');
      const have = new Set((rules.match(/\d+/g) || []).map(Number));
      Object.entries(words).forEach(([w, n]) => { if (new RegExp('\\b' + w + '\\b', 'i').test(rules)) have.add(n); });
      if (d.kind === 'number') have.add(d.number);
      if (/run of 3|runs?\b/.test(rules)) have.add(3);
      for (const n of (TEXT[id].match(/\d+/g) || []).map(Number)) {
        ok(have.has(n), `${id}: "${TEXT[id]}" mentions ${n}, the rules don't`);
      }
    }
  });
})();
