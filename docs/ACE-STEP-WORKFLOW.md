# ACE-Step Workflow — ローカル/OSS の歌入り生成を「制作・参照レーン」で使う

> ユーザー質問: 「ace step 1.5って、なんかに使える？」
>
> 結論: **アプリの実行時部品には不適**（ブラウザで動く Tone.js リアルタイム合成という
> スタックの形と真逆）。だが **Suno のローカル/OSS 版**として、制作・試聴参照のレーン
> （[SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) と同じ用途）にきれいに収まる。
> このドキュメントはその使い方と「やってよいこと / だめなこと」の境界を定義する。

---

## 0. これは何か（ACE-Step 1.5）

オープンソース（Apache-2.0）の音楽生成基盤モデル。**歌詞 + スタイル文 → 歌入りの
フル楽曲**を生成する text-to-audio。要するに **ローカルで動く Suno 系**。

1.5（2026-01 リリース）の確認済みスペック:

| 項目 | 1.5 |
|------|-----|
| アーキ | hybrid LM + Chain-of-Thought reasoning |
| 長さ | 最大 **10 分**（v1 は 4 分） |
| 言語 | **50+ 言語** |
| 速度 | A100 で 1 曲 **<2 秒** / RTX 3090 で <10 秒 |
| **ローカル要件** | **VRAM <4GB**。Mac / AMD / Intel / CUDA 対応 |
| 編集 | cover generation / repainting / **vocal-to-BGM** |
| 個人化 | **数曲から LoRA 学習**（自分のスタイル/声の癖を捕まえる） |

Suno との一番の差: **ローカル・無料・素材を外部にアップロードしない**（私物の Tabasco
stem を扱うのに安心）、かつ **LoRA で自分の素材から学習**できる。

---

## 1. スタックの掟との整合（重要）

music-stack の掟と矛盾しないために、ACE-Step は **制作ツール**として扱い、
**実行時依存にはしない**:

- **runtime 部品にしない** — 各アプリ（Hazama FM / Band Room / chill / namima /
  drum-floor）はブラウザの **リアルタイム Tone.js *合成*** エンジン。ACE-Step は
  GPU でオフラインに固定の音声ファイルを吐く巨大モデルで、ブラウザでは動かない。
  実行時に組み込まない。
- **出力音声をリポに入れない** — 「音源 / サンプル / 歌詞ファイルは repo に追加しない、
  Tone.js 合成 or CDN サンプルのみ」の掟は **実行時アセット**の話。ACE-Step の出力 wav は
  ローカル（DAW / 手元）か、必要なら CDN に置く。**repo にコミットしない**。
- **blind copy しない** — ACE-Step の出力はあくまで *参照・デモ*。良かった要素は
  **音楽的アイデアとしてエンジンの言葉（Tone.js / drum-frame / preset）に翻訳**して
  取り込む。生成物をそのまま貼らない（cross-repo listening review と同じ方針）。

→ この 3 つを守れば、Suno レーンと同じ「人間の制作を助ける外部ツール」に収まる。

---

## 2. 使い道（推奨 3 レーン）

### A. Tabasco 歌入りデモ → Band Room アレンジの指針（本命）

[SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) の Suno フローのローカル版。確定歌詞
（[tabasco-lyrics-final.md](./tabasco-lyrics-final.md)）を入れて歌モノのフルデモを作り、
**「この曲はこう展開できる」を耳で確認**してから、メロ/アレンジの*アイデア*を
Band Room の Tone.js に手で翻訳する。

ACE-Step ならではの利点:
- **LoRA で album 統一** — Tabasco の既存素材（or 1 曲目の生成）から LoRA を作り、
  全 7 曲を同じバンドの声/質感で生成（Suno の Persona に相当、ただしローカル & 学習式）。
- **cover / repainting で元演奏に忠実** — Suno Cover Mode 相当。元の Tabasco mix を
  入力に、コード/テンポ/構造を保ったまま vocal や一部を差し替え。「元のボーカル音程に
  合わせる」用途はこれ。
