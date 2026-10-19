'use strict';
// =====================================================================
//  FIN DEL MUNDO CARS — demo multijugador (1-4 jugadores), local u online
//  HTML + Canvas + JS puro. Online usa PeerJS (ver net.js).
// =====================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------
//  Configuración (ajusta aquí la sensación del juego)
// ---------------------------------------------------------------------
const T = 64;                 // tamaño de baldosa
const COLS = 13;              // ancho de la carretera en baldosas
const ROAD_W = T * COLS;
const CAR_R = 18;             // radio de colisión del carro
const G0 = -34;               // fila de la primera puerta
const GAP = 56;               // filas entre puertas
const CHASM_ROWS = 6;         // largo del abismo de la zona de salto
const GLIDE_TIME = 3.0;       // segundos que alguien planea esperando a que lo enganchen
const PARRY_RANGE = 170;      // distancia a la que aparece el anillo de timing
const PARRY_WIN = 42;         // ventana del parry (distancia entre carros)
const LANE_ROWS = 18;         // largo (en baldosas) del tramo de carriles antes de cada puerta
const LANE_W = 76;            // ancho de cada carril (~2,5 carros), igual para cualquier nº de jugadores
const LANE_OBS = 0.07;        // probabilidad de obstáculo por baldosa en el tramo de carriles
const HOLD_TIME = 2.5;        // segundos que todos deben ir en su carril a la vez
const LOCK_TIME = 2.5;        // bloqueo cuando alguien muere durante el evento
const DOOM_START = 380;       // posición inicial del colapso (detrás de los carros)
const DOOM_SPEED0 = 200;       // velocidad inicial del colapso (px/s)
const DOOM_ACCEL = 2;         // cuánto acelera por segundo
const DOOM_MAX = 280;
const CAR_MAX = 330, CAR_REV = 150, CAR_ACC = 520, CAR_BRAKE = 900, CAR_TURN = 3.4;
const ZAP_EVERY = [22, 35];   // cada cuántos segundos cae un rayo (aleatorio entre ambos)
const ZAP_TIME = 12;          // duración de la avería si nadie ayuda
const ZAP_HIT = 8;          // segundos que resta cada choque de un compañero
const ZAP_SPEED = 0.85;       // velocidad máxima con avería (-15 %)
const ZAP_TURN = 0.3;         // giro hacia el lado averiado (30 % de lo normal)
// Barra de sinergia (compartida): se llena con los eventos bien hechos y al llenarse da TURBO
const TEAM_PARRY = 0.25, TEAM_PERFECT = 0.35;  // enganche / parry perfecto
const TEAM_GATE = 0.3;                         // abrir una puerta yendo todos por su carril
const TEAM_HELP = 0.08, TEAM_FIXED = 0.12;     // cada choque de ayuda / terminar de reparar
const TURBO_TIME = 7;                          // segundos de turbo
const TURBO_BOOST = 1.3;                       // velocidad y aceleración durante el turbo
// Cuerda: dos carros atados un rato (si uno frena arrastra al otro; se traban en obstáculos)
const ROPE_EVERY = [28, 40];  // cada cuántos segundos aparece
const ROPE_TIME = 15;         // segundos atados
const ROPE_LEN = 120;         // largo en reposo
const ROPE_MAX = 230;         // estirada máxima: a partir de aquí arrastra sí o sí
const ROPE_K = 9;             // rigidez del elástico
// Remolque: un carro sin motor, amarrado a otro que lo jala hasta la recarga
const TOW_EVERY = [38, 55];
const TOW_LEN = 95, TOW_MAX = 170, TOW_K = 14;
const TOW_DIST = 1100;        // distancia hasta la línea de recarga (px; 16 px = 1 m)
const TEAM_ROPE = 0.15, TEAM_TOW = 0.2; // sinergia por sobrevivir atados / completar el remolque
// Derrape y combos
const DRIFT_MIN_SPEED = 140;    // velocidad mínima para empezar a derrapar
const DRIFT_LEVELS = [1.1, 2.4]; // segundos de derrape para el nivel 1 (azul) y 2 (naranja)
const DRIFT_BOOST = [70, 120];  // mini-turbo al soltar en cada nivel
const COMBO_IDLE = 2.0;         // segundos sin hacer nada antes de que el combo se cobre solo
const COMBO_MAX = 4;            // multiplicador máximo
const COMBO_TEAM_DIV = 1500;    // puntos de combo por barra de sinergia completa
const COMBO_TEAM_MAX = 0.3;     // lo máximo que un solo combo puede sumar a la sinergia

const COLORS = [
  { name: 'Rojo', c: '#ff4d5e' },
  { name: 'Azul', c: '#3fa7ff' },
  { name: 'Amarillo', c: '#ffd23f' },
  { name: 'Verde', c: '#3ddc84' },
];

const SCHEMES = [
  { label: 'W A S D', act: 'E', dft: 'Espacio', up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], action: ['KeyE'], drift: ['Space'] },
  { label: 'Flechas', act: 'Shift der.', dft: '-', up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], action: ['ShiftRight', 'ControlRight'], drift: ['Slash', 'Period'] },
  { label: 'I J K L', act: 'O', dft: 'U', up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], action: ['KeyO'], drift: ['KeyU'] },
  { label: 'T F G H / Num 8456', act: 'Y', dft: 'R', up: ['KeyT', 'Numpad8'], down: ['KeyG', 'Numpad5'], left: ['KeyF', 'Numpad4'], right: ['KeyH', 'Numpad6'], action: ['KeyY', 'Numpad0'], drift: ['KeyR', 'Numpad7'] },
];

// ---------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
let SEED = Math.random() * 1000;
function hash(c, r, s = 0) {
  const v = Math.sin(c * 127.1 + r * 311.7 + SEED * 13.37 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------------
//  Sonido (WebAudio, todo sintetizado)
// ---------------------------------------------------------------------
const Sound = {
  ctx: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ctx = new AC();
    this.master = ac.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(ac.destination);

    const len = ac.sampleRate * 2;
    this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Retumbe continuo del colapso (ruido marrón)
    const bbuf = ac.createBuffer(1, len, ac.sampleRate);
    const bd = bbuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    const rs = ac.createBufferSource(); rs.buffer = bbuf; rs.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 140;
    this.rumbleGain = ac.createGain(); this.rumbleGain.gain.value = 0;
    rs.connect(rf).connect(this.rumbleGain).connect(this.master); rs.start();

    // Motor
    this.engineOsc = ac.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 50;
    const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 380;
    this.engineGain = ac.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(ef).connect(this.engineGain).connect(this.master); this.engineOsc.start();
  },
  tone(f, dur, { type = 'square', vol = 0.15, to = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, { vol = 0.2, freq = 1000, type = 'lowpass', delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  setRumble(v) { if (this.ctx) this.rumbleGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); },
  setEngine(f, v) {
    if (!this.ctx) return;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  },
  silence() { this.setRumble(0); this.setEngine(50, 0); },
  join(i) { this.tone(330 + i * 110, 0.14, { to: 660 + i * 110, type: 'triangle', vol: 0.2 }); },
  leave() { this.tone(440, 0.15, { to: 200, type: 'triangle', vol: 0.15 }); },
  beat() { this.tone(520, 0.15, { vol: 0.12 }); },
  go() { this.tone(880, 0.45, { type: 'sawtooth', vol: 0.1 }); },
  bump(f) {
    this.noise(0.1, { vol: Math.min(0.35, f / 900), freq: 900, type: 'bandpass' });
    this.tone(140, 0.09, { type: 'triangle', vol: 0.15, to: 60 });
  },
  thud() { this.noise(0.12, { vol: 0.18, freq: 400 }); },
  death() {
    this.tone(500, 0.9, { type: 'sawtooth', vol: 0.13, to: 40 });
    this.noise(0.7, { vol: 0.3, freq: 300 });
  },
  crumble() { this.noise(0.5 + Math.random() * 0.5, { vol: 0.1 + Math.random() * 0.1, freq: 180 + Math.random() * 220 }); },
  event() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { delay: i * 0.08, vol: 0.11 })); },
  blip(id) { this.tone([392, 494, 587, 698][id] || 440, 0.12, { type: 'triangle', vol: 0.2 }); },
  tick(q) { this.tone(600 + q * 160, 0.08, { type: 'square', vol: 0.08 }); },
  lock() {
    this.tone(110, 0.55, { vol: 0.14 });
    this.tone(117, 0.55, { vol: 0.14 });
  },
  open() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, { delay: i * 0.07, vol: 0.12, type: 'triangle' }));
    this.noise(0.4, { vol: 0.15, freq: 2500, type: 'highpass' });
  },
  jump() { this.tone(180, 0.3, { type: 'triangle', vol: 0.2, to: 520 }); this.noise(0.25, { vol: 0.12, freq: 1500, type: 'bandpass' }); },
  parry() {
    this.tone(1400, 0.08, { type: 'square', vol: 0.18 });
    this.tone(2100, 0.35, { type: 'triangle', vol: 0.16, to: 1600 });
    this.tone(90, 0.3, { type: 'sine', vol: 0.3, to: 45 });
    this.noise(0.18, { vol: 0.3, freq: 3000, type: 'highpass' });
  },
  whiff() { this.noise(0.2, { vol: 0.15, freq: 700, type: 'bandpass' }); this.tone(300, 0.2, { type: 'triangle', vol: 0.12, to: 140 }); },
  warn() { this.tone(980, 0.06, { type: 'square', vol: 0.07 }); },
  thunder() {
    this.noise(0.15, { vol: 0.45, freq: 4000, type: 'highpass' });
    this.noise(1.8, { vol: 0.5, freq: 380 });
    this.tone(70, 1.2, { type: 'sine', vol: 0.3, to: 28 });
  },
  zap() { this.tone(1300, 0.14, { type: 'sawtooth', vol: 0.1, to: 280 }); this.noise(0.1, { vol: 0.15, freq: 3000, type: 'bandpass' }); },
  fixed() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, { delay: i * 0.07, vol: 0.13, type: 'triangle' })); },
  team() { this.tone(880, 0.1, { type: 'triangle', vol: 0.12, to: 1320 }); },
  heart() {
    this.tone(70, 0.12, { type: 'sine', vol: 0.35, to: 45 });
    this.tone(62, 0.12, { type: 'sine', vol: 0.28, to: 40, delay: 0.16 });
  },
  turbo() {
    this.tone(180, 0.7, { type: 'sawtooth', vol: 0.12, to: 1400 });
    this.noise(0.9, { vol: 0.25, freq: 1800, type: 'highpass' });
    [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.2, { delay: 0.3 + i * 0.06, vol: 0.1, type: 'square' }));
  },
  turboEnd() { this.tone(900, 0.4, { type: 'triangle', vol: 0.1, to: 300 }); },
  style(mult) { this.tone(500 + mult * 180, 0.09, { type: 'square', vol: 0.08, to: 700 + mult * 220 }); },
  cash() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.05, vol: 0.12, type: 'square' })); },
  comboLost() { this.tone(330, 0.3, { type: 'sawtooth', vol: 0.1, to: 110 }); },
  driftLv(lv) { this.tone(lv === 2 ? 1200 : 900, 0.08, { type: 'triangle', vol: 0.12 }); },
  driftBoost() { this.noise(0.35, { vol: 0.2, freq: 1400, type: 'bandpass' }); this.tone(300, 0.3, { type: 'sawtooth', vol: 0.08, to: 900 }); },
  screech() { this.noise(0.12, { vol: 0.05, freq: 2600, type: 'bandpass' }); },
  rope() { this.tone(220, 0.25, { type: 'triangle', vol: 0.15, to: 330 }); this.noise(0.3, { vol: 0.15, freq: 900, type: 'bandpass' }); },
  snag() { this.tone(140, 0.25, { type: 'square', vol: 0.12, to: 90 }); this.noise(0.15, { vol: 0.2, freq: 500 }); },
  snap() { this.noise(0.12, { vol: 0.3, freq: 3500, type: 'highpass' }); this.tone(900, 0.1, { type: 'triangle', vol: 0.1, to: 400 }); },
  engineDie() { this.tone(260, 0.8, { type: 'sawtooth', vol: 0.12, to: 35 }); this.noise(0.4, { vol: 0.12, freq: 300 }); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, { delay: i * 0.22, vol: 0.12, type: 'sawtooth' })); },
};

