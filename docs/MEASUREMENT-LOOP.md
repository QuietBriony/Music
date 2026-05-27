# Band Room — Measurement Loop

How to ground AI 再現 tuning in **real measured numbers** instead of
qualitative ear feedback ("グルーブない" → "kick avg +18 ms vs Tabasco -3 ms").

This is the workflow that v264 (`-10 ms` cramps-punk bass push) was
derived from. Same workflow scales to any band and any future agent
tweak.

---

## Who can run this loop

| ステップ | human | Codex CLI | Claude Code |
|---|---|---|---|
| `analyze-band-stems.py` | ✅ | ✅ | ✅ |
| band-room.js の音色 / EQ / timing 改修 | ✅ | ✅ | ✅ |
| ship 一式（branch / gate / PR / merge）| ✅ | ✅ | ✅ |
| **● REC で .wav を取る** | ✅ | ❌ tool 無し | ✅ (recipe §4) |
| `compare-capture.py <wav>` で数値 diff | ✅ | ✅ | ✅ |
| diff 解釈 → 次の hypothesis | ✅ | ✅ | ✅ |

要点:
- **codex** で完結させるなら capture は **人が実機で ● REC** → wav を
  repo の何処か（commit はしない、`captures/` 等の gitignore 配下）に
  落として codex に path を渡す
- **Claude Code** はさらに preview MCP で **無人 capture** まで自動化
  可能（§4）。preview MCP / Claude in Chrome は codex には無い tool
  なので、autonomous capture は Claude Code 専用

---

## Pieces

| What | Path | Purpose |
|---|---|---|
| Reference spec extractor | `scripts/analyze-band-stems.py` | Reads real stems from `presets/<band>-stems/<song>/`, writes per-song target spec |
| Target spec | `docs/target-spec-bands.json` | BPM / drum onsets / kick pocket / bass→kick lock % per song |
| Live capture | `band-room.html` ● REC button (v81) | Records the post-limiter mix to a `.webm` file |
| Capture analyser | `scripts/compare-capture.py` | Analyses a capture, prints diff vs target |

---

## 1. Generate / refresh the target spec

```powershell
python -X utf8 scripts/analyze-band-stems.py
```

Auto-discovers bands from `presets/bands.json` (both `bands` and
`reference_libraries`), processes every song that has `drums.mp3` +
`bass.mp3`. Writes `docs/target-spec-bands.json`.

Restrict scope:

```powershell
python -X utf8 scripts/analyze-band-stems.py tabasco
python -X utf8 scripts/analyze-band-stems.py tabasco/human-fly
```

---

## 2. Capture an AI 再現 take

1. Open the live site (or local server): https://quietbriony.github.io/Music/band-room.html
2. Switch to **AI 再現** mode.
3. Pick the target song (e.g. *Human Fly*).
4. Click **● REC** in the recording panel.
5. Let it play **≥ 30 s** (more = more stable measurement).
6. Click **■ STOP REC**, then **↓ download** the auto-named file:
   `band-room_<band>_<song>_<timestamp>.wav` (v272 — was `.webm`, now
   re-encoded to PCM 16-bit so librosa can read it directly).

---

## 3. Compare the capture to target

```powershell
python -X utf8 scripts/compare-capture.py path\to\rec.webm tabasco/human-fly
```

Output:

```
Analysing capture: rec.webm
  duration       : 35.42s
  bpm            : 117.45
  kick onsets    : 84
  kick pocket avg: +12.3 ms (std 95.6ms)

Target: tabasco/human-fly
  bpm            : 117.45
  kick pocket avg: +30.8 ms

Diff (AI - target):
  bpm            : +0.0 BPM
  kick pocket avg: -18.5 ms

  BPM match     : OK
  Pocket within 15ms: OFF
```

→ Decision: the AI's kick is 18.5 ms ahead of Tabasco's typical pocket.
If you want it closer, tweak v264's `BASS_PUSH_BY_PROFILE["cramps-punk"]`
(less negative = less push) or adjust the v247 reinforcement timing.

`band_id` (e.g. `tabasco`) averages across all songs in that band;
`band_id/song_id` (e.g. `tabasco/human-fly`) is per-song.

---

## 4. Autonomous capture recipe (Claude Code 専用)

無人で「ship → 計測 → 解釈 → 次 ship」を回したい時の recipe。codex
には preview MCP が無いので使えない。Claude Code session で 2026-05-25
の v270-v276 calibration を回した時に確立した手順。

### 必要な MCP tool

- `mcp__Claude_Preview__preview_start` — band-room.html を chromium で開く
- `mcp__Claude_Preview__preview_eval` — page 内で JS 実行
- `mcp__Claude_Preview__preview_inspect`（任意）— DOM 確認

### 手順 (v286+ DOM, 2026-05-27 update)

