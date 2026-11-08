'use strict';
// CPDD075CCT gimbal haberleşme protokolü V2.14 (documents/03 Serial Communication Protocol).
// Komut çerçevesi 44 bayt: FB 2C | kod | parametre (4) | telemetri (30) | joystick (5) | XOR | F0
// Geri bildirim çerçevesi 64 bayt: FC 2C | ... | XOR | F0. Çok baytlı alanlar little-endian.

const CMD_LEN = 44;
const FB_LEN = 64;
const JSON_MAX = 35; // 8..42. baytlar (0 tabanlı 7..41)

const CODE = {
  VEHICLE_STATE: 0x11, TRACK_TEMPLATE: 0x23, DISPLAY_MODE: 0x25, BITRATE: 0x2f, VIDEO_SWITCH: 0x31,
  SCREENSHOT: 0x32, RECORD: 0x33, CONT_SCREENSHOT: 0x34, OSD: 0x37, TRACK_POINT: 0x3a, UNTRACK: 0x3b,
  LASER_SINGLE: 0x3d, LASER_CONT: 0x3e, LASER_STOP: 0x3f, PHOTO_RES: 0x40, VIDEO_RES: 0x41, PHOTO: 0x43,
  BURST: 0x44, ZOOM: 0x45, IR_PALETTE: 0x53, SCENE_COMP: 0x55, SHUTTER_COMP: 0x56, TEMP_POINT: 0x5c,
  TEMP_BOX: 0x5d, LEVEL: 0x71, FRAME_ANGLE: 0x72, LOOK_DOWN: 0x73, BOOKMARK: 0x74, YAW_SCAN: 0x77,
  PITCH_SCAN: 0x78, SCAN: 0x79, AZ_LOCK: 0x7a, AZ_FOLLOW: 0x7b, ORIENT: 0x80, LOCK_FRAME: 0x81,
  JSON: 0x90, TRACK_ID: 0x93, CALIBRATE: 0xfa
};

const JOY_ENABLE = 0x70;

function xor(buf, from, to) {
  let x = 0;
  for (let i = from; i <= to; i++) x ^= buf[i];
  return x & 0xff;
}

function clamp(v, lo, hi) { v = Math.round(Number(v) || 0); return v < lo ? lo : v > hi ? hi : v; }

// Parametre alanı (4 bayt) yazıcısı: params().u8(v).u16(v).i16(v).done()
function params() {
  const b = Buffer.alloc(4); let o = 0;
  const api = {
    u8(v) { b.writeUInt8(clamp(v, 0, 255), o); o += 1; return api; },
    u16(v) { b.writeUInt16LE(clamp(v, 0, 65535), o); o += 2; return api; },
    i16(v) { b.writeInt16LE(clamp(v, -32768, 32767), o); o += 2; return api; },
    done() { return b; }
  };
  return api;
}

// Açı alanları "XXXXH-32767" kodlaması: ham = derece×100 + 32767
function angleRaw(deg) { return clamp(Math.round(Number(deg) * 100) + 32767, 0, 65535); }

/**
 * Komut çerçevesi üretir.
 * @param {{code?:number, params?:Buffer|number[], payload?:Buffer, joy?:{yaw:number,pitch:number}|null}} f
 */
function encodeCommand(f = {}) {
  const b = Buffer.alloc(CMD_LEN);
  b[0] = 0xfb; b[1] = 0x2c;
  b[2] = (f.code || 0) & 0xff;
  const p = f.params || [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) b[3 + i] = (p[i] || 0) & 0xff;
  if (f.payload) {
    f.payload.copy(b, 7, 0, Math.min(f.payload.length, JSON_MAX));
  } else if (f.joy) {
    b[37] = JOY_ENABLE;
    b.writeInt16LE(clamp(f.joy.yaw, -100, 100), 38);
    b.writeInt16LE(clamp(f.joy.pitch, -100, 100), 40);
  }
  b[42] = xor(b, 2, 41);
  b[43] = 0xf0;
  return b;
}

