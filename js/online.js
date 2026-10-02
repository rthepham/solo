// Online play, without the network: host and guest sessions, the message
// protocol, and the filtered view each player is sent. js/net.js connects
// these sessions over PeerJS; tests connect them with an in-memory pipe.
//
// The host's browser runs the real engine (Solo.apply) on the full state.
// The guest only ever receives Online.viewFor(state, 1): the opponent's hand,
// both decks, the opponent's face-down cards, the seed, the random generator
// state and the pending choice's saved base state are all removed.
//
// Messages (JSON):
//   guest -> host  { t:'hello', version, token, character, style | deck }   deck: 40 card ids from the deck builder
//                  { t:'action', action }      a move or a choice, as player 1
//                  { t:'ping' }
//   host -> guest  { t:'welcome', version, seat }
//                  { t:'reject', reason, message }
//                  { t:'state', view, logFrom, log }   view has no log; the log is sent incrementally
//                  { t:'error', message }      the guest's action was refused
//                  { t:'pong' }
(function (root) {
  'use strict';
  const Solo = root.Solo;
  const Online = Solo.Online = {};
  const HOST = 0, GUEST = 1;
  const PLAYER_ACTIONS = ['play', 'engage', 'feint', 'choose'];

  // ------------------------------------------------------------------ views
  // What `viewer` may know. Keys are whitelisted so new state fields stay private by default.
  function viewFor(s, viewer) {
    const hidden = c => ({ uid: null, id: null, owner: c.owner, faceDown: !!c.faceDown, silenced: !!c.silenced, keep: false, hidden: true });
    const shown = c => ({ uid: c.uid, id: c.id, owner: c.owner, faceDown: !!c.faceDown, silenced: !!c.silenced, keep: !!c.keep });
    const open = c => (!c.faceDown || c.owner === viewer) ? shown(c) : hidden(c);
    return {
      version: s.version, online: true, viewer,
      round: s.round, firstPlayer: s.firstPlayer, turn: s.turn, phase: s.phase, winner: s.winner,
      lastAction: s.lastAction ? { type: s.lastAction.type, player: s.lastAction.player } : null,
      roundStats: JSON.parse(JSON.stringify(s.roundStats)),
      clash: s.clash ? JSON.parse(JSON.stringify(s.clash)) : null,
      pending: !s.pending ? null : s.pending.player === viewer
        ? { player: s.pending.player, request: JSON.parse(JSON.stringify(s.pending.request)) }
        : { player: s.pending.player },
      players: s.players.map((pl, p) => ({
        character: pl.character, life: pl.life, energy: pl.energy, maxEnergy: pl.maxEnergy, power: pl.power,
        deck: pl.deck.map(hidden),                         // order and identities hidden from both players
        hand: pl.hand.map(c => p === viewer ? shown(c) : hidden(c)),
        combo: pl.combo.map(open),
        discard: pl.discard.map(open),
      })),
      log: logFor(s, viewer),
    };
  }
  // The log rendered for one player: plain text, no private versions left in it.
  function logFor(s, viewer, from = 0) {
    return Solo.logView({ log: s.log.slice(from) }, viewer).map(e => {
      const r = { t: e.text };
      if (e.head) r.k = 'head';
      if (e.dbg) r.dbg = true;
      if (e.mine) r.m = true;
      return r;
    });
  }
  Online.viewFor = viewFor;
  Online.logFor = logFor;

  // ------------------------------------------------------------------ setup helpers
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
  function randomString(n, chars) {
    const out = [];
    const bytes = new Uint32Array(n);
    (root.crypto || require('crypto').webcrypto).getRandomValues(bytes);
    for (let i = 0; i < n; i++) out.push(chars[bytes[i] % chars.length]);
    return out.join('');
  }
  Online.newRoomCode = () => randomString(5, CODE_CHARS);
  Online.newToken = () => randomString(16, 'abcdefghijklmnopqrstuvwxyz0123456789');
  // The host picks the seed. It is long and random so the guest can't guess it
  // (the seed would let them recompute both decks).
  Online.newSeed = () => 'online-' + randomString(20, 'abcdefghijklmnopqrstuvwxyz0123456789');

  // Each player brings a built deck (40 card ids) or a random one (style).
  // Decks are shuffled again with the secret seed before cards get their ids,
  // so a card's uid says nothing about which card it is (buildDeck lists the
  // two copies of each card 20 places apart, and built decks are sorted).
  function buildConfig(seed, choices) {
    return { seed, players: choices.map((ch, p) => {
      const deck = ch.deck ? ch.deck.slice() : Solo.buildDeck(seed + '#' + p, ch.character, ch.style);
      Solo.RNG.shuffle({ rng: Solo.RNG.seedToInt(seed + '|order|' + p) }, deck);
      return { character: ch.character, deck };
    }) };
  }
  Online.buildConfig = buildConfig;

  // Problems with a player's deck choice (empty = fine). Built decks are checked against the deck rules.
  function choiceErrors(c) {
    if (!c || !Solo.DATA[c.character] || Solo.DATA[c.character].kind !== 'character' || !Solo.EFFECTS[c.character]) return ['Pick a character.'];
    if (c.deck !== undefined && c.deck !== null) return Solo.Decks.validateList(c.character, c.deck);
    return c.style === 'mono' || c.style === 'mixed' ? [] : ['Pick a deck.'];
  }
  Online.choiceErrors = choiceErrors;

  // ------------------------------------------------------------------ host
  // opts: { host: {character, style}, seed?, onChange(), save(record) }
  // or Online.restoreHost(record, opts) to rebuild after a refresh.
  function HostSession(opts) {
    this.opts = opts;
    this.host = opts.host;
    this.seed = opts.seed || Online.newSeed();
    this.config = null;
    this.actions = [];
    this.state = null;
    this.guestToken = null;
    this.conn = null;          // the guest's connection: { send(msg), close() }
    this.sentLog = 0;          // log entries the guest already has
    this.status = 'waiting';   // waiting | connected | disconnected
    this.error = '';
  }
  Online.HostSession = HostSession;

  Online.restoreHost = function (record, opts) {
    const h = new HostSession(Object.assign({}, opts, { host: record.host, seed: record.config.seed }));
    h.config = record.config;
    h.actions = record.actions.slice();
    h.guestToken = record.guestToken;
    h.state = Solo.replay(h.config, h.actions);
    h.status = 'disconnected';
    return h;
  };

  HostSession.prototype.record = function () {
    return { host: this.host, config: this.config, actions: this.actions, guestToken: this.guestToken };
  };
  HostSession.prototype.changed = function () {
    if (this.config && this.opts.save) this.opts.save(this.record());
    if (this.opts.onChange) this.opts.onChange();
  };
  HostSession.prototype.view = function () { return this.state ? viewFor(this.state, HOST) : null; };

  HostSession.prototype.sendState = function () {
    if (!this.conn || !this.state) return;
    const v = viewFor(this.state, GUEST);
    const log = v.log;
    delete v.log;
    if (this.sentLog > log.length) this.sentLog = 0;
    this.conn.send({ t: 'state', view: v, logFrom: this.sentLog, log: log.slice(this.sentLog) });
    this.sentLog = log.length;
  };

  HostSession.prototype.receive = function (conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'ping') { conn.send({ t: 'pong' }); return; }
    if (msg.t === 'hello') return this.hello(conn, msg);
    if (conn !== this.conn) return;                       // not the seated guest
    if (msg.t === 'action') {
      const a = msg.action;
      if (!a || typeof a !== 'object' || !PLAYER_ACTIONS.includes(a.type)) {
        conn.send({ t: 'error', message: 'That action is not allowed online.' });
        return;
      }
      const res = this.apply(Object.assign({}, a, { player: GUEST }));
      if (!res.ok) conn.send({ t: 'error', message: res.error });
    }
  };

  HostSession.prototype.hello = function (conn, msg) {
    const reject = (reason, message) => { conn.send({ t: 'reject', reason, message }); conn.close(); };
    if (msg.version !== Solo.VERSION)
      return reject('version', `Version mismatch: the host runs ${Solo.VERSION}, you run ${msg.version}. Both players must load the same version of the game (refresh the page).`);
    if (typeof msg.token !== 'string' || !msg.token) return reject('bad', 'Missing player token.');
    if (this.guestToken && msg.token !== this.guestToken && this.conn)
      return reject('full', 'This room already has two players.');
    if (!this.state) {
      const errs = choiceErrors(msg);
      if (errs.length) return reject('deck', 'The host refused your deck: ' + errs.join(' '));
    }
    if (this.conn && this.conn !== conn) this.conn.close();   // same player rejoining from a new connection
    this.conn = conn;
    this.guestToken = msg.token;
    this.sentLog = 0;
    this.status = 'connected';
    conn.send({ t: 'welcome', version: Solo.VERSION, seat: GUEST });
    if (!this.state) {
      const guestChoice = msg.deck ? { character: msg.character, deck: msg.deck.slice() } : { character: msg.character, style: msg.style };
      this.config = buildConfig(this.seed, [this.host, guestChoice]);
      this.state = Solo.newGame(this.config);
      this.apply({ type: 'start' });
      return;
    }
    this.sendState();
    this.changed();
  };

  // A connection closed (or stopped answering).
  HostSession.prototype.detach = function (conn) {
    if (conn !== this.conn) return;
    this.conn = null;
    this.status = 'disconnected';
    if (this.opts.onChange) this.opts.onChange();
  };

  HostSession.prototype.apply = function (action) {
    const r = Solo.apply(this.state, action);
    if (!r.ok) return r;
    this.actions.push(action);
    this.state = r.state;
    this.sendState();
    this.changed();
    return r;
  };

  // The host's own moves (always player 0). Debug actions are refused online.
  HostSession.prototype.localAction = function (action) {
    if (!this.state) return { ok: false, error: 'Waiting for your friend to join.' };
    if (!action || !PLAYER_ACTIONS.includes(action.type)) return { ok: false, error: 'That action is not allowed online.' };
    return this.apply(Object.assign({}, action, { player: HOST }));
  };

  // ------------------------------------------------------------------ guest
  // opts: { token, character, style, onChange() }
  function GuestSession(opts) {
    this.opts = opts;
    this.token = opts.token;
    this.conn = null;
    this.state = null;         // the latest view from the host (with the log rebuilt)
    this.log = [];
    this.status = 'connecting';  // connecting | connected | reconnecting | rejected
    this.error = '';
    this.rejected = null;
  }
  Online.GuestSession = GuestSession;

  GuestSession.prototype.changed = function () { if (this.opts.onChange) this.opts.onChange(); };

  GuestSession.prototype.attach = function (conn) {
    this.conn = conn;
    conn.send({ t: 'hello', version: Solo.VERSION, token: this.token, character: this.opts.character, style: this.opts.style, deck: this.opts.deck || null });
  };
  GuestSession.prototype.detach = function () {
    this.conn = null;
    if (this.status !== 'rejected') this.status = 'reconnecting';
    this.changed();
  };

  GuestSession.prototype.receive = function (msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'welcome':
        if (msg.version !== Solo.VERSION) {
          this.status = 'rejected';
          this.rejected = { reason: 'version', message: `Version mismatch: the host runs ${msg.version}, you run ${Solo.VERSION}. Both players must load the same version of the game (refresh the page).` };
          if (this.conn) this.conn.close();
        } else { this.status = 'connected'; this.error = ''; }
        return this.changed();
      case 'reject':
        this.status = 'rejected';
        this.rejected = { reason: msg.reason, message: msg.message };
        return this.changed();
      case 'state':
        if (this.status === 'rejected') return;
        this.log = this.log.slice(0, msg.logFrom).concat(msg.log);
        this.state = Object.assign({}, msg.view, { log: this.log });
        this.error = '';
        return this.changed();
      case 'error':
        this.error = msg.message;
        return this.changed();
    }
  };

  GuestSession.prototype.act = function (action) {
    if (!this.conn || this.status !== 'connected') { this.error = 'Not connected to the host.'; this.changed(); return; }
    this.conn.send({ t: 'action', action: Object.assign({}, action, { player: GUEST }) });
  };
})(typeof window !== 'undefined' ? window : globalThis);