```
1. preview_start({ name: "music-static" })  # .claude/launch.json の config 使う
   その後 preview_eval で `window.location.href = 'http://localhost:8130/band-room.html'`。

2. SW cache が古い version を返すことがあるので、初回はクリア:
   preview_eval({
     expression: `(async () => {
       if ('serviceWorker' in navigator) {
         for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
       }
       if ('caches' in window) {
         for (const n of await caches.keys()) await caches.delete(n);
       }
       return 'cleared';
     })()`
   })
   その後 `location.reload()` で fresh fetch。

3. ~5 秒待って instruments load 完了。preview_eval で確認:
   preview_eval({
     expression: `({
       ready: document.readyState,
       version: window.BandRoomTestHooks?.BANDROOM_APP_VERSION,
       hasTone: typeof window.Tone !== 'undefined'
     })`
   })
   期待する br-NN が返ってくれば OK。

4. 曲選択 + AI 再現 mode 切替（mode radio は hidden 0×0、song は button）:
   preview_eval({
     expression: `(() => {
       Array.from(document.querySelectorAll('button[data-song]'))
         .find(b => b.dataset.song === 'human-fly')?.click();
       document.querySelector('input[name="br-mode"][value="synth"]').click();
       return {
         mode: document.querySelector('input[name="br-mode"]:checked').value,
         song: document.querySelector('button[data-song].active')?.dataset.song
       };
     })()`
   })
   ※ v286+ で mode value は "ai" → "synth"、song select は <select> → button[data-song] に変わってる。

5. START（audio context unlock は同 task 内で発火させる）:
   preview_eval({ expression: `document.getElementById('br-play').click(); 'started'` })
   ※ v286+ で ID は br-start-stop → br-play。

6. ~3-4 秒待って drum loop が安定したのを確認:
   preview_eval({
     expression: `({
       meter: document.getElementById('br-meter-fill').style.width,
       state: document.getElementById('br-play').dataset?.state,
       text: document.getElementById('br-play').textContent.trim()
     })`
   })
   meter が非 0% で state="playing", text="STOP" なら鳴ってる。

7. ● REC（toggle ボタン1つに統合された）:
   preview_eval({ expression: `document.getElementById('br-rec-toggle').click(); 'rec-on'` })
   ※ v286+ で br-rec-start / br-rec-stop は br-rec-toggle 一本に統合。

8. 10-12 秒待つ。AI 再現 playback は main thread を重くするので
   preview_eval は 30 秒以上の sleep を返さない（timeout）。短い録音
   推奨。
   - 短くした分、後で複数 capture を平均すると良い
   - 19.8 秒で 3.8 MB の WAV になった実績あり (v286 capture)

9. ■ STOP REC（同じ toggle ボタン押すと止まる）:
   preview_eval({ expression: `document.getElementById('br-rec-toggle').click(); 'rec-off'` })

10. **再生を必ず止める**（user 制約）:
    preview_eval({ expression: `document.getElementById('br-play').click(); 'stopped'` })

11. WAV blob を base64 で抜く。download link は #br-rec-download に確定保持される:
    preview_eval({
      expression: `(async () => {
        const a = document.getElementById('br-rec-download');
        if (!a?.href) return 'NO_BLOB';
        const r = await fetch(a.href);
        const buf = await r.arrayBuffer();
        const u8 = new Uint8Array(buf);
        let s = '';
        for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return { size: u8.length, b64: btoa(s) };
      })()`
    })

12. **size 制限**: preview_eval の return は ~5 MB 超で tool-result
    ファイルに自動保存される
    （`C:\Users\<user>\.claude\projects\...\tool-results\mcp-Claude_Preview-preview_eval-*.txt`）。
    structured object を返すと file は JSON で書かれる (string でない)。

13. Python で wav 復元（return が object なら json.loads、string なら strip('"')）:
    ```python
    import base64, json, pathlib
    src = pathlib.Path("tool-result.txt").read_text(encoding='utf-8')
    data = json.loads(src) if src.lstrip().startswith('{') else src.strip().strip('"')
    b64 = data['b64'] if isinstance(data, dict) else data
    pathlib.Path("captures/capture.wav").write_bytes(base64.b64decode(b64))
    ```

14. 解析:
    ```
    python -X utf8 scripts/compare-capture.py captures/capture.wav tabasco/human-fly
    ```

15. preview_stop({ serverId: ... }) で chromium 終了。次の hypothesis を
    立てて ship、繰り返し。
```

### 既知の hazard

- **30 秒以上の sleep / preview_eval は timeout** — 短く区切る
- **長い WAV (≥13 MB)** は base64 extract 中に renderer hang したことが
  ある。録音 10 秒に絞れば 1.7 MB 程度で安全
- **stop-rec の eval が timeout でも click は queue される** — 慌てて
  retry すると double-click になる、注意
- **preview_screenshot は再生中 timeout** — 再生停止後に撮る
- **WAV を repo に commit しない** — 数 MB バイナリ。.gitignore か
  `captures/`（gitignored）に置く

### 結果

- AI 再現 を「ユーザ ● REC 不要」で計測できる → 1 session で 3-4 round
  calibration が回せる
- v270 capture / v274 capture はこの recipe で取得（v275 は WAV size
  でハングして測れず、v276 は target 側を fair 化）
