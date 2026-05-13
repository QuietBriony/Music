# free-808/ — CC-0 ドラムサンプル置き場 (空 scaffold)

このディレクトリは band-room の `KIT_OPTIONS` に追加するための **CC-0
license のドラムサンプル** を置く場所。**ファイル本体は同梱せず**、ユーザーが
自分の判断で sourcing 元から取得して置く。

---

## 構成 (band-room.js が期待するファイル名)

```
presets/sample-kits/free-808/standard/
├── kick-01.wav
├── snare-01.wav
├── hat-01.wav
├── snare-02.wav     # fill 用
├── snare-03.wav     # ghost 用
└── crash-01.wav
```

WAV / 44.1 or 48 kHz / 16-bit / mono or stereo。1ショット (atack あり、~1秒以内)。

## ソースの推奨 (Public Domain / CC-0 確認済)

### A. TidalCycles `dirt-samples` (CC-0 / unrestricted)
- https://github.com/tidalcycles/dirt-samples
- 古典 drum machine 1ショットが大量。`808/`, `909/`, `hh/`, `cp/` 等
- 例:
  ```bash
  git clone https://github.com/tidalcycles/dirt-samples /tmp/dirt
  cp /tmp/dirt/808bd/BD0000.WAV  free-808/standard/kick-01.wav
  cp /tmp/dirt/808sd/SD0000.WAV  free-808/standard/snare-01.wav
  cp /tmp/dirt/808hc/HC00.WAV    free-808/standard/hat-01.wav
  cp /tmp/dirt/808sd/SD0050.WAV  free-808/standard/snare-02.wav   # mid hit
  cp /tmp/dirt/808sd/SD0075.WAV  free-808/standard/snare-03.wav   # softer ghost
  cp /tmp/dirt/808/CP.WAV        free-808/standard/crash-01.wav   # clap as substitute
  ```

### B. Drumkito (BoomBap / dirt-samples 派生、CC-0)
- https://drumkito.com/
- jazzy / vintage 中心、permissive license の sample pack 多数

### C. Versilian Studios VSCO 2 (CC0 / orchestral / drumless だが各楽器あり)
- https://versilstudios.com/vsco-community.html

### D. Freesound.org "808" タグ
- https://freesound.org/search/?q=808+kick&f=license%3A%22Creative+Commons+0%22
- 個別検索、CC-0 フィルタを必ず指定

## サイズ目安

drum 6 ショット × 100 KB 程度 = **600 KB**。Pages の制限から見て無視できる。

## 配置後の手順

1. 6 個の wav ファイルを `presets/sample-kits/free-808/standard/` に置く
2. `band-room.js` の `KIT_OPTIONS` に以下を追加:
   ```js
   { value: "free-808/standard", label: "Free 808 (CC-0 dirt-samples)" }
   ```
3. オプション: `presets/sample-kits/free-808/standard/manifest.json` を作って
   license と source URL を明示:
   ```json
   {
     "kit": "free-808/standard",
     "source": "TidalCycles dirt-samples",
     "source_url": "https://github.com/tidalcycles/dirt-samples",
     "license": "CC-0 (Public Domain Dedication)",
     "samples": [
       { "voice": "kick",  "file": "kick-01.wav" },
       { "voice": "snare", "file": "snare-01.wav" },
       { "voice": "hat",   "file": "hat-01.wav" },
       { "voice": "fill",  "file": "snare-02.wav" },
       { "voice": "ghost", "file": "snare-03.wav" },
       { "voice": "crash", "file": "crash-01.wav" }
     ]
   }
   ```

これで AI 再現モードで「Free 808」kit が選べるようになる。Tabasco 由来の
sample-kits と並列に動く。

## なぜ同梱しないか

ライセンス追跡を明示的にするため (ユーザーが意図的にコピーした事実が repo の
git log に残る)。誰の repo か、どのライセンスのファイルが入ったか、git blame
できる。
