'use strict';
// Protokol dokümanındaki (V2.14, "JSON Query and IP Modification Example") örnek çerçevelerle doğrulama.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../server/protocol');

const hex = (s) => Buffer.from(s.replace(/\s+/g, ''), 'hex');

test('IP sorgu komutu dokümandaki çerçeveyle aynı (sağlama A3)', () => {
  const expected = hex('FB 2C 90 11 00 00 00 7B 22 73 68 22 3A 22 69 66 63 6F 6E 66 69 67 22 7D 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 A3 F0');
  assert.deepEqual(P.encodeCommand(P.encodeJson({ sh: 'ifconfig' })), expected);
});

test('IP ayarlama komutu dokümandaki çerçeveyle aynı (sağlama ED)', () => {
  const expected = hex('FB 2C 90 19 00 00 00 7B 22 73 65 74 69 70 22 3A 22 31 39 32 2E 31 36 38 2E 38 2E 31 30 31 22 7D 00 00 00 00 00 00 00 00 00 00 ED F0');
  assert.deepEqual(P.encodeCommand(P.encodeJson({ setip: '192.168.8.101' })), expected);
});

test('JSON cevap çerçevesi çözülür (sağlama EA)', () => {
  const frame = hex('FC 2C FF 7B 22 65 63 68 6F 22 3A 22 6F 6B 22 2C 22 69 70 22 3A 22 31 39 32 2E 31 36 38 2E 38 2E 31 30 31 22 7D 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 EA F0');
  assert.equal(frame.length, 64);
  const fb = P.decodeFeedback(frame);
  assert.equal(fb.type, 'json');
  assert.deepEqual(fb.json, { echo: 'ok', ip: '192.168.8.101' });
});

test('Geçersiz JSON cevabı ham metin olarak korunur', () => {
  const fb = P.decodeFeedback(P.encodeFeedback({ json: '{"echo":BitRate2048,CodecType6,RcMode8}' }));
  assert.equal(fb.json, null);
  assert.equal(fb.raw, '{"echo":BitRate2048,CodecType6,RcMode8}');
});

test('Telemetri gidiş-dönüş', () => {
  const s1 = 0x10 | 0x40 | 0x100 | (1 << 9) | (1 << 12);
  const fb = P.decodeFeedback(P.encodeFeedback({
    s1, servoMode: 0x07, azimuth: 112.5, pitch: -20.4, roll: 0.3, laserRange: 1234, frameCount: 77, tfUsage: 41, tfCapacity: 64,
    targetId: 12, targetType: 1, display: 1, zoom: 4, track: { w: 64, h: 96, offYaw: 1.25, offPitch: -0.5 }
  }));
  assert.equal(fb.type, 'telemetry');
  assert.equal(fb.status.recording, true);
  assert.equal(fb.status.tfCard, true);
  assert.equal(fb.status.network, true);
  assert.equal(fb.status.lock, 'locked');
  assert.equal(fb.status.channel, 1);
  assert.equal(fb.servoModeName, 'Takip');
  assert.equal(fb.azimuth, 112.5);
  assert.equal(fb.pitch, -20.4);
  assert.equal(fb.laserRange, 1234);
  assert.equal(fb.targetId, 12);
  assert.equal(fb.targetTypeName, 'Araç');
  assert.equal(fb.display, 1);
  assert.equal(fb.zoom, 4);
  assert.deepEqual(fb.track, { w: 64, h: 96, offYaw: 1.25, offPitch: -0.5 });
  assert.equal(fb.selfTest.ready, true);
});

test('Bozuk sağlama reddedilir', () => {
  const b = P.encodeFeedback({ azimuth: 10 });
  b[10] ^= 0xff;
  assert.deepEqual(P.decodeFeedback(b), { error: 'checksum' });
});

test('Joystick alanları 38-42. baytlarda', () => {
  const b = P.encodeCommand({ joy: { yaw: -30, pitch: 15 } });
  assert.equal(b[37], 0x70);
  assert.equal(b.readInt16LE(38), -30);
  assert.equal(b.readInt16LE(40), 15);
  assert.deepEqual(P.decodeCommand(b).joy, { yaw: -30, pitch: 15 });
});

test('Joystick hızı ±100 ile sınırlanır', () => {
  const b = P.encodeCommand({ joy: { yaw: 500, pitch: -500 } });
  assert.equal(b.readInt16LE(38), 100);
  assert.equal(b.readInt16LE(40), -100);
});

test('Noktadan takip ofseti iki işaretli 16 bit alan', () => {
  const b = P.encodeCommand(P.ACTIONS.trackPoint({ x: -200, y: 100 }));
  assert.equal(b[2], 0x3a);
  assert.equal(b.readInt16LE(3), -200);
  assert.equal(b.readInt16LE(5), 100);
});

test('Açı kodlaması XXXXH-32767', () => {
  assert.equal(P.angleRaw(0), 32767);
  assert.equal(P.angleRaw(-90), 32767 - 9000);
  const b = P.encodeCommand(P.ACTIONS.orient({ yaw: 45, pitch: -30 }));
  assert.equal(b.readUInt16LE(3) - 32767, 4500);
  assert.equal(b.readUInt16LE(5) - 32767, -3000);
});

test('35 bayttan uzun JSON reddedilir', () => {
  assert.throws(() => P.encodeJson({ setSensorAngle: 'x'.repeat(40) }), /en fazla 35 bayt/);
});
