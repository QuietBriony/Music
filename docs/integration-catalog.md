# Music Integration Catalog

## 1) Purpose
- ローカル棚卸しレポート（`_reports/music-stack-inventory-2026-04-24.md`）を実装判断向けに反映し、
  Music統合の優先度・実装範囲・リスクを共通で持つ。
- 変更は **実装統合やファイル移動を行わず**、判断材料を文書化する。
- 対象は Music本体の拡張可能性を高めるため、他repoの既存資産を「どう使うか」を決める。

## 2) Related repos
- Music
- namima
- namima-lab
- test
- chill
- drum-floor
- hazama（reference only）

## 3) Classification
### keep
- **Music**
  - 中核リポジトリ。今回の統合先。
- **namima**
  - 音楽生成の実運用価値が高く、統合中核として維持。
- **drum-floor**
  - 音楽運用思想（ライブ/事故防止）を参照できる支援リポジトリ。

### merge into Music
- **namima-lab**
  - a-min系の実験版資産は Music の実験レイヤー設計へ吸収可能。

### migration candidate
- **test**
  - 近接実装が存在するため、移植候補として比較検証。現時点は一括mergeせず段階移行。
- **chill**
  - UI/音色の軽量サンプル寄り。再利用観点はあるが、運用整合は慎重に検討。

### archive candidate
- **test**（候補）
  - Musicへの機能吸収後の重複縮小候補。
- **chill**（候補）
  - 同上。

### reference / hold
- **hazama**
  - 世界観・ゲーム・小説・総合開発側の参照repo。音楽統合対象外。

## 4) Reusable assets
- `Music`
  - フェーダーUI設計、可視化付き音楽生成フロー
  - 既存Tone.jsベースの起点
- `namima`
  - Web Audio 起動フローと UI との連動（START / interact）
  - 軽量エネルギー制御の考え方
- `namima-lab`
  - a-min系の世代別アレンジ（音色設計の比較テスト素材）
- `test`
  - スタイルブレンド設計（Ambient〜HardTechno）
- `chill`
  - サイバ-禅的な描画/UIリズムとの接続設計
- `drum-floor`
  - 事故防止運用（ライブ運用の手順・ルール）
- `hazama`
  - 状態永続化、読み込み安定化、軽量チェック（スモーク）発想の参照

## 5) Risks
### Actions
- 現時点では `.github/workflows` が検出されず、Actions課金増大や失敗ノイズは低リスク。
- 将来追加時は、実行対象・cron・artifacts出力を事前に最小化。

### LFS
- `.gitattributes` の LFS設定は未検出。
- 追加する音源/動画素材で将来LFSが必要になる可能性あり。

### large files
- 50MB超や音声本体ファイルは現時点未検出。
- `git` 追跡対象での過大化は、現状低リスク。

### secrets
- `.env` / `.pem` / `.key` / token / secret / credential 文字列を含むファイル名は未検出。
- 今回は値そのものを閲覧していないため、値漏洩確認は未実施（必要時のみ最小権限で別途確認）。

## 6) Recommended integration order
1. **namima-lab**
   - 小変更で音色/コア挙動差分をMusicへ吸収可能か検証。
2. **namima**
   - コア実行思想を維持しつつ既存Music設計へ接続。
3. **test / chill**
   - 重複機能を移植単位で切り出し、Musicに吸収できるものだけ取り込む。
4. **drum-floor / hazama**（reference）
   - 実装は変更せず、運用ルール/UX思想をドキュメント参照として保持。

## 7) First small PR candidate
- 新規 `docs/integration-catalog.md`（本ドキュメント）を Music に追加する。
- 変更範囲がドキュメントのみのPRとして、影響を限定し、次工程の実装判断を共通化。

## 8) Do not do yet
- 実装統合（コード統合・構成変更）
- ファイル移動・名前変更
- archive/delete 実行
- `install`/`build`/Actions実行
- `.env` の値参照や他repoのファイル編集