- v286 capture は新 DOM ID で再 capture (19.8s, 3.8 MB, hang 無し)

### この recipe が無い時の fallback (codex も含む)

- 人が実機で ● REC → wav を path で渡す（MEASUREMENT-LOOP §2）
- もしくは "ship done. user に capture 依頼" で session を一旦切る
- diff 解釈は codex でも普通にできる

---

## 5. v286 finding — EQ shelf は wrong knob (重要)

v274 (br-167 系) で「AI 再現 が暗い (rolloff 2442 Hz vs target 5264 Hz)」と
判定 → v274/v284/v286 と 3 回 makeInstrumentPolishBus の EQ3 high shelf
を弄って brightness を改善しようとした。結果:

| ship | EQ corner | webapp rolloff | target との差 |
|---|---|---|---|
| v274 (=v283 capture) | 4200 Hz | 2442 Hz | -2822 Hz |
| v286 (PR #264 capture) | 3600 Hz | 2517 Hz | **-2747 Hz** |

→ EQ corner を **600 Hz 動かしても rolloff は 75 Hz しか変化しない**。

Offline renderer (v285 ship, PR #262) でも同じ結論:
- v285 baked (3000 Hz shelf): brightness +863 Hz / rolloff +1359 Hz vs target
- v286 baked (3600 Hz shelf): brightness +875 Hz / rolloff +1409 Hz vs target

両方とも shelf を動かしても 10 Hz レベルの変化しか出ない。

### Root cause

`makeInstrumentPolishBus` の EQ3 high band は `highFrequency` 以上の帯域に
+3 dB shelf を掛ける構造。これは「上に signal がある」前提の処理。

でも AI 再現 の synth output は **元々 1-3 kHz に dominant content**、
3 kHz 以上には ほぼ signal が乗っていない。なので shelf を 4200→3000→3600
と動かしても、boost 対象が near-silence のままなので brightness が動かない。

### Implication

v274/v284/v286 は **wrong knob を動かしていた**。AI 再現 を brighten する
には EQ shelf ではなく、signal の **上流側** で高域を作る必要がある:

1. **synth waveform 変更** — sine/triangle → saw/pulse で harmonics 増やす
2. **modulation 追加** — FM/AM で sidebands を生成
3. **drum sample 選び直し** — cymbal/hat 帯が薄い可能性、kit profile 見直し
4. **exciter / harmonic enhancer** — 上流で倍音を生成する処理を post-chain
5. **target spec を fair 化** — Tabasco original mix の高域は gritty
   guitar / tape sat / vintage 由来、synth-only AI 再現 で match するのが
   そもそも非現実的かもしれない。target rolloff を 5264 Hz → 3500-4000 Hz
   に下げて「synth-fair target」にする選択肢

### Open question

webapp と offline renderer の brightness が乖離している:
- webapp v286: centroid 1422 Hz / rolloff 2517 Hz (dark)
- offline render v286: centroid 3277 Hz / rolloff 6673 Hz (bright)

renderer は song-track JSON + drum sample から render、webapp は live
Tone.js agent 出力 → 信号源そのものが違う。renderer の brightness は
drum sample の sample 自身の高域特性に引きずられている可能性が高い。

→ webapp で測る (preview MCP) と renderer で測る (offline) は別ものとして
扱う。webapp に変化を起こしたいなら webapp 側で measure。

---

## Format note (v272)

The ● REC button now downloads a **.wav** file directly (PCM 16-bit
interleaved). librosa / Audacity / any standard audio tool reads it
with no extra install — no ffmpeg needed.

Pre-v272 the download was `.webm` (opus-encoded), which required
ffmpeg on PATH to decode. v272 added a small in-browser
`AudioBuffer → WAV` encoder so the user gets an analysis-ready file
straight from the browser.

If WAV re-encode fails (very old browser or codec issue), the code
falls back to the original `.webm` and logs a console warning. In
that fallback, you'd still need ffmpeg or Audacity to convert
externally.

---

## Why this matters

v245-v262 were heuristic — "try this number, see if user likes it on
their iPhone." Round-trip was high (user listen → describe in words →
guess at fix → ship → repeat). With the measurement loop:

- v264 came from `analyze-band-stems.py` showing Tabasco bass averages
  -11.2 ms ahead of kick → ship -10 ms push, root in data not guess.
- Future rounds reference `target-spec-bands.json` numerically. "AI
  pocket is +18 ms off target" beats "AI feels rushed."

When `mcp-music-analysis` is installed, the same analysis is available
to the assistant directly via MCP — same numbers, conversational
access. The CLI scripts remain as the local fallback (no MCP needed).

---

## Extension ideas

- Add `--compare bass` to measure bass→kick lock from a capture
  (requires source separation; full-mix kick band is noisy enough to
  approximate but not strictly bass-vs-kick)
- Per-section measurements (verse vs chorus pocket drift)
- Auto-tune: script reads diff → emits suggested `BASS_PUSH_BY_PROFILE`
  delta directly in JSON, ready for hand-pasting into band-room.js
- Compare AI captures across version history (regression detection)
