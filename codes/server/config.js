'use strict';
// Ayarlar: varsayılanlar üretici kılavuzundan (FPV User Manual 4.1, Remote Control System.ini).
// Kullanıcının son girdiği değerler config.local.json'a yazılır ve açılışta geri yüklenir.
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, 'config.local.json');

const DEFAULTS = {
  http: { host: '127.0.0.1', port: 8080 },
  camera: { ip: '192.168.144.108', port: 9554, localPort: 7001 },
  video: {
    fps: 20,
    width: 1280,
    // CPDD075CCT RTSP verisini yalnızca UDP ile gönderiyor; TCP'de oturum açılıyor ama kare gelmiyor
    transport: 'udp',
    // live/1 bu cihazda 404 döndürüyor; ek akış gerekirse Ayarlar'dan eklenebilir
    streams: [
      { id: 'main', label: 'Ana akış (live/0)', url: 'rtsp://192.168.144.108/live/0' }
    ]
  }
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over || {})) if (k in base) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}

function validate(c) {
  const errs = [];
  const port = (v) => Number.isInteger(v) && v > 0 && v < 65536;
  if (!IPV4.test(c.camera.ip)) errs.push('Cihaz IP adresi geçersiz.');
  if (!port(c.camera.port)) errs.push('Cihaz portu 1–65535 arasında olmalı.');
  if (!port(c.camera.localPort)) errs.push('Yerel port 1–65535 arasında olmalı.');
  if (!port(c.http.port)) errs.push('Web portu 1–65535 arasında olmalı.');
  for (const s of c.video.streams) {
    if (!/^rtsp:\/\/[^\s]+$/i.test(s.url)) errs.push(`"${s.label}" için RTSP adresi rtsp:// ile başlamalı.`);
  }
  if (!(c.video.fps >= 1 && c.video.fps <= 60)) errs.push('Kare hızı 1–60 arasında olmalı.');
  if (!['udp', 'tcp'].includes(c.video.transport)) errs.push('RTSP taşıma yöntemi UDP veya TCP olmalı.');
  if (!(c.video.width >= 320 && c.video.width <= 1920)) errs.push('Video genişliği 320–1920 arasında olmalı.');
  return errs;
}

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { /* ilk açılış */ }
  const c = merge(DEFAULTS, saved);
  return validate(c).length ? DEFAULTS : c;
}

function save(c) {
  fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n', 'utf8');
}

module.exports = { DEFAULTS, load, save, merge, validate };
