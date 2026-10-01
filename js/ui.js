// Hotseat UI. Reads game state and sends action objects to Solo.apply.
// It never changes game state itself.
(function () {
  'use strict';
  const H = Solo._;
  const app = document.getElementById('app');
  const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const ui = {
    game: null,       // { config, actions: [], state }
    viewer: null,     // player whose private info is on screen
    passTo: null,     // show the pass-the-device screen for this player
    error: '',
    debug: false,
    reveal: false,
    showDiscard: [false, false],
  };
  window.soloUI = ui;

  // ---------------------------------------------------------------- setup
  function playableChars() { return Solo.CHARACTERS.filter(c => Solo.EFFECTS[c.id]); }

  function renderSetup() {
    const chars = playableChars();
    const opt = (sel) => chars.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)} (${c.color}, ${esc(c.archetype)})</option>`).join('');
    const seed = 'solo-' + Math.floor(Math.random() * 1e6);
    app.innerHTML = `
      <div class="setup">
        <h1>Solo — The Card Game</h1>
        <p class="muted">Two players, one screen. Reduce your opponent's life to 0, or have the most life when a deck runs out.</p>
        <div class="row"><label>Seed</label><input id="seed" value="${seed}" size="24"></div>
        ${[0, 1].map(p => `
          <div class="row"><label>Player ${p + 1}</label>
            <select id="char${p}">${opt(chars[p % chars.length].id)}</select>
            <select id="style${p}"><option value="mono">Deck: character's color</option><option value="mixed">Deck: all colors</option></select>
          </div>`).join('')}
        <div class="row"><label>Debug mode</label><input type="checkbox" id="debug"> <span class="muted small">Card/stat editor, both hands visible, no pass screen</span></div>
        <div class="row"><button class="primary" id="start">Start game</button></div>
        <p class="muted small">Decks: 40 cards, 20 different cards &times; 2, picked from the seed. The same seed and moves always replay the same game.</p>
      </div>`;
    document.getElementById('start').onclick = () => {
      const seedV = document.getElementById('seed').value || 'solo';
      const players = [0, 1].map(p => {
        const character = document.getElementById('char' + p).value;
        return { character, deck: Solo.buildDeck(seedV + '#' + p, character, document.getElementById('style' + p).value) };
      });
      ui.debug = document.getElementById('debug').checked;
      ui.reveal = ui.debug;
      startGame({ seed: seedV, players });
    };
  }

  function startGame(config) {
    ui.game = { config, actions: [], state: Solo.newGame(config) };
    ui.viewer = null;
    dispatch({ type: 'start' });
  }

  // ---------------------------------------------------------------- dispatch
  function dispatch(action) {
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

  // ---------------------------------------------------------------- rendering
  function cardHTML(s, c, opts = {}) {
    const d = Solo.DATA[c.id];
    const hidden = c.faceDown && !(ui.reveal || c.owner === ui.viewer);
    const val = opts.value !== undefined ? opts.value : null;
    if (c.faceDown) {
      return `<div class="card down ${c.silenced ? 'silenced' : ''}" title="${hidden ? 'Face-down card' : esc(d.name + ' — ' + d.reading)}">
        <div class="num">${val === null ? 0 : val}</div>
        <div class="nm">Face down</div>
        ${hidden ? '' : `<div class="txt">${esc(d.color + ' ' + d.number + ' ' + d.name)}</div>`}
        <div class="btns">${opts.buttons || ''}</div></div>`;
    }
    return `<div class="card ${d.color} ${c.silenced ? 'silenced' : ''}" title="${esc(d.name + ' — ' + d.reading)}">
      <div class="num">${d.number}</div>${c.silenced ? '<span class="tag">no abilities</span>' : ''}
      <div class="nm">${esc(d.name)}</div>
      <div class="txt">${esc(d.reading)}</div>
      <div class="btns">${opts.buttons || ''}</div></div>`;
  }

  function playerHTML(s, p) {
    const pl = s.players[p];
    const ch = Solo.DATA[pl.character];
    const myTurn = s.phase === 'action' && s.turn === p && !s.pending;
    const canAct = myTurn && (ui.viewer === p);
    const showHand = ui.reveal || ui.viewer === p;
    const combo = pl.combo.map(c => {
      let b = '';
      if (canAct && Solo.feintable(s, p).includes(c)) b += `<button data-act="feint" data-uid="${c.uid}">Feint</button>`;
      if (ui.debug) b += `<button data-dbg="flip" data-uid="${c.uid}" title="debug: toggle face">⟲</button><button data-dbg="remove" data-uid="${c.uid}" title="debug: remove">✕</button>`;
      return cardHTML(s, c, { value: H.valueOf(s, c), buttons: b });
    }).join('') || '<span class="muted small">empty</span>';
    const hand = showHand ? (pl.hand.map(c => {
      let b = '';
      if (canAct) {
        const chk = Solo.canPlay(s, p, c.uid);
        b += `<button data-act="play" data-uid="${c.uid}" ${chk.ok ? '' : 'disabled'} title="${esc(chk.reason || '')}">Play (${chk.cost})</button>`;
      }
      if (ui.debug) b += `<button data-dbg="remove" data-uid="${c.uid}">✕</button>`;
      return cardHTML(s, c, { buttons: b });
    }).join('') || '<span class="muted small">no cards</span>') : `<span class="muted">${pl.hand.length} cards (hidden)</span>`;
    const disc = ui.showDiscard[p] ? `<div class="discardlist">${pl.discard.map(c =>
      c.faceDown && !(ui.reveal || c.owner === ui.viewer) ? '<div class="card mini down"><div class="nm">Face down</div></div>'
        : `<div class="card mini ${c.faceDown ? 'down' : Solo.DATA[c.id].color}" title="${esc(Solo.DATA[c.id].reading)}"><div class="nm">${Solo.DATA[c.id].number} ${esc(Solo.DATA[c.id].name)}${c.faceDown ? ' (face down)' : ''}</div></div>`).join('') || '<span class="muted small">empty</span>'}</div>` : '';
    return `<div class="player ${s.turn === p && s.phase === 'action' ? 'active' : ''}">
      <div class="head">
        <span class="pname">Player ${p + 1}${ui.viewer === p ? ' (you)' : ''}</span>
        <span>${esc(ch.name)} <span class="muted">— ${ch.color} ${esc(ch.archetype)}</span></span>
        ${s.firstPlayer === p ? '<span class="stat">first this round</span>' : ''}
      </div>
      <div class="charline">${esc(ch.reading)}</div>
      <div class="stats">
        <span class="stat">Life <b>${pl.life}</b></span>
        <span class="stat">Energy <b>${pl.energy}</b>/${pl.maxEnergy}</span>
        <span class="stat">Power <b>${pl.power}</b></span>
        <span class="stat">Clash total <b>${Solo.clashTotal(s, p)}</b></span>
        <span class="stat">Deck <b>${pl.deck.length}</b></span>
        <span class="stat">Hand <b>${pl.hand.length}</b></span>
        <button class="stat" data-toggle-discard="${p}">Discard <b>${pl.discard.length}</b> ${ui.showDiscard[p] ? '▲' : '▼'}</button>
      </div>
      ${disc}
      <div class="zone-label">Combo (left → right)</div><div class="cards">${combo}</div>
      <div class="zone-label">Hand</div><div class="cards">${hand}</div>
    </div>`;
  }

  function pendingHTML(s) {
    const pd = s.pending;
    if (!pd) return '';
    if (!ui.reveal && ui.viewer !== pd.player) return `<div class="pending">Waiting for Player ${pd.player + 1} to choose…</div>`;
    const r = pd.request;
    let body = '';
    if (r.kind === 'one') body = `<div class="opts">${r.options.map((o, i) => `<button data-choose="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    else if (r.kind === 'many') body = `<div class="opts">${r.options.map((o, i) => `<label class="opt"><input type="checkbox" data-many="${i}"> ${esc(o.label)}</label>`).join('')}</div>
        <div class="opts"><span class="muted small">Choose ${r.min === r.max ? r.min : r.min + '–' + r.max}</span><button class="primary" data-choose-many>Confirm</button></div>`;
    else if (r.kind === 'number') body = `<div class="opts"><input type="number" id="numpick" min="${r.min}" max="${r.max}" value="${r.min}"> <span class="muted small">${r.min}–${r.max}</span><button class="primary" data-choose-num>OK</button></div>`;
    return `<div class="pending"><b>Player ${pd.player + 1}:</b> ${esc(r.prompt)}${body}</div>`;
  }

  function actionsHTML(s) {
    if (s.phase !== 'action' || s.pending) return '';
    const p = s.turn;
    if (!ui.reveal && ui.viewer !== p) return '';
    const la = s.lastAction;
    const clashNext = la && la.type === 'engage' && la.player !== p;
    return `<div class="actions"><b>Player ${p + 1}, choose an action:</b> play a card from your hand, use a Feint in your combo, or Engage.
      <div class="row">
        <button data-engage="2">Engage: draw 2, discard 2</button>
        <button data-engage="1">Engage: draw 1, discard 1</button>
        <button data-engage="0">Engage: draw 0</button>
        ${clashNext ? '<span class="turn" style="color:var(--accent)">Your opponent just engaged — engaging now starts the clash!</span>' : ''}
      </div></div>`;
  }

  function debugHTML(s) {
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
      <p class="muted small">Choose a player above, then add cards, set stats or clear zones. Cards added to a combo don't trigger anything. Then play normally.</p>
      <div class="row"><label><input type="checkbox" id="dbgReveal" ${ui.reveal ? 'checked' : ''}> show both hands / skip pass screen</label></div>
      <div class="row"><button data-export>Copy game record (JSON)</button></div>
    </div>`;
  }

  // Action log, newest first. Built by the engine; each player only sees
  // the text they're allowed to (opponents see "draws 2 cards", not names).
  function logHTML(s) {
    const viewer = ui.reveal ? 'all' : ui.viewer;
    const rows = Solo.logView(s, viewer).slice(-500).reverse().map(e =>
      `<div class="${e.head ? 'head' : ''}${e.dbg ? ' dbg' : ''}${e.mine ? ' mine' : ''}"${e.mine ? ' title="Only you can see this detail"' : ''}>${esc(e.text)}</div>`).join('');
    return `<div class="logbox"><div class="logtitle">Game log <span class="muted small">newest first${viewer === 'all' ? ' · showing hidden details' : ''}</span></div><div class="log" id="log">${rows}</div></div>`;
  }

  function render() {
    if (!ui.game) { renderSetup(); return; }
    const s = ui.game.state;
    if (ui.passTo !== null) {
      app.innerHTML = `<div class="pass"><div class="box"><div class="muted">Pass the device to</div>
        <div class="who">Player ${ui.passTo + 1}</div>
        <button class="primary" id="ready">I'm Player ${ui.passTo + 1} — show my cards</button></div></div>`;
      document.getElementById('ready').onclick = () => { ui.viewer = ui.passTo; ui.passTo = null; render(); };
      return;
    }
    const top = ui.viewer === null ? 1 : 1 - ui.viewer;
    const statusTurn = s.phase === 'over' ? 'Game over'
      : s.pending ? `Waiting on Player ${s.pending.player + 1}'s choice`
      : `Player ${s.turn + 1}'s turn`;
    const winner = s.phase === 'over'
      ? `<div class="over">${s.winner === 'draw' ? 'The game is a draw.' : 'Player ' + (s.winner + 1) + ' wins!'}
         <button data-new>New game</button></div>` : '';
    const la = s.lastAction ? `Last action: Player ${s.lastAction.player + 1} ${s.lastAction.type === 'engage' ? 'engaged' : s.lastAction.type === 'play' ? 'played a card' : 'used a Feint'}` : '';
    app.innerHTML = `<div class="wrap">
      <div class="status"><span class="turn">${statusTurn}</span><span>Round ${s.round}</span><span class="muted">${la}</span>
        <span class="muted small">seed ${esc(s.seed)}</span><button data-new>New game</button></div>
      ${winner}
      ${ui.error ? `<div class="error">${esc(ui.error)}</div>` : ''}
      <div class="layout"><div>
        ${playerHTML(s, top)}
        ${pendingHTML(s)}
        ${actionsHTML(s)}
        ${playerHTML(s, 1 - top)}
      </div>
      <div class="side">${debugHTML(s)}${logHTML(s)}</div>
      </div></div>`;
    for (const id in ui.dbgKeep) {
      const e = document.getElementById(id);
      if (e) { if (e.type === 'checkbox') e.checked = ui.dbgKeep[id]; else e.value = ui.dbgKeep[id]; }
    }
  }
  ui.dbgKeep = {};
  app.addEventListener('change', ev => {
    const e = ev.target;
    if (e.id && e.id.startsWith('dbg') && e.id !== 'dbgReveal') ui.dbgKeep[e.id] = e.type === 'checkbox' ? e.checked : e.value;
  });

  // ---------------------------------------------------------------- events
  app.addEventListener('click', ev => {
    const t = ev.target.closest('button, input[type=checkbox]');
    if (!t || !ui.game) return;
    const s = ui.game.state;
    if (t.dataset.act === 'play') dispatch({ type: 'play', player: s.turn, uid: +t.dataset.uid });
    else if (t.dataset.act === 'feint') dispatch({ type: 'feint', player: s.turn, uid: +t.dataset.uid });
    else if (t.dataset.engage !== undefined) dispatch({ type: 'engage', player: s.turn, count: +t.dataset.engage });
    else if (t.dataset.choose !== undefined) dispatch({ type: 'choose', player: s.pending.player, value: s.pending.request.options[+t.dataset.choose].value });
    else if (t.dataset.chooseMany !== undefined) {
      const vals = [...app.querySelectorAll('[data-many]')].filter(x => x.checked).map(x => s.pending.request.options[+x.dataset.many].value);
      dispatch({ type: 'choose', player: s.pending.player, value: vals });
    } else if (t.dataset.chooseNum !== undefined) dispatch({ type: 'choose', player: s.pending.player, value: +document.getElementById('numpick').value });
    else if (t.dataset.toggleDiscard !== undefined) { ui.showDiscard[+t.dataset.toggleDiscard] = !ui.showDiscard[+t.dataset.toggleDiscard]; render(); }
    else if (t.dataset.new !== undefined) { if (confirm('Start a new game?')) { ui.game = null; render(); } }
    else if (t.dataset.export !== undefined) {
      const rec = JSON.stringify({ config: ui.game.config, actions: ui.game.actions });
      (navigator.clipboard ? navigator.clipboard.writeText(rec) : Promise.reject()).then(() => alert('Game record copied.'), () => prompt('Game record:', rec));
    } else if (t.id === 'dbgReveal') { ui.reveal = t.checked; if (ui.reveal) ui.viewer = Solo.actor(s); render(); }
    else if (t.dataset.dbg) {
      const p = +document.getElementById('dbgP').value;
      const op = t.dataset.dbg;
      if (op === 'add') dispatch({ type: 'debug', op, player: p, cardId: document.getElementById('dbgCard').value, zone: document.getElementById('dbgZone').value, faceDown: document.getElementById('dbgDown').checked });
      else if (op === 'character') dispatch({ type: 'debug', op, player: p, cardId: document.getElementById('dbgChar').value });
      else if (op === 'set') dispatch({ type: 'debug', op, player: p, stat: document.getElementById('dbgStat').value, value: +document.getElementById('dbgVal').value });
      else if (op === 'turn') dispatch({ type: 'debug', op, player: p });
      else if (op === 'clear') dispatch({ type: 'debug', op, player: p, zone: document.getElementById('dbgClearZone').value });
      else if (op === 'flip' || op === 'remove') dispatch({ type: 'debug', op, player: p, uid: +t.dataset.uid });
    }
  });

  render();
})();
