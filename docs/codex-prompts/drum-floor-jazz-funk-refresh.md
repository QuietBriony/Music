# Codex prompt — drum-floor: refresh jazz + funk frames with break/session feel

Paste the block below into the drum-floor repo's codex session. User intent:
JAZZ は Art Blakey の hard bop drum session + Bill Evans の voicing 感、
FUNK は Funkadelic (P-Funk) の live full band session、
**両方とも生音感 + break + ためる**。

Schema reference: `Music/presets/SCHEMA.md` section 2 (drum-frames).
Artist refs: `Music/references/apple-music-refs.json` (Art Blakey / Bill
Evans / Funkadelic 翻訳済) + `Music/references/hazama-fm-pill-refs.json`
(production_aesthetic_governors: Richard D. James + D Angelo を薄く適用).

## Parallel-track note (v36 update)

**Music repo にも並行で local 実装済**: `Music/presets/drum-frames-jazz.json`
(8 frames) と `drum-frames-funk.json` (8 frames) が既に session_role 付きで
反映されている。Codex 側の drum-floor 実装は、これらを参考に or 上書きで OK。
- 両方の version が出揃ったら、curl 反映 step で codex 版を上書きすれば
  Music repo の audit.py が pass する限り問題なし。
- どちらが musically 良いかは聴感で決める。
- production governor (RDJ + D Angelo) は Music repo 側で
  `audio/genre-flavor.js` の `buildDrumsFromFrames` に統合済 (event-level)。
  Codex 側で JSON に governor 寄りの velocity / microMs 揺れを焼き込んでも、
  二重適用にはならず、深まる方向。

---

```
Task: refresh drum-floor/exports/drum-frames-jazz.json and
drum-frames-funk.json with deeper "生音セッション感 + break + ためる"
feel. Source references (in Music repo):

- references/apple-music-refs.json — Art Blakey & The Jazz Messengers
  (Moanin'), Bill Evans Trio (Peace Piece), Funkadelic (Maggot Brain),
  D Angelo (Voodoo) の production_translation を読む
- references/hazama-fm-pill-refs.json — jazz / funk pills の
  primary_references + production_aesthetic_governors を読む

Schema: same as current drum-frames-{jazz,funk}.json (Music/presets/
SCHEMA.md section 2). 既存ファイルをよく読んでから extend する形で良い。

Implementation:

1. JAZZ refresh (drum-floor/exports/drum-frames-jazz.json):
   - 6-8 frames (current 5 から拡張)
   - BPM 120-150 (hard bop standard)、swing 0.16-0.22
   - kit: acoustic (ride / brush / kick / upright bass implicit) feel
   - 各 frame の role を session 感のある名前に:
     "head-intro", "head-statement", "comp-stride", "solo-build",
     "drum-break", "fill-recap"
   - role="drum-break" の frame は 1-2 個 含める:
     * kick / snare / ghost のみで constructed
     * hi-hat は drop (intentional dynamic drop)
     * 8 bar phrase の最後の 2 bar 相当の dynamic feel
   - ride cymbal は instrument="hat" with role="ride" で continuous swing
   - snare lag 8-12 ms (D Angelo governor を弱めに 5-8 ms 適用)
   - "ためる" 表現: 1 frame の最後で全 velocity を 0.5x に drop、次 frame
     で全 velocity を 1.15x に restore

2. FUNK refresh (drum-floor/exports/drum-frames-funk.json):
   - 6-8 frames (current 6 から拡張 or 刷新)
   - BPM 90-105 (P-Funk standard)、swing 0.08-0.14
   - kit: live full band (kick / snare / hat / ghost / clap implicit)
   - 各 frame の role を session 感のある名前に:
     "section-A-rhythm", "section-B-horn-stab", "drum-break",
     "bass-feature", "vamp-loop", "recap"
   - role="drum-break" frame を 1-2 個含める:
     * 2-4 bar drum-only + occasional handclap
     * kick syncopated (1, 2.5, 3.5, 4)
   - snare は behind beat 15-25 ms (D Angelo governor 強め適用、
     P-Funk drummer の drunk timing 系譜)
   - 16th hi-hat は loose、たまに skip (1-2 個の sub を抜く)
   - handclap を ghost note 相当として instrument="ghost" role="clap"

3. 両ファイル共通:
   - 既存 frames は preserved または extend、削除しない
   - 生音感を保つため、microMs の humanize 揺れを 2-5 ms 加算
   - velocity の humanize 揺れを 0.04-0.08 加算
   - "session" のための meta hint:
     - frame に optional "session_role": "head" | "solo" | "break"
       | "recap" を追加 (parser 側は無視可、ドキュメント用)
   - Richard D. James governor を薄く適用: 16th 単位で 3% 確率で
     velocity を 0.3x に drop (1 hit だけ消えるような micro wrongness)

4. Schema (per file):
   {
     "version": 1,
     "format": "drum-frames",
     "genre": "jazz" | "funk",
     "frames": [
       {
         "id": "jazz_blakey_head_0",
         "bpm": 132,
         "swing": 0.18,
         "barLength": 4,
         "role": "head-statement",
         "session_role": "head",
         "events": [
           { "instrument": "kick", "beat": 0, "sub": 0,
             "velocity": 0.7, "microMs": -3, "role": "anchor" },
           { "instrument": "hat", "beat": 0, "sub": 1,
             "velocity": 0.42, "microMs": 4, "role": "ride-swung" },
           ...
         ]
       }, ...
     ]
   }

5. Constraints (drum-floor repo rules):
   - No audio files, no new npm dependencies, no GitHub Actions
   - Don't refactor groove-profiles.json or drum-pattern-frames.json
   - Don't auto-arm live output
   - Open PR; don't auto-merge

6. Acceptance:
   - Both JSONs parse cleanly
   - 6-8 frames per genre
   - JAZZ: avg snare microMs 5-12 ms behind beat
   - FUNK: avg snare microMs 12-25 ms behind beat (drunk pocket)
   - 各 file に role="drum-break" or session_role="break" frame が
     1 個以上含まれる
   - Browser fetch resolves successfully

7. Git:
   - Branch: refresh/drum-frames-jazz-funk-session
   - Commits:
     "refresh: drum-frames-jazz with Blakey hard-bop break/session frames"
     "refresh: drum-frames-funk with Funkadelic break/pocket frames"
   - Open PR; do not auto-merge.
```

---

## After codex finishes

- drum-floor で merge 後、Music repo に JSON コピー:
  ```bash
  curl -sL https://raw.githubusercontent.com/QuietBriony/drum-floor/main/exports/drum-frames-jazz.json -o presets/drum-frames-jazz.json
  curl -sL https://raw.githubusercontent.com/QuietBriony/drum-floor/main/exports/drum-frames-funk.json -o presets/drum-frames-funk.json
  python -X utf8 scripts/audit.py
  ```
- `audio/genre-flavor.js` の `buildJazzFromFrames` / `buildFunkFromFrames`
  が新 frames を読む (既存 builder で OK、break frame は role 値で識別)
- 必要なら break frame 専用の dynamic 処理を builder に追加
