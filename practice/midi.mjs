// Standard MIDI File reader. Symbolic note data only; no Web MIDI / device I/O.
export const MIDI_LIMITS = { bytes: 1_048_576, tracks: 64, notes: 8192, events: 100_000 };
const fail = message => { throw new Error(`MIDIを読み込めません：${message}`); };
export function parseMidi(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
  if (!bytes || bytes.length < 14 || bytes.length > MIDI_LIMITS.bytes) fail('1 MB以下の.midファイルを選んでください。');
  let p = 0, end = bytes.length, events = 0, noteCount = 0;
  const need = n => { if (n < 0 || p + n > end) fail('データが途中で切れています。'); };
  const u8 = () => { need(1); return bytes[p++]; };
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => u8() * 0x1000000 + (u8() << 16) + (u8() << 8) + u8();
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
  const vlq = () => { let value = 0; for (let i = 0; i < 4; i++) { const b = u8(); value = value * 128 + (b & 127); if (!(b & 128)) return value; } fail('時刻の数値が長すぎます。'); };
  const text = arr => new TextDecoder().decode(arr.subarray(0, 200)).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
  if (tag() !== 'MThd') fail('Standard MIDI Fileではありません。');
  const headerSize = u32(); if (headerSize < 6 || headerSize > 1024) fail('ヘッダーが不正です。');
  need(headerSize);
  const format = u16(), count = u16(), ppq = u16();
  if (format > 1 || !count || count > MIDI_LIMITS.tracks || (format === 0 && count !== 1)) fail('SMF形式0または1、64トラック以下に対応しています。');
  if (!ppq || (ppq & 0x8000)) fail('SMPTE時間形式には対応していません。PPQ形式で書き出してください。');
  p += headerSize - 6;
  const tempos = [{ tick: 0, mpqn: 500000 }], groups = [], markers = [], warnings = new Set();
  let lastTick = 0, timeSignature = [4, 4];
  for (let track = 0; track < count; track++) {
    end = bytes.length;
    if (tag() !== 'MTrk') fail('トラックの形式が不正です。');
    const size = u32(); need(size); const trackEnd = p + size; end = trackEnd;
    let tick = 0, running = 0, trackName = `トラック ${track + 1}`, ended = false;
    const channels = new Map(), active = new Map();
    const group = channel => { if (!channels.has(channel)) channels.set(channel, { id: `${track}:${channel}`, track, channel, name: trackName, notes: [], percussion: channel === 9 }); return channels.get(channel); };
    while (p < end) {
      if (++events > MIDI_LIMITS.events) fail('イベント数が多すぎます。短い区間を書き出してください。');
      tick += vlq(); if (tick > 0x7fffffff) fail('曲の長さが上限を超えています。');
      lastTick = Math.max(lastTick, tick);
      let status = u8();
      if (status < 0x80) { if (!running) fail('実行状態の情報が欠けています。'); p--; status = running; }
      if (status === 0xff) {
        const type = u8(), length = vlq(); need(length); const start = p; p += length;
        if (type === 0x03) { trackName = text(bytes.subarray(start, p)) || trackName; for (const g of channels.values()) g.name = trackName; }
        if (type === 0x51) {
          if (length !== 3) fail('テンポの情報が不正です。');
          const mpqn = bytes[start] * 65536 + bytes[start + 1] * 256 + bytes[start + 2];
          if (mpqn < 10000 || mpqn > 60000000) fail('テンポが対応範囲を超えています。');
          tempos.push({ tick, mpqn });
        }
        if (type === 0x58 && length >= 2 && tick === 0 && bytes[start] > 0 && bytes[start + 1] <= 6) timeSignature = [bytes[start], 2 ** bytes[start + 1]];
        if (type === 0x06) { const value = text(bytes.subarray(start, p)); if (/^chord:[A-G]/.test(value)) markers.push({ tick, chord: value.slice(6).trim() }); }
        if (type === 0x2f) { if (length !== 0) fail('トラックの終端が不正です。'); ended = true; break; }
        continue;
      }
      if (status === 0xf0 || status === 0xf7) { running = 0; const length = vlq(); need(length); p += length; continue; }
      if (status < 0x80 || status >= 0xf0) fail('未対応のシステムイベントが含まれます。');
      running = status;
      const kind = status >> 4, channel = status & 15;
      const a = u8(), b = kind === 0xc || kind === 0xd ? 0 : u8();
      if (a > 127 || b > 127) fail('音符の値が不正です。');
      if (kind === 0xe) warnings.add('ピッチベンドは譜面に反映しません。');
      if (kind !== 0x8 && kind !== 0x9) continue;
      const key = `${channel}:${a}`;
      if (kind === 0x9 && b > 0) {
        if (++noteCount > MIDI_LIMITS.notes) fail('音符数が多すぎます。短い区間を書き出してください。');
        if (!active.has(key)) active.set(key, []);
        active.get(key).push({ midi: a, tick, velocity: b / 127 });
      } else {
        const queue = active.get(key);
        if (!queue?.length) continue;
        const note = queue.shift();
        if (tick > note.tick) group(channel).notes.push({ ...note, durationTicks: tick - note.tick });
      }
    }
    if (!ended) fail('トラックの終端がありません。');
    for (const [key, queue] of active) if (!key.startsWith('9:') && queue.length) fail('音符の終了が欠けています。');
    for (const g of channels.values()) if (g.notes.length) { g.notes.sort((a, b) => a.tick - b.tick || b.midi - a.midi); groups.push(g); }
    p = trackEnd; end = bytes.length;
  }
  if (!groups.some(g => !g.percussion)) fail('旋律を持つトラックがありません。');
  const byTick = new Map(); for (const tempo of tempos.sort((a, b) => a.tick - b.tick)) byTick.set(tempo.tick, tempo);
  const tempoMap = [...byTick.values()];
  let seconds = 0;
  for (let i = 0; i < tempoMap.length; i++) {
    if (i) seconds += (tempoMap[i].tick - tempoMap[i - 1].tick) / ppq * tempoMap[i - 1].mpqn / 1e6;
    tempoMap[i].seconds = seconds;
  }
  function secondsAt(tick) {
    let low = 0, high = tempoMap.length - 1;
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (tempoMap[middle].tick <= tick) low = middle; else high = middle - 1; }
    const tempo = tempoMap[low]; return tempo.seconds + (tick - tempo.tick) / ppq * tempo.mpqn / 1e6;
  }
  for (const g of groups) for (const n of g.notes) {
    n.beat = n.tick / ppq; n.beats = n.durationTicks / ppq;
    n.time = secondsAt(n.tick); n.duration = secondsAt(n.tick + n.durationTicks) - n.time;
  }
  return { format, ppq, groups, tempos: tempoMap, markers, timeSignature, endBeat: lastTick / ppq, secondsAt, warnings: [...warnings] };
}