/** JSON uzantı komutu (0x90). Metin ASCII olmalı ve en fazla 35 bayt sığar. */
function encodeJson(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const payload = Buffer.from(text, 'latin1');
  if (payload.length > JSON_MAX) throw new Error(`JSON komutu en fazla ${JSON_MAX} bayt olabilir (${payload.length} bayt).`);
  return { code: CODE.JSON, params: params().u16(payload.length).u16(0).done(), payload };
}

const SERVO_MODES = {
  0x01: 'Yük değiştirme', 0x02: 'Manuel', 0x03: 'Favori', 0x04: 'Sayı ön eki', 0x05: 'Yön kilidi', 0x06: 'Tarama',
  0x07: 'Takip', 0x08: 'Dikey aşağı bakış', 0x09: 'Jiroskop otomatik kayma telafisi', 0x0a: 'Jiroskop sıcaklık kayma telafisi',
  0x0b: 'Yön takibi', 0x0c: 'Merkezleme', 0x0d: 'Manuel jiroskop kalibrasyonu', 0x0f: 'Duruş yönlendirme'
};
const LOAD_TYPES = { 1: 'Beyaz ışık', 2: 'Kızılötesi', 3: 'Çift ışık', 4: 'Üç ışık' };
const LOCK_STATES = ['none', 'locked', 'predicting', 'unlocked'];
const CHANNELS = ['Kanal 1 (tele)', 'Kanal 2 (IR)', 'Kanal 3 (sürekli zoom)', 'Kanal 4 (geniş açı)', 'Kanal 5', 'PIP 1', 'PIP 2', 'PIP 3'];
const TARGET_TYPES = ['Kişi', 'Araç'];

function twoBit(v) { return { 3: 'ok', 2: 'partial', 1: 'fault', 0: 'unknown' }[v & 3]; }

/** 64 baytlık geri bildirim çerçevesini çözer; geçersizse null, sağlama hatasında {error}. */
function decodeFeedback(b) {
  if (!b || b.length < FB_LEN || b[0] !== 0xfc || b[1] !== 0x2c || b[FB_LEN - 1] !== 0xf0) return null;
  if (xor(b, 2, 61) !== b[62]) return { error: 'checksum' };

  if (b[2] === 0xff) {
    const raw = b.subarray(3, 62).toString('latin1').replace(/\0+$/, '');
    let json = null;
    try { json = JSON.parse(raw); } catch (_) { /* cihaz bazen geçersiz JSON döner: {"echo":BitRate2048,...} */ }
    return { type: 'json', raw, json };
  }

  const s1 = b.readUInt16LE(4);
  const s2 = b.readUInt16LE(6);
  const st = b[3];
  const target = b.readUInt16LE(27);
  return {
    type: 'telemetry',
    loadType: b[2], loadTypeName: LOAD_TYPES[b[2]] || `Bilinmiyor (${b[2]})`,
    selfTest: {
      tv: !!(st & 1), ir: !!(st & 2), gyro: twoBit(st >> 2), rotation: twoBit(st >> 4),
      processing: !!(st & 0x40), ready: !!(st & 0x80)
    },
    status: {
      photo: !!(s1 & 1), capturing: !!(s1 & 2), burst: !!(s1 & 4), videoCapture: !!(s1 & 8),
      recording: !!(s1 & 0x10), fileNaming: !!(s1 & 0x20), tfCard: !!(s1 & 0x40), targetOutOfLimit: !!(s1 & 0x80),
      network: !!(s1 & 0x100), lock: LOCK_STATES[(s1 >> 9) & 3], channel: (s1 >> 12) & 0xf,
      channelName: CHANNELS[(s1 >> 12) & 0xf] || ''
    },
    status2: {
      irOut: !!(s2 & 1), tvOut: !!(s2 & 2), calPrepare: !!(s2 & 4), calRunning: !!(s2 & 8),
      calDone: !!(s2 & 0x10), calRestored: !!(s2 & 0x20), calSaved: !!(s2 & 0x40)
    },
    servoMode: b[8], servoModeName: SERVO_MODES[b[8]] || '',
    azimuth: b.readInt16LE(9) / 100,
    pitch: b.readInt16LE(11) / 100,
    roll: b.readInt16LE(13) / 100,
    version: b[15],
    laserRange: b.readUInt16LE(16),
    frameCount: b.readUInt16LE(18),
    tfUsage: b[21],
    tfCapacity: b[22],
    pitchAttitude: b.readInt16LE(23) / 100,
    rollAttitude: b.readInt16LE(25) / 100,
    targetId: target & 0x1fff,
    targetType: target >> 13, targetTypeName: TARGET_TYPES[target >> 13] || '',
    targetLon: b.readFloatLE(29),
    targetLat: b.readFloatLE(33),
    targetAlt: b.readInt16LE(37),
    gyroRate: { yaw: b.readInt16LE(41) / 100, pitch: b.readInt16LE(43) / 100, roll: b.readInt16LE(45) / 100 },
    display: b[47], // 0 görünür, 1 IR, 2 görünür zoom
    zoom: b[48] || 1,
    losRate: { yaw: b.readInt16LE(50) / 100, pitch: b.readInt16LE(52) / 100 },
    track: { w: b.readInt16LE(54), h: b.readInt16LE(56), offYaw: b.readInt16LE(58) / 100, offPitch: b.readInt16LE(60) / 100 }
  };
}

