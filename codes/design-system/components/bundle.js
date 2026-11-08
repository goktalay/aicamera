/* @ds-bundle: {"format":4,"namespace":"Tracklight","components":[{"name":"Button"},{"name":"ControlButton"},{"name":"DirPad"},{"name":"StatusChip"},{"name":"Readout"},{"name":"ProgressBar"},{"name":"Field"},{"name":"IpField"},{"name":"Panel"},{"name":"Tabs"},{"name":"Dialog"},{"name":"VideoPane"},{"name":"Icon"}]} */
(function () {
  var R = window.React, h = R.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }

  var PATHS = {
    photo: 'M4 8h3l2-2h6l2 2h3v11H4z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    record: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
    stop: 'M7 7h10v10H7z',
    pip: 'M3 5h18v14H3z M12 12h7v5h-7z',
    sbs: 'M3 6h8v12H3z M13 6h8v12h-8z',
    swap: 'M4 9h14l-3-3 M20 15H6l3 3',
    track: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5 M12 10v4 M10 12h4',
    laser: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    zoomIn: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M20 20l-4.5-4.5 M8 11h6 M11 8v6',
    zoomOut: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M20 20l-4.5-4.5 M8 11h6',
    focus: 'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    center: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    thermal: 'M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z M12 11v6',
    up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6',
    ok: 'M5 12.5l4.5 4.5L19 7.5',
    info: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 11v5 M12 8v.01',
    error: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v5 M12 16v.01',
    question: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.4 M12 16.2v.01'
  };
  var FILLED = { record: 1 };

  function Icon(p) {
    var d = PATHS[p.name]; if (!d) return null;
    var s = p.size || 20, filled = FILLED[p.name];
    return h('svg', { className: cx('tl-icon', p.className), viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': 'true',
      fill: filled ? 'currentColor' : 'none', stroke: filled ? 'none' : 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: d }));
  }

  function Button(p) {
    var v = p.variant || 'default';
    return h('button', Object.assign({ type: 'button' }, omit(p, ['variant', 'size', 'icon', 'className', 'children']), {
      className: cx('tl-btn', 'tl-btn-' + v, p.size === 'sm' && 'tl-btn-sm', p.className) }),
      p.icon ? h(Icon, { name: p.icon, size: p.size === 'sm' ? 16 : 18 }) : null, p.children);
  }

  function ControlButton(p) {
    var st = R.useState(!!p.defaultPressed), controlled = p.pressed !== undefined;
    var on = controlled ? p.pressed : st[0];
    function click(e) { if (!controlled) st[1](!on); if (p.onPressedChange) p.onPressedChange(!on); if (p.onClick) p.onClick(e); }
    return h('button', { type: 'button', className: cx('tl-ctl', on && 'is-on', p.tone === 'record' && 'tl-ctl-record', p.className),
      'aria-pressed': on, disabled: p.disabled, onClick: click, title: p.label },
      h(Icon, { name: on && p.pressedIcon ? p.pressedIcon : p.icon, size: 22 }),
      h('span', { className: 'tl-ctl-label' }, on && p.pressedLabel ? p.pressedLabel : p.label));
  }

  function DirPad(p) {
    function b(dir, icon, label) {
      return h('button', { type: 'button', className: cx('tl-pad-btn', 'tl-pad-' + dir), 'aria-label': label,
        onPointerDown: function () { if (p.onMove) p.onMove(dir); }, onPointerUp: function () { if (p.onStop) p.onStop(dir); },
        onPointerLeave: function () { if (p.onStop) p.onStop(dir); } }, h(Icon, { name: icon, size: 20 }));
    }
    return h('div', { className: cx('tl-pad', p.className), role: 'group', 'aria-label': p.label || 'Gimbal yönü' },
      b('up', 'up', 'Yukarı'), b('left', 'left', 'Sola'),
      h('button', { type: 'button', className: 'tl-pad-btn tl-pad-center', 'aria-label': 'Merkeze al', onClick: function () { if (p.onCenter) p.onCenter(); } }, h(Icon, { name: 'center', size: 20 })),
      b('right', 'right', 'Sağa'), b('down', 'down', 'Aşağı'));
  }

  function StatusChip(p) {
    var t = p.tone || 'idle';
    return h('span', { className: cx('tl-chip', 'tl-chip-' + t, p.className), role: 'status' },
      h('span', { className: 'tl-chip-dot', 'aria-hidden': 'true' }), p.children);
  }

  function Readout(p) {
    return h('div', { className: cx('tl-readout', p.tone && 'tl-readout-' + p.tone, p.size === 'sm' && 'tl-readout-sm', p.className) },
      h('span', { className: 'tl-readout-label' }, p.label),
      h('span', { className: 'tl-readout-value' }, p.value, p.unit ? h('span', { className: 'tl-readout-unit' }, p.unit) : null));
  }

  function ProgressBar(p) {
    var v = Math.max(0, Math.min(100, p.value || 0)), t = p.tone || 'accent';
    return h('div', { className: cx('tl-progress', 'tl-progress-' + t, p.className) },
      h('div', { className: 'tl-progress-head' }, h('span', null, p.label), h('span', { className: 'tl-progress-pct' }, Math.round(v) + '%')),
      h('div', { className: 'tl-progress-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v), 'aria-label': p.label },
        h('div', { className: 'tl-progress-fill', style: { width: v + '%' } })),
      p.note ? h('p', { className: 'tl-progress-note' }, p.note) : null);
  }

  function Field(p) {
    var id = p.id || ('tl-f-' + String(p.label || '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase());
    var control = p.children;
    if (!control) {
      var rest = omit(p, ['label', 'hint', 'error', 'options', 'mono', 'children', 'className', 'id']);
      control = p.options
        ? h('select', Object.assign({ id: id, className: cx('tl-input', 'tl-select', p.mono && 'tl-mono') }, rest),
            p.options.map(function (o) { var v = typeof o === 'string' ? o : o.value; return h('option', { key: v, value: v }, typeof o === 'string' ? o : o.label); }))
        : h('input', Object.assign({ id: id, className: cx('tl-input', p.mono && 'tl-mono', p.error && 'is-invalid'), 'aria-invalid': p.error ? true : undefined }, rest));
    }
    return h('div', { className: cx('tl-field', p.className) },
      h('label', { className: 'tl-field-label', htmlFor: id }, p.label), control,
      p.error ? h('span', { className: 'tl-field-error' }, p.error) : p.hint ? h('span', { className: 'tl-field-hint' }, p.hint) : null);
  }

  function IpField(p) {
    var init = String(p.defaultValue || p.value || '0.0.0.0').split('.');
    var st = R.useState(init), parts = p.value ? String(p.value).split('.') : st[0];
    var base = p.id || 'tl-ip';
    function focusAt(i) { var n = document.getElementById(base + '-' + i); if (n) n.focus(); }
    function set(i, val) {
      val = val.replace(/[^0-9]/g, '').slice(0, 3); if (val && +val > 255) val = '255';
      var next = parts.slice(); next[i] = val; if (!p.value) st[1](next); if (p.onChange) p.onChange(next.join('.'));
      if (val.length === 3 && i < 3) focusAt(i + 1);
    }
    var cells = [];
    [0, 1, 2, 3].forEach(function (i) {
      cells.push(h('input', { key: 'o' + i, id: base + '-' + i, className: 'tl-ip-octet tl-mono', inputMode: 'numeric', value: parts[i] || '',
        'aria-label': (p.label || 'IP adresi') + ' ' + (i + 1) + '. oktet', disabled: p.disabled,
        onChange: function (e) { set(i, e.target.value); },
        onKeyDown: function (e) { if (e.key === '.' && i < 3) { e.preventDefault(); focusAt(i + 1); } } }));
      if (i < 3) cells.push(h('span', { key: 'd' + i, className: 'tl-ip-dot', 'aria-hidden': 'true' }, '.'));
    });
    return h('div', { className: cx('tl-field', p.className) },
      h('span', { className: 'tl-field-label', id: base + '-lbl' }, p.label || 'IP adresi'),
      h('div', { className: 'tl-ip', role: 'group', 'aria-labelledby': base + '-lbl' }, cells),
      p.hint ? h('span', { className: 'tl-field-hint' }, p.hint) : null);
  }

  function Panel(p) {
    return h('section', { className: cx('tl-panel', p.className), 'aria-label': p.title },
      p.title || p.actions ? h('header', { className: 'tl-panel-head' }, h('h3', { className: 'tl-panel-title' }, p.title), p.actions ? h('div', { className: 'tl-panel-actions' }, p.actions) : null) : null,
      h('div', { className: 'tl-panel-body' }, p.children));
  }

  function Tabs(p) {
    var tabs = p.tabs || [], st = R.useState(p.defaultValue || (tabs[0] && tabs[0].id));
    var cur = p.value !== undefined ? p.value : st[0];
    function pick(id) { if (p.value === undefined) st[1](id); if (p.onChange) p.onChange(id); }
    function key(e, i) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length]; pick(n.id);
      var el = document.getElementById('tl-tab-' + n.id); if (el) el.focus();
    }
    var active = tabs.filter(function (t) { return t.id === cur; })[0];
    return h('div', { className: cx('tl-tabs', p.className) },
      h('div', { className: 'tl-tablist', role: 'tablist' }, tabs.map(function (t, i) {
        var on = t.id === cur;
        return h('button', { key: t.id, id: 'tl-tab-' + t.id, type: 'button', role: 'tab', 'aria-selected': on, tabIndex: on ? 0 : -1,
          className: cx('tl-tab', on && 'is-on'), onClick: function () { pick(t.id); }, onKeyDown: function (e) { key(e, i); } }, t.label);
      })),
      active && active.content !== undefined ? h('div', { className: 'tl-tabpanel', role: 'tabpanel', 'aria-labelledby': 'tl-tab-' + cur }, active.content) : null);
  }

  var DIALOG_ICON = { question: 'question', info: 'info', error: 'error', ok: 'ok' };
  function Dialog(p) {
    if (p.open === false) return null;
    var k = p.kind || 'question';
    return h('div', { className: cx('tl-dialog', 'tl-dialog-' + k, p.className), role: k === 'error' ? 'alertdialog' : 'dialog', 'aria-modal': p.modal ? true : undefined, 'aria-labelledby': 'tl-dlg-t' },
      h('div', { className: 'tl-dialog-bar' }, h('span', { id: 'tl-dlg-t', className: 'tl-dialog-title' }, p.title),
        p.onCancel ? h('button', { type: 'button', className: 'tl-dialog-x', 'aria-label': 'Kapat', onClick: p.onCancel }, '×') : null),
      h('div', { className: 'tl-dialog-body' }, h('span', { className: 'tl-dialog-icon' }, h(Icon, { name: DIALOG_ICON[k], size: 28 })), h('div', { className: 'tl-dialog-msg' }, p.children)),
      h('div', { className: 'tl-dialog-actions' },
        k === 'question' ? h(Button, { onClick: p.onCancel }, p.cancelLabel || 'Vazgeç') : null,
        h(Button, { variant: p.destructive ? 'danger' : 'primary', onClick: p.onConfirm }, p.confirmLabel || 'Tamam')));
  }

  function VideoPane(p) {
    var src = p.source || 'TV', t = p.track;
    return h('figure', { className: cx('tl-video', p.className) },
      h('div', { className: 'tl-video-frame' },
        p.children || h('div', { className: 'tl-video-empty' }, p.emptyText || 'Görüntü yok'),
        h('div', { className: 'tl-hud' },
          h('span', { className: cx('tl-hud-tag', 'tl-hud-src', src === 'IR' && 'is-ir') }, src === 'IR' ? 'IR · ' + (p.palette || 'Beyaz sıcak') : 'TV · ' + (p.zoom || '1.0×')),
          p.recording ? h('span', { className: 'tl-hud-tag tl-hud-rec' }, h('span', { className: 'tl-hud-recdot' }), 'REC ' + (p.recTime || '00:00:00')) : null,
          p.crosshair !== false ? h('span', { className: 'tl-hud-cross', 'aria-hidden': 'true' }) : null,
          t ? h('span', { className: 'tl-hud-track', style: { left: t.x + '%', top: t.y + '%', width: t.w + '%', height: t.h + '%' } },
            t.label ? h('span', { className: 'tl-hud-track-label' }, t.label) : null) : null,
          p.readouts ? h('div', { className: 'tl-hud-readouts' }, p.readouts.map(function (r, i) { return h('span', { key: i, className: 'tl-hud-tag' }, r); })) : null)),
      p.caption ? h('figcaption', { className: 'tl-video-caption' }, p.caption) : null);
  }

  window.Tracklight = Object.assign(window.Tracklight || {}, {
    Button: Button, ControlButton: ControlButton, DirPad: DirPad, StatusChip: StatusChip, Readout: Readout, ProgressBar: ProgressBar,
    Field: Field, IpField: IpField, Panel: Panel, Tabs: Tabs, Dialog: Dialog, VideoPane: VideoPane, Icon: Icon, iconNames: Object.keys(PATHS)
  });
})();
