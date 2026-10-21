'use strict';
// =====================================================================
//  Transporte P2P con PeerJS (WebRTC).
//  Un jugador crea la sala (host) y los demás se conectan con su código.
//  El servidor gratuito de PeerJS solo sirve para que los navegadores se
//  encuentren; los datos del juego viajan directo entre jugadores.
// =====================================================================

const Net = {
  role: 'local',          // local | host | client
  peer: null,
  conns: new Map(),       // host: peerId -> conexión
  conn: null,             // cliente: conexión con el host
  code: '',
  id: '',
  prefix: 'fdmcars-',
  maxClients: 3,
  handlers: { message() {}, join() {}, leave() {}, closed() {} },

  available() { return typeof window.Peer === 'function'; },

  makeCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  },

  host(cb) {
    if (!this.available()) return cb(new Error('No se pudo cargar PeerJS (¿sin internet?)'));
    this.leave();
    this.code = this.makeCode();
    const peer = this.peer = new Peer(this.prefix + this.code);
    peer.on('open', (id) => { this.role = 'host'; this.id = id; cb(null, this.code); });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') { peer.destroy(); this.host(cb); return; } // código ocupado: otro
      if (this.role !== 'host') cb(err);
    });
    peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) peer.reconnect(); });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (this.conns.size >= this.maxClients) {
          conn.send({ t: 'full' });
          setTimeout(() => conn.close(), 300);
          return;
        }
        this.conns.set(conn.peer, conn);
        this.attachFast(conn, conn.peer);
        this.handlers.join(conn.peer);
      });
      conn.on('data', (d) => this.handlers.message(d, conn.peer));
      conn.on('close', () => { if (this.conns.delete(conn.peer)) this.handlers.leave(conn.peer); });
      conn.on('error', () => {});
    });
  },

  join(code, cb) {
    if (!this.available()) return cb(new Error('No se pudo cargar PeerJS (¿sin internet?)'));
    this.leave();
    code = code.trim().toUpperCase();
    const peer = this.peer = new Peer();
    let done = false;
    const finish = (err) => { if (done) return; done = true; clearTimeout(timer); cb(err); };
    const timer = setTimeout(() => finish(new Error('No respondió la sala ' + code)), 12000);
    peer.on('open', (id) => {
      this.id = id;
      const conn = this.conn = peer.connect(this.prefix + code, { reliable: true, serialization: 'json' });
      conn.on('open', () => { this.role = 'client'; this.code = code; this.attachFast(conn, 'host'); finish(null); });
      conn.on('data', (d) => this.handlers.message(d, 'host'));
      conn.on('close', () => { if (this.role === 'client' && this.conn === conn) this.handlers.closed(); });
      conn.on('error', () => {});
    });
    peer.on('error', (err) => {
      if (!done) finish(err.type === 'peer-unavailable' ? new Error('No existe la sala ' + code) : err);
    });
  },

  send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); },
  broadcast(msg) { for (const c of this.conns.values()) if (c.open) c.send(msg); },

  // Canal rápido: sin orden ni reenvíos (como UDP). Para posiciones y controles, que se
  // mandan muy seguido: si se pierde uno, no se espera a reenviarlo, ya llega el siguiente.
  // Es un segundo canal "pactado" (mismo id en los dos lados) sobre la misma conexión.
  FAST_ID: 1001,
  // Si el canal ya tiene esto pendiente de salir, la conexión no da abasto: el mensaje se
  // descarta en vez de encolarse (si no, el retraso crece sin parar: 1 s, 2 s, 4 s…)
  FAST_MAX_BUFFER: 1500, // ≈ 2-3 mensajes de estado
  drops: 0, // mensajes descartados por conexión saturada (para avisar en pantalla)
  attachFast(conn, from) {
    try {
      const ch = conn.peerConnection.createDataChannel('rapido', { negotiated: true, id: this.FAST_ID, ordered: false, maxRetransmits: 0 });
      ch.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        this.handlers.message(m, from);
      };
      conn.fast = ch;
    } catch (err) { conn.fast = null; } // sin canal rápido: todo va por el fiable
  },
  fastOpen(conn) { return !!(conn && conn.fast && conn.fast.readyState === 'open'); },
  // Envía por el canal rápido de una conexión; si está saturado, descarta (devuelve false).
  // force: no descartar nunca (ping/pong, para que el ping mostrado sea el real)
  fastTo(c, msg, str, force = false) {
    if (this.fastOpen(c)) {
      if (!force && c.fast.bufferedAmount > this.FAST_MAX_BUFFER) { this.drops++; return false; }
      c.fast.send(str || JSON.stringify(msg));
      return true;
    }
    if (c && c.open && (!c.dataChannel || c.dataChannel.bufferedAmount < this.FAST_MAX_BUFFER * 4)) { c.send(msg); return true; }
    this.drops++;
    return false;
  },
  sendFast(msg, force) { return this.fastTo(this.conn, msg, null, force); },
  sendFastTo(peer, msg, force) { return this.fastTo(this.conns.get(peer), msg, null, force); },
  broadcastFast(msg) {
    const s = JSON.stringify(msg);
    for (const c of this.conns.values()) this.fastTo(c, msg, s);
  },

  // Ruta de una conexión: directa (P2P) o por un servidor intermedio (relay/TURN)
  async route(conn) {
    const pc = conn && conn.peerConnection;
    if (!pc || !pc.getStats) return null;
    const stats = await pc.getStats();
    let pair = null;
    stats.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId); });
    if (!pair) stats.forEach((s) => { if (!pair && s.type === 'candidate-pair' && s.state === 'succeeded' && (s.nominated || s.selected)) pair = s; });
    if (!pair) return null;
    const l = stats.get(pair.localCandidateId), r = stats.get(pair.remoteCandidateId);
    const relay = (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay');
    const server = relay ? ((l && l.candidateType === 'relay' && l.url) || (r && r.address) || '') : '';
    return { relay, server: server.replace(/^turns?:/, '').replace(/\?.*$/, '') };
  },

  leave() {
    const p = this.peer;
    this.role = 'local';
    this.conns.clear();
    this.conn = null;
    this.code = '';
    this.peer = null;
    if (p && !p.destroyed) p.destroy();
  },
};