// ---------------------------------------------------------------------
//  Entrada: teclado + mandos (Gamepad API)
// ---------------------------------------------------------------------
const keys = new Set();
const pressed = new Set();
addEventListener('keydown', (e) => {
  Sound.init();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', () => Sound.init());
const anyKey = (arr) => arr.some((k) => keys.has(k));
const anyPressed = (arr) => arr.some((k) => pressed.has(k));

let padState = [], padPrev = [];
function pollPads() {
  padPrev = padState; padState = [];
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of gps) if (gp) padState[gp.index] = { gp, b: gp.buttons.map((b) => b.pressed) };
}
function padPressed(i, b) {
  const s = padState[i], p = padPrev[i];
  return !!(s && s.b[b] && !(p && p.b[b]));
}

// ---------------------------------------------------------------------
//  Jugadores
// ---------------------------------------------------------------------
// src: {type:'kb'|'pad', idx} en este PC, o {type:'net', peer, idx:lid} en otro PC (solo en el host).
// En los clientes, la lista llega del host: {slot, label, act, mine, lid}.
const players = [];
const srcLabel = (src) => (src.type === 'kb' ? SCHEMES[src.idx].label : `Mando ${src.idx + 1}`);
const srcAct = (src) => (src.type === 'kb' ? SCHEMES[src.idx].act : 'X');
const srcDrift = (src) => (src.type === 'kb' ? SCHEMES[src.idx].dft : 'RB');
function findPlayer(type, idx) { return players.find((p) => p.src && p.src.type === type && p.src.idx === idx); }
function joinPlayer(src, label, act, dft) {
  if (players.length >= 4) return;
  const used = new Set(players.map((p) => p.slot));
  let slot = 0; while (used.has(slot)) slot++;
  players.push({ slot, src, label: label || srcLabel(src), act: act || srcAct(src), dft: dft || srcDrift(src), score: 0 });
  players.sort((a, b) => a.slot - b.slot);
  Sound.join(slot);
  sendLobby();
}
function leavePlayer(p) { players.splice(players.indexOf(p), 1); Sound.leave(); sendLobby(); }
// ¿Lo controla alguien sentado en este PC?
const isMine = (p) => (Net.role === 'client' ? !!p.mine : p.src.type !== 'net');

function getInput(p) {
  if (p.src.type === 'net') {
    const i = NET.inputs[p.src.peer] && NET.inputs[p.src.peer][p.src.idx];
    return i ? { thr: clamp(+i.thr || 0, -1, 1), steer: clamp(+i.steer || 0, -1, 1), drift: !!i.drift } : { thr: 0, steer: 0, drift: false };
  }
  if (p.src.type === 'kb') {
    const s = SCHEMES[p.src.idx];
    return {
      thr: (anyKey(s.up) ? 1 : 0) - (anyKey(s.down) ? 1 : 0),
      steer: (anyKey(s.right) ? 1 : 0) - (anyKey(s.left) ? 1 : 0),
      drift: anyKey(s.drift),
    };
  }
  const st = padState[p.src.idx];
  if (!st) return { thr: 0, steer: 0 };
  const gp = st.gp, b = (i) => gp.buttons[i];
  let steer = gp.axes[0] || 0;
  if (Math.abs(steer) < 0.2) steer = 0;
  if (b(14)?.pressed) steer = -1;
  if (b(15)?.pressed) steer = 1;
  const gas = Math.max(b(7)?.value || 0, b(0)?.pressed ? 1 : 0, b(12)?.pressed ? 1 : 0);
  const brk = Math.max(b(6)?.value || 0, b(1)?.pressed ? 1 : 0, b(13)?.pressed ? 1 : 0);
  return { thr: gas - brk, steer, drift: !!(b(5)?.pressed || b(4)?.pressed) };
}
function actionPressed(p) {
  if (!p) return false;
  return p.src.type === 'kb' ? anyPressed(SCHEMES[p.src.idx].action) : padPressed(p.src.idx, 2);
}
// Devuelve la pulsación de ACCIÓN de este frame: {d} trae la distancia que vio el jugador remoto
function takeAction(p) {
  if (!p) return null;
  if (p.src.type === 'net') {
    const q = NET.acts[p.src.peer] && NET.acts[p.src.peer][p.src.idx];
    return q && q.length ? q.shift() : null;
  }
  return actionPressed(p) ? { d: null } : null;
}
function actionLabel(p) { return p.act; }

// ---------------------------------------------------------------------
//  Estado de partida
// ---------------------------------------------------------------------
let state = 'menu';    // menu | lobby | countdown | play | over
let G = null;
let countdown = 0, lastBeat = 0, overT = 0;

function makeWorld(seed) {
  SEED = seed;
  G = {
    seed, time: 0, doomY: DOOM_START, doomSpeed: DOOM_SPEED0,
    cars: [], particles: [], gates: new Map(), curGate: null,
    camY: -120, shake: 0, msg: null, best: 0, rumbleT: 1,
    hitstop: 0, flash: 0, links: [], announced: new Set(),
    bolts: [], zapT: rand(14, 20),
    team: 0, turbo: 0, teamPop: null,
    pops: [], screechT: 0,
    tethers: [], ropeT: rand(ROPE_EVERY[0], ROPE_EVERY[1]), towT: rand(TOW_EVERY[0], TOW_EVERY[1]),
  };
}
function makeCar(id, x, y) {
  return {
    id, color: COLORS[id].c, name: 'P' + (id + 1),
    x, y, a: 0, vx: 0, vy: 0,
    alive: true, falling: false, fallT: 0, slide: 0, dist: 0, thr: 0, deathTime: 0, reason: '',
    air: null, parryCd: 0, zap: null,
    drift: null, slip: 0, combo: null, score: 0, boostT: 0, boostV: 0, grazeCd: 0, nearCd: 0,
    noEngine: false,
  };
}
function newGame() {
  makeWorld(Math.random() * 1000);
  const n = players.length;
  players.forEach((p, i) => G.cars.push(makeCar(p.slot, ROAD_W / 2 + (i - (n - 1) / 2) * 90, 0)));
  state = 'countdown'; countdown = 3; lastBeat = 4;
  NET.acts = {};
}
const liveCars = () => G.cars.filter((c) => c.alive && !c.falling);

// Suma a la barra de sinergia compartida. Al llenarse arranca el TURBO (durante el turbo no suma).
function teamGain(amount, label) {
  if (G.turbo > 0 || state !== 'play') return;
  G.team = Math.min(1, G.team + amount);
  fx('team', label);
  if (G.team >= 1) { G.turbo = TURBO_TIME; fx('turbo'); }
}
const carById = (id) => G.cars.find((c) => c.id === id);

function setMsg(text, color = '#fff', dur = 1.6) { G.msg = { text, color, t: dur, max: dur }; }
function showMsg(text, color = '#fff', dur = 1.6) { fx('msg', text, color, dur); }

// ---------------------------------------------------------------------
//  Efectos (sonido, partículas, mensajes). La simulación los dispara con fx():
//  se ejecutan aquí y, si somos host, se reenvían a los clientes para que
//  los reproduzcan igual.
// ---------------------------------------------------------------------
function fx(name, ...args) {
  FX[name](...args);
  if (Net.role === 'host') NET.queue.push([name, args]);
}
const FX = {
  msg(text, color, dur) { setMsg(text, color, dur); },
  beat() { Sound.beat(); },
  go() { setMsg('¡YA!', '#ffd23f', 0.8); Sound.go(); },
  over() { Sound.gameOver(); },
  hit(x, y, n, shake) { sparks(x, y, n); Sound.thud(); if (shake) G.shake = Math.max(G.shake, shake); },
  bump(x, y, f) { sparks(x, y, 10); Sound.bump(f); G.shake = Math.max(G.shake, Math.min(8, f / 40)); },
  death(id, reason) {
    const c = carById(id);
    G.shake = Math.max(G.shake, 14);
    Sound.death();
    if (c) { burst(c.x, c.y, c.color, 34, 300); setMsg(`${c.name} ${reason}`, c.color, 1.8); }
  },
  lock(id) { const c = carById(id); setMsg(`¡BLOQUEADO! ${c ? c.name : ''} cayó`, '#ff4d5e', 2); Sound.lock(); },
  gateOn(k) {
    const g = G.gates.get(k);
    setMsg('¡CADA UNO POR SU CARRIL!', '#ffffff', 2);
    Sound.event();
    if (!g || !g.lanes.length) return;
    g.lanes.forEach((ln, i) => {
      const [a, b] = laneBounds(g, i, g.zoneBot);
      for (let n = 0; n < 16; n++) addP({ x: rand(a, b), y: g.zoneBot - rand(0, 30), vx: rand(-40, 40), vy: rand(-160, -40), life: rand(0.5, 1), color: ln.color, size: rand(3, 6), kind: 'sq', drag: 2 });
    });
  },
  gateOpen(k) {
    const g = G.gates.get(k);
    G.shake = Math.max(G.shake, 10);
    setMsg('¡ADELANTE!', '#3ddc84', 1.4);
    Sound.open();
    if (!g) return;
    for (let i = 0; i < 90; i++) {
      addP({
        x: rand(0, ROAD_W), y: g.y, vx: rand(-200, 200), vy: rand(-450, -50), life: rand(0.8, 1.5),
        color: COLORS[i % 4].c, size: rand(4, 8), kind: 'conf', drag: 1.5, rot: rand(0, 6), vr: rand(-10, 10),
      });
    }
  },
  blip(id) { Sound.blip(id); },
  tick(q) { Sound.tick(q); },
  jump(id) { const c = carById(id); Sound.jump(); if (c) burst(c.x, c.y + 20, '#c9a227', 14, 180); },
  land(id) { const c = carById(id); Sound.thud(); G.shake = Math.max(G.shake, 5); if (c) burst(c.x, c.y, '#8a8aa0', 16, 160); },
  parry(aId, bId, perfect) {
    const a = carById(aId), b = carById(bId);
    G.hitstop = perfect ? 0.18 : 0.11;
    G.shake = Math.max(G.shake, perfect ? 18 : 12);
    G.flash = perfect ? 0.8 : 0.5;
    Sound.parry();
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    sparks(mx, my, 24); burst(mx, my, a.color, 16, 220); burst(mx, my, b.color, 16, 220);
    G.links.push({ a, b, t: 0.5 });
    setMsg(perfect ? '¡PARRY PERFECTO!' : '¡ENGANCHE!', perfect ? '#ffffff' : a.color, 1.2);
  },
  whiff() { Sound.whiff(); setMsg('¡FALLASTE!', '#999', 0.7); },
  warn() { Sound.warn(); },
  zap(id) {
    const c = carById(id);
    G.flash = Math.max(G.flash, 0.6);
    G.shake = Math.max(G.shake, 12);
    Sound.thunder();
    if (!c) return;
    // Rayo zigzagueante desde arriba de la pantalla hasta el carro
    const pts = [];
    for (let i = 0, x = c.x + rand(-60, 60); i <= 10; i++) { pts.push([x, c.y - 700 + i * 70]); x += rand(-40, 40) + (c.x - x) * 0.25; }
    pts[pts.length - 1] = [c.x, c.y];
    G.bolts.push({ pts, t: 0.45 });
    burst(c.x, c.y, '#9fd3ff', 30, 280);
    sparks(c.x, c.y, 16);
    setMsg(`¡RAYO a ${c.name}! Chóquenlo para repararlo`, '#9fd3ff', 2.4);
  },
  team(label) { G.teamPop = { text: '+ ' + label, t: 1.2 }; Sound.team(); },
  style(id, label, mult) {
    const c = carById(id);
    Sound.style(mult);
    if (c) addPop(c.x, c.y - 70, `${label}  x${mult}`, c.color, 14);
  },
  cash(id, value) {
    const c = carById(id);
    Sound.cash();
    if (c) { addPop(c.x, c.y - 80, `+${value}`, '#ffd23f', 26); burst(c.x, c.y, '#ffd23f', 16, 200); }
  },
  ropeOn(a, b) {
    const ca = carById(a), cb = carById(b);
    Sound.rope();
    if (ca && cb) setMsg(`¡${ca.name} y ${cb.name} ATADOS! (${ROPE_TIME} s)`, '#e0b878', 2.2);
  },
  ropeSnag(x, y) { Sound.snag(); G.shake = Math.max(G.shake, 5); sparks(x, y, 10); addPop(x, y - 40, '¡TRABADOS! Rodeen el obstáculo', '#ff8a2e', 18); },
  ropeFree(x, y) { Sound.rope(); addPop(x, y - 40, '¡DESTRABADOS!', '#3ddc84', 16); },
  ropeOff(a, b, ok) {
    Sound.snap();
    for (const id of [a, b]) { const c = carById(id); if (c && c.alive) burst(c.x, c.y, '#e0b878', 10, 160); }
    if (ok) setMsg('¡LIBRES!', '#3ddc84', 1.2);
  },
  towOn(a, b) {
    const ca = carById(a), cb = carById(b);
    Sound.engineDie();
    if (ca) burst(ca.x, ca.y, '#555566', 18, 120);
    if (ca && cb) setMsg(`¡${ca.name} SIN MOTOR! ${cb.name} lo remolca a la recarga`, '#c8cdd8', 2.6);
  },
  towOff(a, b, ok) {
    const ca = carById(a);
    Sound.snap();
    if (ok) { Sound.fixed(); if (ca) { burst(ca.x, ca.y, '#3ddc84', 24, 220); setMsg(`¡MOTOR DE ${ca.name} RECARGADO!`, '#3ddc84', 1.6); } }
  },
  comboLost(id) { const c = carById(id); Sound.comboLost(); if (c) addPop(c.x, c.y - 70, 'COMBO PERDIDO', '#999', 14); },
  driftLv(id, lv) {
    const c = carById(id);
    Sound.driftLv(lv);
    if (c) sparks(c.x, c.y, 8);
  },
  driftBoost(id, lv) {
    const c = carById(id);
    Sound.driftBoost();
    if (c) burst(c.x, c.y + 14, lv === 2 ? '#ff8a2e' : '#3fa7ff', 18, 220);
  },
  turbo() {
    setMsg('¡TURBO EN EQUIPO!', '#ffd23f', 1.8);
    G.flash = Math.max(G.flash, 0.35);
    G.shake = Math.max(G.shake, 8);
    Sound.turbo();
    for (const c of liveCars()) burst(c.x, c.y, '#ffd23f', 18, 260);
  },
  turboEnd() { Sound.turboEnd(); },
  zapHit(id) { const c = carById(id); Sound.zap(); if (c) burst(c.x, c.y, '#9fd3ff', 12, 200); },
  unzap(id) { const c = carById(id); Sound.fixed(); if (c) { burst(c.x, c.y, '#3ddc84', 20, 200); setMsg(`${c.name} reparado`, '#3ddc84', 1.2); } },
};

function viewMetrics() {
  const scale = Math.min(W / (ROAD_W + 2 * T + 40), H / 640);
  return { scale, viewH: H / scale };
}

// ---------------------------------------------------------------------
//  Mundo procedural: baldosas, obstáculos, colapso
// ---------------------------------------------------------------------
function laneCol(r) { return Math.round(6 + 4 * Math.sin(r * 0.11 + SEED)); }
// Qué parte de la zona de una puerta es la fila r: 'barrier' (pegada a la barrera, siempre
// despejada), 'lanes' (tramo de carriles, puede tener obstáculos) o null
function gateZone(r) {
  if (r > G0 + LANE_ROWS + 3) return null;
  const k = Math.round((G0 - r) / GAP);
  for (let kk = k - 1; kk <= k + 1; kk++) {
    if (kk < 0) continue;
    const g = G0 - kk * GAP;
    if (r >= g - 2 && r <= g + 2) return 'barrier';
    if (r > g + 2 && r <= g + LANE_ROWS + 3) return 'lanes';
  }
  return null;
}
// Zona de salto: una rampa y un abismo poco después de cada puerta
function jumpRamp(k) { return G0 - k * GAP - 10; }
function jumpZone(k) { const rr = jumpRamp(k); return { k, rr, top: (rr - CHASM_ROWS) * T, bot: rr * T }; }
function jumpZoneNear(r) {
  const k = Math.round((G0 - 10 - r) / GAP);
  for (let kk = k - 1; kk <= k + 1; kk++) {
    if (kk < 0) continue;
    const rr = jumpRamp(kk);
    if (r >= rr - CHASM_ROWS - 3 && r <= rr + 3) return jumpZone(kk);
  }
  return null;
}
function isChasm(r) { const z = jumpZoneNear(r); return !!z && r >= z.rr - CHASM_ROWS && r < z.rr; }
function isRamp(r) { const z = jumpZoneNear(r); return !!z && r === z.rr; }

function isObstacle(c, r) {
  if (c < 0 || c >= COLS || r > -6 || jumpZoneNear(r)) return false;
  const gz = gateZone(r);
  if (gz === 'barrier') return false;
  if (Math.abs(c - laneCol(r)) <= 1) return false; // siempre queda un camino libre
  const prob = gz === 'lanes' ? LANE_OBS : 0.06 + Math.min(0.06, -r * 0.00006);
  return hash(c, r, 3) < prob;
}
// Borde irregular del colapso: cada baldosa cae en un momento ligeramente distinto
function tileEdge(c, r) { return r * T + T / 2 + (hash(c, r, 1) - 0.5) * 110; }
function fallP(c, r) { return clamp((tileEdge(c, r) - G.doomY) / 170, 0, 1); }
function crackA(c, r) {
  const d = G.doomY - tileEdge(c, r);
  return d < 0 ? 1 : clamp(1 - d / 280, 0, 1);
}

// ---------------------------------------------------------------------
//  Partículas
// ---------------------------------------------------------------------
// Textos flotantes en el mundo (combos, cobros…)
function addPop(x, y, text, color, size) {
  G.pops.push({ x, y, text, color, size, t: 1.1, max: 1.1 });
  if (G.pops.length > 24) G.pops.shift();
}
function addP(o) { if (G.particles.length < 1500) G.particles.push(Object.assign({ t: 0, drag: 3, rot: 0, vr: 0 }, o)); }
function burst(x, y, color, n, speed = 260) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(0, speed);
    addP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1.1), color, size: rand(2, 6), kind: 'sq' });
  }
}
function sparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(120, 380);
    addP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.4), color: '#ffd27a', size: 2, kind: 'spark', drag: 5 });
  }
}
function updateParticles(dt) {
  const ps = G.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.t += dt;
    if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const k = Math.exp(-p.drag * dt);
    p.vx *= k; p.vy *= k;
    if (p.kind === 'conf') p.vy += 500 * dt;
    p.rot += p.vr * dt;
  }
}

// ---------------------------------------------------------------------
//  Puertas / evento de colores
// ---------------------------------------------------------------------
function getGate(k) {
  let g = G.gates.get(k);
  if (!g) {
    const r = G0 - k * GAP;
    g = {
      k, r, y: r * T + T / 2, state: 'idle', lanes: [], progress: 0, lockT: 0, openT: 0, flash: 0, lastQ: 0,
      zoneTop: r * T + T / 2 + 10, zoneBot: (r + 1 + LANE_ROWS) * T, off: null,
    };
    G.gates.set(k, g);
  }
  return g;
}
// Límites del carril i (rectos y verticales). Todos miden LANE_W, van juntos y el grupo
// empieza en g.off, una posición al azar de la pista elegida al activar el evento.
function laneBounds(g, i, y) {
  const off = g.off != null ? g.off : (ROAD_W - g.lanes.length * LANE_W) / 2;
  const left = off + i * LANE_W;
  return [left, left + LANE_W];
}
function assignLanes(g, cars) {
  // Orden aleatorio: obliga a cruzarse con los demás (y a empujarse)
  const order = [...cars].sort(() => Math.random() - 0.5);
  g.lanes = order.map((car) => ({ id: car.id, color: car.color, name: car.name, on: false }));
  g.off = Math.round(rand(30, ROAD_W - g.lanes.length * LANE_W - 30));
}
function activateGate(g) {
  const alive = liveCars();
  if (!alive.length) return;
  assignLanes(g, alive);
  g.state = 'active'; g.progress = 0; g.lastQ = 0;
  fx('gateOn', g.k);
}
function openGate(g) {
  g.state = 'open'; g.openT = 0; g.progress = 1;
  fx('gateOpen', g.k);
  teamGain(TEAM_GATE, 'CARRILES');
}
function updateGates(dt) {
  const { viewH } = viewMetrics();
  const rTop = Math.floor((G.camY - viewH) / T), rBot = Math.floor((G.camY + viewH) / T);
  const kMin = Math.max(0, Math.floor((G0 - rBot) / GAP)), kMax = Math.ceil((G0 - rTop) / GAP);
  for (let k = kMin; k <= kMax; k++) getGate(k);

  const alive = liveCars();
  G.curGate = null;
  for (const [k, g] of G.gates) {
    if (g.y > G.doomY + 1500) { G.gates.delete(k); continue; }
    g.flash = Math.max(0, g.flash - dt * 2);
    if (G.doomY < g.y - 40) { if (g.state !== 'open') g.state = 'dead'; continue; }

    if (g.state === 'idle') {
      if (state === 'play' && alive.some((c) => c.y < g.zoneBot + 7 * T)) activateGate(g);
    } else if (g.state === 'active') {
      G.curGate = g;
      let all = alive.length > 0;
      g.lanes.forEach((ln, i) => {
        const car = G.cars.find((c) => c.id === ln.id);
        let on = false;
        if (car && car.alive && !car.falling && car.y >= g.zoneTop - 30 && car.y <= g.zoneBot) {
          const [a, b] = laneBounds(g, i, car.y);
          on = car.x > a && car.x < b;
        }
        if (on && !ln.on) fx('blip', ln.id);
        ln.on = on;
        if (!on) all = false;
      });
      if (all) g.progress += dt / HOLD_TIME; // si alguien se sale, el progreso se queda donde iba
      const q = Math.floor(g.progress * 4);
      if (q > g.lastQ && q < 4) fx('tick', q);
      g.lastQ = q;
      if (g.progress >= 1) openGate(g);
    } else if (g.state === 'locked') {
      G.curGate = g;
      g.lockT -= dt;
      if (g.lockT <= 0) activateGate(g);
    } else if (g.state === 'open') {
      g.openT += dt;
    }
  }
}

