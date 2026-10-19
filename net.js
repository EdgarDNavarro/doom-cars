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
      conn.on('open', () => { this.role = 'client'; this.code = code; finish(null); });
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
