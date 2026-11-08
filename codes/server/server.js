'use strict';
// aicamera web sunucusu: arayüzü sunar, tarayıcı ile gimbal arasında köprü kurar.
//   node server/server.js            gerçek cihaz (config.local.json veya varsayılanlar)
//   node server/server.js --sim      dahili simülatör ve test görüntüsü
//   --host=0.0.0.0                   ağdaki diğer cihazlardan erişim (dikkat: kimlik doğrulama yok)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const P = require('./protocol');
const config = require('./config');
const tokensCss = require('./tokens-css');
const { GimbalLink } = require('./link');
const { VideoHub } = require('./video');
const { GimbalSim } = require('./sim');

const argv = process.argv.slice(2);
const SIM = argv.includes('--sim');
const hostArg = (argv.find((a) => a.startsWith('--host=')) || '').slice(7);
const portArg = parseInt((argv.find((a) => a.startsWith('--port=')) || '').slice(7), 10);

let cfg = config.load();
const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const DS = path.join(ROOT, 'design-system', 'components');

function effectiveCamera() { return SIM ? { ip: '127.0.0.1', port: 9554, localPort: cfg.camera.localPort } : cfg.camera; }

let sim = null;
if (SIM) sim = new GimbalSim({ host: '127.0.0.1', port: 9554 }).start();

let link = makeLink();
const hub = new VideoHub(cfg.video, { sim: SIM });

function makeLink() {
  const l = new GimbalLink(effectiveCamera());
  l.on('link', (up) => broadcast({ t: 'link', connected: up, stats: l.stats }));
  l.on('telemetry', (fb) => { latest = fb; });
  l.on('json', (fb) => broadcast({ t: 'json', raw: fb.raw, json: fb.json, at: Date.now() }));
  l.on('error', (err) => broadcast({ t: 'error', message: `UDP hatası: ${err.message}` }));
  l.start();
  return l;
}

let latest = null;
hub.on('state', (e) => broadcast({ t: 'video', ...e }));

// --- Statik dosyalar -------------------------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function pkgDir(name) { return path.dirname(require.resolve(`${name}/package.json`)); }
const MOUNTS = {
  '/vendor/react/': path.join(pkgDir('react'), 'umd'),
  '/vendor/react-dom/': path.join(pkgDir('react-dom'), 'umd'),
  '/fonts/sans/': pkgDir('@fontsource/ibm-plex-sans'),
  '/fonts/mono/': pkgDir('@fontsource/ibm-plex-mono'),
  '/ds/': DS,
  '/': WEB
};

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Bulunamadı'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  if (p.startsWith('/video/')) {
    const st = hub.get(p.slice(7));
    if (!st) { res.writeHead(404); res.end(); return; }
    st.attach(req, res);
    return;
  }
  if (p === '/tokens.css') {
    try { res.writeHead(200, { 'Content-Type': TYPES['.css'], 'Cache-Control': 'no-cache' }); res.end(tokensCss.build()); }
    catch (e) { res.writeHead(500); res.end(String(e.message)); }
    return;
  }
  for (const [prefix, dir] of Object.entries(MOUNTS)) {
    if (!p.startsWith(prefix)) continue;
    const rel = p.slice(prefix.length) || 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(path.resolve(dir) + path.sep)) { res.writeHead(403); res.end(); return; }
    serveFile(res, file);
    return;
  }
  res.writeHead(404); res.end();
});

// --- WebSocket ---------------------------------------------------------------
const wss = new WebSocketServer({
  server, path: '/ws',
  // Başka sitelerin bu yerel sunucuya komut göndermesini engelle
  verifyClient: ({ req }) => { try { return new URL(req.headers.origin).host === req.headers.host; } catch (_) { return false; } }
});

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}

function hello() {
  return { t: 'hello', sim: SIM, config: cfg, camera: effectiveCamera(), connected: link.connected, stats: link.stats, video: hub.states() };
}

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

wss.on('connection', (ws) => {
  send(ws, hello());
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch (_) { return; }
    try { handle(ws, m); } catch (e) { send(ws, { t: 'error', message: e.message }); }
  });
  ws.on('close', () => {
    if (wss.clients.size === 0) { link.setJoy(null); link.setHold(null); }
  });
});

function handle(ws, m) {
  switch (m.t) {
    case 'action': {
      const fn = P.ACTIONS[m.name];
      if (!fn) throw new Error(`Bilinmeyen eylem: ${m.name}`);
      link.pulse(fn(m.args || {}));
      break;
    }
    case 'hold': {
      const fn = P.HOLD_ACTIONS[m.name];
      if (!fn) throw new Error(`Bilinmeyen basılı eylem: ${m.name}`);
      link.setHold(m.on ? fn() : null);
      break;
    }
    case 'joy':
      link.setJoy(m.stop ? null : { yaw: Number(m.yaw) || 0, pitch: Number(m.pitch) || 0 });
      break;
    case 'json':
      link.pulse(P.encodeJson(m.obj), 5);
      broadcast({ t: 'json-sent', text: JSON.stringify(m.obj), at: Date.now() });
      break;
    case 'config': {
      const next = config.merge(cfg, m.config || {});
      const errors = config.validate(next);
      if (errors.length) { send(ws, { t: 'config-error', errors }); return; }
      cfg = next;
      config.save(cfg);
      link.stop(); link = makeLink();
      hub.configure(cfg.video, { sim: SIM });
      broadcast(hello());
      send(ws, { t: 'config-saved' });
      break;
    }
    default: break;
  }
}

// Telemetri 10 Hz, istatistik 1 Hz
setInterval(() => { if (latest) broadcast({ t: 'fb', fb: latest }); }, 100);
setInterval(() => broadcast({ t: 'stats', connected: link.connected, stats: link.stats, error: link.lastError }), 1000);

const host = hostArg || cfg.http.host;
const port = portArg || cfg.http.port;
server.listen(port, host, () => {
  console.log(`aicamera arayüzü: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
  console.log(SIM ? 'Simülatör modu: gerçek cihaz yerine dahili simülatör ve test görüntüsü kullanılıyor.'
    : `Cihaz: ${cfg.camera.ip}:${cfg.camera.port} (yerel port ${cfg.camera.localPort})`);
});

function shutdown() { hub.closeAll(); link.stop(); if (sim) sim.stop(); server.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