// ---------------------------------------------------------------------
//  Carros
// ---------------------------------------------------------------------
function killCar(car, reason) {
  if (car.falling || !car.alive) return;
  car.falling = true; car.fallT = 0; car.deathTime = G.time; car.reason = reason;
  car.air = null; car.zap = null; car.drift = null; car.combo = null;
  fx('death', car.id, reason);
  // Si tenía carril asignado en un evento activo, se bloquea el paso para todos
  for (const g of G.gates.values()) {
    if (g.state === 'active' && g.lanes.some((l) => l.id === car.id)) {
      g.state = 'locked'; g.lockT = LOCK_TIME; g.progress = 0; g.flash = 1;
      fx('lock', car.id);
    }
  }
}

function collideObstacles(car, quiet = false) {
  const r0 = Math.floor((car.y - CAR_R) / T), r1 = Math.floor((car.y + CAR_R) / T);
  const c0 = Math.floor((car.x - CAR_R) / T), c1 = Math.floor((car.x + CAR_R) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!isObstacle(c, r) || fallP(c, r) > 0.3) continue;
    const bx0 = c * T + 6, by0 = r * T + 6, bx1 = c * T + T - 6, by1 = r * T + T - 6;
    const nx = clamp(car.x, bx0, bx1), ny = clamp(car.y, by0, by1);
    let dx = car.x - nx, dy = car.y - ny;
    const d = Math.hypot(dx, dy);
    // Roce: pasar muy pegado a un obstáculo sin tocarlo
    if (!quiet && d >= CAR_R && d < CAR_R + 14 && car.grazeCd <= 0 && Math.hypot(car.vx, car.vy) > 180) {
      car.grazeCd = 0.7;
      style(car, 20, 0.25, 'ROCE');
    }
    if (d >= CAR_R || d === 0) continue;
    dx /= d; dy /= d;
    car.x = nx + dx * CAR_R; car.y = ny + dy * CAR_R;
    const vn = car.vx * dx + car.vy * dy;
    if (vn < 0) {
      car.vx -= 1.3 * vn * dx; car.vy -= 1.3 * vn * dy;
      if (vn < -120 && !quiet) { fx('hit', nx, ny, 8, 4); breakCombo(car); }
    }
  }
}

// ---------------------------------------------------------------------
//  Salto y parry en cadena
//  - El primero que salta (con gente detrás) queda planeando sobre el abismo.
//  - El siguiente salta y, al alcanzarlo, pulsa ACCIÓN en el momento justo:
//    el de delante sale lanzado a la otra orilla y el que llega queda planeando
//    para el siguiente. Si ya no queda nadie detrás, también sale lanzado.
//  - Quien planea demasiado sin que lo enganchen, cae.
// ---------------------------------------------------------------------
const playerOf = (car) => players.find((pl) => pl.slot === car.id);
function someoneBehind(car, z) {
  return G.cars.some((o) => o !== car && o.alive && !o.falling && !o.air && o.y > z.bot - 5);
}
function startJump(car, z) {
  const speed = clamp(-car.vy, 260, CAR_MAX);
  car.vy = -speed; car.vx *= 0.3;
  const gliders = G.cars.some((o) => o !== car && o.air && o.air.zone === z.k && o.air.mode !== 'launch');
  car.air = { zone: z.k, top: z.top, bot: z.bot, mode: 'fly', z: 1, t: 0, glideT: 0, lastBeep: 0 };
  fx('jump', car.id);
  if (!gliders && !someoneBehind(car, z)) launch(car); // va solo: la rampa le alcanza
}
function launch(car) {
  const a = car.air;
  // Aterrizaje siempre a la misma distancia del borde: así el cliente puede predecirlo exacto
  a.mode = 'launch'; a.t = 0; a.fromY = car.y; a.toY = a.top - 110; a.fromZ = a.z;
  car.vx = 0; car.vy = 0;
}
// loose: sin exigir que el objetivo vaya delante (para aceptar pulsaciones remotas con lag)
function parryTarget(car, loose = false) {
  let best = null, bestD = loose ? PARRY_RANGE + 120 : PARRY_RANGE;
  for (const o of G.cars) {
    if (o === car || !o.air || o.air.zone !== car.air.zone || o.air.mode === 'launch') continue;
    if (!loose && o.y > car.y + 10) continue;
    const d = Math.hypot(o.x - car.x, o.y - car.y);
    if (d < bestD) { best = o; bestD = d; }
  }
  return best ? { car: best, d: bestD } : null;
}
// claimed: distancia que vio en su pantalla un jugador remoto al pulsar. Si el host
// también los ve razonablemente cerca, se confía en lo que vio el jugador (el lag no lo castiga).
const LAG_TOLERANCE = 110;
function tryParry(car, claimed = null) {
  if (car.parryCd > 0) return;
  let tg = parryTarget(car);
  let d = tg ? tg.d : Infinity;
  if (claimed != null) {
    const lt = parryTarget(car, true);
    if (lt && lt.d <= PARRY_WIN + LAG_TOLERANCE) { tg = lt; d = claimed; }
  }
  if (!tg) return;
  if (d <= PARRY_WIN) {
    fx('parry', car.id, tg.car.id, d < 18);
    teamGain(d < 18 ? TEAM_PERFECT : TEAM_PARRY, d < 18 ? 'PARRY PERFECTO' : 'ENGANCHE');
    launch(tg.car);
    const z = jumpZone(car.air.zone);
    if (someoneBehind(car, z)) { car.air.mode = 'glide'; car.air.glideT = 0; car.vy = 0; }
    else launch(car);
  } else {
    car.parryCd = 0.6;
    fx('whiff');
  }
}
function updateAir(car, dt, inp, p) {
  const a = car.air;
  a.t += dt;
  car.x = clamp(car.x + inp.steer * 170 * dt, CAR_R, ROAD_W - CAR_R);
  if (a.mode === 'launch') {
    const k = Math.min(1, a.t / 0.75);
    car.y = a.fromY + (a.toY - a.fromY) * easeOut(k);
    a.z = a.fromZ * (1 - k) + Math.sin(Math.PI * k) * 0.9;
    if (k >= 1) {
      car.air = null; car.vy = -140; car.vx = 0;
      fx('land', car.id);
      style(car, 40, 0.5, 'ATERRIZAJE');
    }
    return;
  }
  car.y += car.vy * dt;
  car.vy *= Math.exp(-(a.mode === 'glide' ? 4 : 1.2) * dt);
  if (car.y < a.top + 40) { car.y = a.top + 40; car.vy = 0; }
  if (a.mode === 'fly') {
    a.z = 0.6 + 0.4 * Math.exp(-a.t * 2);
    if (Math.abs(car.vy) < 40) { a.mode = 'glide'; a.glideT = 0; }
  } else {
    a.z = 0.6 + 0.06 * Math.sin(G.time * 5);
    a.glideT += dt;
    const left = GLIDE_TIME - a.glideT;
    if (left < 1.2 && a.glideT - a.lastBeep > (left < 0.5 ? 0.1 : 0.22)) { a.lastBeep = a.glideT; fx('warn'); }
    if (left <= 0) { killCar(car, 'no lo engancharon'); return; }
  }
  const act = takeAction(p);
  if (act) tryParry(car, act.d);
  if (state === 'play' && G.doomY < car.y - 10) killCar(car, 'se lo tragó el colapso');
}

// ---------------------------------------------------------------------
//  Derrape y combos
//  - Derrapar, pasar rozando a otro carro, rozar obstáculos y aterrizar saltos
//    suman puntos y suben el multiplicador.
//  - El combo se cobra con ACCIÓN en el suelo o solo tras COMBO_IDLE s sin hacer nada.
//    Al cobrarlo, una parte va a la barra de sinergia compartida.
//  - Chocar (paredes, obstáculos, barreras u otro carro) pierde el combo.
// ---------------------------------------------------------------------
function style(car, pts, multAdd = 0, label = null) {
  if (state !== 'play') return;
  const c = car.combo || (car.combo = { pts: 0, mult: 1, idle: 0 });
  c.pts += pts; c.idle = 0;
  if (multAdd) c.mult = Math.min(COMBO_MAX, c.mult + multAdd);
  if (label) fx('style', car.id, label, Math.round(c.mult * 10) / 10);
}
function cashCombo(car) {
  const c = car.combo;
  car.combo = null;
  if (!c) return;
  const value = Math.round(c.pts * c.mult);
  if (value < 20) return;
  car.score += value;
  fx('cash', car.id, value);
  teamGain(Math.min(COMBO_TEAM_MAX, value / COMBO_TEAM_DIV), `COMBO ${car.name}`);
}
function breakCombo(car) {
  car.drift = null;
  if (!car.combo) return;
  const lost = car.combo.pts > 15;
  car.combo = null;
  if (lost) fx('comboLost', car.id);
}

// ---------------------------------------------------------------------
//  Cuerdas: la cuerda (dos carros atados) y el remolque (uno sin motor jalado por otro)
//  Una cuerda es un elástico: si se estira más que su largo tira de los dos carros, y pasado
//  el máximo arrastra al otro sí o sí. Si pasa por los dos lados de un obstáculo se traba:
//  entonces tira de ambos hacia el obstáculo hasta que uno lo rodee.
// ---------------------------------------------------------------------
const tetherOf = (car) => G.tethers.find((t) => t.a === car.id || t.b === car.id);

// ¿El segmento (x1,y1)-(x2,y2) cruza la caja? (Liang–Barsky)
function segHitsBox(x1, y1, x2, y2, bx0, by0, bx1, by1) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - bx0], [dx, bx1 - x1], [-dy, y1 - by0], [dy, by1 - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
// Caja (un poco reducida) del primer obstáculo que cruza la cuerda entre a y b
function ropeObstacle(a, b) {
  const r0 = Math.floor(Math.min(a.y, b.y) / T), r1 = Math.floor(Math.max(a.y, b.y) / T);
  const c0 = clamp(Math.floor(Math.min(a.x, b.x) / T), 0, COLS - 1), c1 = clamp(Math.floor(Math.max(a.x, b.x) / T), 0, COLS - 1);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!isObstacle(c, r) || fallP(c, r) > 0.3) continue;
    const box = [c * T + 12, r * T + 12, c * T + T - 12, r * T + T - 12];
    if (segHitsBox(a.x, a.y, b.x, b.y, ...box)) {
      // Eje en el que el obstáculo los separa: se destraban cuando uno lo rodea y quedan del mismo lado
      const axis = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y) ? 'x' : 'y';
      return { x: c * T + T / 2, y: r * T + T / 2, box, axis };
    }
  }
  return null;
}
// ¿Hay un abismo entre los dos? (entonces la cuerda se afloja para no arrastrar a nadie al vacío)
function chasmBetween(a, b) {
  const z = jumpZoneNear(Math.floor(a.y / T)) || jumpZoneNear(Math.floor(b.y / T));
  return !!z && ((a.y < z.top + 40 && b.y > z.bot - 10) || (b.y < z.top + 40 && a.y > z.bot - 10));
}

// Tirón elástico entre dos puntos. only: aplicar solo a ese carro (predicción del cliente)
function pullPair(t, p, q, len, maxLen, dt, only) {
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
  if (d <= len || d < 1) return;
  const nx = dx / d, ny = dy / d;
  const vr = ((q.vx || 0) - (p.vx || 0)) * nx + ((q.vy || 0) - (p.vy || 0)) * ny; // >0: se separan
  const imp = (t.k * (d - len) + Math.max(0, vr) * 2.5) * dt * 0.5;
  const mp = p.vx !== undefined && only !== q, mq = q.vx !== undefined && only !== p; // un punto fijo no se mueve
  if (mp) { p.vx += nx * imp; p.vy += ny * imp; }
  if (mq) { q.vx -= nx * imp; q.vy -= ny * imp; }
  if (d > maxLen) { // tope: arrastra
    const ex = d - maxLen, share = mp && mq ? 0.5 : 1;
    if (mp) { p.x += nx * ex * share; p.y += ny * ex * share; }
    if (mq) { q.x -= nx * ex * share; q.y -= ny * ex * share; }
  }
}
function tetherPhysics(t, dt, only = null) {
  const a = carById(t.a), b = carById(t.b);
  if (!a || !b || a.air || b.air || chasmBetween(a, b)) { t.slack = true; t.snag = null; return; }
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (t.slack) { t.L = Math.max(t.rest, Math.min(600, d)); t.slack = false; } // se vuelve a tensar poco a poco
  t.L = Math.max(t.rest, t.L - 80 * dt);
  const maxLen = Math.max(t.max, t.L * 1.4);
  if (!t.snag) { pullPair(t, a, b, t.L, maxLen, dt, only); return; }
  // Trabada: cada tramo va del carro al obstáculo; el largo se reparte entre los dos
  const P = { x: t.snag.x, y: t.snag.y };
  const da = Math.hypot(P.x - a.x, P.y - a.y), db = Math.hypot(P.x - b.x, P.y - b.y), tot = da + db || 1;
  pullPair(t, a, P, t.L * da / tot, maxLen * da / tot, dt, only);
  pullPair(t, b, P, t.L * db / tot, maxLen * db / tot, dt, only);
}

function freeCars() { return liveCars().filter((c) => !c.air && !tetherOf(c)); }
function nearestTo(car, list) {
  let best = null, bd = Infinity;
  for (const o of list) { const d = Math.hypot(o.x - car.x, o.y - car.y); if (o !== car && d < bd) { best = o; bd = d; } }
  return best;
}
function startTether(kind) {
  const free = freeCars();
  if (free.length < 2) return false;
  const a = free[Math.floor(Math.random() * free.length)], b = nearestTo(a, free);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const rope = kind === 'rope';
  const t = {
    kind, a: a.id, b: b.id, time: ROPE_TIME,
    rest: rope ? ROPE_LEN : TOW_LEN, max: rope ? ROPE_MAX : TOW_MAX, k: rope ? ROPE_K : TOW_K,
    L: Math.max(rope ? ROPE_LEN : TOW_LEN, Math.min(400, d)), snag: null, slack: false,
    goalY: rope ? null : a.y - TOW_DIST,
  };
  G.tethers.push(t);
  if (rope) fx('ropeOn', a.id, b.id);
  else { a.noEngine = true; fx('towOn', a.id, b.id); }
  return true;
}
function endTether(t, ok) {
  G.tethers.splice(G.tethers.indexOf(t), 1);
  const a = carById(t.a);
  if (t.kind === 'tow' && a) a.noEngine = false;
  fx(t.kind === 'rope' ? 'ropeOff' : 'towOff', t.a, t.b, ok);
  if (ok) teamGain(t.kind === 'rope' ? TEAM_ROPE : TEAM_TOW, t.kind === 'rope' ? 'ATADOS' : 'REMOLQUE');
}
const okCar = (c) => c && c.alive && !c.falling;
function updateTethers(dt) {
  for (const t of [...G.tethers]) {
    const a = carById(t.a), b = carById(t.b);
    if (t.kind === 'rope') {
      t.time -= dt;
      if (!okCar(a) || !okCar(b)) { endTether(t, false); continue; }
      if (t.time <= 0) { endTether(t, true); continue; }
    } else {
      if (!okCar(a)) { endTether(t, false); continue; }
      if (!okCar(b)) { // se cayó quien remolcaba: lo toma otro, o el motor vuelve
        const nb = nearestTo(a, freeCars());
        if (nb) { t.b = nb.id; t.slack = true; fx('msg', `${nb.name} toma el remolque`, nb.color, 1.4); }
        else { endTether(t, false); continue; }
      }
      if (a.y < t.goalY) { endTether(t, true); continue; }
    }
    // Trabarse / destrabarse en obstáculos
    if (okCar(a) && okCar(b) && !a.air && !b.air) {
      if (!t.snag) {
        const o = ropeObstacle(a, b);
        if (o) { t.snag = o; fx('ropeSnag', o.x, o.y); }
      } else {
        const s = t.snag, k = s.axis;
        const sameSide = Math.sign(a[k] - s[k]) === Math.sign(b[k] - s[k]);
        if (sameSide || fallP(Math.floor(s.x / T), Math.floor(s.y / T)) > 0.3) { t.snag = null; fx('ropeFree', s.x, s.y); }
      }
    }
    tetherPhysics(t, dt);
  }
}

// Física de conducción: acelerar, girar, moverse y chocar con bordes, obstáculos y barreras.
// La usan el host (quiet=false) y la predicción local del cliente (quiet=true: solo mueve,
// sin efectos ni combos, porque eso lo decide el host).
function drive(car, dt, thr, steer, fwd, lat, maxF, boost, quiet) {
  if (thr > 0) fwd += CAR_ACC * boost * thr * dt;
  else if (thr < 0) fwd += (fwd > 0 ? CAR_BRAKE : CAR_ACC * 0.6) * thr * dt;
  else fwd *= Math.exp(-1.5 * dt);
  fwd = clamp(fwd, -CAR_REV, maxF);

  // Agarre lateral (tras un choque, se reduce un momento para que el empujón se note)
  car.slide = Math.max(0, car.slide - dt);
  lat *= Math.exp(-(car.slide > 0 ? 2 : 10) * dt);

  car.a += steer * CAR_TURN * dt * clamp(fwd / 140, -1, 1);
  const dx = Math.sin(car.a), dy = -Math.cos(car.a);
  const rx = Math.cos(car.a), ry = Math.sin(car.a);
  car.vx = dx * fwd + rx * lat;
  car.vy = dy * fwd + ry * lat;
  car.x += car.vx * dt; car.y += car.vy * dt;

  // Bordes de la carretera
  const hit = (x, y, n, shake) => { if (!quiet) { fx('hit', x, y, n, shake); breakCombo(car); } };
  if (car.x < CAR_R) { car.x = CAR_R; if (car.vx < -120) hit(car.x - CAR_R, car.y, 6, 0); car.vx = Math.abs(car.vx) * 0.4; }
  if (car.x > ROAD_W - CAR_R) { car.x = ROAD_W - CAR_R; if (car.vx > 120) hit(car.x + CAR_R, car.y, 6, 0); car.vx = -Math.abs(car.vx) * 0.4; }

  collideObstacles(car, quiet);

  // Barreras de las puertas cerradas
  for (const g of G.gates.values()) {
    if (g.state === 'open' || g.state === 'dead') continue;
    if (car.y - CAR_R < g.y + 10 && car.y > g.y - 60) {
      car.y = g.y + 10 + CAR_R;
      if (car.vy < 0) {
        if (car.vy < -150) hit(car.x, g.y + 10, 8, 3);
        car.vy = -car.vy * 0.3;
      }
    }
  }
}

