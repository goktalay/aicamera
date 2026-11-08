'use strict';
// Cihaz simülatörü: gerçek gimbal olmadan arayüzü denemek için. UDP 9554'te komut dinler,
// her 20 ms'de 64 baytlık geri bildirim yollar. Değerler sahte ama protokol biçimi gerçektir.
const dgram = require('node:dgram');
const P = require('./protocol');

const FOV = { tv: [14.8, 8.4], ir: [16.9, 12.8] };

class GimbalSim {
  constructor({ host = '127.0.0.1', port = 9554 } = {}) {
    this.host = host; this.port = port;
    this.peer = null;
    this.prevCode = 0;
    this.lastCmd = null; this.lastCmdAt = 0;
    this.s = {
      az: 0, pitch: -10, roll: 0, recording: false, lock: 0, track: { w: 0, h: 0, offYaw: 0, offPitch: 0 },
      display: 0, zoom: 1, servo: 0x02, laser: 0, frame: 0, targetId: 1, targetType: 0, photoUntil: 0,
      ip: '192.168.144.108', s2: 0, calUntil: 0, sensorAngle: 30, encoding: 'BitRate2048,CodecType6,RcMode8'
    };
  }

  start() {
    this.sock = dgram.createSocket('udp4');
    this.sock.on('message', (m, r) => this._onCmd(m, r));
    this.sock.bind(this.port, this.host);
    this.timer = setInterval(() => this._tick(), 20);
    return this;
  }

  stop() { clearInterval(this.timer); try { this.sock.close(); } catch (_) {} }

  _send(obj) { if (this.peer) this.sock.send(P.encodeFeedback(obj), this.peer.port, this.peer.address); }

  _onCmd(msg, rinfo) {
    const c = P.decodeCommand(msg);
    if (!c || c.error) return;
    this.peer = rinfo;
    this.lastCmd = c; this.lastCmdAt = Date.now();
    if (c.code !== this.prevCode && c.code !== 0) this._edge(c);
    this.prevCode = c.code;
  }

  _edge(c) {
    const s = this.s, p = c.params, now = Date.now();
    const C = P.CODE;
    switch (c.code) {
      case C.RECORD: if (p[0] === 1) s.recording = true; else if (p[0] === 2) s.recording = false; break;
      case C.TRACK_POINT: {
        const x = Buffer.from(p).readInt16LE(0), y = Buffer.from(p).readInt16LE(2);
        const fov = s.display === 1 ? FOV.ir : FOV.tv;
        s.lock = 1; s.servo = 0x07;
        s.track = { w: 72, h: 72, offYaw: -x / 1920 * fov[0] / s.zoom, offPitch: y / 1080 * fov[1] / s.zoom };
        break;
      }
      case C.TRACK_ID:
        s.lock = 1; s.servo = 0x07; s.targetId = (s.targetId % 40) + 1;
        s.track = { w: 64, h: 110, offYaw: 0.6, offPitch: -0.3 };
        break;
      case C.UNTRACK: s.lock = 0; s.servo = 0x02; s.track = { w: 0, h: 0, offYaw: 0, offPitch: 0 }; break;
      case C.VIDEO_SWITCH: s.display = (s.display + 1) % 3; break;
      case C.DISPLAY_MODE: s.display = [1, 0, 0, 1][p[0]] ?? 0; break;
      case C.LASER_SINGLE: s.laser = 180 + Math.round(Math.random() * 900); break;
      case C.LEVEL: s.az = 0; s.pitch = 0; s.servo = 0x0c; break;
      case C.LOOK_DOWN: s.az = 0; s.pitch = -90; s.servo = 0x08; break;
      case C.AZ_LOCK: s.servo = 0x05; break;
      case C.AZ_FOLLOW: s.servo = 0x0b; break;
      case C.PHOTO: case C.SCREENSHOT: s.photoUntil = now + 400; break;
      case C.ZOOM: if (p[0] === 0 && p[1] === 1) s.zoom = Math.max(1, Math.min(128, Buffer.from(p).readUInt16LE(2) / 10)); break;
      case C.CALIBRATE:
        if (p[0] === 0x01) s.s2 = 0x04;
        else if (p[0] === 0x02) { s.s2 = 0x08; s.calUntil = now + 3000; }
        else if (p[0] === 0x0a) s.s2 = 0x20;
        break;
      case C.JSON: this._json(c.payload); break;
      default: break;
    }
  }

