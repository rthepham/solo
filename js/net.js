// Connects Online sessions (js/online.js) over the internet with PeerJS:
// browser-to-browser (WebRTC), using PeerJS's free public broker only to find
// each other. No server of our own. PeerJS is loaded from a CDN the first time
// online play is used, so hotseat mode still works offline.
(function (root) {
  'use strict';
  const Solo = root.Solo;
  const Net = Solo.Net = {};
  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'solo-cardgame-room-';     // broker ids are global: keep ours distinctive
  const PING_MS = 3000, DEAD_MS = 12000, RETRY_MS = 3000;

  Net.load = function () {
    if (root.Peer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEERJS_URL;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load PeerJS (are you online?).'));
      document.head.appendChild(s);
    });
  };

  // Wraps a PeerJS DataConnection: send/close, a heartbeat, and one onClose call
  // when it closes or stops answering (WebRTC can take a long time to notice).
  function wrap(conn, onData, onClose) {
    let last = Date.now(), done = false;
    const w = {
      send(m) { if (!done && conn.open) { try { conn.send(m); } catch (e) { /* closing */ } } },
      close() { finish(); try { conn.close(); } catch (e) { /* already closed */ } },
    };
    function finish() { if (done) return; done = true; clearInterval(timer); onClose(w); }
    const timer = setInterval(() => {
      if (Date.now() - last > DEAD_MS) { w.close(); return; }
      w.send({ t: 'ping' });
    }, PING_MS);
    conn.on('data', m => { last = Date.now(); if (m && (m.t === 'ping' || m.t === 'pong')) { if (m.t === 'ping') w.send({ t: 'pong' }); return; } onData(w, m); });
    conn.on('close', finish);
    conn.on('error', finish);
    return w;
  }

  // ------------------------------------------------------------------ host
  // Registers the room code with the broker and accepts the guest.
  // opts: { code, fresh, onCode(code), onStatus(text) }. Returns { stop() }.
  Net.host = function (session, opts) {
    let peer = null, stopped = false, code = opts.code;
    function open() {
      if (stopped) return;
      peer = new root.Peer(PREFIX + code);
      peer.on('open', () => { opts.onCode(code); opts.onStatus(''); });
      peer.on('connection', conn => {
        let w = null;
        conn.on('open', () => {
          w = wrap(conn, (from, m) => session.receive(from, m), from => session.detach(from));
        });
      });
      peer.on('disconnected', () => { if (!stopped) setTimeout(() => { if (!stopped && !peer.destroyed) peer.reconnect(); }, RETRY_MS); });
      peer.on('error', err => {
        if (stopped) return;
        if (err.type === 'unavailable-id') {
          // A new room: pick another code. A restored room: the broker still
          // remembers our old page for a few seconds, so keep trying.
          peer.destroy();
          if (opts.fresh && !session.state) code = Solo.Online.newRoomCode();
          else opts.onStatus(`Getting room ${code} back from the broker… retrying`);
          setTimeout(open, RETRY_MS);
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          opts.onStatus('Lost touch with the PeerJS broker, retrying… (players already connected stay connected)');
        } else opts.onStatus('Connection problem: ' + (err.message || err.type));
      });
    }
    open();
    return { stop() { stopped = true; if (peer) peer.destroy(); } };
  };

  // ------------------------------------------------------------------ guest
  // Connects to the room, and keeps reconnecting if the connection drops.
  // opts: { code, onStatus(text), onNotFound() }. Returns { stop() }.
  Net.join = function (session, opts) {
    let peer = null, stopped = false, everConnected = false, timer = null, conn = null;
    const retry = () => { clearTimeout(timer); timer = setTimeout(connect, RETRY_MS); };
    function connect() {
      if (stopped || session.status === 'rejected') return;
      if (!peer || peer.destroyed) return start();
      if (peer.disconnected) { peer.reconnect(); retry(); return; }
      conn = peer.connect(PREFIX + opts.code, { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        everConnected = true;
        opts.onStatus('');
        wrap(conn, (w, m) => session.receive(m), () => { session.detach(); retry(); });
        session.attach({ send: m => conn.open && conn.send(m), close: () => conn.close() });
      });
    }
    function start() {
      peer = new root.Peer();
      peer.on('open', connect);
      peer.on('error', err => {
        if (stopped) return;
        if (err.type === 'peer-unavailable') {
          if (!everConnected) { opts.onNotFound(); return; }
          opts.onStatus('The host is not reachable right now. Retrying…');
          retry();
        } else {
          opts.onStatus('Connection problem: ' + (err.message || err.type) + '. Retrying…');
          retry();
        }
      });
      peer.on('disconnected', () => { if (!stopped) retry(); });
    }
    start();
    return { stop() { stopped = true; clearTimeout(timer); if (peer) peer.destroy(); } };
  };
})(typeof window !== 'undefined' ? window : globalThis);