function updateCar(car, dt) {
  if (car.falling) {
    car.fallT += dt / 0.9;
    car.x += car.vx * dt * 0.4; car.y += car.vy * dt * 0.4;
    if (car.fallT >= 1) { car.alive = false; car.falling = false; }
    return;
  }
  if (!car.alive) return;

  const p = playerOf(car);
  const inp = state === 'play' && p ? getInput(p) : { thr: 0, steer: 0, drift: false };
  if (car.noEngine) inp.thr = Math.min(0, inp.thr); // sin motor: solo frenar y girar
  car.thr = inp.thr;
  car.parryCd = Math.max(0, car.parryCd - dt);
  car.grazeCd = Math.max(0, car.grazeCd - dt);
  car.nearCd = Math.max(0, car.nearCd - dt);
  car.boostT = Math.max(0, car.boostT - dt);
  if (car.air) { car.drift = null; car.slip *= Math.exp(-8 * dt); updateAir(car, dt, inp, p); return; }
  // En el suelo, ACCIÓN cobra el combo
  if (takeAction(p) && car.combo) cashCombo(car);
  const prevY = car.y;

  let dx = Math.sin(car.a), dy = -Math.cos(car.a);
  let rx = Math.cos(car.a), ry = Math.sin(car.a);
  let fwd = car.vx * dx + car.vy * dy;
  let lat = car.vx * rx + car.vy * ry;

  // Avería por rayo: más lento y gira mal hacia un lado. Se arregla sola o con choques.
  let steer = inp.steer;
  if (car.zap) {
    car.zap.t -= dt;
    car.zap.cd = Math.max(0, car.zap.cd - dt);
    if (car.zap.t <= 0) {
      if (car.zap.helped) teamGain(TEAM_FIXED, 'REPARADO');
      car.zap = null; fx('unzap', car.id);
    } else if (Math.sign(steer) === car.zap.side) steer *= ZAP_TURN;
  }
  const boost = G.turbo > 0 ? TURBO_BOOST : 1;

  // Derrape: mantener el botón mientras se gira a buena velocidad
  if (!car.drift && inp.drift && Math.abs(steer) > 0.1 && fwd > DRIFT_MIN_SPEED) {
    car.drift = { t: 0, dir: Math.sign(steer), lv: 0 };
  }
  if (car.drift && (!inp.drift || fwd < DRIFT_MIN_SPEED * 0.7)) {
    const lv = car.drift.lv;
    car.drift = null;
    if (lv > 0 && !inp.drift) { // soltado a tiempo: mini-turbo
      car.boostV = DRIFT_BOOST[lv - 1]; car.boostT = 0.8;
      fwd += car.boostV;
      fx('driftBoost', car.id, lv);
      style(car, 30 * lv, 0.5 * lv, lv === 2 ? 'MEGA DERRAPE' : 'DERRAPE');
    }
  }
  if (car.drift) {
    const d = car.drift;
    d.t += dt;
    const lv = d.t >= DRIFT_LEVELS[1] ? 2 : d.t >= DRIFT_LEVELS[0] ? 1 : 0;
    if (lv > d.lv) { d.lv = lv; fx('driftLv', car.id, lv); }
    // Siempre gira hacia el lado del derrape; el volante solo lo cierra o lo abre
    steer = d.dir * clamp(0.75 + 0.55 * steer * d.dir, 0.25, 1.3) * 1.15;
    fwd *= Math.exp(-0.12 * dt);
    style(car, 14 * dt * (1 + lv * 0.5));
  }
  // Inclinación visual del carro hacia dentro de la curva
  car.slip += ((car.drift ? car.drift.dir * 0.5 : 0) - car.slip) * Math.min(1, dt * 8);

  // El combo se cobra solo si pasas un rato sin hacer nada
  if (car.combo && !car.drift && (car.combo.idle += dt) > COMBO_IDLE) cashCombo(car);

  // El mini-turbo del derrape permite pasar un rato por encima de la velocidad máxima
  const maxF = CAR_MAX * (car.zap ? ZAP_SPEED : 1) * boost + (car.boostT > 0 ? car.boostV * (car.boostT / 0.8) : 0);

  drive(car, dt, inp.thr, steer, fwd, lat, maxF, boost, false);

  car.dist = Math.max(car.dist, -car.y / 16);

  // ¿Pasó por la rampa? -> salto
  const z = jumpZoneNear(Math.floor(car.y / T));
  if (z && prevY >= z.bot && car.y < z.bot) { startJump(car, z); return; }

  // ¿Se cayó el suelo debajo (o entró al abismo sin saltar)?
  if (state === 'play') {
    const c = clamp(Math.floor(car.x / T), 0, COLS - 1), r = Math.floor(car.y / T);
    if (isChasm(r)) killCar(car, 'cayó al abismo');
    else if (fallP(c, r) > 0.25) killCar(car, 'cayó al vacío');
  }
}

function collideCars() {
  const cs = liveCars().filter((c) => !c.air);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = CAR_R * 2;
    // Pasada al límite: cruzarse muy cerca y rápido sin chocar
    const tied = G.tethers.some((t) => (t.a === a.id && t.b === b.id) || (t.a === b.id && t.b === a.id));
    if (!tied && d >= min && d < min + 26 && Math.hypot(b.vx - a.vx, b.vy - a.vy) > 160) {
      for (const c of [a, b]) if (c.nearCd <= 0) { c.nearCd = 0.8; style(c, 25, 0.5, 'AL LÍMITE'); }
    }
    if (d >= min || d < 0.001) continue;
    const nx = dx / d, ny = dy / d, ov = (min - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const jmp = -(1 + 1.15) * rv / 2;
      a.vx -= jmp * nx; a.vy -= jmp * ny; b.vx += jmp * nx; b.vy += jmp * ny;
      if (-rv > 70) {
        a.slide = b.slide = 0.35;
        a.a += rand(-0.15, 0.15); b.a += rand(-0.15, 0.15);
        fx('bump', (a.x + b.x) / 2, (a.y + b.y) / 2, -rv);
        breakCombo(a); breakCombo(b); // chocarse rompe el combo de los dos
        a.nearCd = b.nearCd = 1; // separarse tras el golpe no cuenta como "al límite"
      }
      // Un compañero que choca al carro averiado le resta tiempo de avería
      if (-rv > 50) {
        for (const [z, o] of [[a, b], [b, a]]) {
          if (!z.zap || o.zap || z.zap.cd > 0) continue;
          z.zap.t -= ZAP_HIT; z.zap.cd = 0.3; z.zap.helped = true;
          fx('zapHit', z.id);
          teamGain(TEAM_HELP, 'AYUDA');
        }
      }
    }
  }
}

// viewOnly: en los clientes la cámara solo se mueve; empujar y matar lo decide el host
function updateCamera(dt, viewOnly = false) {
  const live = liveCars();
  const { viewH } = viewMetrics();
  const jumping = live.some((c) => c.air);
  if (live.length) {
    let minY = Infinity, maxY = -Infinity;
    for (const c of live) { minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); }
    let target = (minY + maxY) / 2 - viewH * 0.08;
    // El líder manda: el que se queda atrás sale de pantalla (salvo durante un salto en cadena)
    if (!jumping) target = Math.min(target, minY + viewH * 0.3);
    // El que va primero siempre queda a la vista: la cámara lo sigue (antes lo frenaba contra el
    // borde de arriba, pero eso en online no se puede predecir y daba tirones)
    target = Math.min(target, minY + viewH / 2 - 60);
    const fast = minY < G.camY - viewH / 2 + 90;
    G.camY += (target - G.camY) * Math.min(1, dt * (fast ? 9 : 3.5));
  }
  if (viewOnly) return;
  const bottom = G.camY + viewH / 2;
  for (const c of live) {
    if (c.air) continue;
    if (state === 'play' && !jumping && c.y > bottom + 30) killCar(c, 'se quedó atrás');
  }
}

// ---------------------------------------------------------------------
//  Bucle de actualización
// ---------------------------------------------------------------------
// Teclado/mando de este PC: devuelve qué control quiere entrar o salir (lid = id local estable)
function lobbyLocalInput(onJoin, onLeave) {
  SCHEMES.forEach((s, i) => {
    if (anyPressed(s.up)) onJoin({ type: 'kb', idx: i });
    else if (anyPressed(s.down)) onLeave({ type: 'kb', idx: i });
  });
  padState.forEach((st, i) => {
    if (!st) return;
    if (padPressed(i, 0)) { Sound.init(); onJoin({ type: 'pad', idx: i }); }
    else if (padPressed(i, 1)) onLeave({ type: 'pad', idx: i });
  });
}
const startPressed = () => anyPressed(['Enter', 'Space', 'NumpadEnter']) || padState.some((st, i) => st && padPressed(i, 9));

function updateLobby() {
  if (Net.role === 'client') {
    lobbyLocalInput(
      (src) => { if (!players.find((p) => p.mine && p.lid === lidOf(src))) Net.send({ t: 'join', lid: lidOf(src), label: srcLabel(src), act: srcAct(src), dft: srcDrift(src) }); },
      (src) => { if (players.find((p) => p.mine && p.lid === lidOf(src))) Net.send({ t: 'leave', lid: lidOf(src) }); },
    );
    return;
  }
  lobbyLocalInput(
    (src) => { if (!findPlayer(src.type, src.idx)) joinPlayer(src); },
    (src) => { const p = findPlayer(src.type, src.idx); if (p) leavePlayer(p); },
  );
  if (anyPressed(['Escape']) && Net.role === 'local') { backToMenu(); return; }
  if (startPressed() && players.length) newGame();
}

function update(dt) {
  if (state === 'menu') return;
  // Cliente: medir el ping con el host cada segundo
  if (Net.role === 'client' && (NET.pingT -= dt) <= 0) { NET.pingT = 1; Net.send({ t: 'ping', c: performance.now() }); }
  if (state === 'lobby') { updateLobby(); return; }
  if (Net.role !== 'client' && anyPressed(['Escape'])) { toLobby(); return; }
  if (!G) return;
  if (Net.role === 'host') netHostTick(dt);
  G.flash = Math.max(0, G.flash - dt * 3);
  if (G.hitstop > 0) { G.hitstop = Math.max(0, G.hitstop - dt); return; } // congelado breve tras un parry
  for (let i = G.links.length - 1; i >= 0; i--) if ((G.links[i].t -= dt) <= 0) G.links.splice(i, 1);
  for (let i = G.bolts.length - 1; i >= 0; i--) if ((G.bolts[i].t -= dt) <= 0) G.bolts.splice(i, 1);
  if (G.teamPop && (G.teamPop.t -= dt) <= 0) G.teamPop = null;
  for (let i = G.pops.length - 1; i >= 0; i--) { const p = G.pops[i]; p.y -= 40 * dt; if ((p.t -= dt) <= 0) G.pops.splice(i, 1); }

  if (Net.role === 'client') clientUpdate(dt);
  else simulate(dt);
  cosmetics(dt);
}

// Toda la lógica de juego. Solo corre en modo local o en el host.
function simulate(dt) {
  if (state === 'countdown') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (n < lastBeat && n > 0) { lastBeat = n; fx('beat'); }
    if (countdown <= 0) { state = 'play'; fx('go'); }
  }

  if (state === 'play' || state === 'over') {
    G.time += dt;
    G.doomSpeed = Math.min(DOOM_MAX, DOOM_SPEED0 + G.time * DOOM_ACCEL);
    G.doomY -= G.doomSpeed * dt;
  }

  // Turbo: la barra se vacía mientras dura
  if (G.turbo > 0) {
    G.turbo = Math.max(0, G.turbo - dt);
    G.team = G.turbo / TURBO_TIME;
    if (G.turbo === 0) { G.team = 0; fx('turboEnd'); }
  }

  for (const car of G.cars) updateCar(car, dt);
  updateTethers(dt);
  collideCars();
  updateGates(dt);
  updateCamera(dt);

  for (const c of G.cars) if (c.alive) G.best = Math.max(G.best, c.dist);

  // Rayo: cada cierto tiempo cae sobre un carro al azar (en el suelo y sin avería)
  if (state === 'play') {
    G.zapT -= dt;
    if (G.zapT <= 0) {
      const cands = liveCars().filter((c) => !c.air && !c.zap);
      if (cands.length) {
        const c = cands[Math.floor(Math.random() * cands.length)];
        c.zap = { t: ZAP_TIME, side: Math.random() < 0.5 ? -1 : 1, cd: 0 };
        fx('zap', c.id);
        G.zapT = rand(ZAP_EVERY[0], ZAP_EVERY[1]);
      } else G.zapT = 2;
    }
    // Cuerda y remolque (si no hay carros libres, se reintenta en unos segundos)
    if ((G.ropeT -= dt) <= 0) G.ropeT = startTether('rope') ? rand(ROPE_EVERY[0], ROPE_EVERY[1]) : 3;
    if ((G.towT -= dt) <= 0) G.towT = startTether('tow') ? rand(TOW_EVERY[0], TOW_EVERY[1]) : 3;
  }

  // Aviso de zona de salto
  for (const c of liveCars()) {
    const z = jumpZoneNear(Math.floor((c.y - 8 * T) / T)) || jumpZoneNear(Math.floor(c.y / T));
    if (z && c.y > z.bot && c.y < z.bot + 9 * T && !G.announced.has(z.k)) {
      G.announced.add(z.k);
      const n = liveCars().length;
      showMsg(n > 1 ? '¡SALTO! Uno a uno y engánchense en el aire' : '¡SALTO!', '#ffd23f', 2.4);
    }
  }

  if (state === 'play' && G.cars.every((c) => !c.alive)) {
    state = 'over'; overT = 0; fx('over');
  }
  if (state === 'over') {
    overT += dt;
    let again = startPressed() || padState.some((st, i) => st && padPressed(i, 0));
    if (overT > 1 && again) newGame();
  }
}

// Lo puramente visual/sonoro. Corre en todos los PCs.
function cosmetics(dt) {
  updateParticles(dt);

  // Latido cuando el colapso está a menos de 10 m (más rápido cuanto más cerca)
  const gap = doomGap();
  G.heartT = (G.heartT || 0) - dt;
  if (state === 'play' && gap != null && gap < 10 && G.heartT <= 0) {
    Sound.heart();
    G.heartT = 0.45 + Math.max(0, gap) * 0.06;
  }

  // Derrape: marcas en el suelo, humo y chispas de color según el nivel
  G.screechT -= dt;
  let anyDrift = false;
  for (const car of liveCars()) {
    if (!car.drift || car.air) continue;
    anyDrift = true;
    const a = car.a + car.slip, fx0 = Math.sin(a), fy0 = -Math.cos(a), rx0 = Math.cos(a), ry0 = Math.sin(a);
    for (const side of [-1, 1]) {
      const wx = car.x - fx0 * 15 + rx0 * 11 * side, wy = car.y - fy0 * 15 + ry0 * 11 * side;
      if (Math.random() < 0.6) addP({ x: wx, y: wy, vx: 0, vy: 0, life: 1.6, color: '#0c0b12', size: 6, kind: 'skid', drag: 0 });
      if (Math.random() < 0.35) addP({ x: wx, y: wy, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, color: '#d8d8e8', size: 4, kind: 'smoke', drag: 2 });
      const lv = car.drift.lv;
      if (lv > 0 && Math.random() < 0.6) {
        const s = rand(80, 220), an = rand(0, Math.PI * 2);
        addP({ x: wx, y: wy, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: rand(0.12, 0.3), color: lv === 2 ? '#ff8a2e' : '#3fa7ff', size: 2, kind: 'spark', drag: 5 });
      }
    }
  }
  if (anyDrift && G.screechT <= 0) { Sound.screech(); G.screechT = 0.11; }

  // Estela de color durante el turbo
  if (G.turbo > 0) {
    for (const car of liveCars()) {
      addP({ x: car.x + rand(-6, 6), y: car.y + 18, vx: 0, vy: 60, life: 0.35, color: car.color, size: rand(6, 10), kind: 'smoke', drag: 1 });
    }
  }

  // Humo del escape
  for (const car of liveCars()) {
    if (car.air || car.thr <= 0 || Math.random() > 0.5) continue;
    const dx = Math.sin(car.a), dy = -Math.cos(car.a);
    addP({ x: car.x - dx * 22 + rand(-3, 3), y: car.y - dy * 22 + rand(-3, 3), vx: -dx * 40, vy: -dy * 40, life: 0.5, color: '#c8c8dc', size: 4, kind: 'smoke', drag: 2 });
  }

  // Escombros cayendo en el borde del colapso + retumbes
  const { viewH } = viewMetrics();
  const doomVisible = G.doomY < G.camY + viewH / 2 + 200;
  if (doomVisible && state !== 'countdown') {
    for (let i = 0; i < 3; i++) {
      addP({
        x: rand(-T, ROAD_W + T), y: G.doomY + rand(-20, 60), vx: rand(-15, 15), vy: rand(0, 40),
        life: rand(0.8, 1.4), color: Math.random() < 0.3 ? '#ff6a3d' : '#3a3c4e', size: rand(4, 11), kind: 'fall', drag: 1, rot: rand(0, 6), vr: rand(-3, 3),
      });
    }
    G.rumbleT -= dt;
    if (G.rumbleT <= 0) { G.rumbleT = rand(0.4, 1.2); Sound.crumble(); G.shake = Math.max(G.shake, 2.5); }
  }
  const closeness = clamp(1 - (G.doomY - (G.camY + viewH / 2)) / 600, 0.1, 1);
  Sound.setRumble(state === 'countdown' ? 0.05 : closeness * 0.55);

  const live = liveCars();
  const avgSpeed = live.length ? live.reduce((s, c) => s + Math.hypot(c.vx, c.vy), 0) / live.length : 0;
  Sound.setEngine((45 + avgSpeed * 0.3) * (G.turbo > 0 ? 1.35 : 1), live.length ? 0.05 : 0);

  G.shake *= Math.exp(-8 * dt);
  if (G.shake < 0.2) G.shake = 0;
  if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
}

