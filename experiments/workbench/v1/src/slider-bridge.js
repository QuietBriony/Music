// The pinned REPL identifies live slider signals by the numeric literal's
// position at evaluation, not by the order of currently rendered DOM widgets.
export function sliderDeclarations(code) {
  const pattern = /^[\t ]*const\s+([A-Za-z_$][\w$]*)\s*=\s*slider\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/gm;
  return [...code.matchAll(pattern)].map((match) => {
    const from = match.index + match[0].indexOf('slider(') + match[0].slice(match[0].indexOf('slider(')).indexOf(match[2]);
    return { name: match[1], from, to: from + match[2].length, value: match[2],
      min: Number(match[3]), max: Number(match[4]), step: Number(match[5]), type: 'slider' };
  });
}

// Faders edit only one numeric literal. They remain usable after hand edits to
// the musical body, without granting the pattern generator permission to rewrite it.
export function sliderSettings(code, names) {
  const declarations = sliderDeclarations(code);
  return new Map(names.flatMap(name => {
    const matches = declarations.filter(item => item.name === name);
    if (matches.length !== 1) return [];
    const item = matches[0];
    if (![Number(item.value), item.min, item.max, item.step].every(Number.isFinite)
      || item.min > item.max || item.step <= 0) return [];
    return [[name, item]];
  }));
}

export function sliderChange(code, name, input) {
  const item = sliderSettings(code, [name]).get(name);
  if (!item) throw new Error('このフェーダーの接続を確認できません');
  const value = Number(input);
  if (!Number.isFinite(value)) throw new Error('フェーダーの値が不正です');
  const clamped = Math.max(item.min, Math.min(item.max, value));
  const next = Math.max(item.min, Math.min(item.max,
    Number((item.min + Math.round((clamped - item.min) / item.step) * item.step).toFixed(6))));
  return { ...item, value: next, insert: String(next) };
}

export class SliderBridge {
  constructor(getMirror, api, onChange = () => {}) {
    this.getMirror = getMirror;
    this.api = api;
    this.onChange = onChange;
    this.widgets = null;
    this.bindings = [];
    this.ids = new Map();
  }

  capture() {
    const mirror = this.getMirror();
    if (!mirror || mirror.widgets === this.widgets) return;
    this.widgets = mirror.widgets;
    const declarations = sliderDeclarations(mirror.code);
    this.bindings = declarations.map((item) => ({ ...item,
      id: mirror.widgets?.some((w) => w.type === 'slider' && w.from === item.from) ? 'slider_' + item.from : null,
    }));
    this.ids = new Map(this.bindings.filter((item) => item.id).map((item) => [item.id, item.id]));
  }

  refresh() {
    const mirror = this.getMirror();
    const current = sliderDeclarations(mirror.code);
    // Structural edits are evaluated through the normal Run path. Rebuilding
    // decorations here only maps the already registered signals to new offsets.
    if (current.length !== this.bindings.length || current.some((item, i) => item.name !== this.bindings[i].name)) return;
    // A custom score may also have visual widgets or anonymous sliders. Keep
    // their existing decorations instead of replacing them with a slider-only set.
    if (!mirror.widgets?.every(w => w.type === 'slider' && this.ids.has('slider_' + w.from))) {
      this.api.decorate?.();
      return;
    }
    this.api.updateWidgets(mirror.editor, current);
    this.api.decorate?.();
  }

  decorateNative(sliders) {
    this.capture();
    const current = sliderDeclarations(this.getMirror()?.code || '');
    if (current.length !== this.bindings.length || current.some((item, i) => item.name !== this.bindings[i].name)) return;
    const offsets = new Map(current.map((item, i) => [item.from, {item, binding:this.bindings[i]}]));
    for (const slider of sliders) {
      const setting = offsets.get(slider.from);
      if (!setting?.binding.id) continue;
      // A newly mounted inline widget must keep the running signal's original
      // ID, even when previous numeric edits changed the document offsets.
      slider.originalFrom = Number(setting.binding.id.slice(7));
      slider.originalValue = setting.item.value;
      slider.value = setting.item.value;
    }
  }

  set(name, input, playing) {
    const mirror = this.getMirror();
    const change = sliderChange(mirror.code, name, input);
    this.capture();
    const binding = this.bindings.find((item) => item.name === name);
    if (playing && !binding?.id) throw new Error('演奏の準備中です。少し待ってもう一度動かしてください');
    mirror.editor.dispatch({ changes: { from: change.from, to: change.to, insert: change.insert } });
    if (playing) this.api.setSignal(binding.id, change.value);
    this.refresh();
    this.onChange();
    return change.value;
  }

  nativeMessage(id, value) {
    this.capture();
    const runtimeId = this.ids.get(id);
    if (!runtimeId || !Number.isFinite(value)) return;
    this.api.setSignal(runtimeId, value);
    this.refresh();
    this.onChange();
  }
}