- **vocal-to-BGM** — vocal トラックに合う伴奏を生成 → アレンジ案出しに使える。

Band Room 側の受け口は `🎙 external vocal` slot（生成 wav を drop）。掟どおり wav は
repo に入れず手元/CDN で扱う。

### B. 測定ループの参照ターゲット

Band Room の AI 再現は `docs/target-spec-bands.json` の数値と比較して詰めている
（[MEASUREMENT-LOOP.md](./MEASUREMENT-LOOP.md)）。ACE-Step で**ジャンル忠実な
リファレンス音源**を作れば、「このジャンルはこう鳴るべき」の追加ターゲットになる。
brightness / DR / pocket の目標値を、市販曲だけでなく生成リファレンスからも採れる。

### C. アイデア探索（オフライン）

「あの曲のあの展開、うちのエンジンで再現できる？」をオフラインで素早く試作 →
**良い要素だけをエンジンの言葉に翻訳**。10 分尺・50 言語・CoT で構成感のある長尺も出せる
ので、長尺 radio（Hazama FM / chill）の楽章設計の叩き台にも使える。

---

## 3. 使えないこと（境界）

- **実行時部品** — ブラウザで動かない。アプリに組み込まない。
- **ドラムパターン / MIDI 抽出** — 出力は*音声*。drum-floor やエンジンが欲しい記号
  データ（drum-frame / step grid）は出ない。音声から叩き出すなら別途解析が要る。
- **リアルタイム / 生で進化する radio** — ACE-Step は固定尺の一発生成。Hazama FM の
  「生で進行し続ける」体験は作れない。

---

## 4. セットアップ（高レベル）

ローカル GPU（VRAM 4GB〜）or Mac/AMD/Intel。詳細は公式 README に従う:

1. `git clone https://github.com/ace-step/ACE-Step-1.5`
2. 依存インストール（Python 環境。Mac/AMD/Intel/CUDA それぞれの手順あり）
3. モデル重みを取得 → ローカル推論 or Web UI 起動
4. 歌詞 + スタイル文を入力して生成。section タグ（`[verse]` `[chorus]` 等）は
   Suno と同様に構造把握を助ける（[SUNO-WORKFLOW.md §2](./SUNO-WORKFLOW.md) の
   prompt テンプレがそのまま流用できる）

※ バージョン/手順は変動。公式 GitHub / Releases を正とする。

---

## 5. Suno vs ACE-Step 早見表

| | Suno | ACE-Step 1.5 |
|---|---|---|
| 動作 | クラウド | **ローカル**（VRAM <4GB / Mac/AMD/Intel/CUDA） |
| コスト | $10〜/月 | **無料**（OSS・Apache-2.0） |
| 素材アップロード | 必要（Cover 時） | **不要**（手元で完結＝私物 stem に安心） |
| 声/スタイル統一 | Persona | **LoRA 学習**（数曲から） |
| 元演奏に忠実 | Cover Mode | cover / **repainting** |
| 手軽さ・仕上がり | ◎（すぐ綺麗） | ○（セットアップは要るが自由度高） |
| スタックでの位置 | 制作・参照レーン | **同左**（実行時には組み込まない） |

迷ったら: **手早く綺麗に → Suno** / **無料・ローカル・私物素材・学習 → ACE-Step**。
両方とも「人間の制作を助ける外部ツール」で、出力はエンジンの言葉に翻訳して取り込む。

---

## 6. 参考リンク

- ACE-Step 1.5 GitHub: https://github.com/ace-step/ACE-Step-1.5
- Releases（版/手順の正）: https://github.com/ace-step/ACE-Step-1.5/releases
- 公式サイト（1.5）: https://ace-step.github.io/ace-step-v1.5.github.io/
- 2026 ガイド: https://dev.to/czmilo/ace-step-15-the-complete-2026-guide-to-open-source-ai-music-generation-522e
- 関連: [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) / [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) / [MEASUREMENT-LOOP.md](./MEASUREMENT-LOOP.md)