// ---------------------------------------------------------------------
//  Online: protocolo del juego
//  - El host simula todo y envía ~30 veces por segundo el estado + los eventos
//    de efectos (sonidos, partículas, mensajes).
//  - Los clientes envían sus controles y pulsaciones de ACCIÓN, y dibujan el
//    estado suavizado. El parry lo juzga la pantalla de quien lo pulsa.
// ---------------------------------------------------------------------
const NET = { inputs: {}, acts: {}, queue: [], sendT: 0, lastInp: '', pingT: 0, rtt: 0, localBumps: [] };
const PREDICT_SNAP = 160;  // si la predicción se aleja más que esto del host, se corrige de golpe
const PREDICT_PULL = 4;    // fuerza de la corrección suave hacia el host (más alto = más rígido)
const SNAP_DELAY = 0.025;  // retraso extra del estado del host además del ping (su fotograma + envío)
const REMOTE_LEAD_MAX = 0.3; // cuánto como máximo se proyectan hacia delante los demás carros (s)

// Choques de mi carro contra los demás, en mi PC y al instante. Solo se mueve mi carro:
// al otro lo mueve su dueño y el host. Así el golpe se siente justo cuando se tocan.
function predictCollisions(me) {
  for (const o of G.cars) {
    if (o === me || !o.alive || o.falling || o.air) continue;
    const dx = o.x - me.x, dy = o.y - me.y, d = Math.hypot(dx, dy), min = CAR_R * 2;
    if (d >= min || d < 0.001) continue;
    const nx = dx / d, ny = dy / d;
    // Como en el host: cada uno se aparta la mitad (la otra mitad la hace el otro carro allá)
    me.x -= nx * (min - d) * 0.5; me.y -= ny * (min - d) * 0.5;
    const ovx = o.tvx !== undefined ? o.tvx : o.vx, ovy = o.tvy !== undefined ? o.tvy : o.vy;
    const rv = (ovx - me.vx) * nx + (ovy - me.vy) * ny;
    if (rv < 0) {
      const j = -(1 + 1.15) * rv / 2;
      me.vx -= j * nx; me.vy -= j * ny;
      me.lastBump = performance.now();
      if (-rv > 70) {
        me.slide = 0.35;
        // Chispas y sonido ya, sin esperar al host (luego se ignora su aviso de este mismo choque)
        const x = me.x + nx * CAR_R, y = me.y + ny * CAR_R;
        FX.bump(x, y, -rv);
        NET.localBumps.push({ x, y, t: performance.now() });
      }
    }
  }
}

// Estado de mi carro en un instante pasado (interpolado del historial de la predicción)
function histAt(c, t) {
  const h = c.hist;
  if (!h || !h.length || t < h[0].t) return null; // sin historial suficiente: no se compara
  for (let i = h.length - 1; i > 0; i--) {
    if (h[i - 1].t <= t) {
      const a = h[i - 1], b = h[i], k = (t - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, vx: a.vx + (b.vx - a.vx) * k, vy: a.vy + (b.vy - a.vy) * k, a: a.a + Math.atan2(Math.sin(b.a - a.a), Math.cos(b.a - a.a)) * k };
    }
  }
  return h[h.length - 1];
}

// Despegue simulado en el cliente (mismas reglas que startJump/updateAir del host). Cuando el
// host confirma el salto, el carro pasa a mostrarse con lo que diga el host.
function startLocalAir(c, z) {
  const speed = clamp(-c.vy, 260, CAR_MAX);
  const gliders = G.cars.some((o) => o !== c && o.air && o.air.zone === z.k && o.air.mode !== 'launch');
  const behind = G.cars.some((o) => o !== c && o.alive && !o.falling && !o.air && o.y > z.bot - 5);
  const solo = !gliders && !behind;
  c.localAir = { t: 0, solo, top: z.top, fromY: c.y, toY: z.top - 110, vy: -speed, z: 1 };
  c.vx *= 0.3; c.drift = null; c.hist = []; c.corr = null;
  c.air = c.localAirState = { zone: z.k, top: z.top, bot: z.bot, mode: solo ? 'launch' : 'fly', z: 1, t: 0, glideT: 0 };
  c.localJumpAt = performance.now();
  FX.jump(c.id); // sonido y polvo ya (el aviso del host de este salto se ignora)
}
function localAirStep(c, dt, inp) {
  const la = c.localAir;
  la.t += dt;
  c.x = clamp(c.x + inp.steer * 170 * dt, CAR_R, ROAD_W - CAR_R);
  if (la.solo) {
    const k = Math.min(1, la.t / 0.75);
    c.y = la.fromY + (la.toY - la.fromY) * easeOut(k);
    c.air.z = Math.sin(Math.PI * k) * 0.9 + (1 - k) * (la.z != null ? la.z : 1);
    if (k >= 1) { // aterricé en mi PC: sigue la predicción en el suelo (como tras el lanzamiento del host)
      c.localAir = null; c.air = null; c.landedLocal = true;
      c.vx = 0; c.vy = -140; c.hist = []; c.corr = null;
      return;
    }
  } else {
    c.y += la.vy * dt;
    la.vy *= Math.exp(-1.2 * dt);
    if (c.y < la.top + 40) { c.y = la.top + 40; la.vy = 0; }
    c.air.z = 0.6 + 0.4 * Math.exp(-la.t * 2);
  }
  c.vy = la.vy; c.vx = 0;
  if (la.t > 0.8) { c.localAir = null; c.air = null; c.hist = []; } // el host nunca confirmó: vuelta a la normalidad
}

// En el cliente, mi propio carro en el suelo se mueve con predicción local
function predicting(c) {
  return Net.role === 'client' && state === 'play' && c.alive && !c.falling && (!c.air || c.localAir) &&
    players.some((p) => p.mine && p.slot === c.id);
}
// Misma conducción que el host (incluido el derrape y su mini-turbo), pero sin efectos:
// combos, choques y demás los sigue decidiendo el host.
function predictCar(car, dt, inp) {
  let dx = Math.sin(car.a), dy = -Math.cos(car.a), rx = Math.cos(car.a), ry = Math.sin(car.a);
  let fwd = car.vx * dx + car.vy * dy, lat = car.vx * rx + car.vy * ry;
  let steer = inp.steer;
  if (car.noEngine) inp = Object.assign({}, inp, { thr: Math.min(0, inp.thr) });
  if (car.zap && Math.sign(steer) === car.zap.side) steer *= ZAP_TURN;
  car.boostT = Math.max(0, car.boostT - dt);

  if (!car.drift && inp.drift && Math.abs(steer) > 0.1 && fwd > DRIFT_MIN_SPEED) car.drift = { t: 0, dir: Math.sign(steer), lv: 0 };
  if (car.drift && (!inp.drift || fwd < DRIFT_MIN_SPEED * 0.7)) {
    const lv = car.drift.lv;
    car.drift = null;
    if (lv > 0 && !inp.drift) { car.boostV = DRIFT_BOOST[lv - 1]; car.boostT = 0.8; fwd += car.boostV; }
  }
  if (car.drift) {
    const d = car.drift;
    d.t += dt;
    d.lv = d.t >= DRIFT_LEVELS[1] ? 2 : d.t >= DRIFT_LEVELS[0] ? 1 : 0;
    steer = d.dir * clamp(0.75 + 0.55 * steer * d.dir, 0.25, 1.3) * 1.15;
    fwd *= Math.exp(-0.12 * dt);
  }
  car.slip += ((car.drift ? car.drift.dir * 0.5 : 0) - car.slip) * Math.min(1, dt * 8);

  const boost = G.turbo > 0 ? TURBO_BOOST : 1;
  const maxF = CAR_MAX * (car.zap ? ZAP_SPEED : 1) * boost + (car.boostT > 0 ? car.boostV * (car.boostT / 0.8) : 0);
  car.thr = inp.thr;
  drive(car, dt, inp.thr, steer, fwd, lat, maxF, boost, true);
}
const lidOf = (src) => (src.type === 'kb' ? 'k' : 'p') + src.idx;
const srcFromLid = (lid) => ({ type: lid[0] === 'k' ? 'kb' : 'pad', idx: +lid.slice(1) });
const r1 = (v) => Math.round(v * 10) / 10;

function sendLobby() {
  updateNetInfo();
  if (Net.role !== 'host') return;
  Net.broadcast({
    t: 'lobby', st: state === 'lobby' ? 'lobby' : 'game',
    players: players.map((p) => ({
      slot: p.slot, label: p.label, act: p.act, dft: p.dft,
      owner: p.src.type === 'net' ? p.src.peer : Net.id, lid: p.src.type === 'net' ? p.src.idx : null,
    })),
  });
}

function makeSnap() {
  return {
    t: 's', st: state, cd: countdown, ot: overT, seed: G.seed, time: G.time,
    doomY: r1(G.doomY), ds: G.doomSpeed, best: G.best, tm: G.team, tb: G.turbo,
    cars: G.cars.map((c) => ({
      id: c.id, x: r1(c.x), y: r1(c.y), a: Math.round(c.a * 1000) / 1000, vx: r1(c.vx), vy: r1(c.vy),
      al: c.alive, fa: c.falling, ft: c.fallT, th: c.thr, di: c.dist, dt: c.deathTime, re: c.reason, air: c.air, cd: c.parryCd,
      zp: c.zap ? { t: r1(c.zap.t), side: c.zap.side } : null,
      dr: c.drift, sl: Math.round(c.slip * 100) / 100, sc: c.score, ne: c.noEngine,
      cb: c.combo ? { pts: Math.round(c.combo.pts), mult: c.combo.mult, idle: r1(c.combo.idle) } : null,
    })),
    gates: [...G.gates.values()].map((g) => ({
      k: g.k, state: g.state, lanes: g.lanes, progress: g.progress, lockT: g.lockT, openT: g.openT,
      off: g.off, flash: g.flash,
    })),
    cg: G.curGate ? G.curGate.k : null,
    th: G.tethers.map((t) => ({
      kind: t.kind, a: t.a, b: t.b, time: r1(t.time), L: r1(t.L), rest: t.rest, max: t.max, k: t.k,
      slack: t.slack, goalY: t.goalY, snag: t.snag ? { x: t.snag.x, y: t.snag.y } : null,
    })),
    ev: NET.queue,
  };
}

function netHostTick(dt) {
  NET.sendT -= dt;
  if (NET.sendT > 0) return;
  NET.sendT = 1 / 30;
  if (Net.conns.size) Net.broadcast(makeSnap());
  NET.queue = [];
}

const findNet = (peer, lid) => players.find((p) => p.src.type === 'net' && p.src.peer === peer && p.src.idx === lid);
function hostMessage(m, from) {
  const lid = String(m.lid || '').slice(0, 4);
  if (m.t === 'join' && state === 'lobby') {
    if (!findNet(from, lid)) joinPlayer({ type: 'net', peer: from, idx: lid }, String(m.label || 'Remoto').slice(0, 24), String(m.act || '?').slice(0, 12), String(m.dft || '?').slice(0, 12));
    sendLobby();
  } else if (m.t === 'leave' && state === 'lobby') {
    const p = findNet(from, lid);
    if (p) leavePlayer(p);
  } else if (m.t === 'ping') {
    const c = Net.conns.get(from);
    if (c && c.open) c.send({ t: 'pong', c: m.c });
  } else if (m.t === 'in') {
    NET.inputs[from] = m.p && typeof m.p === 'object' ? m.p : {};
  } else if (m.t === 'act') {
    const q = ((NET.acts[from] ||= {})[lid] ||= []);
    if (q.length < 4) q.push({ d: typeof m.d === 'number' ? m.d : null });
  }
}

function clientMessage(m) {
  if (m.t === 'lobby') applyLobby(m);
  else if (m.t === 's') applySnap(m);
  else if (m.t === 'full') backToMenu('La sala está llena.');
  else if (m.t === 'pong' && typeof m.c === 'number') {
    const rtt = (performance.now() - m.c) / 1000;
    NET.rtt = NET.rtt ? NET.rtt * 0.7 + rtt * 0.3 : rtt;
    updateNetInfo();
  }
}

function applyLobby(m) {
  const before = players.length;
  players.length = 0;
  for (const q of m.players || []) players.push({ slot: q.slot, label: q.label, act: q.act, dft: q.dft, lid: q.lid, mine: q.owner === Net.id, src: null });
  if (players.length > before) Sound.join(players[players.length - 1].slot);
  else if (players.length < before) Sound.leave();
  if (m.st === 'lobby' && state !== 'lobby' && state !== 'menu') { state = 'lobby'; G = null; Sound.silence(); }
  updateNetInfo();
}

function applySnap(m) {
  if (state === 'menu' || m.st === 'lobby') return;
  if (!G || G.seed !== m.seed) {
    makeWorld(m.seed);
    G.camY = (m.cars.reduce((s, c) => s + c.y, 0) / Math.max(1, m.cars.length)) - 50;
  }
  state = m.st; countdown = m.cd; overT = m.ot;
  G.time = m.time; G.doomY = m.doomY; G.doomSpeed = m.ds; G.best = m.best;
  G.team = m.tm || 0; G.turbo = m.tb || 0;
  const now = performance.now();
  for (const s of m.cars) {
    let c = carById(s.id);
    if (!c) { c = makeCar(s.id, s.x, s.y); c.a = s.a; G.cars.push(c); }
    Object.assign(c, {
      alive: s.al, falling: s.fa, fallT: s.ft, thr: s.th, dist: s.di, deathTime: s.dt, reason: s.re, air: s.air, parryCd: s.cd, zap: s.zp,
      combo: s.cb, score: s.sc || 0, noEngine: !!s.ne,
      tx: s.x, ty: s.y, ta: s.a, tvx: s.vx, tvy: s.vy, recv: now,
    });
    // Mi carro en el suelo lo mueve la predicción local. Lo que manda el host refleja mis
    // teclas de hace un ping, así que se compara con dónde estaba mi carro entonces.
    // Despegué en mi PC: mientras el host no lo confirme, se mantiene mi vuelo local;
    // cuando lo confirma, manda el host
    if (c.localAir) {
      // Despegue: termina cuando el host me pone en el aire. Lanzamiento tras parry: cuando el
      // host también me lanza (o ya aterricé allá)
      // Si mi PC ya me está lanzando, sigo con mi curva hasta aterrizar (el host hace la misma);
      // si yo preveía planear, en cuanto el host me pone en el aire manda él.
      const la = c.localAir;
      const done = la.solo ? !s.air && la.until === 'launch' : !!s.air;
      if (done) c.localAir = null;
      else { c.air = c.localAirState; continue; }
    }
    // Ya aterricé en mi PC pero el host aún me tiene en el aire: sigo con la predicción
    if (c.landedLocal) {
      if (s.air && s.air.mode === 'launch') c.air = null;
      else c.landedLocal = false;
    }
    if (predicting(c)) {
      if (s.air) continue; // el host aún no confirmó el aterrizaje: nada que comparar todavía
      // Calibración automática del retraso: se prueba alrededor del valor actual y se queda con
      // el que mejor encaja con mi historial (el ping solo no incluye fotogramas ni envíos).
      // Solo en conducción "limpia" (sin choques recientes ni cuerda), porque un golpe que mi PC
      // no predijo igual desajustaría la calibración.
      if (!NET.lat) NET.lat = NET.rtt + SNAP_DELAY;
      const clean = c.slide <= 0 && !tetherOf(c) && (!c.lastBump || now - c.lastBump > 800);
      const span = c.hist && c.hist.length ? (now - c.hist[0].t) / 1000 : 0;
      if (clean && Math.hypot(c.vx, c.vy) > 80 && span > NET.lat + 0.08) {
        let best = NET.lat, bestErr = Infinity;
        for (let off = -0.05; off <= 0.0501; off += 0.01) {
          const h = histAt(c, now - (NET.lat + off) * 1000);
          const e = h ? Math.hypot(s.x - h.x, s.y - h.y) : Infinity;
          if (e < bestErr) { bestErr = e; best = NET.lat + off; }
        }
        if (bestErr < 30) NET.lat += (best - NET.lat) * 0.15;
      }
      NET.lat = clamp(NET.lat, NET.rtt, NET.rtt + 0.15); // siempre cerca del ping medido
      const past = histAt(c, now - NET.lat * 1000);
      if (past) {
        const da = Math.atan2(Math.sin(s.a - past.a), Math.cos(s.a - past.a));
        c.corr = { x: s.x - past.x, y: s.y - past.y, vx: s.vx - past.vx, vy: s.vy - past.vy, a: da };
      }
      continue;
    }
    c.hist = null; c.corr = null;
    if (Math.hypot(s.x - c.x, s.y - c.y) > 250) { c.x = s.x; c.y = s.y; c.a = s.a; }
    Object.assign(c, { drift: s.dr, slip: s.sl || 0, vx: s.vx, vy: s.vy });
  }
  const seen = new Set();
  for (const s of m.gates) { Object.assign(getGate(s.k), s); seen.add(s.k); }
  for (const k of [...G.gates.keys()]) if (!seen.has(k)) G.gates.delete(k);
  G.curGate = m.cg != null ? G.gates.get(m.cg) || null : null;
  G.tethers = m.th || [];
  NET.localBumps = NET.localBumps.filter((b) => now - b.t < 600);
  for (const [name, args] of m.ev || []) {
    if (!FX[name]) continue;
    // Un choque que mi PC ya mostró al instante no se repite cuando llega el aviso del host
    if (name === 'bump' && NET.localBumps.some((b) => Math.hypot(b.x - args[0], b.y - args[1]) < 90)) continue;
    if (name === 'jump') { const jc = carById(args[0]); if (jc && jc.localJumpAt && now - jc.localJumpAt < 1500) continue; }
    if (name === 'parry' && NET.localParryAt && now - NET.localParryAt < 1500) continue; // ya lo mostré
    FX[name](...args);
  }
}

