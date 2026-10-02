// Online play without a network: a host session and a guest session pass
// JSON messages through an in-memory pipe. Checks that both views stay in
// sync, prompts reach only the right player, and the guest never receives
// hidden information.
(function () {
  'use strict';
  const { eq, ok } = T;
  const O = Solo.Online;
  const onl = (name, fn) => T.tests.push({ group: 'online', card: null, name, fn });

  // ------------------------------------------------------------------ pipe
  // Messages are queued (JSON round-trip, like PeerJS 'json' serialization)
  // and delivered by net.flush(), so nothing recurses.
  function makeNet() {
    const q = [];
    const net = { q, toGuest: [], links: [] };
    net.link = (host, guest) => {
      const link = { open: true };
      link.hostSide = { send: m => link.open && q.push(() => { const c = JSON.parse(JSON.stringify(m)); net.toGuest.push(c); guest.receive(c); }),
                        close: () => { link.open = false; } };
      link.guestSide = { send: m => link.open && q.push(() => host.receive(link.hostSide, JSON.parse(JSON.stringify(m)))),
                         close: () => { link.open = false; } };
      guest.attach(link.guestSide);
      net.links.push(link);
      return link;
    };
    net.drop = link => { link.open = false; q.length = 0; };
    net.flush = () => { let n = 0; while (q.length) { q.shift()(); if (++n > 100000) throw new Error('message loop'); } };
    return net;
  }

  function start(seed, hostChoice, guestChoice, token = 'guest-token') {
    const host = new O.HostSession({ host: hostChoice || { character: 'C-asher', style: 'mono' }, seed: seed || 'online-test-seed' });
    const guest = new O.GuestSession(Object.assign({ token }, guestChoice || { character: 'C-spring', style: 'mono' }));
    const net = makeNet();
    const link = net.link(host, guest);
    net.flush();
    return { host, guest, net, link };
  }

  const strip = v => { const c = JSON.parse(JSON.stringify(v)); delete c.log; return c; };
  const guestInSync = (host, guest, msg) => {
    eq(strip(guest.state), strip(O.viewFor(host.state, 1)), (msg || '') + ' guest view == host view for player 2');
    eq(guest.state.log, O.logFor(host.state, 1), (msg || '') + ' guest log == host log for player 2');
  };

  // A random bot that only looks at its own view (proves the views are enough to play).
  function botAction(view, me, R) {
    if (view.phase === 'over') return null;
    const pd = view.pending;
    if (pd) {
      if (pd.player !== me) return null;
      ok(pd.request, 'the player who must choose gets the request');
      const q = pd.request;
      const v = q.kind === 'one' ? q.options[R(q.options.length)].value
        : q.kind === 'many' ? q.options.slice(0, q.min + R(q.max - q.min + 1)).map(o => o.value) : q.min + R(q.max - q.min + 1);
      return { type: 'choose', player: me, value: v };
    }
    if (view.phase !== 'action' || view.turn !== me) return null;
    const playable = view.players[me].hand.filter(c => Solo.canPlay(view, me, c.uid).ok), f = Solo.feintable(view, me);
    return playable.length && R(4) ? { type: 'play', player: me, uid: playable[R(playable.length)].uid }
      : f.length && !R(4) ? { type: 'feint', player: me, uid: f[0].uid } : { type: 'engage', player: me, count: R(3) };
  }
  const fallback = (view, me) => view.pending
    ? { type: 'choose', player: me, value: view.pending.request.kind === 'many' ? [] : view.pending.request.kind === 'number' ? view.pending.request.min : view.pending.request.options[0].value }
    : { type: 'engage', player: me, count: 0 };

  // Plays a whole game between two random bots through the pipe. `each` runs after every step.
  function playGame(seed, each, opts = {}) {
    const R0 = { rng: Solo.RNG.seedToInt(seed + 'bot') };
    const R = n => Solo.RNG.int(R0, n);
    const chars = Solo.CHARACTERS.map(c => c.id);
    const pick = () => ({ character: chars[R(chars.length)], style: R(2) ? 'mixed' : 'mono' });
    const g = start('online-' + seed, pick(), pick());
    let steps = 0, stuck = 0;
    while (g.host.state.phase !== 'over' && steps++ < 4000) {
      const before = g.host.actions.length;
      const hv = g.host.view();
      let a = botAction(hv, 0, R);
      if (a) {
        let r = g.host.localAction(a);
        if (!r.ok) r = g.host.localAction(fallback(hv, 0));
        if (!r.ok) throw new Error('host move refused: ' + r.error);
      } else {
        a = botAction(g.guest.state, 1, R);
        ok(a, 'someone can act');
        g.guest.act(a);
        g.net.flush();
        if (g.guest.error) { g.guest.error = ''; g.guest.act(fallback(g.guest.state, 1)); }
      }
      g.net.flush();
      if (g.guest.error) throw new Error('guest move refused: ' + g.guest.error);
      stuck = g.host.actions.length === before ? stuck + 1 : 0;
      if (stuck > 3) throw new Error('no progress');
      if (each) each(g);
      if (opts.stopAt && steps === opts.stopAt) return g;
    }
    eq(g.host.state.phase, 'over', 'game finished');
    return g;
  }

  // ------------------------------------------------------------------ tests
  onl('Connect: guest joins, game starts, both get the mulligan prompt in turn only', () => {
    const { host, guest } = start();
    eq([host.status, guest.status], ['connected', 'connected']);
    ok(host.state && host.state.pending, 'game started, first mulligan pending');
    guestInSync(host, guest);
    const chooser = host.state.pending.player;
    const hv = host.view(), gv = guest.state;
    ok(chooser === 0 ? hv.pending.request && !gv.pending.request : gv.pending.request && !hv.pending.request,
      'only the chooser gets the prompt; the other sees just who is choosing');
  });

  onl('Version strings must match (both directions)', () => {
    const host = new O.HostSession({ host: { character: 'C-asher', style: 'mono' } });
    const sent = [];
    host.receive({ send: m => sent.push(m), close() {} }, { t: 'hello', version: 'old-version', token: 'x', character: 'C-spring', style: 'mono' });
    eq(sent.map(m => [m.t, m.reason]), [['reject', 'version']]);
    ok(/Version mismatch/.test(sent[0].message) && !host.state, 'clear message; no game started');
    const guest = new O.GuestSession({ token: 't', character: 'C-spring', style: 'mono' });
    guest.attach({ send() {}, close() {} });
    guest.receive({ t: 'welcome', version: 'other-version', seat: 1 });
    eq(guest.status, 'rejected');
    ok(/Version mismatch/.test(guest.rejected.message));
  });

  onl('Hidden info: the guest view does not change when hidden cards change (differential)', () => {
    const swapIds = ['R1-flame', 'U5-check', 'K9-death', 'G2-life', 'Y7-sun'];
    let checks = 0;
    for (let i = 0; i < 8; i++) playGame('diff' + i, g => {
      const s = g.host.state;
      const s2 = JSON.parse(JSON.stringify(s));
      let k = 0;
      const scramble = c => { c.id = swapIds[k++ % swapIds.length]; };
      s2.seed = 'different'; s2.rng = 12345;
      s2.players[0].hand.forEach(scramble);
      s2.players.forEach(pl => pl.deck.forEach(scramble));
      s2.players[1].deck.reverse();
      s2.players.forEach(pl => ['combo', 'discard'].forEach(z => pl[z].forEach(c => { if (c.faceDown && c.owner === 0) scramble(c); })));
      if (s2.pending && s2.pending.base) s2.pending.base = { secret: 'anything' };
      eq(strip(O.viewFor(s2, 1)), strip(O.viewFor(s, 1)), 'view for player 2');
      checks++;
    });
    ok(checks > 150, 'checked many positions: ' + checks);
  });

  onl('Hidden info: guest messages never contain secret fields or ids of hidden cards', () => {
    const msgs = [];
    for (let i = 0; i < 8; i++) msgs.push(...playGame('fields' + i).net.toGuest);
    ok(msgs.length > 150, 'many messages: ' + msgs.length);
    const bad = /"(seed|rng|base|answers|action|nextUid|firstPlayerOverride)":/;
    msgs.forEach(m => {
      if (m.t !== 'state') return;
      const txt = JSON.stringify(m.view);
      ok(!bad.test(txt), 'no secret field in ' + txt.slice(0, 80));
      m.view.players.forEach((pl, p) => {
        ok(pl.deck.every(c => c.hidden && c.id === null && c.uid === null), 'decks hidden');
        if (p === 0) ok(pl.hand.every(c => c.hidden && c.id === null), 'host hand hidden');
        ['combo', 'discard'].forEach(z => pl[z].forEach(c => {
          if (c.faceDown && c.owner === 0) ok(c.hidden && c.id === null && c.uid === null, 'host face-down cards hidden');
        }));
      });
      if (m.view.pending && m.view.pending.player === 0) ok(!m.view.pending.request, 'host prompt not sent to guest');
      ok(!JSON.stringify(m).includes('online-fields'), 'the secret seed never appears in a message (log included)');
    });
  });

  onl('Full games: both views stay in sync and prompts go only to the player who must answer', () => {
    for (const seed of ['sync1', 'sync2', 'sync3']) {
      playGame(seed, g => {
        guestInSync(g.host, g.guest, seed);
        const pd = g.host.state.pending;
        if (pd) {
          const mine = pd.player === 0 ? g.host.view() : g.guest.state;
          const theirs = pd.player === 0 ? g.guest.state : g.host.view();
          ok(mine.pending.request && !theirs.pending.request && theirs.pending.player === pd.player, 'prompt routing');
        }
      });
    }
  });

  onl('Guest log shows the host\'s draws as counts only, and its own draws by name', () => {
    const g = playGame('logs', null, { stopAt: 15 });
    const hostDraw = g.guest.log.find(e => /^Player 1 draws \d+ cards?/.test(e.t));
    const ownDraw = g.guest.log.find(e => /^Player 2 draws \d+ cards?:/.test(e.t));
    ok(hostDraw && !hostDraw.t.includes(':'), 'host draw has no names: ' + (hostDraw && hostDraw.t));
    ok(ownDraw && ownDraw.m, 'own draw named and marked private');
  });

  onl('The guest can only act as Player 2, and debug actions are refused', () => {
    const { host, guest, net } = start('rules');
    const turnState = JSON.stringify(host.state);
    guest.conn.send({ t: 'action', action: { type: 'debug', op: 'set', player: 1, stat: 'life', value: 99 } });
    net.flush();
    ok(/not allowed/.test(guest.error), 'debug refused');
    eq(JSON.stringify(host.state), turnState, 'state unchanged');
    eq(host.localAction({ type: 'debug', op: 'set', player: 0, stat: 'life', value: 99 }).ok, false, 'host debug refused too');
    // Answer the mulligans, then try to act as Player 1 on Player 1's turn.
    while (host.state.pending) {
      if (host.state.pending.player === 0) host.localAction({ type: 'choose', value: false });
      else { guest.act({ type: 'choose', value: false }); }
      net.flush();
    }
    if (host.state.turn === 1) { guest.act({ type: 'engage', count: 0 }); net.flush(); }
    eq(host.state.turn, 0);
    const before = host.actions.length;
    guest.conn.send({ t: 'action', action: { type: 'engage', player: 0, count: 0 } });
    net.flush();
    eq(host.actions.length, before, 'moving for Player 1 is refused');
    ok(/Player 1's turn/.test(guest.error), 'guest told why: ' + guest.error);
  });

  onl('A third player cannot join a full room', () => {
    const { host, net } = start();
    const intruder = new O.GuestSession({ token: 'someone-else', character: 'C-dante', style: 'mono' });
    net.link(host, intruder);
    net.flush();
    eq([intruder.status, intruder.rejected.reason], ['rejected', 'full']);
    eq(host.guestToken, 'guest-token');
  });

  onl('Guest disconnects and rejoins with the room code: picks up where they were', () => {
    const g = playGame('rejoin', null, { stopAt: 15 });
    ok(g.host.state.phase !== 'over', 'mid-game');
    g.net.drop(g.net.links[0]);
    g.host.detach(g.net.links[0].hostSide);
    g.guest.detach();
    eq([g.host.status, g.guest.status], ['disconnected', 'reconnecting']);
    // The host keeps playing while it's their move.
    const hv = g.host.view();
    if (!hv.pending && hv.turn === 0) g.host.localAction({ type: 'engage', count: 0 });
    // Same browser (same token) reconnects.
    g.net.link(g.host, g.guest);
    g.net.flush();
    eq([g.host.status, g.guest.status], ['connected', 'connected']);
    guestInSync(g.host, g.guest, 'after rejoin');
    // A fresh page load (new session object, same saved token) also works.
    g.net.drop(g.net.links[1]); g.host.detach(g.net.links[1].hostSide);
    const fresh = new O.GuestSession({ token: 'guest-token', character: 'C-spring', style: 'mono' });
    g.net.link(g.host, fresh);
    g.net.flush();
    eq(strip(fresh.state), strip(O.viewFor(g.host.state, 1)));
    eq(fresh.state.log, O.logFor(g.host.state, 1), 'full log resent');
  });

  onl('Host refresh: the game is restored from the saved seed + action list', () => {
    let saved = null;
    const g = playGame('restore', null, { stopAt: 15 });
    ok(g.host.state.phase !== 'over', 'mid-game');
    saved = JSON.parse(JSON.stringify(g.host.record()));
    ok(saved.config.seed === 'online-restore' && saved.actions.length >= 15, 'record has seed, decks and actions');
    const restored = O.restoreHost(saved, {});
    eq(JSON.stringify(restored.state), JSON.stringify(g.host.state), 'identical state after replay');
    eq(restored.status, 'disconnected');
    // The guest reconnects to the restored host and the game goes on.
    g.net.drop(g.net.links[0]); g.guest.detach();
    g.net.link(restored, g.guest);
    g.net.flush();
    guestInSync(restored, g.guest, 'after host restore');
  });

  onl('Online seeds and room codes are random and well-formed', () => {
    const codes = new Set(Array.from({ length: 50 }, () => O.newRoomCode()));
    ok(codes.size > 45 && [...codes].every(c => /^[A-HJKMNP-Z2-9]{5}$/.test(c)), 'codes');
    ok(O.newSeed() !== O.newSeed() && O.newSeed().length > 20, 'seeds');
    // Card uids don't reveal identity: the two copies of a card are not 20 apart.
    const cfg = O.buildConfig('online-x', [{ character: 'C-asher', style: 'mono' }, { character: 'C-spring', style: 'mono' }]);
    const d = cfg.players[0].deck;
    ok(d.slice(0, 20).some((id, i) => d[i + 20] !== id), 'deck order shuffled with the secret seed');
  });
})();
