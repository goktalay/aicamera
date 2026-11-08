'use strict';
// RTSP → MJPEG köprüsü. Tarayıcı RTSP oynatamaz; ffmpeg akışı JPEG karelerine çevirir,
// her kare multipart/x-mixed-replace ile tüm izleyicilere yayılır. Akış başına tek ffmpeg süreci.
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

const BOUNDARY = 'tracklightframe';
const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

class MjpegStream extends EventEmitter {
  constructor(id, source, opts) {
    super();
    this.id = id;
    this.source = source; // { url } veya { test: true }
    this.opts = opts;     // { fps, width, ffmpeg }
    this.clients = new Set();
    this.proc = null;
    this.buf = Buffer.alloc(0);
    this.state = 'idle';
    this.lastFrame = null;
    this.restartDelay = 1000;
  }

  args() {
    const out = ['-an', '-vf', `scale=${this.opts.width}:-2`, '-r', String(this.opts.fps), '-f', 'image2pipe', '-c:v', 'mjpeg', '-q:v', '6', 'pipe:1'];
    if (this.source.test) {
      return ['-hide_banner', '-loglevel', 'error', '-re', '-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=${this.opts.fps}`, ...out];
    }
    return ['-hide_banner', '-loglevel', 'error', '-fflags', 'nobuffer', '-flags', 'low_delay', '-rtsp_transport', this.opts.transport || 'udp',
      '-timeout', '5000000', '-i', this.source.url, ...out];
  }

  setState(s, detail) {
    if (s === this.state && !detail) return;
    this.state = s;
    this.emit('state', { id: this.id, state: s, detail: detail || '' });
  }

  ensure() {
    if (this.proc || this.clients.size === 0) return;
    clearTimeout(this.stopTimer);
    this.setState('connecting');
    let errText = '';
    const p = spawn(this.opts.ffmpeg, this.args(), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    this.proc = p;
    p.stdout.on('data', (chunk) => this._onData(chunk));
    p.stderr.on('data', (d) => { errText = (errText + d.toString()).slice(-400); });
    p.on('error', (err) => {
      errText = err.code === 'ENOENT' ? 'ffmpeg bulunamadı. Kurup PATH\'e ekleyin.' : err.message;
    });
    p.on('close', () => {
      this.proc = null;
      this.buf = Buffer.alloc(0);
      if (this.clients.size === 0) { this.setState('idle'); return; }
      this.setState('error', errText.trim().split('\n').pop() || 'Akış kapandı');
      this.retry = setTimeout(() => this.ensure(), this.restartDelay);
      this.restartDelay = Math.min(this.restartDelay * 2, 10000);
    });
  }

  _onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      const s = this.buf.indexOf(SOI);
      if (s < 0) { this.buf = Buffer.alloc(0); return; }
      const e = this.buf.indexOf(EOI, s + 2);
      if (e < 0) { if (s > 0) this.buf = this.buf.subarray(s); return; }
      const frame = this.buf.subarray(s, e + 2);
      this.buf = this.buf.subarray(e + 2);
      this._broadcast(Buffer.from(frame));
    }
  }

  _broadcast(jpeg) {
    if (this.state !== 'live') { this.setState('live'); this.restartDelay = 1000; }
    this.lastFrame = jpeg;
    const head = Buffer.from(`--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
    for (const res of this.clients) {
      // Yavaş istemci kareleri biriktirmesin: arabellek doluysa bu kareyi atla
      if (res.writableLength > 2 * 1024 * 1024) continue;
      res.write(head); res.write(jpeg); res.write('\r\n');
    }
  }

  attach(req, res) {
    res.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      'Cache-Control': 'no-store', Connection: 'close', Pragma: 'no-cache'
    });
    this.clients.add(res);
    req.on('close', () => {
      this.clients.delete(res);
      if (this.clients.size === 0) this.stopTimer = setTimeout(() => this.kill(), 3000);
    });
    this.ensure();
  }

  kill() {
    clearTimeout(this.retry);
    if (this.proc) { this.proc.kill('SIGKILL'); this.proc = null; }
    this.setState('idle');
  }
}

class VideoHub extends EventEmitter {
  constructor(cfg, opts) {
    super();
    this.streams = new Map();
    this.configure(cfg, opts);
  }

  configure(cfg, opts) {
    for (const s of this.streams.values()) s.kill();
    this.streams.clear();
    for (const def of cfg.streams) {
      const src = opts.sim ? { test: true } : { url: def.url };
      const st = new MjpegStream(def.id, src, { fps: cfg.fps, width: cfg.width, transport: cfg.transport, ffmpeg: opts.ffmpeg || 'ffmpeg' });
      st.on('state', (e) => this.emit('state', e));
      this.streams.set(def.id, st);
    }
  }

  get(id) { return this.streams.get(id); }
  states() { return Array.from(this.streams.values()).map((s) => ({ id: s.id, state: s.state })); }
  closeAll() { for (const s of this.streams.values()) s.kill(); }
}

module.exports = { VideoHub };