function clientUpdate(dt) {
  if (state === 'countdown') countdown = Math.max(0, countdown - dt);
  if (state === 'play' || state === 'over') { G.time += dt; G.doomY -= G.doomSpeed * dt; }
  if (state === 'over') overT += dt;
  if (G.turbo > 0) { G.turbo = Math.max(0, G.turbo - dt); G.team = G.turbo / TURBO_TIME; }
  for (const g of G.gates.values()) if (g.state === 'open') g.openT += dt;

  const now = performance.now(), k = 1 - Math.exp(-18 * dt);
  const mine = players.filter((p) => p.mine);
  const preds = G.cars.filter((c) => c.tx !== undefined && predicting(c));

  // Los demás carros. Lo que manda el host ya es pasado (medio ping), y mi carro va adelantado
  // (medio ping más, porque mis teclas tardan en llegar al host). Para que los choques se vean
  // donde de verdad ocurren, los demás se proyectan con su velocidad hasta mi mismo instante.
  // Mientras tenga un carro vivo, todo se muestra en "mi instante" (también mi carro en el aire).
  // El adelanto cambia suave para que nada salte de sitio al despegar o aterrizar.
  const meAlive = G.cars.some((c) => c.alive && !c.falling && mine.some((p) => p.slot === c.id));
  const leadTarget = meAlive && state === 'play' ? (NET.lat || NET.rtt + SNAP_DELAY) : 0;
  NET.lead = (NET.lead || 0) + (leadTarget - (NET.lead || 0)) * Math.min(1, dt * 4);
  const lead = NET.lead;
  for (const c of G.cars) {
    if (c.tx === undefined || preds.includes(c)) continue;
    const age = Math.min(0.15, (now - c.recv) / 1000);
    const ext = Math.min(REMOTE_LEAD_MAX, age + (c.alive && !c.falling ? lead : 0));
    const a = c.air;
    if (a && a.mode === 'launch' && a.fromY !== undefined) {
      // El lanzamiento es una curva conocida: se calcula en el instante que toca, sin estimar
      const t = a.t + ext, kk = Math.min(1, t / 0.75);
      a.z = a.fromZ * (1 - kk) + Math.sin(Math.PI * kk) * 0.9;
      c.y += (a.fromY + (a.toY - a.fromY) * easeOut(kk) - c.y) * k;
      c.x += (c.tx - c.x) * k;
      // Mi carro ya aterrizó en mi instante: la predicción retoma desde aquí (como en el host)
      if (kk >= 1 && mine.some((p) => p.slot === c.id) && state === 'play') {
        c.y = a.toY; c.vx = 0; c.vy = -140; c.air = null; c.landedLocal = true;
        c.hist = []; c.corr = null; c.drift = null; c.slip = 0;
      }
    } else {
      c.x += (c.tx + c.tvx * ext - c.x) * k;
      c.y += (c.ty + c.tvy * ext - c.y) * k;
    }
    const da = Math.atan2(Math.sin(c.ta - c.a), Math.cos(c.ta - c.a));
    c.a += da * k;
  }

  for (const c of preds) {
    {
      const p = mine.find((q) => q.slot === c.id);
      // Despegue en mi PC: hasta que el host confirme el salto, el vuelo se simula aquí igual
      // que allá (así no hay salto brusco al pasar la rampa)
      if (c.localAir) {
        if (G.hitstop <= 0) localAirStep(c, dt, p ? getInput({ src: srcFromLid(p.lid) }) : { steer: 0 });
        continue;
      }
      // Predicción: mi carro responde al instante a mis teclas…
      if (p && G.hitstop <= 0) {
        const prevY = c.y;
        predictCar(c, dt, getInput({ src: srcFromLid(p.lid) }));
        const z = jumpZoneNear(Math.floor(c.y / T));
        if (z && prevY >= z.bot && c.y < z.bot) { startLocalAir(c, z); continue; }
        const t = tetherOf(c);
        if (t) tetherPhysics(t, dt, c); // el tirón de la cuerda también se siente al instante
        predictCollisions(c);           // y los choques con los demás, justo cuando se tocan
      }
      // …y se corrige poco a poco con la diferencia que detectó el último mensaje del host
      // (choques, empujones…). Si la diferencia es enorme, se corrige de golpe.
      const cr = c.corr;
      if (cr) {
        // Si la diferencia es enorme, o mediana pero no se va (p. ej. tras un choque mi PC dejó
        // mi carro al otro lado del rival), se corrige de golpe en vez de pelear contra el choque
        const mag = Math.hypot(cr.x, cr.y);
        c.corrBad = mag > 50 ? (c.corrBad || 0) + dt : 0;
        const big = mag > PREDICT_SNAP || c.corrBad > 1.0;
        if (big) c.corrBad = 0;
        const kp = big ? 1 : 1 - Math.exp(-PREDICT_PULL * dt);
        const mx = cr.x * kp, my = cr.y * kp, mvx = cr.vx * kp, mvy = cr.vy * kp, ma = cr.a * kp;
        c.x += mx; c.y += my; c.vx += mvx; c.vy += mvy; c.a += ma;
        // El historial también se corrige, para no volver a contar lo ya aplicado
        for (const h of c.hist || []) { h.x += mx; h.y += my; h.vx += mvx; h.vy += mvy; h.a += ma; }
        cr.x -= mx; cr.y -= my; cr.vx -= mvx; cr.vy -= mvy; cr.a -= ma;
      }
      (c.hist || (c.hist = [])).push({ t: now, x: c.x, y: c.y, vx: c.vx, vy: c.vy, a: c.a });
      while (c.hist.length && now - c.hist[0].t > 1000) c.hist.shift();
    }
  }
  updateCamera(dt, true);

  // Enviar los controles de este PC: en cuanto cambian (y cada 0,1 s por si se pierde alguno)
  if (state === 'countdown' || state === 'play') {
    const inp = {};
    for (const p of mine) inp[p.lid] = getInput({ src: srcFromLid(p.lid) });
    const key = JSON.stringify(inp);
    NET.sendT -= dt;
    if (key !== NET.lastInp || NET.sendT <= 0) {
      Net.send({ t: 'in', p: inp });
      NET.lastInp = key; NET.sendT = 0.1;
    }
  }
  // ACCIÓN: se manda con la distancia que se ve en ESTA pantalla
  for (const p of mine) {
    if (!actionPressed({ src: srcFromLid(p.lid) })) continue;
    const car = carById(p.slot);
    if (!car || (car.air && car.air.mode === 'launch')) continue;
    if (!car.air) { if (car.combo) Net.send({ t: 'act', lid: p.lid, d: null }); continue; } // cobrar combo
    const tg = parryTarget(car);
    Net.send({ t: 'act', lid: p.lid, d: tg ? Math.round(tg.d) : null });
    // Parry acertado en mi pantalla: se muestra ya (el host casi siempre lo acepta, tiene margen
    // para el lag). Mi carro sale lanzado al instante o se queda planeando si hay gente detrás.
    if (tg && tg.d <= PARRY_WIN && car.parryCd <= 0 && !car.localAir) {
      FX.parry(car.id, tg.car.id, tg.d < 18);
      NET.localParryAt = performance.now();
      const z = jumpZone(car.air.zone);
      const behind = G.cars.some((o) => o !== car && o.alive && !o.falling && !o.air && o.y > z.bot - 5);
      if (!behind) {
        car.localAir = { t: 0, solo: true, top: z.top, fromY: car.y, toY: z.top - 110, vy: 0, z: car.air.z, until: 'launch' };
        car.air = car.localAirState = Object.assign({}, car.air, { mode: 'launch' });
      }
    }
  }
}

Net.handlers.message = (m, from) => {
  if (!m || typeof m !== 'object') return;
  if (Net.role === 'host') hostMessage(m, from);
  else if (Net.role === 'client') clientMessage(m);
};
Net.handlers.join = () => sendLobby();
Net.handlers.leave = (peer) => {
  delete NET.inputs[peer]; delete NET.acts[peer];
  if (state === 'lobby') for (const p of players.filter((q) => q.src.type === 'net' && q.src.peer === peer)) leavePlayer(p);
  sendLobby();
};
Net.handlers.closed = () => backToMenu('Se perdió la conexión con el host.');

// ---------------------------------------------------------------------
//  Menú (HTML) y cambios de pantalla
// ---------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const setMenuMsg = (t) => { $('menuMsg').textContent = t; };
function enterLobby() {
  players.length = 0; G = null; state = 'lobby';
  NET.rtt = 0; NET.lat = 0; NET.lead = 0; NET.pingT = 0; NET.lastInp = '';
  $('menu').hidden = true;
  $('netbar').hidden = Net.role === 'local';
  $('roomCode').textContent = Net.code;
  if (document.activeElement) document.activeElement.blur();
  sendLobby();
}
function toLobby() {
  state = 'lobby'; G = null; Sound.silence(); NET.queue = [];
  // Quien se desconectó durante la partida sale ahora de la lista
  for (const p of players.filter((q) => q.src.type === 'net' && !Net.conns.has(q.src.peer))) leavePlayer(p);
  sendLobby();
}
function backToMenu(msg = '') {
  Net.leave();
  players.length = 0; G = null; state = 'menu';
  Sound.silence();
  $('menu').hidden = false; $('netbar').hidden = true;
  setMenuMsg(msg);
  if (location.search) history.replaceState(null, '', location.pathname);
}
function updateNetInfo() {
  if (Net.role === 'local') return;
  const who = Net.role === 'host' ? `${Net.conns.size} PC conectados`
    : `ping ${NET.rtt ? Math.round(NET.rtt * 1000) + ' ms' : '…'}`;
  $('netInfo').textContent = `${players.length}/4 jugadores · ${who}`;
}
function joinRoom(code) {
  code = code.trim().toUpperCase();
  if (code.length < 4) { setMenuMsg('Escribe el código de la sala.'); return; }
  Sound.init();
  setMenuMsg(`Conectando a ${code}…`);
  Net.join(code, (err) => {
    if (err) { setMenuMsg(err.message || String(err)); return; }
    enterLobby();
  });
}
$('btnLocal').onclick = () => { Sound.init(); Net.leave(); enterLobby(); };
$('btnHost').onclick = () => {
  Sound.init();
  setMenuMsg('Creando sala…');
  Net.host((err) => { if (err) setMenuMsg('No se pudo crear la sala: ' + (err.message || err.type)); else enterLobby(); });
};
$('btnJoin').onclick = () => joinRoom($('codeInput').value);
$('codeInput').addEventListener('keydown', (e) => {
  e.stopPropagation(); // que escribir el código no mueva carros
  if (e.key === 'Enter') joinRoom(e.target.value);
});
$('btnCopy').onclick = (e) => {
  const url = `${location.origin}${location.pathname}?sala=${Net.code}`;
  e.target.blur();
  const done = () => { e.target.textContent = '¡Copiado!'; setTimeout(() => (e.target.textContent = 'Copiar enlace'), 1500); };
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Copia este enlace:', url));
  else prompt('Copia este enlace:', url);
};
$('btnLeave').onclick = () => backToMenu();
{
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { $('codeInput').value = sala; joinRoom(sala); }
}

// ---------------------------------------------------------------------
//  Render
// ---------------------------------------------------------------------
function drawStars() {
  const off = G && state !== 'lobby' ? -G.camY * 0.15 : performance.now() * 0.02;
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W;
    const y = ((((Math.sin(i * 47.3) * 0.5 + 0.5) * H + off * (0.3 + (i % 3) * 0.3)) % H) + H) % H;
    const s = 1 + (i % 3);
    ctx.fillStyle = `rgba(255,${170 + (i % 60)},210,${0.12 + (i % 5) * 0.07})`;
    ctx.fillRect(x, y, s, s);
  }
}

function drawCracks(c, r, cr) {
  const n = 1 + Math.floor(cr * 4);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    let px = (hash(c, r, 10 + i) - 0.5) * T * 0.6, py = (hash(c, r, 20 + i) - 0.5) * T * 0.6;
    ctx.moveTo(px, py);
    for (let j = 0; j < 3; j++) {
      px = clamp(px + (hash(c, r, 30 + i * 5 + j) - 0.5) * T * 0.7, -T / 2, T / 2);
      py = clamp(py + (hash(c, r, 60 + i * 5 + j) - 0.5) * T * 0.7, -T / 2, T / 2);
      ctx.lineTo(px, py);
    }
  }
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `rgba(5,4,10,${0.3 + cr * 0.7})`;
  ctx.stroke();
  if (cr > 0.55) {
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = `rgba(255,100,40,${(cr - 0.55) * 1.8})`;
    ctx.stroke();
  }
}

function drawObstacle(h) {
  const s = T - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(-s / 2 + 5, -s / 2 + 7, s, s, 6); ctx.fill();
  if (h < 0.5) { // caja
    ctx.fillStyle = '#7a5a3a'; rr(-s / 2, -s / 2, s, s, 4); ctx.fill();
    ctx.strokeStyle = '#5a3f26'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-s / 2 + 4, -s / 2 + 4); ctx.lineTo(s / 2 - 4, s / 2 - 4);
    ctx.moveTo(s / 2 - 4, -s / 2 + 4); ctx.lineTo(-s / 2 + 4, s / 2 - 4); ctx.stroke();
    ctx.strokeStyle = '#9b7550'; ctx.lineWidth = 3; rr(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4, 3); ctx.stroke();
  } else { // roca
    ctx.fillStyle = '#5d5a6e'; rr(-s / 2, -s / 2, s, s, 16); ctx.fill();
    ctx.fillStyle = '#76738a'; rr(-s / 2 + 6, -s / 2 + 5, s - 18, s - 20, 12); ctx.fill();
  }
}

function drawTile(c, r) {
  const p = fallP(c, r);
  if (p >= 1 || isChasm(r)) return;
  const wall = c < 0 || c >= COLS;
  const h = hash(c, r, 2);
  const cr = p > 0 ? 1 : crackA(c, r);
  ctx.save();
  ctx.translate(c * T + T / 2, r * T + T / 2);
  if (p > 0) {
    const s = 1 - p * 0.85;
    ctx.rotate((h - 0.5) * p * 1.4);
    ctx.scale(s, s);
    ctx.globalAlpha = 1 - p * 0.5;
  } else if (cr > 0.75) {
    ctx.translate(rand(-1, 1) * 2 * cr, rand(-1, 1) * 2 * cr);
  }
  ctx.fillStyle = wall ? '#463b58' : ((c + r) & 1 ? '#2a2c3b' : '#2e3042');
  ctx.fillRect(-T / 2, -T / 2, T + 0.6, T + 0.6);
  if (wall) {
    ctx.fillStyle = '#56496b'; ctx.fillRect(-T / 2, -T / 2, T, 5);
    const sx = c < 0 ? T / 2 - 10 : -T / 2;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (i + r) & 1 ? '#ffd23f' : '#1a1a22';
      ctx.fillRect(sx, -T / 2 + i * 16, 10, 16);
    }
  } else if (c === 0 || c === COLS - 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(c === 0 ? -T / 2 : T / 2 - 4, -T / 2, 4, T);
  }
  if (!wall && Math.abs(c - (COLS - 1) / 2) < 0.5 && (r & 1)) { // línea central discontinua
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(-3, -T / 2 + 10, 6, T - 20);
  }
  if (!wall && isRamp(r)) { // rampa con chevrones
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-T / 2, -T / 2, T + 0.6, T + 0.6);
    ctx.fillStyle = '#e6c449'; ctx.fillRect(-T / 2, -T / 2, T + 0.6, T * 0.35);
    ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, 12); ctx.lineTo(0, -6); ctx.lineTo(16, 12); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  if (cr > 0 && p <= 0) drawCracks(c, r, cr);
  if (p > 0) { ctx.fillStyle = `rgba(0,0,0,${p * 0.7})`; ctx.fillRect(-T / 2, -T / 2, T, T); }
  if (!wall && isObstacle(c, r)) drawObstacle(h);
  ctx.restore();
}

