# Vocal Regeneration — 3 つの再生成経路

Tabasco LIVE の "適当英語" ボーカル → 意味の通る proper English ボーカル
への置き換え方。ブラウザ単独では AI 歌声合成は不可なので、3 通りで対処。

## 経路 1: 自分で歌い直す (推奨、品質最高)

**ステップ:**
1. band-room.html で `🎤 vocal stem` を OFF (元音源ボーカル消す)
2. `band-room.css` の `📻 原音 stems` モードで drums/bass/other 鳴らす
3. user 自身が `docs/tabasco-lyrics-final.md` を見ながら歌う
4. (オプション) スマホ等で録音 → mp3 化 → 経路 3 の upload slot へ

**長所:**
- 完全 user 自身の声 (バンドメンバー本人)
- 歌の癖、息づかい、感情そのまま
- 著作権完全クリア (自分で歌った素材)
- 練習しながら歌詞も育つ

**短所:**
- 録音環境次第で音質バラつき
- 歌詞によっては自分の声に合わない場所も

## 経路 2: Suno / Udio 等 AI 生成 (デモ用)

外部 AI ボーカル合成ツールで歌わせる。**band-room 単独では動かない、外部で生成 → 取り込む**。

### Suno 手順
1. https://suno.com/ でアカウント作成
2. **Custom Mode** で以下のプロンプトを使う:

```
[Title]
Human Fly

[Style of Music]
Indie rock, LCD Soundsystem motorik pulse + Backdrop Bomb mixture energy,
117 BPM, G major, male vocal mid-low register, half-spoken verse +
shouted-melodic chorus. Dry mix, modern indie production.

[Lyrics]
(verse 1)
Standing in the middle of the city, gravity pinning me down
Wearing a face I don't recognize, in a crowd of half-familiar sounds
... (full lyrics from docs/tabasco-lyrics-final.md)
```

3. Generate → 2-3 take 試す → 一番気に入ったやつ mp3 ダウンロード
4. ファイル名: `human-fly-suno.mp3` 等
5. band-room へアップロード (経路 3)

### Suno 注意
- BPM/key 完全一致は無理。±3-5 BPM ズレあり得る
- 「Backdrop Bomb」「LCD Soundsystem」みたいな具体名は弱い、ジャンル名 + 感性表現で書く
- 90 秒以上の曲は 2 回 generate して continuation 機能で繋ぐ
- 月 50 曲まで無料 (Standard プラン)

### 各曲の Suno プロンプトテンプレート (style 部分)

| 曲 | Style prompt |
|---|---|
| 01 TABASCO | Punk chant manifesto, 136 BPM D minor, hardcore Japanese mixture-rock, fast, shouted male vocal |
| 02 Hey | Indie pop-rock, 123 BPM G major, LCD Soundsystem propulsion + cowbell, half-spoken male vocal calling out |
| 03 I got a feeling | Alt-rock quiet-loud (Nirvana style), 117 BPM B minor, anticipation theme, controlled verse explosive chorus |
| 04 Under the Moon | Fast ska-punk, 161 BPM Bb major, hardcore street energy, communal chorus shouted by group |
| 05 Electric Sheep | Hardcore postpunk agro (UNRIPE Okinawa style), 129 BPM E minor, 2:30 short intense, full-throat shouted vocal |
| 06 Human Fly | Indie rock dance-punk, 117 BPM G major, LCD Soundsystem motorik + Nirvana quiet-loud, male mid-low vocal |
| 07 Sister | Indie ballad with warm analog feel (Sadistic Mika Band 70s), 117 BPM F major, sustained melodic male vocal |

## 経路 3: band-room へボーカルレイヤとして upload

band-room.html に **external vocal mp3 upload slot** を追加した (v63)。

使い方:
1. 経路 1 (自分録音) または経路 2 (Suno 生成) で `<song-id>-vocal.mp3` を用意
2. band-room の `🎤 external vocal` セクションで file picker からアップロード
3. 元の vocal stem を OFF、external vocal の音量調整
4. `sound mix` の vocal blend (spread / room) スライダーで処理

UI 上:
- `Choose file` → file:// blob URL を Tone.Player に渡す
- 同じ vocal blend chain (spread / room、delay send は内部 off) が掛かる
- vocal stem と排他または重ね

**保存はブラウザのメモリだけ** (リロードで消える) — 永続化はファイルを user 側 PC に保管。

## どこから始めるか

**今すぐ:**
- 経路 1 で Human Fly を歌い直してみる (歌詞は draft.md 通り)
- 録音は iPhone のボイスメモで OK → mp3 化

**気が向いたら:**
- 経路 2 で Suno に Human Fly の Style prompt 投げる → 比較
- 自分の歌 vs AI 歌で違いを聴き比べ

**ハマったら:**
- 7 曲全部 Suno で生成 → band-room の external vocal slot で並列再生
- カラオケアプリ的に user が歌う or AI 声で済ます切替可能

## 著作権メモ

- 元 m4a (Tabasco LIVE) の歌詞: user 自身が書いたもの → user owns
- v2.1 リライト歌詞: claude が書いた草稿、user が修正 → user owns (band の歌詞として使う前提)
- Suno 生成音源: Suno の生成物 → Suno 利用規約に従う (個人利用 OK、商用は plan 確認)
- UNRIPE サンプル: 私的 reference library として保持、外部配布不可
- Tabasco stems: user バンド本人の私的音源、外部配布不可