/** Geri bildirim çerçevesi üretir (simülatör ve testler için). */
function encodeFeedback(t) {
  const b = Buffer.alloc(FB_LEN);
  b[0] = 0xfc; b[1] = 0x2c;
  if (t.json !== undefined) {
    b[2] = 0xff;
    Buffer.from(typeof t.json === 'string' ? t.json : JSON.stringify(t.json), 'latin1').copy(b, 3, 0, 59);
  } else {
    b[2] = t.loadType || 4;
    b[3] = t.selfTestByte === undefined ? 0xff : t.selfTestByte;
    b.writeUInt16LE(t.s1 || 0, 4);
    b.writeUInt16LE(t.s2 || 0, 6);
    b[8] = t.servoMode || 0;
    b.writeInt16LE(clamp((t.azimuth || 0) * 100, -32768, 32767), 9);
    b.writeInt16LE(clamp((t.pitch || 0) * 100, -32768, 32767), 11);
    b.writeInt16LE(clamp((t.roll || 0) * 100, -32768, 32767), 13);
    b[15] = t.version || 0;
    b.writeUInt16LE(clamp(t.laserRange || 0, 0, 65535), 16);
    b.writeUInt16LE((t.frameCount || 0) & 0xffff, 18);
    b[21] = t.tfUsage || 0;
    b[22] = t.tfCapacity || 0;
    b.writeInt16LE(clamp((t.pitchAttitude || 0) * 100, -32768, 32767), 23);
    b.writeUInt16LE(((t.targetType || 0) << 13) | ((t.targetId || 0) & 0x1fff), 27);
    b[47] = t.display || 0;
    b[48] = t.zoom || 1;
    const tr = t.track || {};
    b.writeInt16LE(clamp(tr.w || 0, -32768, 32767), 54);
    b.writeInt16LE(clamp(tr.h || 0, -32768, 32767), 56);
    b.writeInt16LE(clamp((tr.offYaw || 0) * 100, -32768, 32767), 58);
    b.writeInt16LE(clamp((tr.offPitch || 0) * 100, -32768, 32767), 60);
  }
  b[62] = xor(b, 2, 61);
  b[63] = 0xf0;
  return b;
}

/** Komut çerçevesini çözer (simülatör için). */
function decodeCommand(b) {
  if (!b || b.length < CMD_LEN || b[0] !== 0xfb || b[1] !== 0x2c || b[43] !== 0xf0) return null;
  if (xor(b, 2, 41) !== b[42]) return { error: 'checksum' };
  const out = { code: b[2], params: Array.from(b.subarray(3, 7)), joy: null, payload: null };
  if (b[2] === CODE.JSON) {
    const len = b.readUInt16LE(3);
    out.payload = b.subarray(7, 7 + Math.min(len, JSON_MAX)).toString('latin1');
  } else if (b[37] === JOY_ENABLE) {
    out.joy = { yaw: b.readInt16LE(38), pitch: b.readInt16LE(40) };
  }
  return out;
}

/**
 * Adlandırılmış eylemler → {code, params}. Arayüz yalnızca bu adları kullanır.
 * Parametre anlamları protokol Tablo 3'ten.
 */
