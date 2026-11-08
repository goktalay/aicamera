/* aicamera arayüzü — React 18 (UMD) + Tracklight bileşenleri, derleme adımı yok. */
(function () {
  'use strict';
  const R = window.React, h = R.createElement, T = window.Tracklight;
  const { useState, useEffect, useRef, useCallback } = R;

  // ---------- yardımcılar ----------
  const fmt = (n, d = 1) => (typeof n === 'number' && isFinite(n) ? n.toFixed(d) : '—');
  const clock = (ms) => new Date(ms).toLocaleTimeString('tr-TR', { hour12: false });
  function store(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (_) { return fallback; }
  }
  function persist(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) { /* gizli pencere */ } }
  function usePersisted(key, fallback) {
    const [v, setV] = useState(() => store(key, fallback));
    useEffect(() => persist(key, v), [key, v]);
    return [v, setV];
  }

  // ---------- sunucu bağlantısı ----------
  const INITIAL = { ws: false, hello: null, connected: false, fb: null, stats: null, linkError: '', video: {}, log: [], toast: null, configErrors: null };

  function pushLog(s, entry) { return [{ id: Date.now() + Math.random(), at: Date.now(), ...entry }, ...s.log].slice(0, 60); }

  function reduce(s, m) {
    switch (m.t) {
      case 'hello': {
        const video = {};
        (m.video || []).forEach((v) => { video[v.id] = { state: v.state, detail: '' }; });
        return { ...s, hello: m, connected: m.connected, stats: m.stats, video, configErrors: null };
      }
      case 'link': return { ...s, connected: m.connected, stats: m.stats };
      case 'fb': return { ...s, fb: m.fb };
      case 'stats': return { ...s, connected: m.connected, stats: m.stats, linkError: m.error || '' };
      case 'video': return { ...s, video: { ...s.video, [m.id]: { state: m.state, detail: m.detail } } };
      case 'json': return { ...s, log: pushLog(s, { dir: 'in', text: m.raw }) };
      case 'json-sent': return { ...s, log: pushLog(s, { dir: 'out', text: m.text }) };
      case 'error': return { ...s, log: pushLog(s, { dir: 'err', text: m.message }), toast: { id: Date.now(), tone: 'danger', text: m.message } };
      case 'config-error': return { ...s, configErrors: m.errors };
      case 'config-saved': return { ...s, configErrors: null, toast: { id: Date.now(), tone: 'ok', text: 'Ayarlar kaydedildi, cihaza yeniden bağlanılıyor.' } };
      default: return s;
    }
  }

  function useBridge() {
    const [st, setSt] = useState(INITIAL);
    const wsRef = useRef(null);
    useEffect(() => {
      let stopped = false, retry = 500, timer = null;
      function open() {
        const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
        wsRef.current = ws;
        ws.onopen = () => { retry = 500; setSt((s) => ({ ...s, ws: true })); };
        ws.onclose = () => {
          setSt((s) => ({ ...s, ws: false, connected: false }));
          if (!stopped) { timer = setTimeout(open, retry); retry = Math.min(retry * 2, 5000); }
        };
        ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } setSt((s) => reduce(s, m)); };
      }
      open();
      return () => { stopped = true; clearTimeout(timer); if (wsRef.current) wsRef.current.close(); };
    }, []);
    const send = useCallback((m) => { const ws = wsRef.current; if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }, []);
    const dismiss = useCallback(() => setSt((s) => ({ ...s, toast: null })), []);
    return [st, send, dismiss];
  }

  // ---------- joystick (yön tuşları ve klavye oklarıyla) ----------
  function useJoystick(send, speed, invert) {
    const active = useRef(new Set());
    const timer = useRef(null);
    const cfg = useRef({ speed, invert });
    cfg.current = { speed, invert };

    const tick = useCallback(() => {
      const a = active.current, { speed: v, invert: inv } = cfg.current;
      if (!a.size) {
        send({ t: 'joy', stop: true });
        clearInterval(timer.current); timer.current = null;
        return;
      }
      let yaw = 0, pitch = 0;
      if (a.has('left')) yaw -= v;
      if (a.has('right')) yaw += v;
      if (a.has('up')) pitch += v;
      if (a.has('down')) pitch -= v;
      send({ t: 'joy', yaw: inv.yaw ? -yaw : yaw, pitch: inv.pitch ? -pitch : pitch });
    }, [send]);

    // Kısa bir dokunuş da gimbali hissedilir biçimde oynatsın: her basış en az MIN_PRESS_MS sürer
    const MIN_PRESS_MS = 150;
    const pressedAt = useRef({});
    const press = useCallback((dir) => {
      active.current.add(dir);
      pressedAt.current[dir] = Date.now();
      tick();
      if (!timer.current) timer.current = setInterval(tick, 100);
    }, [tick]);
    const release = useCallback((dir) => {
      if (!active.current.has(dir)) return;
      const left = MIN_PRESS_MS - (Date.now() - (pressedAt.current[dir] || 0));
      const done = () => { if (active.current.delete(dir)) tick(); };
      if (left > 0) setTimeout(done, left); else done();
    }, [tick]);

    useEffect(() => {
      const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const editable = (el) => !!el && el.nodeType === 1 &&
        (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.getAttribute('role') === 'tab');
      const down = (e) => { const d = KEYS[e.key]; if (!d || editable(e.target)) return; e.preventDefault(); if (!e.repeat) press(d); };
      const up = (e) => { const d = KEYS[e.key]; if (d) release(d); };
      const blur = () => { active.current.clear(); tick(); };
      window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
      return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); blur(); };
    }, [press, release, tick]);

    return { press, release };
  }

  function useRecordingClock(on) {
    const [start, setStart] = useState(null);
    const [, force] = useState(0);
    useEffect(() => { setStart(on ? Date.now() : null); }, [on]);
    useEffect(() => { if (!on) return; const t = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(t); }, [on]);
    if (!start) return '00:00:00';
    const s = Math.floor((Date.now() - start) / 1000);
    return [s / 3600, (s % 3600) / 60, s % 60].map((x) => String(Math.floor(x)).padStart(2, '0')).join(':');
  }

  // Takip kutusu: cihaz kutu boyutunu piksel, merkezden sapmayı derece olarak verir.
  // Sapma, kaynağın görüş açısıyla (teknik şartname) yüzdeye çevrilir; yaklaşık bir konumdur.
  const FOV = { tv: [14.8, 8.4], ir: [16.9, 12.8] };
  function trackBox(fb) {
    if (!fb || (fb.status.lock !== 'locked' && fb.status.lock !== 'predicting') || fb.track.w <= 0) return null;
    const fov = fb.display === 1 ? FOV.ir : FOV.tv;
    const z = Math.max(1, fb.zoom || 1);
    const w = Math.min(100, (fb.track.w / 1920) * 100), hh = Math.min(100, (fb.track.h / 1080) * 100);
    const cx = 50 - (fb.track.offYaw / (fov[0] / z)) * 100;
    const cy = 50 + (fb.track.offPitch / (fov[1] / z)) * 100;
    const label = (fb.status.lock === 'predicting' ? 'Tahmin' : 'Kilitli') + (fb.targetTypeName ? ' · ' + fb.targetTypeName : '');
    return { x: cx - w / 2, y: cy - hh / 2, w, h: hh, label };
  }

  const LOCK_TEXT = { none: 'Takip yok', locked: 'Kilitli', predicting: 'Tahmin ediliyor', unlocked: 'Hedef kayboldu' };
  const LOCK_TONE = { none: 'idle', locked: 'ok', predicting: 'warn', unlocked: 'danger' };

  // ---------- Kontrol ekranı ----------
  function VideoArea({ st, act, pointMode, setPointMode }) {
    const streams = (st.hello && st.hello.config.video.streams) || [];
    const [stream, setStream] = usePersisted('stream', 'main');
    const fb = st.fb;
    const recording = !!(fb && fb.status.recording);
    const recTime = useRecordingClock(recording);
    const vs = st.video[stream] || { state: 'idle' };
    const live = vs.state === 'live';

    function onClick(e) {
      if (!pointMode) return;
      const img = e.currentTarget, r = img.getBoundingClientRect();
      const nw = img.naturalWidth || 16, nh = img.naturalHeight || 9;
      const k = Math.min(r.width / nw, r.height / nh), dw = nw * k, dh = nh * k;
      const fx = (e.clientX - r.left - (r.width - dw) / 2) / dw;
      const fy = (e.clientY - r.top - (r.height - dh) / 2) / dh;
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
      act('trackPoint', { x: Math.round((fx - 0.5) * 1920), y: Math.round((fy - 0.5) * 1080) });
      setPointMode(false);
    }

    const statusText = {
      idle: 'Görüntü bekleniyor', connecting: 'Görüntüye bağlanılıyor…', error: 'Görüntü alınamadı'
    }[vs.state];
    const url = (streams.find((s) => s.id === stream) || {}).url || '';
    const readouts = fb ? [
      `AZ ${fmt(fb.azimuth, 2)}°`, `P ${fmt(fb.pitch, 2)}°`, `R ${fmt(fb.roll, 2)}°`,
      ...(fb.laserRange ? [`${fb.laserRange} m`] : []), `${fb.zoom}×`
    ] : null;

    return h('div', { className: 'ctl-video' + (pointMode ? ' is-pointing' : '') },
      h(T.VideoPane, {
        source: fb && fb.display === 1 ? 'IR' : 'TV', palette: 'Termal', zoom: fb ? `${fb.zoom}×` : '1×',
        recording, recTime, track: trackBox(fb), readouts,
        crosshair: true
      },
        h('img', { key: stream, src: `/video/${stream}`, alt: 'Canlı görüntü', onClick, draggable: false }),
        !live ? h('div', { className: 'video-status' }, h('div', null, statusText, h('small', null, vs.state === 'error' && vs.detail ? vs.detail : url))) : null),
      h('div', { className: 'video-bar' },
        h(T.Field, {
          id: 'stream', label: 'Akış', value: stream, onChange: (e) => setStream(e.target.value),
          options: streams.map((s) => ({ value: s.id, label: s.label }))
        }),
        pointMode ? h('p', { className: 'hint' }, 'Takip edilecek hedefe videoda tıklayın. Vazgeçmek için “Noktadan” tuşuna yeniden basın.')
          : h('p', { className: 'hint' }, 'Ok tuşları gimbali hareket ettirir.'))
    );
  }

  function CameraPanel({ fb, act, send }) {
    const [osd, setOsd] = useState(2);
    const recording = !!(fb && fb.status.recording);
    const hold = (name) => ({
      onPointerDown: () => send({ t: 'hold', name, on: true }),
      onPointerUp: () => send({ t: 'hold', name, on: false }),
      onPointerLeave: () => send({ t: 'hold', name, on: false })
    });
    return h(T.Panel, { title: 'Kamera' },
      h('div', { className: 'ctl-buttons' },
        h(T.ControlButton, { icon: 'photo', label: 'Fotoğraf', pressed: !!(fb && fb.status.photo), onClick: () => act('photo') }),
        h(T.ControlButton, {
          icon: 'record', pressedIcon: 'stop', label: 'Kayıt', pressedLabel: 'Durdur', tone: 'record', pressed: recording,
          onClick: () => act(recording ? 'recordStop' : 'recordStart')
        }),
        h(T.ControlButton, { icon: 'focus', label: 'Kare al', pressed: false, onClick: () => act('screenshot') }),
        h(T.ControlButton, { icon: 'swap', label: 'Görüntü', pressed: false, onClick: () => act('videoSwitch') }),
        h(T.ControlButton, { icon: 'thermal', label: 'IR palet', pressed: false, onClick: () => act('irPalette') }),
        h(T.ControlButton, {
          icon: 'pip', label: ['OSD kapalı', 'OSD kısmi', 'OSD tam'][osd], pressed: false,
          onClick: () => { const n = (osd + 1) % 3; setOsd(n); act('osd', { level: n }); }
        }),
        h(T.ControlButton, { icon: 'laser', label: 'Mesafe', pressed: false, onClick: () => act('laserSingle') })),
      h('div', { className: 'zoom-row' },
        h(T.Button, { icon: 'zoomOut', 'aria-label': 'Uzaklaştır', ...hold('zoomOut') }),
        h(T.Readout, { label: 'Zoom', value: fb ? fb.zoom : '—', unit: '×', size: 'sm' }),
        h(T.Button, { icon: 'zoomIn', 'aria-label': 'Yakınlaştır', ...hold('zoomIn') }),
        h('span', { className: 'hint' }, 'Basılı tutun')));
  }

  function TrackPanel({ fb, act, pointMode, setPointMode }) {
    const lock = fb ? fb.status.lock : 'none';
    const tracking = lock === 'locked' || lock === 'predicting';
    return h(T.Panel, { title: 'Takip', actions: h(T.StatusChip, { tone: LOCK_TONE[lock] }, LOCK_TEXT[lock]) },
      h('div', { className: 'ctl-buttons' },
        h(T.ControlButton, { icon: 'track', label: 'AI takip', pressed: tracking, onClick: () => act(tracking ? 'untrack' : 'trackGreenBox') }),
        h(T.ControlButton, { icon: 'focus', label: 'Noktadan', pressed: pointMode, onClick: () => setPointMode(!pointMode) })),
      h('p', { className: 'hint' }, 'AI takip merkeze en yakın hedefi (yeşil kutu) kilitler. “Noktadan” ile videoda istediğiniz yere tıklayın.'),
      h('div', { className: 'readouts' },
        h(T.Readout, { label: 'Hedef', value: fb && fb.targetId ? `#${fb.targetId}` : '—', unit: fb ? fb.targetTypeName : '', size: 'sm' }),
        h(T.Readout, { label: 'Kutu', value: fb && fb.track.w ? `${fb.track.w}×${fb.track.h}` : '—', unit: 'px', size: 'sm' }),
        h(T.Readout, { label: 'Sapma yatay', value: fmt(fb && fb.track.offYaw, 2), unit: '°', size: 'sm' }),
        h(T.Readout, { label: 'Sapma dikey', value: fmt(fb && fb.track.offPitch, 2), unit: '°', size: 'sm' })),
      h(T.Button, { variant: 'ghost', disabled: !tracking, onClick: () => act('untrack') }, 'Takibi bırak'));
  }

  function GimbalPanel({ fb, act, joy, speed, setSpeed }) {
    return h(T.Panel, { title: 'Gimbal', actions: fb && fb.servoModeName ? h(T.StatusChip, { tone: 'idle' }, fb.servoModeName) : null },
      h('div', { className: 'gimbal-row' },
        h(T.DirPad, { onMove: joy.press, onStop: joy.release, onCenter: () => act('level') }),
        h('div', { className: 'readouts' },
          h(T.Readout, { label: 'Azimut', value: fmt(fb && fb.azimuth, 2), unit: '°', tone: 'accent' }),
          h(T.Readout, { label: 'Yunuslama', value: fmt(fb && fb.pitch, 2), unit: '°', tone: 'accent' }))),
      h(T.Field, {
        id: 'joy-speed', label: 'Dönüş hızı', value: String(speed), onChange: (e) => setSpeed(Number(e.target.value)), mono: true,
        options: [5, 10, 20, 40, 80].map((v) => ({ value: String(v), label: `${v} °/s` }))
      }),
      h('div', { className: 'btn-grid' },
        h(T.Button, { icon: 'center', onClick: () => act('level') }, 'Merkeze al'),
        h(T.Button, { icon: 'down', onClick: () => act('lookDown') }, 'Aşağı bak'),
        h(T.Button, { onClick: () => act('azimuthLock') }, 'Yön kilidi'),
        h(T.Button, { onClick: () => act('azimuthFollow') }, 'Yön takibi')));
  }

  function chip(ok, label, okText, badText) {
    return h(T.StatusChip, { tone: ok === true ? 'ok' : ok === false ? 'danger' : 'warn' }, `${label}: ${ok === true ? okText : ok === false ? badText : 'belirsiz'}`);
  }
  const twoBit = (v) => (v === 'ok' ? true : v === 'fault' ? false : null);

  function StatusPanel({ fb, st }) {
    if (!fb) return h(T.Panel, { title: 'Cihaz durumu' }, h('p', { className: 'empty' }, 'Cihazdan veri bekleniyor.'), h(ForeignNotice, { st }));
    const t = fb.selfTest;
    return h(T.Panel, { title: 'Cihaz durumu' },
      h('div', { className: 'chips' },
        chip(t.tv, 'TV kamera', 'normal', 'arıza'), chip(t.ir, 'IR kamera', 'normal', 'arıza'),
        chip(twoBit(t.gyro), 'Jiroskop', 'normal', 'arıza'), chip(twoBit(t.rotation), 'Motor', 'normal', 'arıza'),
        chip(t.processing, 'İşlemci', 'normal', 'arıza'), chip(t.ready, 'Gimbal', 'hazır', 'hazır değil')),
      h('div', { className: 'readouts' },
        h(T.Readout, { label: 'TF kart', value: fb.status.tfCard ? `%${fb.tfUsage}` : 'Yok', unit: fb.status.tfCard ? `/ ${fb.tfCapacity} GB` : '', size: 'sm' }),
        h(T.Readout, { label: 'Lazer mesafe', value: fb.laserRange || '—', unit: 'm', size: 'sm' }),
        h(T.Readout, { label: 'Yük', value: fb.loadTypeName, size: 'sm' }),
        h(T.Readout, { label: 'Sürüm', value: fb.version, size: 'sm' })),
      st.stats ? h('p', { className: 'hint' }, `Gönderilen ${st.stats.tx} · alınan ${st.stats.rx} çerçeve` + (st.stats.badChecksum ? ` · ${st.stats.badChecksum} bozuk` : '')) : null,
      h(ForeignNotice, { st }));
  }

  // Ayarlı adres dışından gelen çerçeveler: genellikle ağdaki gerçek cihaz başka bir IP'dedir
  function ForeignNotice({ st }) {
    if (!st.stats || !st.stats.foreign) return null;
    return h('p', { className: 'warn-text' },
      `${st.stats.foreignFrom} adresinden de gimbal verisi geliyor; ayarlı cihaz bu değil, yok sayılıyor. Bu cihazı kullanmak için Ayarlar → Bağlantı'da IP adresini değiştirin.`);
  }

  function ControlView(ctx) {
    const { st, act, send } = ctx;
    const [pointMode, setPointMode] = useState(false);
    const [speed, setSpeed] = usePersisted('joySpeed', 20);
    const joy = useJoystick(send, speed, ctx.invert);
    const fb = st.fb;
    return h('div', { className: 'ctl-grid' },
      h(VideoArea, { st, act, pointMode, setPointMode }),
      h('div', { className: 'ctl-side' },
        h(CameraPanel, { fb, act, send }),
        h(TrackPanel, { fb, act, pointMode, setPointMode }),
        h(GimbalPanel, { fb, act, joy, speed, setSpeed }),
        h(StatusPanel, { fb, st })));
  }

  // ---------- Ayarlar ----------
  function ConnectionPanel({ st, send }) {
    const c = st.hello && st.hello.config;
    const [form, setForm] = useState(null);
    useEffect(() => { if (c) setForm(JSON.parse(JSON.stringify(c))); }, [st.hello]);
    if (!form) return h(T.Panel, { title: 'Bağlantı' }, h('p', { className: 'empty' }, 'Sunucuya bağlanılıyor…'));
    const set = (fn) => setForm((f) => { const n = JSON.parse(JSON.stringify(f)); fn(n); return n; });
    const num = (v) => parseInt(v, 10) || 0;
    return h(T.Panel, { title: 'Bağlantı' },
      st.hello.sim ? h('p', { className: 'warn-text' }, 'Simülatör modu açık: cihaz adresi yerine dahili simülatör kullanılıyor.') : null,
      h(T.IpField, { id: 'cam-ip', label: 'Cihaz IP', value: form.camera.ip, onChange: (ip) => set((n) => { n.camera.ip = ip; }), hint: 'Fabrika ayarı 192.168.144.108' }),
      h('div', { className: 'two' },
        h(T.Field, { id: 'cam-port', label: 'Cihaz UDP portu', mono: true, inputMode: 'numeric', value: String(form.camera.port), onChange: (e) => set((n) => { n.camera.port = num(e.target.value); }) }),
        h(T.Field, { id: 'cam-local', label: 'Yerel port', mono: true, inputMode: 'numeric', value: String(form.camera.localPort), onChange: (e) => set((n) => { n.camera.localPort = num(e.target.value); }) })),
      form.video.streams.map((s, i) => h(T.Field, {
        key: s.id, id: 'rtsp-' + s.id, label: s.label, mono: true, value: s.url, onChange: (e) => set((n) => { n.video.streams[i].url = e.target.value.trim(); })
      })),
      h('div', { className: 'two' },
        h(T.Field, { id: 'v-fps', label: 'Kare hızı', mono: true, value: String(form.video.fps), onChange: (e) => set((n) => { n.video.fps = num(e.target.value); }), options: ['10', '15', '20', '25', '30'].map((v) => ({ value: v, label: `${v} fps` })) }),
        h(T.Field, { id: 'v-width', label: 'Görüntü genişliği', mono: true, value: String(form.video.width), onChange: (e) => set((n) => { n.video.width = num(e.target.value); }), options: ['640', '960', '1280', '1920'].map((v) => ({ value: v, label: `${v} px` })) })),
      st.configErrors ? h('ul', { className: 'errors' }, st.configErrors.map((e) => h('li', { key: e }, e))) : null,
      h('div', { className: 'btn-row' },
        h(T.Button, { variant: 'primary', onClick: () => send({ t: 'config', config: { camera: form.camera, video: form.video } }) }, 'Kaydet ve yeniden bağlan'),
        h(T.Button, { variant: 'ghost', onClick: () => setForm(JSON.parse(JSON.stringify(c))) }, 'Değişiklikleri geri al')));
  }

  function ControlPrefsPanel({ invert, setInvert }) {
    const box = (key, label) => h('label', { className: 'check', htmlFor: 'inv-' + key },
      h('input', { id: 'inv-' + key, type: 'checkbox', checked: !!invert[key], onChange: (e) => setInvert({ ...invert, [key]: e.target.checked }) }), label);
    return h(T.Panel, { title: 'Kumanda yönü' },
      h('p', { className: 'hint' }, 'Gimbal ters yöne dönüyorsa ilgili ekseni çevirin. Bu tercih yalnızca bu tarayıcıda saklanır.'),
      box('yaw', 'Yatay ekseni (sapma) ters çevir'),
      box('pitch', 'Dikey ekseni (yunuslama) ters çevir'));
  }

  function ApplyRow({ id, label, options, initial, onApply }) {
    const [v, setV] = useState(initial);
    return h('div', { className: 'inline' },
      h(T.Field, { id, label, value: v, onChange: (e) => setV(e.target.value), options }),
      h(T.Button, { onClick: () => onApply(v) }, 'Uygula'));
  }

  function ImagePanel({ act }) {
    return h(T.Panel, { title: 'Görüntü ve kayıt' },
      h(ApplyRow, { id: 'disp', label: 'Ekran kaynağı', initial: '1', onApply: (v) => act('displayMode', { mode: Number(v) }),
        options: [{ value: '1', label: 'Görünür ışık 1' }, { value: '2', label: 'Görünür ışık 2' }, { value: '0', label: 'Kızılötesi 1' }, { value: '3', label: 'Kızılötesi 2' }] }),
      h(ApplyRow, { id: 'br', label: 'Bit hızı (live/0)', initial: '4', onApply: (v) => act('bitrate', { level: Number(v), stream: 1 }),
        options: ['400', '512', '1024', '1536', '2048', '2560', '3072', '3584', '4096'].map((k, i) => ({ value: String(i), label: `${k} kbps` + (i === 4 ? ' (varsayılan)' : '') })) }),
      h(ApplyRow, { id: 'pres', label: 'Fotoğraf çözünürlüğü', initial: '1', onApply: (v) => act('photoResolution', { res: Number(v) }),
        options: [{ value: '1', label: '1920×1080' }, { value: '2', label: '4K' }, { value: '3', label: '8K' }] }),
      h(ApplyRow, { id: 'vres', label: 'Video çözünürlüğü', initial: '1', onApply: (v) => act('videoResolution', { res: Number(v) }),
        options: [{ value: '1', label: '1920×1080' }, { value: '2', label: '4K' }] }),
      h(ApplyRow, { id: 'tpl', label: 'Takip şablonu', initial: '2', onApply: (v) => act('trackTemplate', { size: Number(v), w: 0, h: 0 }),
        options: [{ value: '1', label: 'Küçük (16×16)' }, { value: '2', label: 'Orta (32×32)' }, { value: '3', label: 'Büyük (64×64)' }, { value: '4', label: 'Çok büyük (128×128)' }] }));
  }

  function DevicePanel({ send, confirm }) {
    const [newIp, setNewIp] = useState('192.168.144.108');
    const [angle, setAngle] = useState('30');
    const json = (obj) => send({ t: 'json', obj });
    return h(T.Panel, { title: 'Cihaz ağı ve kodlama' },
      h('div', { className: 'btn-row' },
        h(T.Button, { onClick: () => json({ sh: 'ifconfig' }) }, 'IP adresini sorgula'),
        h(T.Button, { onClick: () => json({ getEd: '' }) }, 'Kodlamayı sorgula')),
      h('div', { className: 'inline' },
        h(T.IpField, { id: 'new-ip', label: 'Yeni cihaz IP', value: newIp, onChange: setNewIp }),
        h(T.Button, {
          variant: 'danger', onClick: () => confirm({
            title: 'Cihaz IP adresini değiştir', confirmLabel: 'IP adresini değiştir', destructive: true,
            body: `Cihazın IP adresi ${newIp} olacak. Bağlantı kopar; bilgisayarı aynı ağa alıp Bağlantı ayarlarında yeni adresi girmeniz gerekir.`,
            onConfirm: () => json({ setip: newIp })
          })
        }, 'Değiştir')),
      h(ApplyRow, { id: 'enc', label: 'Video kodlaması', initial: 'H265+2M', onApply: (v) => json({ setEd: v }),
        options: ['H264+2M', 'H264+4M', 'H264+8M', 'H265+2M', 'H265+4M', 'H265+8M'].map((v) => ({ value: v, label: v.replace('+', ' · ') })) }),
      h('div', { className: 'inline' },
        h(T.Field, { id: 'sensor-angle', label: 'Montaj eğim açısı (°)', mono: true, inputMode: 'numeric', value: angle, onChange: (e) => setAngle(e.target.value.replace(/[^0-9-]/g, '')) }),
        h(T.Button, { onClick: () => json({ setSensorAngle: String(parseInt(angle, 10) || 0) }) }, 'Ayarla'),
        h(T.Button, { variant: 'ghost', onClick: () => json({ getSensorAngle: '' }) }, 'Sorgula')),
      h('hr', { className: 'divider' }),
      h('p', { className: 'subhead' }, 'AI hedef tespiti'),
      h('div', { className: 'btn-row' },
        h(T.Button, { onClick: () => json({ pausedetecor: '1' }) }, 'Tespiti duraklat'),
        h(T.Button, { onClick: () => json({ pausedetecor: '0' }) }, 'Tespiti başlat')));
  }

  function LogPanel({ log }) {
    return h(T.Panel, { title: 'Cihaz yanıtları' },
      log.length ? h('ul', { className: 'log' }, log.map((e) => h('li', { key: e.id },
        h('time', null, clock(e.at)),
        h('span', { className: 'dir-' + e.dir }, e.dir === 'out' ? 'Gönderildi' : e.dir === 'in' ? 'Yanıt' : 'Hata'),
        h('span', { className: 'msg' }, e.text))))
        : h('p', { className: 'empty' }, 'Henüz yanıt yok. Bir sorgu gönderdiğinizde burada görünür.'));
  }

  function SettingsView(ctx) {
    return h('div', { className: 'settings-grid' },
      h(ConnectionPanel, { st: ctx.st, send: ctx.send }),
      h(ImagePanel, { act: ctx.act }),
      h(DevicePanel, { send: ctx.send, confirm: ctx.confirm }),
      h(ControlPrefsPanel, { invert: ctx.invert, setInvert: ctx.setInvert }),
      h(LogPanel, { log: ctx.st.log }));
  }

  // ---------- Kalibrasyon ----------
  function CalibrationView({ st, act, confirm }) {
    const s2 = st.fb && st.fb.status2;
    const step = (title, body, args, extra) => confirm({ title, body, confirmLabel: title, onConfirm: () => act('calibrate', args), ...extra });
    return h('div', { className: 'settings-grid' },
      h(T.Panel, { title: 'Servo kalibrasyonu' },
        h('p', { className: 'warn-text' }, 'Kalibrasyon sırasında gimbali hareket ettirmeyin ve gücünü kesmeyin. Cihaz düz, sabit bir yüzeyde olmalı.'),
        s2 ? h('div', { className: 'chips' },
          s2.calPrepare ? h(T.StatusChip, { tone: 'busy' }, 'Ön hazırlık yapıldı') : null,
          s2.calRunning ? h(T.StatusChip, { tone: 'busy' }, 'Kalibrasyon sürüyor') : null,
          s2.calDone ? h(T.StatusChip, { tone: 'ok' }, 'Kalibrasyon tamamlandı') : null,
          s2.calSaved ? h(T.StatusChip, { tone: 'ok' }, 'Kaydedildi') : null,
          s2.calRestored ? h(T.StatusChip, { tone: 'warn' }, 'Önceki duruma dönüldü') : null,
          !(s2.calPrepare || s2.calRunning || s2.calDone || s2.calSaved || s2.calRestored) ? h(T.StatusChip, null, 'Bekliyor') : null) : null,
        h('p', { className: 'subhead' }, '1. Hazırlık'),
        h(T.Button, { onClick: () => step('Ön hazırlığı başlat', 'Gimbal kalibrasyona hazırlanacak.', { step: 1 }) }, 'Ön hazırlığı başlat'),
        h('p', { className: 'subhead' }, '2. Kalibrasyon'),
        h('div', { className: 'btn-grid' },
          h(T.Button, { onClick: () => step('İvmeölçer kalibrasyonu', 'İvmeölçer kalibre edilecek ve sıfır noktası kaydedilecek.', { step: 2, mode: 1 }) }, 'İvmeölçer'),
          h(T.Button, { onClick: () => step('Jiroskop kalibrasyonu', 'Jiroskop kalibre edilecek; sıfır noktası kaydedilmez. Bitince cihazı kapatıp açarak deneyin.', { step: 2, mode: 2 }) }, 'Jiroskop'),
          h(T.Button, { onClick: () => step('Sıfır noktasını ayarla', 'Gimbalin şu anki konumu sıfır noktası olarak kaydedilecek.', { step: 2, mode: 3 }) }, 'Sıfır noktası')),
        h('p', { className: 'subhead' }, 'Geri alma'),
        h(T.Button, {
          variant: 'danger', onClick: () => step('Kalibrasyon öncesine dön', 'Tüm kalibrasyon sonuçları silinip önceki duruma dönülecek.', { step: 0x0a }, { destructive: true })
        }, 'Kalibrasyon öncesine dön')),
      h(T.Panel, { title: 'Kızılötesi telafi' },
        h('p', { className: 'hint' }, 'Termal görüntüde bant veya leke oluşursa telafi uygulayın. Perde telafisi kısa bir tıklama sesiyle görüntüyü bir an dondurur.'),
        h('div', { className: 'btn-row' },
          h(T.Button, { onClick: () => act('shutterCompensation') }, 'Perde telafisi'),
          h(T.Button, { onClick: () => act('sceneCompensation') }, 'Sahne telafisi'))));
  }

  // ---------- Katmanlar ----------
  function ConfirmLayer({ d, close }) {
    useEffect(() => {
      if (!d) return undefined;
      const prev = document.activeElement;
      const key = (e) => { if (e.key === 'Escape') close(); };
      window.addEventListener('keydown', key);
      setTimeout(() => { const b = document.querySelector('.app-overlay .tl-dialog-actions .tl-btn:last-child'); if (b) b.focus(); }, 0);
      return () => { window.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
    }, [d]);
    if (!d) return null;
    return h('div', { className: 'app-overlay', onClick: (e) => { if (e.target === e.currentTarget) close(); } },
      h(T.Dialog, {
        kind: 'question', title: d.title, confirmLabel: d.confirmLabel, destructive: d.destructive, modal: true,
        onCancel: close, onConfirm: () => { close(); d.onConfirm(); }
      }, h('p', null, d.body)));
  }

  function Toast({ toast, dismiss }) {
    useEffect(() => { if (!toast) return undefined; const t = setTimeout(dismiss, 4500); return () => clearTimeout(t); }, [toast]);
    if (!toast) return null;
    return h('div', { className: 'toast toast-' + toast.tone, role: toast.tone === 'danger' ? 'alert' : 'status' }, toast.text);
  }

  // ---------- Uygulama ----------
  function App() {
    const [st, send, dismiss] = useBridge();
    const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
    const [tab, setTab] = usePersisted('tab', 'control');
    const [dialog, setDialog] = useState(null);
    const [invert, setInvert] = usePersisted('joyInvert', { yaw: false, pitch: false });
    useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('theme', theme); } catch (_) {} }, [theme]);

    const act = useCallback((name, args) => send({ t: 'action', name, args }), [send]);
    const ctx = { st, send, act, confirm: setDialog, invert, setInvert };
    const cam = st.hello && st.hello.camera;

    let conn;
    if (!st.ws) conn = h(T.StatusChip, { tone: 'danger' }, 'Sunucuya bağlanılamıyor');
    else if (st.connected) conn = h(T.StatusChip, { tone: 'ok' }, `Bağlı · ${cam ? cam.ip : ''}`);
    else conn = h(T.StatusChip, { tone: 'warn' }, `Cihaz yanıt vermiyor · ${cam ? cam.ip : ''}`);

    return h('div', { className: 'app' },
      h('header', { className: 'app-head' },
        h('div', { className: 'app-brand' }, h('h1', null, 'aicamera'), h('span', { className: 'app-model' }, 'CPDD075CCT')),
        h('div', { className: 'app-chips' },
          st.hello && st.hello.sim ? h(T.StatusChip, { tone: 'busy' }, 'Simülatör') : null,
          st.fb && st.fb.status.recording ? h(T.StatusChip, { tone: 'record' }, 'Kaydediliyor') : null,
          conn,
          h(T.Button, { variant: 'ghost', size: 'sm', onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark') }, theme === 'dark' ? 'Açık tema' : 'Koyu tema'))),
      h('main', { className: 'app-body' },
        h(T.Tabs, {
          value: tab, onChange: setTab,
          tabs: [
            { id: 'control', label: 'Kontrol', content: h(ControlView, ctx) },
            { id: 'settings', label: 'Ayarlar', content: h(SettingsView, ctx) },
            { id: 'calibration', label: 'Kalibrasyon', content: h(CalibrationView, ctx) }
          ]
        })),
      h(ConfirmLayer, { d: dialog, close: () => setDialog(null) }),
      h(Toast, { toast: st.toast, dismiss }));
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
