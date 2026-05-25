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

### 手順

```
1. preview_start({ url: "https://quietbriony.github.io/Music/band-room.html" })
   または local file://、または npx serve.

2. ~3-5 秒待って instruments load 完了。preview_eval で
   `document.readyState` を確認するか、`window.Tone` の有無を見る。

3. AI 再現 mode に切替（hidden 0×0 radio なので preview_click 不可）:
   preview_eval({
     code: `document.querySelector('input[name="br-mode"][value="ai"]').click();`
   })

4. 曲を選択:
   preview_eval({
     code: `document.querySelector('#br-song-select').value = 'human-fly';
            document.querySelector('#br-song-select').dispatchEvent(new Event('change'));`
   })

5. START（audio context unlock は同 task 内で発火させる）:
   preview_eval({
     code: `document.getElementById('br-start-stop').click();`
   })

6. ~3 秒待って drum loop が安定したのを確認:
   preview_eval({
     code: `document.getElementById('br-meter-fill').style.width;`
   })
   非 0 % が返れば音が鳴っている（feedback_bandroom-preview-testing 参照）。

7. ● REC:
   preview_eval({
     code: `document.getElementById('br-rec-start').click();`
   })

8. 10 秒待つ。AI 再現 playback は main thread を重くするので
   preview_eval は 30 秒以上の sleep を返さない（timeout）。短い録音
   推奨。
   - 短くした分、後で複数 capture を平均すると良い

9. ■ STOP REC（timeout する可能性あり、action は queue されるので OK）:
   preview_eval({
     code: `document.getElementById('br-rec-stop').click();`,
     timeout: 5000
   })

10. **再生を必ず止める**（user 制約）:
    preview_eval({
      code: `document.getElementById('br-start-stop').click();`
    })

11. WAV blob を base64 で抜く:
    preview_eval({
      code: `(async () => {
        const a = document.querySelector('a[href^="blob:"][download$=".wav"]');
        if (!a) return 'NO_BLOB';
        const r = await fetch(a.href);
        const buf = await r.arrayBuffer();
        const u8 = new Uint8Array(buf);
        let s = ''; for (let i=0; i<u8.length; i++) s += String.fromCharCode(u8[i]);
        return btoa(s);
      })();`
    })

12. **size 制限**: preview_eval の return は ~5 MB 超で tool-result
    ファイルに自動保存される
    （`C:\Users\<user>\.claude\projects\...\tool-results\mcp-Claude_Preview-preview_eval-*.txt`）。
    file は JSON-quoted string なので leading/trailing `"` を strip
    してから Base64 decode する。

13. Python で wav 復元:
    ```python
    import base64, pathlib
    raw = pathlib.Path("tool-result.txt").read_text().strip().strip('"')
    pathlib.Path("capture.wav").write_bytes(base64.b64decode(raw))
    ```

14. 解析:
    ```
    python -X utf8 scripts/compare-capture.py capture.wav tabasco/human-fly
    ```

15. preview_stop() で chromium 終了。次の hypothesis を立てて ship、
    繰り返し。
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

### この recipe が無い時の fallback (codex も含む)

- 人が実機で ● REC → wav を path で渡す（MEASUREMENT-LOOP §2）
- もしくは "ship done. user に capture 依頼" で session を一旦切る
- diff 解釈は codex でも普通にできる

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
