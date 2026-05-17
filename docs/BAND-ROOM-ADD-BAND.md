# Band Room — 新バンド追加手順

band-room.html は `presets/bands.json` を読み込んで、登録されたバンドの曲を再生します。
新しいバンドを追加する流れ:

## 1. 音源を所定の場所に置く

```
C:\Users\平成造園\Desktop\musicpl\<BAND-NAME>\
  ├── 01 song1.m4a
  ├── 02 song2.m4a
  ...
```

m4a / wav / mp3 / flac / aac 対応。ファイル名は「番号 タイトル.m4a」形式推奨
(`01 Song Title.m4a` → song-id は `song-title` に自動変換される)。

## 2. Stem 分離スクリプト実行

```bash
cd C:/workspace/music-stack/Music
python scripts/_separate_band.py <band-id>
```

`<band-id>` は band の識別子 (lowercase、ハイフン OK 例: `unripe`, `chappy`)。

スクリプトが:
- 各 m4a を wav に変換 (imageio-ffmpeg)
- Demucs htdemucs モデルで 4-stem 分離 (vocals / drums / bass / other) @ 192 kbps mp3
- `presets/<band-id>-stems/<song-id>/{vocals,drums,bass,other}.mp3` にコピー

CPU 1 曲あたり 2-5 分 (7 曲なら ~20-30 分)。

## 3. `presets/bands.json` にエントリ追加

```json
{
  "bands": {
    "<band-id>": {
      "name": "<Band Display Name>",
      "subtitle": "短い説明",
      "scene": "ジャンル / 軸",
      "stems_dir": "presets/<band-id>-stems",
      "drum_frames_pattern": "presets/drum-frames-<band-id>-{songid}.json",
      "lyrics_doc": "docs/<band-id>-lyrics.md",
      "songs": [
        { "id": "<song-id>", "track": "01", "title": "<Title>", "bpm": 120, "key": "G major", "duration_s": 180 },
        ...
      ]
    }
  }
}
```

song-id は stem 分離スクリプトの sanitize_id 出力と一致させる:
- `06 Human Fly.m4a` → song-id `human-fly`
- `01 TABASCO.m4a` → song-id `tabasco`

## 4. (オプション) drum-frames JSON 作成

各曲の section / chord_progression / drum frame を手書きするなら:
- `presets/drum-frames-<band-id>-<song-id>.json` を `presets/drum-frames-tabasco-human-fly.json` をテンプレに作る
- `scripts/_gen_tabasco_songs.py` を band-aware に書き換えてもいい

無くても **stems モード**で再生可。drum-frames が無いと「AI 再現 (synth)」モードが機能しないだけ。

## 5. (オプション) sw.js precache に追加

`sw.js` の PRECACHE_URLS に該当 stems を追加。サイズ大きい band は precache せず on-demand 推奨 (Service Worker が cache-first で 1 回目以降は cache から)。

```js
"presets/<band-id>-stems/<song-id>/vocals.mp3",
"presets/<band-id>-stems/<song-id>/drums.mp3",
// etc.
```

VERSION も bump。

## 6. デプロイ

```bash
git add -- presets/bands.json presets/<band-id>-stems/ scripts/
git commit -m "feat(music): add <band-name> band to band-room"
git push
```

Pages 反映後、band-room.html の上部 band selector に新バンドが現れる。

---

## トラブルシューティング

### Demucs が "TorchCodec required" で失敗
→ `pip install "torch==2.7.1" "torchaudio==2.7.1"` (新版 torch は torchcodec 必須)

### m4a が読めない
→ imageio-ffmpeg ヘルパーを介して wav 経由。スクリプトは自動でやってる

### 容量大きすぎる
→ Demucs の `--mp3-bitrate` を 128 や 96 に下げる (`_separate_band.py` の cmd を編集)

### sw.js precache に入れたら install 時間長すぎ
→ band の stems を precache から外す。on-demand cache-first で初回再生時にだけ DL される
