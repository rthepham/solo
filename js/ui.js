// UI for hotseat and online play. Reads game state and sends action objects;
// it never changes game state itself.
//   hotseat: actions go to Solo.apply on the local state.
//   host:    actions go to the Online.HostSession, which runs the engine.
//   guest:   actions are sent to the host; the screen shows the host's filtered view.
(function () {
  'use strict';
  const H = Solo._;
  const O = Solo.Online;
  const app = document.getElementById('app');
  const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const COLOR_VAR = { Red: 'var(--red)', Blue: 'var(--blue)', Yellow: 'var(--yellow)', Green: 'var(--green)', Black: 'var(--black)' };

  const ui = {
    mode: null,       // null (setup screen) | 'hotseat' | 'host' | 'guest'
    game: null,       // hotseat: { config, actions: [], state }
    online: null,     // { session, net, code, notice }
    viewer: null,     // player whose private info is on screen
    passTo: null,     // hotseat: show the pass-the-device screen for this player
    error: '',
    debug: false,
    reveal: false,
    setupTab: 'hotseat',
    joinCode: '',
    // screen-only state (never part of the game)
    sel: null,        // selected hand card uid
    picks: [],        // values picked so far in a "choose several" prompt
    pickKey: '',      // which prompt `picks` belongs to
    num: 0,           // value in a "choose a number" prompt
    drawer: null,     // player whose discard pile is open
    pinned: null,     // card id shown in the inspector (tap / click)
    hover: null,      // card id under the mouse
    clashAt: null,    // log index of the clash being shown in the results overlay
    overSeen: false,  // game-over overlay dismissed
    logMin: false,    // narrow screens: log collapsed
    snap: null,       // previous render, for highlights: { key, stats, cards, logLen, myTurn }
    toast: '',
  };
  window.soloUI = ui;
  const online = () => ui.mode === 'host' || ui.mode === 'guest';

  // ---------------------------------------------------------------- storage
  // sessionStorage: survives a refresh of this tab (auto-resume).
  // localStorage: the host's game record and the guest's seat token, per room.
  const store = {
    get(area, k) { try { const v = window[area].getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(area, k, v) { try { window[area].setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(area, k) { try { window[area].removeItem(k); } catch (e) { /* storage unavailable */ } },
  };

  // ---------------------------------------------------------------- setup
  function playableChars() { return Solo.CHARACTERS.filter(c => Solo.EFFECTS[c.id]); }
  const charOptions = sel => playableChars().map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)} (${c.color}, ${esc(c.archetype)})</option>`).join('');

  // Saved decks live in this browser: [{ id, name, character, cards: { id: copies }, updated }].
  const loadDecks = () => store.get('localStorage', 'solo-decks') || [];
  const saveDecks = list => store.set('localStorage', 'solo-decks', list);
  const deckLegal = d => Solo.Decks.validate(d).length === 0;

  // One "Deck" picker: a saved deck, or a random deck for a chosen character.
  function deckPickerHTML(prefix, defChar) {
    const decks = loadDecks();
    const sel = store.get('localStorage', 'solo-pick-' + prefix) || 'random-mono';
    const opt = (v, label, dis) => `<option value="${v}" ${v === sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(label)}</option>`;
    return `<select id="${prefix}deck" data-deckpick="${prefix}">
        ${opt('random-mono', 'Random deck: character\'s color')}${opt('random-mixed', 'Random deck: all colors')}
        ${decks.length ? `<optgroup label="Your decks">${decks.map(d => opt('deck:' + d.id, `${d.name} — ${Solo.DATA[d.character] ? Solo.DATA[d.character].name : '?'}${deckLegal(d) ? '' : ' (not finished)'}`, !deckLegal(d))).join('')}</optgroup>` : ''}
      </select>
      <select id="${prefix}char" ${sel.startsWith('deck:') ? 'style="display:none"' : ''}>${charOptions(defChar)}</select>`;
  }
  // What a picker means: { character, style } or { character, deck: [40 ids], name }.
  function pickedChoice(prefix) {
    const v = document.getElementById(prefix + 'deck').value;
    store.set('localStorage', 'solo-pick-' + prefix, v);
    if (v.startsWith('deck:')) {
      const d = loadDecks().find(x => 'deck:' + x.id === v);
      if (d && deckLegal(d)) return { character: d.character, deck: Solo.Decks.toList(d.cards), name: d.name };
    }
    return { character: document.getElementById(prefix + 'char').value, style: v === 'random-mixed' ? 'mixed' : 'mono' };
  }

  function renderSetup() {
    const chars = playableChars();
    const seed = 'solo-' + Math.floor(Math.random() * 1e6);
    const tab = ui.setupTab;
    if (tab === 'decks') { renderDeckBuilder(); return; }
    const last = store.get('localStorage', 'solo-last-host');
    const lastRec = last && store.get('localStorage', 'solo-host-' + last);
    const lastState = lastRec && lastRec.record.config ? `room ${esc(last)}` : '';
    app.innerHTML = `
      <div class="setup">
        <h1>Solo — The Card Game</h1>
        <p class="muted">Reduce your opponent's life to 0, or have the most life when a deck runs out.</p>
        ${tabsHTML(tab)}
        ${ui.online && ui.online.notice ? `<div class="error">${esc(ui.online.notice)}</div>` : ''}
        ${tab === 'hotseat' ? `
        <div class="row"><label>Seed</label><input id="seed" value="${seed}" size="24"></div>
        ${[0, 1].map(p => `<div class="row"><label>Player ${p + 1}</label>${deckPickerHTML('p' + p, chars[p % chars.length].id)}</div>`).join('')}
        <div class="row"><label>Debug mode</label><input type="checkbox" id="debug"> <span class="muted small">Card/stat editor, both hands visible, no pass screen</span></div>
        <div class="row"><button class="primary" id="start">Start game</button></div>
        <p class="muted small">Build your own decks in the <b>Decks</b> tab. Random decks are 20 different cards &times; 2, picked from the seed; the same seed and moves always replay the same game.</p>
        ` : `
        <div class="row"><label>Your deck</label>${deckPickerHTML('o', chars[0].id)}</div>
        <div class="box2">
          <h2>Host a game</h2>
          <p class="muted small">You get a short room code. Send it to your friend. Your browser runs the game, so keep this page open.</p>
          <div class="row"><button class="primary" id="host">Host</button>
            ${lastState ? `<button id="resume">Resume hosting ${lastState}</button>` : ''}</div>
        </div>
        <div class="box2">
          <h2>Join a game</h2>
          <div class="row"><input id="code" placeholder="Room code" size="10" maxlength="5" value="${esc(ui.joinCode)}" style="text-transform:uppercase"><button class="primary" id="join">Join</button></div>
        </div>
        <p class="muted small">Online play connects the two browsers directly (PeerJS, loaded from unpkg.com). Debug mode is off online.</p>
        `}
      </div>`;
    bindTabs();
    app.querySelectorAll('[data-deckpick]').forEach(s => {
      s.onchange = () => { document.getElementById(s.dataset.deckpick + 'char').style.display = s.value.startsWith('deck:') ? 'none' : ''; };
    });
    if (tab === 'hotseat') {
      document.getElementById('start').onclick = () => {
        const seedV = document.getElementById('seed').value || 'solo';
        const players = [0, 1].map(p => {
          const c = pickedChoice('p' + p);
          return { character: c.character, deck: c.deck || Solo.buildDeck(seedV + '#' + p, c.character, c.style) };
        });
        ui.debug = document.getElementById('debug').checked;
        ui.reveal = ui.debug;
        startGame({ seed: seedV, players });
      };
    } else {
      document.getElementById('host').onclick = () => startHost({ choice: pickedChoice('o') });
      const r = document.getElementById('resume');
      if (r) r.onclick = () => startHost({ code: last, record: lastRec.record });
      document.getElementById('join').onclick = () => {
        const code = document.getElementById('code').value.trim().toUpperCase();
        if (!/^[A-Z0-9]{5}$/.test(code)) { ui.joinCode = code; ui.online = { notice: 'Room codes are 5 letters/numbers.' }; render(); return; }
        startGuest(code, pickedChoice('o'));
      };
    }
  }

  const tabsHTML = tab => `<div class="tabs">${[['hotseat', 'Hotseat (one screen)'], ['online', 'Online (two computers)'], ['decks', 'Decks']]
    .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>`;
  function bindTabs() {
    app.querySelectorAll('[data-tab]').forEach(b => {
      b.onclick = () => {
        if (ui.setupTab === 'decks' && ui.db && ui.db.dirty && !confirm('Leave the deck builder without saving your changes?')) return;
        ui.setupTab = b.dataset.tab; if (ui.online) ui.online.notice = ''; render();
      };
    });
  }

  // ---------------------------------------------------------------- deck builder
  const COLORS = Solo.COLORS;
  const FAMILIES = [...new Set(Solo.NUMBERS.map(c => c.name.split(' ')[0]))];
  const newDeck = () => ({ id: null, name: 'New deck', character: playableChars()[0].id, cards: {} });
  function dbState() {
    if (!ui.db) ui.db = { deck: newDeck(), dirty: false, msg: '', f: { colors: [], nums: [], family: '', text: '', inDeck: false } };
    return ui.db;
  }

  function renderDeckBuilder() {
    const db = dbState();
    app.innerHTML = `<div class="wrap builder">
      <div class="topbar"><b style="font-size:18px">Deck builder</b><span class="spacer"></span>${tabsHTML('decks')}</div>
      <div class="dblayout">
        <div><div id="dbfilters">${dbFiltersHTML(db)}</div><div id="dbgrid" class="cards dbgrid"></div></div>
        <div id="dbpanel" class="dbpanel"></div>
      </div></div>`;
    bindTabs();
    dbRefresh();
  }
  // Redraws the card grid and the deck panel (not the filters, so typing in search keeps focus).
  function dbRefresh() {
    const db = dbState();
    const grid = document.getElementById('dbgrid'), panel = document.getElementById('dbpanel');
    if (grid) grid.innerHTML = dbGridHTML(db);
    if (panel) panel.innerHTML = dbPanelHTML(db);
  }

  function dbFiltersHTML(db) {
    const f = db.f;
    const chip = (kind, v, label, on, style) => `<button class="chip ${on ? 'on' : ''}" data-dbf="${kind}" data-v="${v}" ${style ? `style="${style}"` : ''}>${label}</button>`;
    return `<div class="dbf">
      <input id="dbtext" placeholder="Search name or text…" value="${esc(f.text)}">
      <div class="chips">${COLORS.map(c => chip('color', c, c, f.colors.includes(c), `--chip:${COLOR_VAR[c]}`)).join('')}</div>
      <div class="chips">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => chip('num', n, n, f.nums.includes(n))).join('')}</div>
      <select id="dbfamily"><option value="">All families</option>${FAMILIES.map(x => `<option ${x === f.family ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <label class="muted small"><input type="checkbox" id="dbindeck" ${f.inDeck ? 'checked' : ''}> only cards in my deck</label>
      ${f.colors.length || f.nums.length || f.family || f.text || f.inDeck ? '<button data-dbclear>Clear filters</button>' : ''}
    </div>`;
  }

  function dbGridHTML(db) {
    const f = db.f, cards = db.deck.cards, text = f.text.trim().toLowerCase();
    const list = Solo.NUMBERS.filter(c => Solo.EFFECTS[c.id] &&
      (!f.colors.length || f.colors.includes(c.color)) && (!f.nums.length || f.nums.includes(c.number)) &&
      (!f.family || c.name.startsWith(f.family + ' ')) && (!f.inDeck || cards[c.id]) &&
      (!text || (c.name + ' ' + c.reading + ' ' + c.color).toLowerCase().includes(text)))
      .sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.number - b.number || a.name.localeCompare(b.name));
    if (!list.length) return '<span class="empty">No cards match these filters.</span>';
    const full = Solo.Decks.count(cards) >= Solo.Decks.SIZE;
    return list.map(c => {
      const n = cards[c.id] || 0;
      const b = `<button data-drem="${c.id}" ${n ? '' : 'disabled'} title="Remove one">−</button><span class="cnt">${n}/2</span><button data-dadd="${c.id}" ${n >= 2 || full ? 'disabled' : ''} title="Add one">+</button>`;
      return cardHTML({ uid: null, id: c.id, faceDown: false, owner: 0 }, { buttons: b, cls: `dbcard ${n ? 'indeck' : ''} n${n}` });
    }).join('');
  }

  function dbPanelHTML(db) {
    const d = db.deck, total = Solo.Decks.count(d.cards), errs = Solo.Decks.validate(d);
    const ch = Solo.DATA[d.character];
    const ids = Object.keys(d.cards).filter(id => d.cards[id]).sort((a, b) => Solo.DATA[a].number - Solo.DATA[b].number || COLORS.indexOf(Solo.DATA[a].color) - COLORS.indexOf(Solo.DATA[b].color));
    const byColor = COLORS.map(c => [c, ids.filter(id => Solo.DATA[id].color === c).reduce((t, id) => t + d.cards[id], 0)]).filter(x => x[1]);
    const curve = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ids.filter(id => Solo.DATA[id].number === n).reduce((t, id) => t + d.cards[id], 0));
    const maxC = Math.max(1, ...curve);
    const saved = loadDecks();
    return `
      <div class="row"><input id="dbname" value="${esc(d.name)}" maxlength="40" style="flex:1;font-weight:700"></div>
      <div class="row"><select id="dbchar" style="flex:1">${charOptions(d.character)}</select></div>
      ${ch ? `<div class="muted small" style="margin-bottom:8px">${esc(ch.reading)}</div>` : ''}
      <div class="dbcount ${total === 40 ? 'ok' : ''}"><b>${total}</b> / 40 cards<div class="meter"><i style="width:${Math.min(100, total / 40 * 100)}%"></i></div></div>
      ${byColor.length ? `<div class="colorbar">${byColor.map(([c, n]) => `<i style="flex:${n};background:${COLOR_VAR[c]}" title="${c}: ${n}"></i>`).join('')}</div>` : ''}
      <div class="curve" title="Cards by number">${curve.map((n, i) => `<div><i style="height:${n / maxC * 100}%"></i><span>${i + 1}</span><b>${n || ''}</b></div>`).join('')}</div>
      <div class="dblist">${ids.map(id => { const c = Solo.DATA[id]; return `<div class="dbrow" data-cid="${id}"><span class="dot" style="background:${COLOR_VAR[c.color]}"></span>
        <span class="nn">${c.number}</span><span class="nm2">${esc(c.name)}</span><span class="x">${d.cards[id]}×</span>
        <button data-drem="${id}">−</button><button data-dadd="${id}" ${d.cards[id] >= 2 || total >= 40 ? 'disabled' : ''}>+</button></div>`; }).join('') || '<div class="empty">Click cards on the left to add them.</div>'}</div>
      ${errs.length ? `<div class="dberr">${errs.map(esc).join('<br>')}</div>` : '<div class="dbok">✓ Ready to play</div>'}
      ${db.msg ? `<div class="dbmsg">${esc(db.msg)}</div>` : ''}
      <div class="row"><button class="primary" data-dbsave>${d.id ? 'Save' : 'Save deck'}</button><button data-dbnew>New</button>
        ${d.id ? '<button data-dbcopy>Duplicate</button><button class="danger" data-dbdel>Delete</button>' : ''}</div>
      <div class="row"><button data-dbshare ${total ? '' : 'disabled'}>Copy share code</button></div>
      <div class="row"><input id="dbimport" placeholder="Paste a deck code (S1-…)" style="flex:1"><button data-dbimport>Import</button></div>
      <h2 style="margin-top:12px">Saved decks (${saved.length})</h2>
      <div class="dbsaved">${saved.map(s => `<button class="${s.id === d.id ? 'on' : ''}" data-dbopen="${s.id}">${esc(s.name)} <span class="muted small">${Solo.DATA[s.character] ? esc(Solo.DATA[s.character].name) : ''} · ${Solo.Decks.count(s.cards)}/40${deckLegal(s) ? '' : ' · not finished'}</span></button>`).join('') || '<span class="muted small">None yet.</span>'}</div>`;
  }

  function dbClick(t, ev) {
    const db = dbState(), d = db.deck, ds = t.dataset;
    const change = fn => { fn(); db.dirty = true; db.msg = ''; dbRefresh(); };
    if (ds.dadd) return change(() => { if ((d.cards[ds.dadd] || 0) < 2 && Solo.Decks.count(d.cards) < 40) d.cards[ds.dadd] = (d.cards[ds.dadd] || 0) + 1; });
    if (ds.drem) return change(() => { d.cards[ds.drem] = Math.max(0, (d.cards[ds.drem] || 0) - 1); if (!d.cards[ds.drem]) delete d.cards[ds.drem]; });
    if (t.classList.contains('dbcard') && ds.cid && ev.target.closest('button') === null)
      return change(() => { if ((d.cards[ds.cid] || 0) < 2 && Solo.Decks.count(d.cards) < 40) d.cards[ds.cid] = (d.cards[ds.cid] || 0) + 1; });
    if (ds.dbf) {
      const key = ds.dbf === 'color' ? 'colors' : 'nums', v = ds.dbf === 'color' ? ds.v : +ds.v;
      db.f[key] = db.f[key].includes(v) ? db.f[key].filter(x => x !== v) : db.f[key].concat([v]);
      document.getElementById('dbfilters').innerHTML = dbFiltersHTML(db);
      return dbRefresh();
    }
    if (ds.dbclear !== undefined) { db.f = { colors: [], nums: [], family: '', text: '', inDeck: false }; document.getElementById('dbfilters').innerHTML = dbFiltersHTML(db); return dbRefresh(); }
    if (ds.dbsave !== undefined) {
      const list = loadDecks();
      if (!d.id) d.id = 'd' + Date.now().toString(36);
      const rec = { id: d.id, name: d.name.trim() || 'Unnamed deck', character: d.character, cards: Object.assign({}, d.cards), updated: Date.now() };
      const i = list.findIndex(x => x.id === d.id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      saveDecks(list);
      db.dirty = false;
      const errs = Solo.Decks.validate(rec);
      db.msg = errs.length ? 'Saved as a draft. It can be used once it\'s legal.' : 'Saved. Pick it under "Deck" in the Hotseat or Online tab.';
      return dbRefresh();
    }
    const guard = () => !db.dirty || confirm('Discard your unsaved changes to this deck?');
    if (ds.dbnew !== undefined) { if (guard()) { db.deck = newDeck(); db.dirty = false; db.msg = ''; dbRefresh(); } return; }
    if (ds.dbopen) {
      if (!guard()) return;
      const s = loadDecks().find(x => x.id === ds.dbopen);
      if (s) { db.deck = JSON.parse(JSON.stringify(s)); db.dirty = false; db.msg = ''; dbRefresh(); }
      return;
    }
    if (ds.dbcopy !== undefined) { db.deck = Object.assign(JSON.parse(JSON.stringify(d)), { id: null, name: d.name + ' (copy)' }); db.dirty = true; db.msg = 'Copy made. Save it to keep it.'; return dbRefresh(); }
    if (ds.dbdel !== undefined) {
      if (!confirm(`Delete the deck "${d.name}"?`)) return;
      saveDecks(loadDecks().filter(x => x.id !== d.id));
      db.deck = newDeck(); db.dirty = false; db.msg = 'Deck deleted.';
      return dbRefresh();
    }
    if (ds.dbshare !== undefined) {
      const code = Solo.Decks.encode(d);
      const done = () => { db.msg = 'Share code copied: ' + code; dbRefresh(); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => { prompt('Deck code:', code); });
      else prompt('Deck code:', code);
      return;
    }
    if (ds.dbimport !== undefined) {
      const r = Solo.Decks.decode(document.getElementById('dbimport').value);
      if (!r.ok) { db.msg = r.error; return dbRefresh(); }
      if (!guard()) return;
      db.deck = Object.assign({ id: null }, r.deck); db.dirty = true;
      db.msg = `Imported "${r.deck.name}". Save it to keep it.`;
      return dbRefresh();
    }
  }
  function dbInput(t) {
    const db = dbState();
    if (t.id === 'dbtext') { db.f.text = t.value; dbRefresh(); }
    else if (t.id === 'dbname') { db.deck.name = t.value; db.dirty = true; }
  }
  function dbChange(t) {
    const db = dbState();
    if (t.id === 'dbfamily') { db.f.family = t.value; dbRefresh(); }
    else if (t.id === 'dbindeck') { db.f.inDeck = t.checked; dbRefresh(); }
    else if (t.id === 'dbchar') { db.deck.character = t.value; db.dirty = true; db.msg = ''; dbRefresh(); }
  }

  function resetScreen() {
    Object.assign(ui, { logSeen: null, sel: null, picks: [], pickKey: '', drawer: null, pinned: null, clashAt: null, overSeen: false, snap: null, toast: '', error: '' });
  }

  function startGame(config) {
    resetScreen();
    ui.mode = 'hotseat';
    ui.game = { config, actions: [], state: Solo.newGame(config) };
    ui.viewer = null; ui.passTo = null;
    dispatch({ type: 'start' });
  }

  // ---------------------------------------------------------------- online setup
  function startHost({ choice, code, record }) {
    resetScreen();
    ui.mode = 'host';
    ui.viewer = 0; ui.debug = false; ui.reveal = false; ui.passTo = null;
    const save = rec => { if (ui.online && ui.online.code) store.set('localStorage', 'solo-host-' + ui.online.code, { record: rec }); };
    const opts = { host: choice, onChange: render, save };
    let session;
    try { session = record ? O.restoreHost(record, opts) : new O.HostSession(opts); }
    catch (e) { ui.mode = null; ui.online = { notice: 'Could not restore that game: ' + e.message }; render(); return; }
    ui.online = { session, code: code || O.newRoomCode(), notice: '', ready: false };
    render();
    Solo.Net.load().then(() => {
      ui.online.net = Solo.Net.host(session, {
        code: ui.online.code, fresh: !record,
        onCode: c => {
          ui.online.code = c; ui.online.ready = true;
          store.set('sessionStorage', 'solo-online', { role: 'host', code: c });
          store.set('localStorage', 'solo-last-host', c);
          if (session.config) save(session.record());
          render();
        },
        onStatus: t => { ui.online.notice = t; render(); },
      });
    }, e => { ui.online.notice = e.message; render(); });
  }

  function startGuest(code, choice) {
    resetScreen();
    ui.mode = 'guest';
    ui.viewer = 1; ui.debug = false; ui.reveal = false; ui.passTo = null;
    let token = store.get('localStorage', 'solo-guest-token-' + code);
    if (!token) { token = O.newToken(); store.set('localStorage', 'solo-guest-token-' + code, token); }
    const session = new O.GuestSession(Object.assign({ token, onChange: render }, choice));
    ui.online = { session, code, notice: '' };
    store.set('sessionStorage', 'solo-online', { role: 'guest', code, choice });
    render();
    Solo.Net.load().then(() => {
      ui.online.net = Solo.Net.join(session, {
        code,
        onStatus: t => { ui.online.notice = t; render(); },
        onNotFound: () => {
          leaveOnline(false);
          ui.setupTab = 'online'; ui.joinCode = code;
          ui.online = { notice: `No game found with code ${code}. Check the code, and that the host's page is still open.` };
          render();
        },
      });
    }, e => { ui.online.notice = e.message; render(); });
  }

  function leaveOnline(forget) {
    if (ui.online && ui.online.net) ui.online.net.stop();
    store.del('sessionStorage', 'solo-online');
    if (forget && ui.mode === 'host' && ui.online && ui.online.code) {
      store.del('localStorage', 'solo-host-' + ui.online.code);
      store.del('localStorage', 'solo-last-host');
    }
    ui.mode = null; ui.online = null; ui.viewer = null;
  }

  // ---------------------------------------------------------------- state & dispatch
  // The state on screen: online games show a filtered view (the host too).
  function current() {
    if (ui.mode === 'hotseat') return ui.game.state;
    if (ui.mode === 'host') return ui.online.session.view();
    if (ui.mode === 'guest') return ui.online.session.state;
    return null;
  }

  function dispatch(action) {
    ui.sel = null;
    if (ui.mode === 'host') {
      const res = ui.online.session.localAction(action);
      ui.error = res.ok ? '' : res.error;
      render();
      return;
    }
    if (ui.mode === 'guest') { ui.online.session.error = ''; ui.online.session.act(action); return; }
    const res = Solo.apply(ui.game.state, action);
    if (!res.ok) { ui.error = res.error; render(); return; }
    ui.error = '';
    ui.game.actions.push(action);
    ui.game.state = res.state;
    const who = Solo.actor(res.state);
    if (who !== null && who !== ui.viewer) {
      if (ui.reveal) ui.viewer = who; else ui.passTo = who;
    }
    render();
  }
  ui.dispatch = dispatch;
  const errorText = () => ui.mode === 'guest' ? ui.online.session.error : ui.error;

  // ---------------------------------------------------------------- helpers
  const def = id => Solo.DATA[id];
  // Card face text: the reading without my interpretation notes ([UNCLEAR] ..., [RULING]); those go in the inspector.
  const faceText = d => d.reading.replace(/\s*\[UNCLEAR\][\s\S]*$/, '').replace(/\s*\[RULING\]/g, '');
  const noteText = d => { const m = d.reading.match(/\[UNCLEAR\]\s*([\s\S]*)$/); return m ? m[1] : ''; };
  const canSee = c => !c.hidden && c.id && (!c.faceDown || ui.reveal || c.owner === ui.viewer);
  const pName = p => online() ? (p === ui.viewer ? 'You' : 'Opponent') : `Player ${p + 1}`;
  const pFull = p => online() ? (p === ui.viewer ? `You (Player ${p + 1})` : `Opponent (Player ${p + 1})`) : `Player ${p + 1}${ui.viewer === p ? ' (you)' : ''}`;
  const myPending = s => s.pending && (ui.reveal || s.pending.player === ui.viewer) && s.pending.request;
  const canAct = (s, p) => s.phase === 'action' && !s.pending && s.turn === p && ui.viewer === p;

  // Options of the current prompt, by value, for highlighting board cards.
  function promptInfo(s) {
    const r = myPending(s);
    if (!r) return null;
    const key = `${s.log.length}|${s.pending.player}|${r.prompt}|${r.options.length}`;
    if (key !== ui.pickKey) { ui.pickKey = key; ui.picks = []; ui.num = r.min || 0; }
    const values = new Set(r.options.filter(o => typeof o.value === 'number').map(o => o.value));
    return { r, values };
  }

  // ---------------------------------------------------------------- cards
  // c: a card (or a hidden placeholder). o: { value, buttons, cls, uid }
  function cardHTML(c, o = {}) {
    const uid = c.uid === null || c.uid === undefined ? '' : c.uid;
    const pi = o.pi;
    let cls = o.cls || '';
    if (pi && uid !== '' && pi.values.has(c.uid)) cls += pi.r.kind === 'many' && ui.picks.includes(c.uid) ? ' picked' : ' opt';
    const val = o.value !== undefined && o.value !== null ? o.value : null;
    if (!canSee(c)) {
      return `<div class="card back ${cls}" data-uid="${uid}" title="Face-down card">
        <div class="nm">Face down</div>${val !== null ? `<div class="val">${val}</div>` : ''}${o.buttons ? `<div class="btns">${o.buttons}</div>` : ''}</div>`;
    }
    const d = def(c.id);
    if (c.faceDown) {
      return `<div class="card back ${cls} ${c.silenced ? 'silenced' : ''}" data-uid="${uid}" data-cid="${c.id}" title="Face down (you can see it)">
        <div class="nm">Face down</div><div class="peek">${d.color} ${d.number}<br>${esc(d.name)}</div>
        ${val !== null ? `<div class="val">${val}</div>` : ''}${o.buttons ? `<div class="btns">${o.buttons}</div>` : ''}</div>`;
    }
    const showVal = val !== null && val !== d.number;
    return `<div class="card ${d.color} ${cls} ${c.silenced ? 'silenced' : ''}" data-uid="${uid}" data-cid="${c.id}">
      ${c.silenced ? '<span class="tag">no abilities</span>' : ''}
      <div class="top"><div class="n">${d.number}</div><div class="nm">${esc(d.name)}</div></div>
      <div class="tx">${esc(faceText(d))}</div>
      ${o.buttons ? `<div class="btns">${o.buttons}</div>` : ''}
      ${showVal ? `<div class="val" title="current value">${val}</div>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- board
  function statHTML(p, k, label, value, extra, pct) {
    return `<div class="stat ${k}" data-stat="${p}-${k}"><div class="k">${label}</div><div class="v">${value}${extra ? `<small>${extra}</small>` : ''}</div>
      ${pct !== undefined ? `<div class="meter"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>` : ''}</div>`;
  }

  function stripHTML(s, p) {
    const pl = s.players[p];
    const ch = def(pl.character);
    const active = (s.phase === 'action' && s.turn === p && !s.pending) || (s.pending && s.pending.player === p);
    const handBacks = p === ui.viewer || ui.reveal ? '' :
      `<div class="backs" title="Cards in hand">${pl.hand.slice(0, 10).map(() => '<div class="mini"></div>').join('')}<span class="cnt">${pl.hand.length} in hand</span></div>`;
    return `<div class="pstrip ${active ? 'active' : ''}">
      <div class="who" data-cid="${pl.character}">
        <div class="portrait" style="background:${COLOR_VAR[ch.color]}">${esc(ch.name[0])}</div>
        <div><div class="pn">${pFull(p)}</div><div class="cname">${esc(ch.name)} · ${ch.color} ${esc(ch.archetype)}</div>
        ${s.firstPlayer === p ? '<div class="first">★ first this round</div>' : ''}</div>
      </div>
      <div class="bars">
        ${statHTML(p, 'life', '♥ Life', pl.life, '', pl.life * 10)}
        ${statHTML(p, 'energy', '⚡ Energy', pl.energy, ' / ' + pl.maxEnergy, pl.energy / Math.max(1, pl.maxEnergy) * 100)}
        ${statHTML(p, 'power', '✊ Power', pl.power)}
        ${statHTML(p, 'total', 'Σ Clash total', Solo.clashTotal(s, p))}
      </div>
      <div class="piles">
        ${handBacks}
        <div class="pile" title="Deck">${pl.deck.length}<span class="pl">deck</span></div>
        <button class="pile" data-discard="${p}" title="Open discard pile">${pl.discard.length}<span class="pl">discard ▾</span></button>
      </div>
    </div>`;
  }

  function laneHTML(s, p, pi) {
    const pl = s.players[p];
    const act = canAct(s, p);
    const feints = act ? Solo.feintable(s, p) : [];
    const cards = pl.combo.map(c => {
      let b = '';
      if (feints.includes(c)) b += `<button data-feint="${c.uid}" title="Use this card's Feint (takes your action)">Feint</button>`;
      if (ui.debug) b += `<button data-dbg="flip" data-uid="${c.uid}" title="debug: toggle face">⟲</button><button data-dbg="remove" data-uid="${c.uid}" title="debug: remove">✕</button>`;
      return cardHTML(c, { value: H.valueOf(s, c), buttons: b, pi, cls: feints.includes(c) ? 'feintable' : '' });
    }).join('') || '<span class="empty">empty combo</span>';
    const vals = H.comboValues(s, p);
    return `<div class="lane"><div class="lanelbl">${pName(p)} combo</div><div class="cards">${cards}</div>
      <div class="sum"><b>${Solo.clashTotal(s, p)}</b><span>${pl.power} power<br>+ ${vals.reduce((a, b) => a + b, 0)} combo</span></div></div>`;
  }

  function handHTML(s, p, pi) {
    const pl = s.players[p];
    const act = canAct(s, p);
    if (ui.sel !== null && !pl.hand.some(c => c.uid === ui.sel)) ui.sel = null;
    const cards = pl.hand.map(c => {
      let b = '', cls = '';
      if (act) {
        const chk = Solo.canPlay(s, p, c.uid);
        cls = chk.ok ? 'playable' : 'unplayable';
        if (ui.sel === c.uid) {
          cls += ' sel';
          b = chk.ok ? `<button class="primary" data-play="${c.uid}">Play · ${chk.cost}⚡</button>` : `<span class="why">${esc(chk.reason)}</span>`;
        }
      }
      if (ui.debug) b += `<button data-dbg="remove" data-uid="${c.uid}">✕</button>`;
      return cardHTML(c, { buttons: b, cls, pi });
    }).join('') || '<span class="empty">no cards in hand</span>';
    return `<div class="cards hand">${cards}</div>`;
  }

  // The bar between the lanes and your hand: your prompt, your turn's actions, or "waiting".
  function decideHTML(s, pi) {
    if (s.phase === 'over') return '';
    const me = ui.viewer;
    if (s.pending) {
      if (!pi) return `<div class="decide wait">${online() ? 'Waiting for opponent…' : `Waiting for Player ${s.pending.player + 1} to choose…`}</div>`;
      const r = pi.r;
      const cardOpts = r.options.filter(o => typeof o.value === 'number');
      const other = r.options.map((o, i) => [o, i]).filter(([o]) => typeof o.value !== 'number');
      // Cards already on the board just glow there; the prompt only draws the others (discard pile, deck).
      const onBoard = uid => s.players.some((pl, p) => pl.combo.some(c => c.uid === uid) ||
        ((p === ui.viewer || ui.reveal) && pl.hand.some(c => c.uid === uid)));
      const optCards = cardOpts.filter(o => !onBoard(o.value)).map(o => {
        const found = findCard(s, o.value);
        const c = found || { uid: o.value, id: o.card || null, owner: o.card ? me : 1 - me, faceDown: !!o.faceDown, hidden: !o.card };
        const loc = (o.label.match(/\[(.*)\]$/) || [])[1] || '';
        return `<div class="optcard">${cardHTML(Object.assign({}, c, { uid: o.value }), { pi, value: found && H.where(s, found) && H.where(s, found).zone === 'combo' ? H.valueOf(s, found) : undefined })}<div class="loc">${esc(loc)}</div></div>`;
      }).join('');
      let controls = '';
      if (r.kind === 'one') controls = other.map(([o, i]) => `<button data-opt="${i}" ${o.value === true ? 'class="primary"' : ''}>${esc(o.label)}</button>`).join('');
      else if (r.kind === 'many') {
        const n = ui.picks.length, okN = n >= r.min && n <= r.max;
        controls = `<span class="muted">${n} chosen (${r.min === r.max ? r.min : r.min + '–' + r.max})</span>
          <button class="primary" data-confirm ${okN ? '' : 'disabled'}>Confirm</button>${n ? '<button data-clearpicks>Clear</button>' : ''}`;
      } else if (r.kind === 'number') {
        controls = `<div class="stepper"><button data-num="-1">−</button><b>${ui.num}</b><button data-num="1">+</button>
          <button data-num="min">${r.min}</button><button data-num="max">${r.max}</button></div><button class="primary" data-numok>OK</button>`;
      }
      const hint = cardOpts.length ? (r.kind === 'many' ? 'Click cards to select them (glowing cards are choices), then Confirm.' : 'Click a glowing card to choose it.') : '';
      return `<div class="decide"><div class="q">${online() ? '' : `<span class="who2">Player ${s.pending.player + 1}:</span> `}${esc(r.prompt)}</div>
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${optCards ? `<div class="opts">${optCards}</div>` : ''}
        <div class="row">${controls}</div></div>`;
    }
    if (s.phase !== 'action') return '';
    const p = s.turn;
    if (!ui.reveal && me !== p) return `<div class="decide wait">${online() ? 'Opponent\'s turn — waiting for them to act…' : ''}</div>`;
    const la = s.lastAction;
    const clashNext = la && la.type === 'engage' && la.player !== p;
    return `<div class="decide"><div class="q">${online() ? 'Your turn.' : `Player ${p + 1}'s turn.`} Click a card in your hand to play it, use a Feint, or Engage.</div>
      <div class="engage">
        <button data-engage="2">Engage · draw 2, discard 2</button>
        <button data-engage="1">Engage · draw 1, discard 1</button>
        <button data-engage="0">Engage · draw 0</button>
        ${clashNext ? '<span class="warn" style="color:var(--accent);font-weight:700">⚔ Your opponent just engaged — engaging now starts the clash!</span>' : ''}
      </div></div>`;
  }

  function findCard(s, uid) {
    for (const pl of s.players) for (const z of ['hand', 'combo', 'discard']) { const c = pl[z].find(x => x.uid === uid); if (c) return c; }
    return null;
  }

  // ---------------------------------------------------------------- side panels
  function inspectorHTML() {
    const id = ui.pinned || ui.hover;
    if (!id || !def(id)) return `<div class="inspector" id="inspector"><div class="muted small">Point at (or tap) any card or character to read it in full here.</div></div>`;
    const d = def(id);
    const big = d.kind === 'number' ? cardHTML({ uid: null, id, faceDown: false, owner: ui.viewer }) : '';
    return `<div class="inspector ${ui.pinned ? 'pinned' : ''}" id="inspector"><button class="closebtn" data-unpin>✕</button>
      <div class="big">${big}<div class="full"><div class="t">${esc(d.kind === 'number' ? `${d.color} ${d.number} ${d.name}` : `${d.name} — ${d.color} ${d.archetype}`)}</div>
      ${esc(d.kind === 'number' ? faceText(d) : d.reading)}${d.kind === 'number' && noteText(d) ? `<div class="orig">Rules note: ${esc(noteText(d))}</div>` : ''}${d.text && d.text !== d.reading ? `<div class="orig">Printed: ${esc(d.text)}</div>` : ''}</div></div></div>`;
  }

  function logHTML(s, fresh) {
    const viewer = ui.reveal ? 'all' : ui.viewer;
    const all = Solo.logView(s, viewer);
    const rows = all.slice(-500).map((e, i, arr) => ({ e, i: all.length - arr.length + i })).reverse().map(({ e, i }) =>
      `<div class="${e.head ? 'head' : ''}${e.dbg ? ' dbg' : ''}${e.mine ? ' mine' : ''}${i >= fresh ? ' fresh' : ''}"${e.mine ? ' title="Only you can see this detail"' : ''}>${esc(e.text)}</div>`).join('');
    return `<div class="logbox ${ui.logMin ? 'min' : ''}"><div class="logtitle">Game log <span class="muted small">newest first${viewer === 'all' ? ' · hidden details shown' : ''}</span><button data-logmin>${ui.logMin ? '▲' : '▼'}</button></div><div class="log" id="log">${rows}</div></div>`;
  }

  function debugHTML() {
    if (!ui.debug) return '';
    const cards = Solo.NUMBERS.map(c => `<option value="${c.id}">${c.color} ${c.number} ${esc(c.name)}${Solo.EFFECTS[c.id] ? '' : ' (not implemented)'}</option>`).join('');
    const chars = Solo.CHARACTERS.map(c => `<option value="${c.id}">${esc(c.name)} (${c.color})${Solo.EFFECTS[c.id] ? '' : ' (not implemented)'}</option>`).join('');
    const pl = '<option value="0">Player 1</option><option value="1">Player 2</option>';
    return `<div class="debug"><h2>Debug</h2>
      <div class="row"><select id="dbgP">${pl}</select></div>
      <div class="row"><select id="dbgCard">${cards}</select></div>
      <div class="row"><select id="dbgZone"><option value="hand">hand</option><option value="combo">combo (right end)</option><option value="discard">discard</option><option value="deckTop">deck top</option></select>
        <label><input type="checkbox" id="dbgDown"> face down</label><button data-dbg="add">Add card</button></div>
      <div class="row"><select id="dbgChar">${chars}</select><button data-dbg="character">Set character</button></div>
      <div class="row"><select id="dbgStat"><option>life</option><option>energy</option><option>power</option><option>maxEnergy</option></select>
        <input id="dbgVal" type="number" value="10" style="width:70px"><button data-dbg="set">Set</button></div>
      <div class="row"><select id="dbgClearZone"><option value="hand">hand</option><option value="combo">combo</option><option value="discard">discard</option><option value="deck">deck</option></select><button data-dbg="clear">Clear zone</button></div>
      <div class="row"><button data-dbg="turn">Give turn to this player</button></div>
      <p class="muted small">Choose a player above, then add cards, set stats or clear zones. Cards added to a combo don't trigger anything.</p>
      <div class="row"><label><input type="checkbox" id="dbgReveal" ${ui.reveal ? 'checked' : ''}> show both hands / skip pass screen</label></div>
      <div class="row"><button data-export>Copy game record (JSON)</button></div>
    </div>`;
  }

  // ---------------------------------------------------------------- overlays
  function overlaysHTML(s, pi) {
    let out = '';
    if (ui.drawer !== null) {
      const pl = s.players[ui.drawer];
      out += `<div class="overlay" data-close><div class="modal"><h2>${pFull(ui.drawer)} — discard pile (${pl.discard.length})</h2>
        <div class="cards">${pl.discard.map(c => cardHTML(c, { pi })).join('') || '<span class="empty">empty</span>'}</div>
        <div class="row" style="margin-top:12px"><button data-close>Close</button></div></div></div>`;
    } else if (s.phase === 'over' && !ui.overSeen) {
      const me = ui.viewer;
      const win = s.winner === 'draw' ? 'Draw!' : online() ? (s.winner === me ? 'You win!' : 'You lose') : `Player ${s.winner + 1} wins!`;
      const cls = s.winner === 'draw' ? '' : online() ? (s.winner === me ? 'win' : 'lose') : 'win';
      const last = Solo.logView(s, ui.reveal ? 'all' : me).filter(e => e.head).slice(-1)[0];
      out += `<div class="overlay"><div class="modal"><div class="result ${cls}">${win}</div>
        ${last ? `<p style="text-align:center">${esc(last.text)}</p>` : ''}
        <div class="row" style="justify-content:center;display:flex;gap:8px"><button data-overok>See the board</button>
        ${online() ? '<button class="primary" data-leave>Leave</button>' : '<button class="primary" data-new>New game</button>'}</div></div></div>`;
    } else if (ui.clashAt !== null) out += clashHTML(s);
    return out;
  }

  // Clash results, read from the log (so each player sees only what their log shows).
  function clashHTML(s) {
    const lines = Solo.logView(s, ui.reveal ? 'all' : ui.viewer);
    const from = ui.clashAt;
    let to = lines.length;
    for (let i = from + 1; i < lines.length; i++) if (lines[i].head && /^Round \d+ begins/.test(lines[i].text)) { to = i; break; }
    const part = lines.slice(from, to);
    const tot = [0, 1].map(p => part.map(e => e.text.match(new RegExp(`^Player ${p + 1}: power (\\d+) \\+ combo (\\d+) \\((.*)\\) = (\\d+)\\.`))).find(Boolean));
    const winLine = part.find(e => / wins the clash, | is a tie, /.test(e.text));
    const winner = winLine && (winLine.text.match(/^Player (\d) wins/) || [])[1];
    const side = p => {
      const m = tot[p];
      return `<div class="side2 ${winner == p + 1 ? 'win' : ''}"><div>${pFull(p)}</div><div class="tot">${m ? m[4] : '…'}</div>
        <div class="brk">${m ? `power ${m[1]} + combo ${m[2]} (${esc(m[3])})` : ''}</div></div>`;
    };
    const waiting = s.pending && !myPending(s) ? '<p class="muted">Waiting for the other player to finish the reset…</p>' : '';
    return `<div class="overlay"><div class="modal"><h2>⚔ ${esc(part[0] ? part[0].text : 'Clash!')}</h2>
      <div class="clashsum">${side(0)}<div class="vsbig">VS</div>${side(1)}</div>
      ${winLine ? `<div class="result" style="font-size:20px">${esc(winLine.text)}</div>` : ''}
      <div class="clashlines">${part.slice(1).map(e => `<div class="${e.head ? 'head' : ''}">${esc(e.text)}</div>`).join('')}</div>
      ${waiting}
      <div class="row" style="margin-top:12px;display:flex"><button class="primary" data-clashok>${s.pending && myPending(s) ? 'Continue to the reset' : 'Continue'}</button></div></div></div>`;
  }

  // Online connection status: connected, reconnecting, or opponent disconnected.
  function connHTML() {
    const o = ui.online, ss = o.session;
    let cls, text;
    if (ui.mode === 'host') {
      if (!o.ready) { cls = 'warn'; text = 'Setting up the room…'; }
      else if (ss.status === 'connected') { cls = 'good'; text = 'Opponent connected'; }
      else if (ss.status === 'waiting') { cls = 'warn'; text = 'Waiting for your friend to join'; }
      else { cls = 'bad'; text = `Opponent disconnected — they can rejoin with code ${o.code}`; }
    } else {
      if (ss.status === 'connected') { cls = 'good'; text = 'Connected'; }
      else if (ss.status === 'rejected') { cls = 'bad'; text = 'Refused by the host'; }
      else if (ss.status === 'reconnecting') { cls = 'bad'; text = 'Reconnecting… (opponent disconnected?)'; }
      else { cls = 'warn'; text = 'Connecting…'; }
    }
    return `<span class="conn ${cls}">● ${esc(text)}</span><span>Room <b>${esc(o.code)}</b></span>${o.notice ? `<span class="muted small">${esc(o.notice)}</span>` : ''}`;
  }

  function joinLink(code) { return location.href.replace(/#.*$/, '') + '#join=' + code; }

  // Online, before the game exists: show the room code / connection progress.
  function renderLobby() {
    const o = ui.online, ss = o.session;
    let body;
    if (ui.mode === 'host') {
      body = o.ready ? `<div class="muted">Your room code</div><div class="code">${esc(o.code)}</div>
        <p>Send your friend this code. They open the game, choose <b>Online</b>, and enter it. Or send them this link:</p>
        <div class="row"><input readonly value="${esc(joinLink(o.code))}" id="joinlink" style="width:100%"><button data-copylink>Copy</button></div>
        <p class="muted">Waiting for your friend to join… Keep this page open: your browser runs the game.</p>`
        : '<p>Setting up a room…</p>';
    } else if (ss.status === 'rejected') {
      body = `<div class="error">${esc(ss.rejected.message)}</div>`;
    } else body = `<p>Connecting to room <b>${esc(o.code)}</b>…</p>`;
    app.innerHTML = `<div class="setup"><h1>Solo — Online</h1>${body}
      ${o.notice ? `<p class="muted small">${esc(o.notice)}</p>` : ''}
      <div class="row"><button data-leave>Cancel</button></div></div>`;
  }

  // ---------------------------------------------------------------- render
  function render() {
    if (!ui.mode) { renderSetup(); return; }
    if (online() && (!current() || (ui.mode === 'guest' && ui.online.session.status === 'rejected'))) { renderLobby(); return; }
    const s = current();
    if (ui.passTo !== null) {
      app.innerHTML = `<div class="pass"><div class="box"><div class="muted">Pass the device to</div>
        <div class="who3">Player ${ui.passTo + 1}</div>
        <button class="primary" id="ready">I'm Player ${ui.passTo + 1} — show my cards</button></div></div>`;
      document.getElementById('ready').onclick = () => { ui.viewer = ui.passTo; ui.passTo = null; ui.snap = null; render(); };
      return;
    }
    const me = ui.viewer === null ? 0 : ui.viewer, top = 1 - me;
    const viewerKey = ui.reveal ? 'all' : ui.viewer;
    const logLen = Solo.logView(s, viewerKey).length;
    const gameKey = `${ui.mode}|${online() ? ui.online.code : s.seed}|${viewerKey}`;
    const prev = ui.snap && ui.snap.key === gameKey ? ui.snap : null;
    // Log lines are the same in every player's view (only their text differs), so
    // "how much of the log was already on screen" survives the pass-the-device screen.
    const logKey = gameKey.replace(/\|[^|]*$/, '');
    const seen = ui.logSeen && ui.logSeen.key === logKey ? ui.logSeen.n : logLen;
    const fresh = seen;
    // A new clash in the log opens the results overlay.
    if (logLen > seen) {
      const lines = Solo.logView(s, viewerKey);
      for (let i = seen; i < lines.length; i++) if (lines[i].head && /^Clash!/.test(lines[i].text)) ui.clashAt = i;
    }
    const myTurnNow = s.phase !== 'over' && Solo.actor(s) === ui.viewer;
    if (prev && online() && myTurnNow && !prev.myTurn) ui.toast = s.pending ? 'Your choice' : 'Your turn';

    const pi = promptInfo(s);
    const statusTurn = s.phase === 'over' ? 'Game over'
      : !online() ? (s.pending ? `Player ${s.pending.player + 1} is choosing` : `Player ${s.turn + 1}'s turn`)
      : s.pending ? (s.pending.player === ui.viewer ? 'Your choice' : 'Waiting for opponent…')
      : s.turn === ui.viewer ? 'Your turn' : 'Opponent\'s turn';
    const la = s.lastAction ? `Last: ${pName(s.lastAction.player)} ${s.lastAction.type === 'engage' ? 'engaged' : s.lastAction.type === 'play' ? 'played a card' : 'used a Feint'}` : '';
    const err = errorText();
    app.innerHTML = `<div class="wrap ${ui.logMin ? 'logmin' : ''}">
      <div class="topbar"><span class="turn ${myTurnNow ? 'mine' : ''}">${statusTurn}</span><span>Round <b>${s.round}</b></span><span class="muted">${la}</span>
        <span class="spacer"></span>
        ${online() ? connHTML() + '<button data-leave>Leave</button>' : `<span class="muted small">seed ${esc(s.seed)}</span><button data-new>New game</button>`}</div>
      ${err ? `<div class="error">${esc(err)}</div>` : ''}
      <div class="layout"><div class="arena">
        ${stripHTML(s, top)}
        ${ui.reveal ? handHTML(s, top, pi) : ''}
        ${laneHTML(s, top, pi)}
        ${laneHTML(s, me, pi)}
        ${decideHTML(s, pi)}
        ${stripHTML(s, me)}
        ${handHTML(s, me, pi)}
      </div>
      <div class="side">${debugHTML()}${inspectorHTML()}${logHTML(s, fresh)}</div>
      </div></div>
      ${overlaysHTML(s, pi)}
      ${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ''}`;
    ui.toast = '';
    for (const id in ui.dbgKeep) {
      const e = document.getElementById(id);
      if (e) { if (e.type === 'checkbox') e.checked = ui.dbgKeep[id]; else e.value = ui.dbgKeep[id]; }
    }
    highlightChanges(s, prev);
    ui.snap = snapshot(s, gameKey, logLen, myTurnNow);
    ui.logSeen = { key: logKey, n: logLen };
  }
  ui.render = render;

  // What changed since the last render: cards entering a combo, flips, stat changes.
  function snapshot(s, key, logLen, myTurn) {
    const cards = {};
    s.players.forEach((pl, p) => ['hand', 'combo', 'discard'].forEach(z => pl[z].forEach(c => { if (c.uid !== null) cards[c.uid] = `${p}${z}${c.faceDown ? 'd' : 'u'}`; })));
    const stats = s.players.map(pl => ({ life: pl.life, energy: pl.energy, power: pl.power }));
    return { key, cards, stats, logLen, myTurn };
  }
  function highlightChanges(s, prev) {
    if (!prev) return;
    app.querySelectorAll('.lane .card[data-uid]').forEach(el => {
      const uid = el.dataset.uid;
      if (!uid) return;
      const now = prev.cards[uid], loc = el.closest('.lane') ? 'combo' : '';
      if (!now || !now.includes(loc)) el.classList.add('enter');
      else if (now.endsWith('u') && el.classList.contains('back')) el.classList.add('flipped');
    });
    s.players.forEach((pl, p) => ['life', 'energy', 'power'].forEach(k => {
      const d = pl[k] - prev.stats[p][k];
      if (!d) return;
      const el = app.querySelector(`[data-stat="${p}-${k}"]`);
      if (el) el.insertAdjacentHTML('beforeend', `<span class="float ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`);
    }));
  }

  ui.dbgKeep = {};
  app.addEventListener('input', ev => { if (!ui.mode && ui.setupTab === 'decks') dbInput(ev.target); });
  app.addEventListener('change', ev => {
    const e = ev.target;
    if (!ui.mode && ui.setupTab === 'decks') { dbChange(e); return; }
    if (e.id && e.id.startsWith('dbg') && e.id !== 'dbgReveal') ui.dbgKeep[e.id] = e.type === 'checkbox' ? e.checked : e.value;
  });

  // Inspector follows the mouse without re-rendering the board.
  app.addEventListener('mouseover', ev => {
    const el = ev.target.closest('[data-cid]');
    const id = el ? el.dataset.cid : null;
    if (!id || id === ui.hover || ui.pinned) return;
    ui.hover = id;
    const box = document.getElementById('inspector');
    if (box) box.outerHTML = inspectorHTML();
  });

  // ---------------------------------------------------------------- events
  app.addEventListener('dblclick', ev => {
    const el = ev.target.closest('.hand .card.playable[data-uid]');
    const s = current();
    if (el && s && canAct(s, ui.viewer)) dispatch({ type: 'play', player: ui.viewer, uid: +el.dataset.uid });
  });

  app.addEventListener('click', ev => {
    const t = ev.target.closest('button, input[type=checkbox], .card[data-uid], .who[data-cid], .overlay');
    if (!ui.mode) {
      if (ui.setupTab === 'decks') { const b = ev.target.closest('button, .card[data-cid]'); if (b) dbClick(b, ev); }
      return;
    }
    if (!t) return;
    if (t.dataset.leave !== undefined) {
      const over = !current() || current().phase === 'over';
      const msg = ui.mode === 'host' && !over ? 'Leave this game? Your friend will be disconnected. (You can resume it later from the Online tab.)' : 'Leave this game?';
      if (over || confirm(msg)) { leaveOnline(over); ui.setupTab = 'online'; render(); }
      return;
    }
    if (t.dataset.copylink !== undefined) {
      const v = document.getElementById('joinlink').value;
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => { t.textContent = 'Copied'; }, () => {});
      return;
    }
    const s = current();
    if (!s) return;
    const pi = promptInfo(s);
    const choose = value => dispatch({ type: 'choose', player: s.pending.player, value });
    const d = t.dataset;

    if (t.classList.contains('overlay')) { if (d.close !== undefined && ev.target === t) { ui.drawer = null; render(); } return; }
    if (d.close !== undefined) { ui.drawer = null; render(); return; }
    if (d.clashok !== undefined) { ui.clashAt = null; render(); return; }
    if (d.overok !== undefined) { ui.overSeen = true; render(); return; }
    if (d.discard !== undefined) { ui.drawer = +d.discard; render(); return; }
    if (d.unpin !== undefined) { ui.pinned = null; render(); return; }
    if (d.logmin !== undefined) { ui.logMin = !ui.logMin; render(); return; }
    if (t.classList.contains('who')) { ui.pinned = ui.pinned === d.cid ? null : d.cid; render(); return; }

    // Clicking a card: answer a prompt, select a hand card, or read it.
    if (t.classList.contains('card')) {
      const uid = d.uid === '' ? null : +d.uid;
      if (pi && uid !== null && pi.values.has(uid)) {
        if (pi.r.kind === 'one') { ui.drawer = null; choose(uid); return; }
        ui.picks = ui.picks.includes(uid) ? ui.picks.filter(x => x !== uid) : ui.picks.concat([uid]);
        render(); return;
      }
      if (uid !== null && canAct(s, ui.viewer) && s.players[ui.viewer].hand.some(c => c.uid === uid)) {
        ui.sel = ui.sel === uid ? null : uid;
        ui.pinned = null; ui.hover = d.cid || ui.hover;
        render(); return;
      }
      if (d.cid) { ui.pinned = ui.pinned === d.cid ? null : d.cid; render(); }
      return;
    }

    if (d.play !== undefined) dispatch({ type: 'play', player: s.turn, uid: +d.play });
    else if (d.feint !== undefined) dispatch({ type: 'feint', player: s.turn, uid: +d.feint });
    else if (d.engage !== undefined) dispatch({ type: 'engage', player: s.turn, count: +d.engage });
    else if (d.opt !== undefined && pi) choose(pi.r.options[+d.opt].value);
    else if (d.confirm !== undefined && pi) { ui.drawer = null; choose(ui.picks.slice()); }
    else if (d.clearpicks !== undefined) { ui.picks = []; render(); }
    else if (d.num !== undefined && pi) {
      const r = pi.r;
      ui.num = d.num === 'min' ? r.min : d.num === 'max' ? r.max : Math.max(r.min, Math.min(r.max, ui.num + +d.num));
      render();
    } else if (d.numok !== undefined && pi) choose(ui.num);
    else if (d.new !== undefined) { if (s.phase === 'over' || confirm('Start a new game?')) { ui.game = null; ui.mode = null; render(); } }
    else if (!ui.debug) return;
    else if (d.export !== undefined) {
      const rec = JSON.stringify({ config: ui.game.config, actions: ui.game.actions });
      (navigator.clipboard ? navigator.clipboard.writeText(rec) : Promise.reject()).then(() => alert('Game record copied.'), () => prompt('Game record:', rec));
    } else if (t.id === 'dbgReveal') { ui.reveal = t.checked; if (ui.reveal) ui.viewer = Solo.actor(s); ui.snap = null; render(); }
    else if (d.dbg) {
      const p = +document.getElementById('dbgP').value;
      const op = d.dbg;
      if (op === 'add') dispatch({ type: 'debug', op, player: p, cardId: document.getElementById('dbgCard').value, zone: document.getElementById('dbgZone').value, faceDown: document.getElementById('dbgDown').checked });
      else if (op === 'character') dispatch({ type: 'debug', op, player: p, cardId: document.getElementById('dbgChar').value });
      else if (op === 'set') dispatch({ type: 'debug', op, player: p, stat: document.getElementById('dbgStat').value, value: +document.getElementById('dbgVal').value });
      else if (op === 'turn') dispatch({ type: 'debug', op, player: p });
      else if (op === 'clear') dispatch({ type: 'debug', op, player: p, zone: document.getElementById('dbgClearZone').value });
      else if (op === 'flip' || op === 'remove') dispatch({ type: 'debug', op, player: p, uid: +d.uid });
    }
  });

  // ---------------------------------------------------------------- start
  // A join link (#join=CODE) opens the Online tab with the code filled in.
  // A refreshed online tab goes straight back into its game.
  const readJoinLink = () => {
    const m = location.hash.match(/join=([A-Za-z0-9]{5})/);
    if (m) { ui.setupTab = 'online'; ui.joinCode = m[1].toUpperCase(); }
    return !!m;
  };
  readJoinLink();
  // A join link opened in a tab that already shows the game only changes the hash.
  window.addEventListener('hashchange', () => { if (readJoinLink() && !ui.mode) render(); });
  const resume = store.get('sessionStorage', 'solo-online');
  if (resume && resume.role === 'host') {
    const rec = store.get('localStorage', 'solo-host-' + resume.code);
    if (rec) startHost({ code: resume.code, record: rec.record }); else render();
  } else if (resume && resume.role === 'guest') startGuest(resume.code, resume.choice || {});
  else render();
})();
