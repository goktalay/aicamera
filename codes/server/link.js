'use strict';
// Gimbal UDP bağlantısı: protokolün istediği gibi her 40 ms'de (25 Hz) bir komut çerçevesi gönderir.
// Bir düğmeye basmak = birkaç çerçeve boyunca o kodu göndermek; cihaz kod değişim kenarını algılar.
// Bırakınca kod/parametre/joystick alanları sıfırlanır.
const dgram = require('node:dgram');
const { EventEmitter } = require('node:events');
const P = require('./protocol');

const TICK_MS = 40;
const PULSE_FRAMES = 5;    // tek seferlik komut ~200 ms gönderilir
const GAP_FRAMES = 3;      // ardışık komutlar arasında sıfır çerçeve (yeni kenar oluşsun)
const JOY_TIMEOUT_MS = 500; // arayüzden joystick mesajı gelmezse dur (ölü adam koruması)
const LINK_TIMEOUT_MS = 1500;

class GimbalLink extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.queue = [];
    this.current = null; // { frame, left }
    this.gap = 0;
    this.hold = null;
    this.joy = null;
    this.joyAt = 0;
    this.lastRx = 0;
    this.connected = false;
    // foreign: ayarlı cihaz dışındaki bir adresten gelen çerçeveler (ör. ağdaki başka bir gimbal)
    this.stats = { tx: 0, rx: 0, badChecksum: 0, sendErrors: 0, foreign: 0, foreignFrom: '' };
    this.lastError = '';
  }

  start() {
    this.sock = dgram.createSocket('udp4');
    this.sock.on('message', (msg, rinfo) => this._onMessage(msg, rinfo));
    this.sock.on('error', (err) => { this.lastError = err.message; this.emit('error', err); });
    this.sock.bind(this.cfg.localPort, () => {
      this.timer = setInterval(() => this._tick(), TICK_MS);
      this.watch = setInterval(() => this._checkLink(), 250);
    });
  }

  stop() {
    clearInterval(this.timer); clearInterval(this.watch);
    if (this.sock) { try { this.sock.close(); } catch (_) {} this.sock = null; }
  }

  /** Tek seferlik komut (kuyruğa girer). */
  pulse(frame, frames = PULSE_FRAMES) {
    if (this.queue.length > 20) this.queue.shift();
    this.queue.push({ frame, left: frames });
  }

  /** Basılı tutulan komut; null ile bırakılır. */
  setHold(frame) { this.hold = frame; }

  /** Joystick hızı (°/s); null ile durur. */
  setJoy(joy) { this.joy = joy; this.joyAt = Date.now(); }

  _next() {
    if (this.current && this.current.left > 0) { this.current.left--; return this.current.frame; }
    if (this.current) { this.current = null; this.gap = GAP_FRAMES; }
    if (this.gap > 0) { this.gap--; return null; }
    if (this.queue.length) { this.current = this.queue.shift(); this.current.left--; return this.current.frame; }
    return this.hold;
  }

  _tick() {
    if (this.joy && Date.now() - this.joyAt > JOY_TIMEOUT_MS) this.joy = null;
    const f = this._next() || {};
    const frame = P.encodeCommand({
      code: f.code, params: f.params, payload: f.payload,
      joy: f.payload ? null : this.joy
    });
    this.sock.send(frame, this.cfg.port, this.cfg.ip, (err) => {
      if (err) { this.stats.sendErrors++; this.lastError = err.message; } else this.stats.tx++;
    });
  }

  _onMessage(msg, rinfo) {
    // Yalnızca ayarlı cihazın çerçevelerini kabul et; gimbal son komut aldığı adrese yayın yapar,
    // bu yüzden ağdaki başka bir cihaz da bu porta veri gönderiyor olabilir.
    if (rinfo && rinfo.address !== this.cfg.ip) {
      this.stats.foreign++;
      this.stats.foreignFrom = `${rinfo.address}:${rinfo.port}`;
      return;
    }
    // Bir datagram birden çok çerçeve taşıyabilir; FC 2C başlığından itibaren tara.
    for (let i = 0; i + P.FB_LEN <= msg.length; i++) {
      if (msg[i] !== 0xfc || msg[i + 1] !== 0x2c) continue;
      const fb = P.decodeFeedback(msg.subarray(i, i + P.FB_LEN));
      if (!fb) continue;
      if (fb.error) { this.stats.badChecksum++; continue; }
      this.stats.rx++;
      this.lastRx = Date.now();
      if (!this.connected) { this.connected = true; this.emit('link', true); }
      this.emit(fb.type === 'json' ? 'json' : 'telemetry', fb);
      i += P.FB_LEN - 1;
    }
  }

  _checkLink() {
    const up = Date.now() - this.lastRx < LINK_TIMEOUT_MS;
    if (up !== this.connected) { this.connected = up; this.emit('link', up); }
  }
}

module.exports = { GimbalLink, TICK_MS };