function drawLanes(g) {
  if (g.state !== 'active' && g.state !== 'locked') return;
  const locked = g.state === 'locked';
  const top = g.zoneTop, bot = Math.min(g.zoneBot, G.doomY);
  if (bot <= top) return;
  const step = 16;
  ctx.save();
  ctx.globalAlpha = locked ? 0.25 + 0.2 * Math.sin(G.time * 20) : 1;
  g.lanes.forEach((ln, i) => {
    // Franja de color
    ctx.beginPath();
    for (let y = top; y <= bot; y += step) { const [a] = laneBounds(g, i, y); y === top ? ctx.moveTo(a, y) : ctx.lineTo(a, y); }
    for (let y = bot; y >= top; y -= step) ctx.lineTo(laneBounds(g, i, y)[1], y);
    ctx.closePath();
    ctx.fillStyle = rgba(ln.color, ln.on ? 0.33 : 0.14);
    ctx.fill();

    // Bordes del carril
    ctx.lineWidth = 4;
    ctx.strokeStyle = ln.color;
    if (ln.on) { ctx.shadowColor = ln.color; ctx.shadowBlur = 18; }
    else { ctx.setLineDash([18, 12]); ctx.lineDashOffset = G.time * 40; }
    for (const side of [0, 1]) {
      ctx.beginPath();
      for (let y = top; y <= bot; y += step) { const x = laneBounds(g, i, y)[side]; y === top ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.shadowBlur = 0;

    // Chevrones que avanzan hacia la puerta
    ctx.strokeStyle = rgba(ln.color, ln.on ? 0.95 : 0.5);
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    const off = (G.time * 160) % 110;
    for (let y = bot - off; y > top + 20; y -= 110) {
      const [a, b] = laneBounds(g, i, y), cx = (a + b) / 2;
      ctx.beginPath(); ctx.moveTo(cx - 14, y + 10); ctx.lineTo(cx, y - 4); ctx.lineTo(cx + 14, y + 10); ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Nombre en la entrada del carril
    if (bot === g.zoneBot) {
      const [a, b] = laneBounds(g, i, bot - 28);
      text(ln.name, (a + b) / 2, bot - 28, { size: 20, color: ln.color });
    }
  });
  ctx.restore();
}

function drawGateBarrier(g) {
  if (g.state === 'dead') return;
  if (fallP(Math.floor(COLS / 2), g.r) >= 1) return;
  const openE = g.state === 'open' ? easeOut(Math.min(1, g.openT / 0.7)) : 0;
  const halfW = (ROAD_W / 2) * (1 - openE);
  const locked = g.state === 'locked';
  const col = locked ? '#ff4d5e' : g.state === 'open' ? '#3ddc84' : '#b48cff';
  const y0 = g.y - 10;

  // Postes
  ctx.fillStyle = '#16151f';
  ctx.fillRect(-26, g.y - 18, 26, 36); ctx.fillRect(ROAD_W, g.y - 18, 26, 36);
  ctx.fillStyle = col;
  ctx.fillRect(-16, g.y - 8, 10, 16); ctx.fillRect(ROAD_W + 6, g.y - 8, 10, 16);

  if (halfW > 1) {
    const flick = locked ? 0.5 + 0.5 * Math.abs(Math.sin(G.time * 18)) : 0.75 + 0.25 * Math.sin(G.time * 5);
    for (const [x0, w] of [[0, halfW], [ROAD_W - halfW, halfW]]) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0, w, 20); ctx.clip();
      ctx.fillStyle = rgba(col, 0.35 * flick);
      ctx.fillRect(x0, y0, w, 20);
      ctx.fillStyle = rgba(col, 0.7 * flick);
      const off = (G.time * 60) % 28;
      for (let x = x0 - 28 + off; x < x0 + w + 28; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, y0 + 20); ctx.lineTo(x + 12, y0); ctx.lineTo(x + 20, y0); ctx.lineTo(x + 8, y0 + 20); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = col;
      ctx.fillRect(x0, y0 - 2, w, 3); ctx.fillRect(x0, y0 + 19, w, 3);
    }
    // Progreso de sincronización: se llena desde el centro
    if (g.progress > 0 && g.state === 'active') {
      const pw = (ROAD_W / 2) * g.progress;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(ROAD_W / 2 - pw, y0 + 7, pw * 2, 6);
    }
  }
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,77,94,${g.flash * 0.35})`;
    ctx.fillRect(0, y0 - 30, ROAD_W, 80);
  }
}

function drawCar(car) {
  const s = car.falling ? Math.max(0, 1 - car.fallT) : 1;
  if (s <= 0 || (!car.alive && !car.falling)) return;
  const air = car.air;
  if (air && !isChasm(Math.floor(car.y / T))) { // sombra en el suelo mientras vuela
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(car.x + air.z * 28, car.y + air.z * 28, 16, 22, car.a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.a + (car.slip || 0) + (car.falling ? car.fallT * 5 : 0));
  ctx.scale(s * (air ? 1 + air.z * 0.35 : 1), s * (air ? 1 + air.z * 0.35 : 1));
  if (car.falling) ctx.globalAlpha = 1 - car.fallT * 0.5;
  if (!car.falling && !air) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(-9, -15, 26, 40, 7); ctx.fill(); }
  ctx.fillStyle = '#111';
  for (const [wx, wy] of [[-15, -15], [11, -15], [-15, 5], [11, 5]]) ctx.fillRect(wx, wy, 4, 11);
  ctx.fillStyle = car.color; rr(-12, -20, 24, 40, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(-9, -5, 18, 15, 4); ctx.fill();
  ctx.fillStyle = 'rgba(190,230,255,0.85)'; rr(-9, -12, 18, 6, 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-2, -20, 4, 8);
  ctx.fillStyle = '#fff7c2'; ctx.fillRect(-10, -21, 5, 3); ctx.fillRect(5, -21, 5, 3);
  ctx.fillStyle = '#ff3344'; ctx.fillRect(-10, 18, 5, 2); ctx.fillRect(5, 18, 5, 2);
  ctx.restore();

  if (!car.falling) {
    ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(car.name, car.x, car.y - 34);
    ctx.fillStyle = car.color; ctx.fillText(car.name, car.x, car.y - 34);

    if (car.zap) drawZap(car);

    // Combo en curso: multiplicador y puntos (parpadea cuando está por cobrarse solo)
    if (car.combo) {
      const cb = car.combo, cy = car.y - (car.zap ? 74 : 52);
      const ending = !car.drift && cb.idle > COMBO_IDLE - 0.6 && Math.sin(performance.now() / 60) > 0;
      const col = cb.mult >= 3 ? '#ff8a2e' : cb.mult >= 2 ? '#ffd23f' : '#ffffff';
      ctx.globalAlpha = ending ? 0.4 : 1;
      text(`x${cb.mult.toFixed(1)}  ${Math.round(cb.pts * cb.mult)}`, car.x, cy, { size: 15, color: col });
      ctx.globalAlpha = 1;
    }

    // Flecha hacia su carril durante el evento
    const g = G.curGate;
    const li = g && g.state === 'active' ? g.lanes.findIndex((l) => l.id === car.id) : -1;
    if (li >= 0 && !g.lanes[li].on) {
      const ty = clamp(car.y, g.zoneTop + 30, g.zoneBot - 10);
      const [la, lb] = laneBounds(g, li, ty);
      const a = Math.atan2(ty - car.y, (la + lb) / 2 - car.x);
      ctx.save();
      ctx.translate(car.x + Math.cos(a) * 34, car.y + Math.sin(a) * 34);
      ctx.rotate(a);
      ctx.fillStyle = car.color;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.fill();
      ctx.restore();
    }
  }
}

// Carro averiado por rayo: chispas eléctricas, barra de avería y lado que gira mal
function drawZap(car) {
  const z = car.zap;
  ctx.strokeStyle = '#9fd3ff'; ctx.lineWidth = 2;
  ctx.shadowColor = '#9fd3ff'; ctx.shadowBlur = 10;
  for (let i = 0; i < 3; i++) {
    const a = rand(0, Math.PI * 2), r0 = rand(14, 22);
    let x = car.x + Math.cos(a) * r0, y = car.y + Math.sin(a) * r0;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) { x += Math.cos(a) * 7 + rand(-6, 6); y += Math.sin(a) * 7 + rand(-6, 6); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  const w = 52, x0 = car.x - w / 2, y0 = car.y - 56;
  const k = clamp(z.t / ZAP_TIME, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(x0 - 2, y0 - 2, w + 4, 10, 4); ctx.fill();
  ctx.fillStyle = '#9fd3ff'; rr(x0, y0, w * k, 6, 3); ctx.fill();
  text('⚡', x0 - 12, y0 + 3, { size: 14, color: '#ffd23f' });
  // Flecha roja del lado que gira mal
  text(z.side < 0 ? '◀' : '▶', x0 + w + 12, y0 + 3, { size: 13, color: '#ff4d5e' });
}

// Cuerdas, línea de recarga del remolque e indicadores
function drawTethers() {
  for (const t of G.tethers) {
    const a = carById(t.a), b = carById(t.b);
    if (!a || !b) continue;
    const rope = t.kind === 'rope';

    // Línea de recarga del remolque
    if (!rope && t.goalY != null) {
      const pulse = 0.6 + 0.4 * Math.sin(G.time * 6);
      ctx.strokeStyle = `rgba(61,220,132,${pulse})`; ctx.lineWidth = 6;
      ctx.setLineDash([22, 14]); ctx.lineDashOffset = -G.time * 60;
      ctx.beginPath(); ctx.moveTo(0, t.goalY); ctx.lineTo(ROAD_W, t.goalY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(61,220,132,0.10)'; ctx.fillRect(0, t.goalY - 40, ROAD_W, 40);
      text('⚡ RECARGA', ROAD_W / 2, t.goalY - 20, { size: 20, color: '#3ddc84' });
    }

    // La cuerda: tensa (recta) o floja (con comba); trabada pasa por el obstáculo
    const pts = t.snag ? [a, t.snag, b] : [a, b];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = t.snag || t.slack ? 0 : Math.max(0, t.L - d) * 0.45;
    const tense = !t.snag && d > t.L + 20;
    const col = rope ? (tense ? '#ffcf8a' : '#c9a066') : (tense ? '#d6dbe6' : '#8e96a8');
    for (const [w, c] of [[rope ? 7 : 8, 'rgba(0,0,0,0.45)'], [rope ? 4 : 5, col]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
      if (!rope && w < 6) ctx.setLineDash([8, 6]); // remolque: parece cadena
      ctx.beginPath();
      if (pts.length === 2) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
        ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
      } else { ctx.moveTo(a.x, a.y); ctx.lineTo(t.snag.x, t.snag.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'butt';
    }
    if (t.snag) { ctx.strokeStyle = '#ff8a2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.snag.x, t.snag.y, 30, 0, Math.PI * 2); ctx.stroke(); }

    // Indicadores
    if (rope) text(`⏱ ${Math.ceil(t.time)}`, (a.x + b.x) / 2, (a.y + b.y) / 2 + sag * 0.5 - 18, { size: 15, color: '#ffcf8a' });
    else if (a.alive && !a.falling) {
      const m = Math.max(0, Math.round((a.y - t.goalY) / 16));
      text(`SIN MOTOR · ${m} m`, a.x, a.y + 38, { size: 13, color: '#c8cdd8' });
    }
  }
}

function drawPops() {
  for (const p of G.pops) {
    const k = p.t / p.max;
    ctx.globalAlpha = Math.min(1, k * 2.5);
    text(p.text, p.x, p.y, { size: Math.round(p.size * (1 + (1 - k) * 0.15)), color: p.color });
  }
  ctx.globalAlpha = 1;
}

function drawBolts() {
  for (const b of G.bolts) {
    const a = clamp(b.t / 0.45, 0, 1);
    for (const [w, col] of [[14, `rgba(140,200,255,${a * 0.35})`], [4, `rgba(255,255,255,${a})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  }
}

function drawParticles() {
  for (const p of G.particles) {
    const k = p.t / p.life;
    ctx.globalAlpha = 1 - k;
    if (p.kind === 'spark') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    } else if (p.kind === 'skid') {
      ctx.globalAlpha = 0.45 * (1 - k);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = 0.3 * (1 - k);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k * 2), 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'fall' || p.kind === 'conf') {
      const s = p.kind === 'fall' ? p.size * (1 - k) : p.size;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-s / 2, -s / 2, s, p.kind === 'conf' ? s * 0.5 : s);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawWorld() {
  const { scale, viewH } = viewMetrics();
  const sx = G.shake ? rand(-1, 1) * G.shake : 0, sy = G.shake ? rand(-1, 1) * G.shake : 0;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-ROAD_W / 2 + sx, -G.camY + sy);

  const r0 = Math.floor((G.camY - viewH / 2) / T) - 1, r1 = Math.floor((G.camY + viewH / 2) / T) + 1;
  for (let r = r0; r <= r1; r++) for (let c = -1; c <= COLS; c++) drawTile(c, r);

  // Línea de salida
  if (r0 <= 1 && r1 >= 0 && fallP(0, 0) < 1) {
    for (let i = 0; i < COLS * 4; i++) {
      ctx.fillStyle = i & 1 ? '#ddd' : '#222';
      ctx.fillRect(i * 16, 50, 16, 8);
      ctx.fillStyle = i & 1 ? '#222' : '#ddd';
      ctx.fillRect(i * 16, 58, 16, 8);
    }
  }

  for (const g of G.gates.values()) drawLanes(g);

  // Resplandor del colapso
  const grd = ctx.createLinearGradient(0, G.doomY - 120, 0, G.doomY + 220);
  grd.addColorStop(0, 'rgba(255,60,30,0)');
  grd.addColorStop(0.35, 'rgba(255,80,30,0.18)');
  grd.addColorStop(1, 'rgba(120,0,40,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(-T * 3, G.doomY - 120, ROAD_W + T * 6, 340);

  drawChasmEdges(r0, r1);
  drawParticles();
  drawTethers();
  for (const car of G.cars) if (!car.air) drawCar(car);
  for (const g of G.gates.values()) drawGateBarrier(g);
  for (const car of G.cars) if (car.air) drawCar(car);
  drawBolts();
  drawAirUI();
  drawPops();
  ctx.restore();
}