  _json(text) {
    let o = {};
    try { o = JSON.parse(text); } catch (_) { this._send({ json: { echo: 'invalid cmd' } }); return; }
    const s = this.s;
    if (o.sh === 'ifconfig') this._send({ json: { echo: 'ok', ip: s.ip } });
    else if (o.setip) { s.ip = o.setip; this._send({ json: { echo: 'ok' } }); }
    else if ('getEd' in o) this._send({ json: `{"echo":${s.encoding}}` });
    else if (o.setEd) { s.encoding = o.setEd; this._send({ json: { echo: 'ok' } }); }
    else if ('pausedetecor' in o) this._send({ json: { echo: 'ok' } });
    else if (o.setSensorAngle) { s.sensorAngle = parseInt(o.setSensorAngle, 10) || 0; this._send({ json: { echo: 'ok' } }); }
    else if ('getSensorAngle' in o) this._send({ json: { echo: `SensorAngle= ${s.sensorAngle}` } });
    else this._send({ json: { echo: 'invalid cmd' } });
  }

  _tick() {
    const s = this.s, now = Date.now(), dt = 0.02;
    const c = now - this.lastCmdAt < 200 ? this.lastCmd : null;
    if (c && c.joy) {
      s.az += c.joy.yaw * dt; s.pitch += c.joy.pitch * dt; s.servo = 0x02;
      if (s.lock) { s.lock = 0; s.track = { w: 0, h: 0, offYaw: 0, offPitch: 0 }; }
    }
    if (c && c.code === P.CODE.ZOOM && c.params[0] === 1) s.zoom = Math.min(30, s.zoom + 0.08);
    if (c && c.code === P.CODE.ZOOM && c.params[0] === 2) s.zoom = Math.max(1, s.zoom - 0.08);
    if (s.az > 180) s.az -= 360; if (s.az < -180) s.az += 360;
    s.pitch = Math.max(-90, Math.min(30, s.pitch));
    if (s.lock) {
      // Hedef yavaşça merkeze çekilir, küçük titreşimle
      s.track.offYaw = s.track.offYaw * 0.985 + (Math.random() - 0.5) * 0.04;
      s.track.offPitch = s.track.offPitch * 0.985 + (Math.random() - 0.5) * 0.03;
      s.az += s.track.offYaw * 0.02;
    }
    if (s.calUntil && now > s.calUntil) { s.s2 = 0x10 | 0x40; s.calUntil = 0; }
    s.frame = (s.frame + 1) & 0xffff;

    const s1 = (now < s.photoUntil ? 1 : 0) | (s.recording ? 0x10 : 0) | 0x40 | 0x100 | (s.lock << 9)
      | ((s.display === 1 ? 1 : 0) << 12);
    this._send({
      s1, s2: s.s2 | 0x03, servoMode: s.servo, azimuth: s.az, pitch: s.pitch, roll: s.roll, version: 31,
      laserRange: s.laser, frameCount: s.frame, tfUsage: 41, tfCapacity: 64, pitchAttitude: s.pitch,
      targetId: s.targetId, targetType: s.targetType, display: s.display, zoom: Math.round(s.zoom), track: s.track
    });
  }
}

module.exports = { GimbalSim };

if (require.main === module) {
  const sim = new GimbalSim({ host: '0.0.0.0' }).start();
  console.log(`Gimbal simülatörü UDP ${sim.port} portunda çalışıyor.`);
}
