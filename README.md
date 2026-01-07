# Namima — UCM Mandala Engine (DX)

ブラウザ上で動く「音響 + 視覚」ジェネレーティブエンジンです。
iOS Safari の WebAudio 制約（ユーザー操作でのみAudioContextが開始）を回避する構造になっています。

## フォルダ構成（このリポジトリの“正”）

```
/index.html
/style.css
/engine.js

/assets/         # 背景・曼荼羅レイヤ（SVG）
/presets/        # ジャンルプリセット（JSON）
/audio/          # 予備（将来サンプル等を置くなら。現状は未使用）
```

> Gitは空フォルダを保持できないため、`/audio/` には `.gitkeep` を置いてあります。

## 使い方（GitHub Pages）

1. GitHub → Settings → Pages
2. Deploy from branch → `main` / `/ (root)`
3. 公開URLへアクセス → **Tap/Click START** で音が有効化されます（iOS対策）

## Preset（ジャンル）について

- `/presets/*.json` を読み込み、UIのPreset選択で切替できます
- `AUTO (by Energy)` は UCMフェーダーの Energy で自動的に雰囲気を寄せます
- JSON は以下のキーを優先的に解釈します（無い場合は無視）：
  - `ucm`: `energy / wave / mind / creation / finance / observer / void / circle`
  - `audio`: `tempo / density / brightness / silenceRate / bassWeight / padWeight / reverb / delay`
  - `patterns`: `percussion / glitch / bass / pad / drone`

## トラブルシュート（最重要）

- iPhone: **マナーモード**やサイト設定で音がブロックされる場合があります
- presetが出ない: `presets/techno.json` などが **ルート直下の /presets/** にあるか確認
- 曼荼羅が出ない: `assets/layer_01.svg` などが **/assets/** にあるか確認