function drawChasmEdges(r0, r1) {
  for (let r = r0; r <= r1; r++) {
    if (!isRamp(r)) continue;
    const z = jumpZoneNear(r);
    if (G.doomY < z.top) continue;
    // Pared del acantilado (borde lejano) y borde cercano
    ctx.fillStyle = '#1b1825'; ctx.fillRect(-T, z.top, ROAD_W + 2 * T, 18);
    ctx.fillStyle = '#2a2638'; ctx.fillRect(-T, z.top, ROAD_W + 2 * T, 5);
    const grd = ctx.createLinearGradient(0, z.bot - 60, 0, z.bot);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grd; ctx.fillRect(-T, z.bot - 60, ROAD_W + 2 * T, 60);
    // Polvo flotando en el abismo
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97.3 + G.time * (10 + i * 3)) % (ROAD_W + 2 * T)) - T;
      const y = z.top + 30 + ((i * 53.1) % (z.bot - z.top - 60));
      ctx.fillStyle = `rgba(180,150,255,${0.08 + (i % 4) * 0.04})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }
}

function drawAirUI() {
  // Uniones de los enganches
  for (const l of G.links) {
    ctx.strokeStyle = `rgba(255,255,255,${l.t * 2})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
  }
  for (const car of G.cars) {
    const a = car.air;
    if (!a || !car.alive || car.falling) continue;
    // Temporizador de quien planea esperando
    if (a.mode === 'glide') {
      const left = clamp(1 - a.glideT / GLIDE_TIME, 0, 1);
      ctx.lineWidth = 5;
      ctx.strokeStyle = left < 0.35 && Math.sin(G.time * 30) > 0 ? '#ffffff' : '#ff4d5e';
      ctx.beginPath(); ctx.arc(car.x, car.y, 40, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
      text('¡ENGÁNCHAME!', car.x, car.y + 56, { size: 13, color: '#ff8a8a' });
    }
    // Anillo de timing del parry: se cierra a medida que te acercas
    if (a.mode === 'launch') continue;
    const tg = parryTarget(car);
    if (!tg) continue;
    const inWin = tg.d <= PARRY_WIN;
    const rWin = 20 + PARRY_WIN * 0.8, rRing = 20 + tg.d * 0.8;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(tg.car.x, tg.car.y, rWin, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = inWin ? 7 : 4;
    ctx.strokeStyle = inWin ? '#ffffff' : car.color;
    if (inWin) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; }
    ctx.beginPath(); ctx.arc(tg.car.x, tg.car.y, rRing, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    const p = playerOf(car);
    if (p && isMine(p) && car.parryCd <= 0) text(`¡${actionLabel(p)}!`, car.x, car.y + 50, { size: inWin ? 26 : 18, color: inWin ? '#fff' : car.color });
  }
}

function text(str, x, y, { size = 20, color = '#fff', align = 'center', weight = 'bold', stroke = true } = {}) {
  ctx.font = `${weight} ${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

// Distancia (en metros) entre el colapso y el carro vivo que va más atrás
const M_PER_PX = 1 / 16;
function doomGap() {
  const live = liveCars();
  if (!live.length) return null;
  return (G.doomY - Math.max(...live.map((c) => c.y))) * M_PER_PX;
}
const dangerColor = (m) => (m < 15 ? '#ff4d5e' : m < 40 ? '#ffd23f' : '#3ddc84');

// Minimapa vertical (borde derecho): el colapso abajo, los carros encima y lo que viene
const METER_RANGE = 2560; // tramo que muestra, en px del mundo (160 m)
function drawDoomMeter() {
  const w = 16, h = Math.min(H * 0.5, 340), x = W - 34, top = 96, bot = top + h;
  const base = G.doomY;
  const toY = (wy) => bot - clamp((base - wy) / METER_RANGE, 0, 1) * h;

  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(x - 4, top - 4, w + 8, h + 8, 8); ctx.fill();
  ctx.fillStyle = '#23222f'; rr(x, top, w, h, 5); ctx.fill();

  // Saltos (abismo) y puertas que vienen
  const rBot = Math.floor(base / T), rTop = Math.floor((base - METER_RANGE) / T);
  const kMin = Math.max(0, Math.floor((G0 - rBot) / GAP) - 1), kMax = Math.ceil((G0 - rTop) / GAP) + 1;
  for (let k = kMin; k <= kMax; k++) {
    const z = jumpZone(k);
    if (z.bot <= base && z.top >= base - METER_RANGE) {
      const y1 = toY(z.top), y2 = toY(z.bot);
      ctx.fillStyle = '#07060c'; ctx.fillRect(x, y1, w, y2 - y1);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(x, y2 - 2, w, 2);
    }
    const gy = (G0 - k * GAP) * T + T / 2;
    if (gy <= base && gy >= base - METER_RANGE) {
      const g = G.gates.get(k);
      ctx.fillStyle = g && g.state === 'open' ? '#3ddc84' : g && g.state === 'locked' ? '#ff4d5e' : '#b48cff';
      ctx.fillRect(x - 3, toY(gy) - 1.5, w + 6, 3);
    }
  }

  // El colapso: franja roja que late en la base
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 150);
  ctx.fillStyle = `rgba(255,77,60,${pulse})`;
  rr(x - 2, bot - 6, w + 4, 8, 3); ctx.fill();

  // Carros (los que se salen del rango, en el borde con flecha)
  for (const c of G.cars) {
    if (!c.alive || c.falling) continue;
    const far = base - c.y > METER_RANGE;
    const cy = toY(c.y);
    ctx.fillStyle = c.color;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (far) { ctx.moveTo(x + w / 2, cy - 7); ctx.lineTo(x + w / 2 - 6, cy + 2); ctx.lineTo(x + w / 2 + 6, cy + 2); ctx.closePath(); }
    else ctx.arc(x + w / 2, cy, c.zap ? 6 : 5, 0, Math.PI * 2);
    ctx.stroke(); ctx.fill();
  }

  // Distancia del que va más atrás, al lado de su punto
  const gap = doomGap();
  if (gap != null) {
    const m = Math.max(0, Math.round(gap));
    const ly = clamp(toY(G.doomY - gap / M_PER_PX), top + 8, bot - 14);
    text(`${m} m`, x - 8, ly, { size: 13, align: 'right', color: dangerColor(m) });
  }
  text('⚠', x + w / 2, bot + 16, { size: 13, color: '#ff4d5e' });
}

function drawHUD() {
  text(`${Math.floor(G.best)} m`, 20, 30, { size: 28, align: 'left' });
  const gap = doomGap();
  if (gap != null && state !== 'over') {
    const m = Math.max(0, Math.round(gap));
    const blink = m < 15 ? 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 120)) : 1;
    ctx.globalAlpha = blink;
    text(`Colapso a ${m} m`, 20, 62, { size: 20, align: 'left', color: dangerColor(m) });
    ctx.globalAlpha = 1;
  }
  text(`${Math.round(G.doomSpeed)} km/h`, 20, 86, { size: 13, align: 'left', color: '#ff8a6a', weight: 'normal' });
  if (state !== 'over') drawDoomMeter();

  // Jugadores
  G.cars.forEach((car, i) => {
    const x = W - 20 - (G.cars.length - 1 - i) * 74;
    ctx.globalAlpha = car.alive ? 1 : 0.35;
    ctx.fillStyle = car.color; rr(x - 64, 14, 64, 30, 8); ctx.fill();
    text(car.alive ? (car.zap ? `⚡${car.name}` : car.name) : `${car.name} ✕`, x - 32, 29, { size: 16, color: '#111', stroke: false });
    ctx.globalAlpha = 1;
  });

  // Barra del evento
  const g = G.curGate;
  if (g) {
    const bw = Math.min(360, W - 40), bx = W / 2 - bw / 2, by = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(bx - 4, by - 4, bw + 8, 22, 8); ctx.fill();
    if (g.state === 'active') {
      ctx.fillStyle = '#ffffff'; rr(bx, by, bw * g.progress, 14, 6); ctx.fill();
      const on = g.lanes.filter((l) => l.on).length;
      text(`En su carril ${on}/${g.lanes.length}`, W / 2, by - 18, { size: 16 });
    } else {
      ctx.fillStyle = '#ff4d5e'; rr(bx, by, bw * (g.lockT / LOCK_TIME), 14, 6); ctx.fill();
      text(`BLOQUEADO ${g.lockT.toFixed(1)}s`, W / 2, by - 18, { size: 16, color: '#ff4d5e' });
    }
  }

  if (state !== 'countdown') drawTeamBar();

  if (G.msg) {
    const k = G.msg.t / G.msg.max;
    ctx.globalAlpha = Math.min(1, k * 3);
    const s = 1 + (1 - k) * 0.08;
    text(G.msg.text, W / 2, H * 0.3, { size: Math.round(40 * s), color: G.msg.color });
    ctx.globalAlpha = 1;
  }

  if (state === 'countdown') {
    const n = Math.ceil(countdown);
    const f = countdown - Math.floor(countdown);
    text(String(n), W / 2, H / 2, { size: Math.round(90 + f * 50), color: '#ffd23f' });
    text('¡Escapen del fin del mundo!', W / 2, H / 2 + 80, { size: 22 });
  }

  if (state === 'over') drawGameOver();
}

// Efecto de velocidad del turbo: líneas que pasan rápido y bordes de color
function drawSpeedFx() {
  const fade = Math.min(1, G.turbo / 0.6, (TURBO_TIME - G.turbo) / 0.3);
  const t = performance.now() / 1000;
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const h1 = Math.sin(i * 127.3) * 0.5 + 0.5, h2 = Math.sin(i * 61.7) * 0.5 + 0.5;
    // Más líneas cerca de los bordes, menos en el centro
    const x = h1 < 0.5 ? h1 * W * 0.7 : W - (1 - h1) * W * 0.7;
    const len = 60 + h2 * 180, speed = 1600 + h2 * 1600;
    const y = (((h2 * 977 + t * speed) % (H + len)) + H + len) % (H + len) - len;
    ctx.strokeStyle = `rgba(255,255,255,${(0.12 + h2 * 0.25) * fade})`;
    ctx.lineWidth = 1.5 + h1 * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(255,170,40,0)');
  vg.addColorStop(1, `rgba(255,150,30,${0.35 * fade * (0.85 + 0.15 * Math.sin(t * 12))})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// Borde inferior rojo que late cuando el colapso está a menos de 15 m del último
function drawDangerEdge() {
  const gap = doomGap();
  if (gap == null || gap >= 15 || state !== 'play') return;
  const k = 1 - Math.max(0, gap) / 15;
  const beat = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / (gap < 6 ? 110 : 220)));
  const grd = ctx.createLinearGradient(0, H, 0, H * 0.6);
  grd.addColorStop(0, `rgba(255,30,30,${0.45 * k * beat})`);
  grd.addColorStop(1, 'rgba(255,30,30,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);
}

// Barra de sinergia compartida (abajo al centro)
function drawTeamBar() {
  const bw = Math.min(340, W - 60), bx = W / 2 - bw / 2;
  const by = H - (Net.role === 'local' ? 34 : 78);
  const turbo = G.turbo > 0;
  const t = performance.now() / 1000;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(bx - 5, by - 5, bw + 10, 24, 10); ctx.fill();
  if (G.team > 0) {
    const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    if (turbo) { grd.addColorStop(0, '#ff7a2e'); grd.addColorStop(1, '#ffd23f'); }
    else { grd.addColorStop(0, '#3fa7ff'); grd.addColorStop(1, '#3ddc84'); }
    ctx.fillStyle = grd;
    if (turbo || G.team > 0.85) { ctx.shadowColor = turbo ? '#ffb02e' : '#3ddc84'; ctx.shadowBlur = 14 + 6 * Math.sin(t * 10); }
    rr(bx, by, bw * G.team, 14, 6); ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Marcas de cuartos
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 1; i < 4; i++) ctx.fillRect(bx + (bw * i) / 4 - 1, by, 2, 14);
  const label = turbo ? `¡TURBO! ${G.turbo.toFixed(1)}s` : 'SINERGIA';
  text(label, W / 2, by - 14, { size: turbo ? 18 : 13, color: turbo ? '#ffd23f' : '#9fd3ff' });
  if (G.teamPop) {
    const k = G.teamPop.t / 1.2;
    ctx.globalAlpha = Math.min(1, k * 2);
    text(G.teamPop.text, W / 2 + bw / 2 - 10, by - 16 - (1 - k) * 24, { size: 15, color: '#3ddc84', align: 'right' });
    ctx.globalAlpha = 1;
  }
}

function drawGameOver() {
  ctx.fillStyle = `rgba(5,4,12,${Math.min(0.75, overT)})`;
  ctx.fillRect(0, 0, W, H);
  if (overT < 0.4) return;
  text('EL MUNDO SE ACABÓ', W / 2, H * 0.22, { size: 52, color: '#ff4d5e' });
  text(`Llegaron a ${Math.floor(G.best)} m en ${G.time.toFixed(1)} s`, W / 2, H * 0.22 + 50, { size: 20, weight: 'normal' });
  const ranking = [...G.cars].sort((a, b) => b.deathTime - a.deathTime || b.dist - a.dist);
  ranking.forEach((car, i) => {
    const y = H * 0.42 + i * 46;
    const bw = Math.min(600, W - 32), x0 = W / 2 - bw / 2;
    ctx.fillStyle = rgba(car.color, 0.2); rr(x0, y - 19, bw, 38, 10); ctx.fill();
    text(`${i + 1}º`, x0 + 28, y, { size: 22, color: car.color });
    text(car.name, x0 + 60, y, { size: 22, color: car.color, align: 'left' });
    text(car.reason, x0 + 110, y, { size: 14, align: 'left', weight: 'normal', color: '#ccc' });
    text(`${Math.floor(car.dist)} m · ${car.deathTime.toFixed(1)} s`, x0 + bw - 110, y, { size: 15, align: 'right' });
    text(`★ ${car.score}`, x0 + bw - 14, y, { size: 17, align: 'right', color: '#ffd23f' });
  });
  if (overT > 1) {
    const blink = 0.6 + 0.4 * Math.sin(performance.now() / 200);
    ctx.globalAlpha = blink;
    text(Net.role === 'client' ? 'Esperando a que el host pida la revancha…' : 'ENTER / ESPACIO / START: revancha   ·   ESC: volver al lobby', W / 2, H * 0.85, { size: 18 });
    ctx.globalAlpha = 1;
  }
}

function drawLobby() {
  const t = performance.now() / 1000;
  text('FIN DEL MUNDO', W / 2, H * 0.14 + Math.sin(t * 2) * 4, { size: Math.min(72, W / 10), color: '#ff4d5e' });
  text('carros contra el colapso · 1 a 4 jugadores', W / 2, H * 0.14 + 52, { size: 18, weight: 'normal', color: '#ddd' });

  const bw = Math.min(200, (W - 80) / 4), gap = 14, total = bw * 4 + gap * 3;
  for (let i = 0; i < 4; i++) {
    const x = W / 2 - total / 2 + i * (bw + gap), y = H * 0.32, h = 170;
    const p = players.find((pl) => pl.slot === i);
    const col = COLORS[i].c;
    ctx.fillStyle = p ? rgba(col, 0.22) : 'rgba(255,255,255,0.04)';
    rr(x, y, bw, h, 14); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = p ? col : 'rgba(255,255,255,0.15)';
    ctx.setLineDash(p ? [] : [8, 8]); rr(x, y, bw, h, 14); ctx.stroke(); ctx.setLineDash([]);
    if (p) {
      ctx.save(); ctx.translate(x + bw / 2, y + 62); ctx.scale(1.6, 1.6); ctx.rotate(Math.sin(t * 3 + i) * 0.2);
      ctx.fillStyle = '#111'; for (const [wx, wy] of [[-15, -15], [11, -15], [-15, 5], [11, 5]]) ctx.fillRect(wx, wy, 4, 11);
      ctx.fillStyle = col; rr(-12, -20, 24, 40, 7); ctx.fill();
      ctx.fillStyle = 'rgba(190,230,255,0.85)'; rr(-9, -12, 18, 6, 2); ctx.fill();
      ctx.restore();
      const where = Net.role === 'local' ? '' : isMine(p) ? ' (tú)' : ' (online)';
      text(`P${i + 1} · ${COLORS[i].name}${where}`, x + bw / 2, y + 125, { size: 17, color: col });
      text(p.label, x + bw / 2, y + 146, { size: 12, weight: 'normal', color: '#ccc' });
      text(`acción ${actionLabel(p)} · derrape ${p.dft}`, x + bw / 2, y + 161, { size: 12, weight: 'normal', color: '#aaa' });
    } else {
      text('Libre', x + bw / 2, y + h / 2, { size: 18, color: 'rgba(255,255,255,0.35)', stroke: false });
    }
  }

  const ly = H * 0.32 + 196;
  const lines = [
    'Únete pulsando ACELERAR en tu control:  W  ·  ↑  ·  I  ·  T / Num8  ·  botón A del mando',
    'Sal pulsando FRENAR (S · ↓ · K · G · botón B)',
    'Antes de cada puerta aparecen carriles de color: TODOS deben ir por el suyo a la vez para abrirla.',
    'Zona de SALTO: el primero planea sobre el abismo; el siguiente lo alcanza y pulsa ACCIÓN justo a tiempo (parry).',
    'ACCIÓN: E · Shift der. · O · Y · mando X      DERRAPE (mantener girando): Espacio · - · U · R · mando RB',
    'COMBOS: derrapa, pasa rozando carros y obstáculos, aterriza saltos. ACCIÓN en el suelo cobra; chocar lo pierde.',
    'RAYO: a quien le cae va más lento y gira mal hacia un lado. ¡Chóquenlo para repararlo!',
    'CUERDA: a veces dos quedan atados 15 s (ojo con los obstáculos). REMOLQUE: jala al que no tiene motor hasta la recarga.',
    'Carriles, enganches y reparaciones llenan la barra de SINERGIA: llena = ¡TURBO para todos!',
  ];
  lines.forEach((l, i) => text(l, W / 2, ly + i * 21, { size: 13, weight: 'normal', color: i < 2 ? '#eee' : '#bbb' }));
  const py = Math.max(H * 0.84, ly + lines.length * 21 + 22);
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
  if (Net.role === 'client') text('Esperando a que el host empiece…', W / 2, py, { size: 22, color: '#ffd23f' });
  else if (players.length) text('ENTER / ESPACIO / START para empezar', W / 2, py, { size: 24, color: '#ffd23f' });
  ctx.globalAlpha = 1;
  if (Net.role === 'local') text('ESC: volver al menú', W / 2, py + 30, { size: 14, weight: 'normal', color: '#888' });
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0a14'); bg.addColorStop(1, '#170814');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  drawStars();
  if (state === 'menu') return; // el menú es HTML
  if (state === 'lobby' || !G) { drawLobby(); return; }
  drawWorld();
  if (G.turbo > 0) drawSpeedFx();
  drawDangerEdge();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();
}

// ---------------------------------------------------------------------
//  Bucle principal
// ---------------------------------------------------------------------
let last = performance.now();
function step(now, draw) {
  const dt = Math.min(0.033, Math.max(0, now - last) / 1000);
  last = now;
  pollPads();
  update(dt);
  if (draw) render();
  pressed.clear();
}
let lastRaf = 0;
function frame(now) {
  lastRaf = performance.now();
  step(now, true);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Si el host cambia de pestaña, el navegador pausa requestAnimationFrame y el juego se
// congelaría para todos: un worker sigue marcando el ritmo de la simulación.
try {
  const src = 'setInterval(() => postMessage(0), 16)';
  const ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  ticker.onmessage = () => {
    const now = performance.now();
    if (Net.role === 'host' && now - lastRaf > 100) step(now, false); // rAF lleva rato sin correr
  };
} catch (e) { /* sin worker: el host debe mantener la pestaña visible */ }