const ACTIONS = {
  photo: () => ({ code: CODE.PHOTO }),
  burstToggle: () => ({ code: CODE.BURST }),
  screenshot: () => ({ code: CODE.SCREENSHOT }),
  recordStart: () => ({ code: CODE.RECORD, params: [1] }),
  recordStop: () => ({ code: CODE.RECORD, params: [2] }),
  videoSwitch: () => ({ code: CODE.VIDEO_SWITCH }),
  displayMode: ({ mode }) => ({ code: CODE.DISPLAY_MODE, params: [clamp(mode, 0, 3)] }),
  osd: ({ level }) => ({ code: CODE.OSD, params: [clamp(level, 0, 2)] }),
  trackPoint: ({ x, y }) => ({ code: CODE.TRACK_POINT, params: params().i16(clamp(x, -960, 960)).i16(clamp(y, -540, 540)).done() }),
  untrack: () => ({ code: CODE.UNTRACK }),
  trackGreenBox: () => ({ code: CODE.TRACK_ID, params: [0] }),
  trackById: ({ id }) => ({ code: CODE.TRACK_ID, params: params().u8(1).u16(id).done() }),
  trackTemplate: ({ size, w, h }) => ({ code: CODE.TRACK_TEMPLATE, params: [clamp(size, 0, 4), 0, clamp(w, 0, 255), clamp(h, 0, 255)] }),
  laserSingle: () => ({ code: CODE.LASER_SINGLE }),
  laserContinuous: () => ({ code: CODE.LASER_CONT }),
  laserStop: () => ({ code: CODE.LASER_STOP }),
  photoResolution: ({ res }) => ({ code: CODE.PHOTO_RES, params: [clamp(res, 1, 3)] }),
  videoResolution: ({ res }) => ({ code: CODE.VIDEO_RES, params: [clamp(res, 1, 2)] }),
  bitrate: ({ level, stream }) => ({ code: CODE.BITRATE, params: [clamp(level, 0, 8), clamp(stream, 0, 3)] }),
  setZoom: ({ factor }) => ({ code: CODE.ZOOM, params: params().u8(0).u8(1).u16(Math.round(Number(factor) * 10)).done() }),
  irPalette: () => ({ code: CODE.IR_PALETTE }),
  sceneCompensation: () => ({ code: CODE.SCENE_COMP }),
  shutterCompensation: () => ({ code: CODE.SHUTTER_COMP }),
  tempPoint: ({ x, y }) => ({ code: CODE.TEMP_POINT, params: params().u16(clamp(x, 1, 1920)).u16(clamp(y, 1, 1080)).done() }),
  level: () => ({ code: CODE.LEVEL }),
  lookDown: () => ({ code: CODE.LOOK_DOWN }),
  bookmark: () => ({ code: CODE.BOOKMARK }),
  azimuthLock: () => ({ code: CODE.AZ_LOCK }),
  azimuthFollow: () => ({ code: CODE.AZ_FOLLOW }),
  frameAngle: ({ yaw, pitch }) => ({ code: CODE.FRAME_ANGLE, params: params().u16(angleRaw(yaw)).u16(angleRaw(pitch)).done() }),
  orient: ({ yaw, pitch }) => ({ code: CODE.ORIENT, params: params().u16(angleRaw(yaw)).u16(angleRaw(pitch)).done() }),
  lockFrameAngle: ({ on }) => ({ code: CODE.LOCK_FRAME, params: [on ? 1 : 0] }),
  calibrate: ({ step, mode }) => ({ code: CODE.CALIBRATE, params: [clamp(step, 0, 255), clamp(mode || 0, 0, 3)] })
};

// Basılı tutuldukça gönderilen eylemler (bırakınca çerçeve sıfırlanır)
const HOLD_ACTIONS = {
  zoomIn: () => ({ code: CODE.ZOOM, params: [1] }),
  zoomOut: () => ({ code: CODE.ZOOM, params: [2] })
};

module.exports = {
  CMD_LEN, FB_LEN, JSON_MAX, CODE, xor, encodeCommand, encodeJson, decodeFeedback, encodeFeedback, decodeCommand,
  ACTIONS, HOLD_ACTIONS, angleRaw, params
};