export function melodyNotes(midi, groupId, highVoice = false) {
  const group = midi.groups.find(item => item.id === groupId && !item.percussion);
  if (!group) fail('旋律のトラックを選んでください。');
  let source = group.notes;
  if (highVoice) {
    const highest = new Map();
    for (const note of source) if (!highest.has(note.tick) || highest.get(note.tick).midi < note.midi) highest.set(note.tick, note);
    source = [...highest.values()];
  }
  if (source.length > 512) fail('練習は512音までです。短い区間を書き出してください。');
  return source.map((note, i) => {
    const next = source[i + 1];
    if (!highVoice && next && note.tick + note.durationTicks > next.tick + midi.ppq / 32) fail('和音が含まれています。「高い音を旋律として読む」を選ぶか、単音トラックを選んでください。');
    const endTick = next ? Math.min(note.tick + note.durationTicks, next.tick) : note.tick + note.durationTicks;
    return { ...note, beats: (endTick - note.tick) / midi.ppq, duration: midi.secondsAt(endTick) - note.time, stepSeconds: next ? next.time - note.time : midi.secondsAt(endTick) - note.time, stepBeats: next ? next.beat - note.beat : note.beats };
  });
}

export async function fetchMidi(url, { signal } = {}) {
  const target = new URL(url, location.href);
  if (target.username || target.password || (target.protocol !== 'https:' && target.origin !== location.origin)) fail('HTTPSのMIDIファイルURLを指定してください。');
  const response = await fetch(target, { signal, credentials: 'omit', cache: 'no-store' });
  if (!response.ok) fail(`取得できませんでした（${response.status}）。ファイルからも読み込めます。`);
  if (Number(response.headers.get('content-length')) > MIDI_LIMITS.bytes) fail('1 MB以下のMIDIを選んでください。');
  const reader = response.body?.getReader();
  if (!reader) { const data = await response.arrayBuffer(); if (data.byteLength > MIDI_LIMITS.bytes) fail('ファイルが大きすぎます。'); return data; }
  const chunks = []; let length = 0;
  try {
    while (true) { const result = await reader.read(); if (result.done) break; length += result.value.length; if (length > MIDI_LIMITS.bytes) fail('ファイルが大きすぎます。'); chunks.push(result.value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const data = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return data.buffer;
}
