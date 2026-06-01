# Recording Workflow — UR44 / 電子ドラム / EP-133 を band-room に流す手順

> ユーザー: 「UR44 が UI である、普通のマイクもある、bass ギターとかは取れる。
> 電子ドラム + 叩ける人いれば UR44 から取れる。EP-133 もそんな感じで使える？」
>
> 答え: **全部 OK**。UR44 経由で multi-track 録音 → DAW で stem 出し →
> band-room の `🥁🎸🎹 external stems` slot にドロップ = 完全 self-cover。
> EP-133 は USB-C で sample / MIDI、3.5mm out で音声録音という2レーンで同じ流れに乗る。
>
> 関連: [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) /
> [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) /
> [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md)

---

## 0. ハードウェア構成と band-room の対応表

| ハードウェア | UR44 接続経路 | band-room の流し先 |
|-------------|---------------|------------------|
| 普通のマイク (dynamic e.g. SM58) | XLR → UR44 ch1 mic in、phantom OFF | `🎙 external vocal` |
| コンデンサーマイク (e.g. AT2020) | XLR → UR44 ch1、**phantom +48V ON** | `🎙 external vocal` |
| ベース guitar | 1/4" TS → UR44 **Hi-Z** ボタン押した ch | `🥁🎸🎹 external bass` |
| エレキ guitar | 1/4" TS → UR44 Hi-Z ch、または **アンプ後 line out → UR44 line** | `🥁🎸🎹 external other` |
| 電子ドラム (line out) | 1/4" TRS stereo → UR44 ch3/4 line | `🥁🎸🎹 external drums` |
| **EP-133 K.O. II** | USB-C → PC (MIDI / sample transfer) + 3.5mm line out → UR44 stereo line ch | sampler の出音は drums or other |

UR44 は **4ch 同時録音可能** (Cubase / Cubasis 込みで来る、他 DAW でも動く)。

---

## 1. DAW の選択肢

Steinberg UR44 = **Cubase AI / LE が bundle**。それ以外でも:

| DAW | 価格 | おすすめケース |
|-----|------|--------------|
| **Cubase AI** (bundle) | 0 円 (UR44 同梱) | UR44 ユーザー、起動だけで動く |
| **Audacity** | 無料 OSS | 単純録音 + 編集だけならこれで十分 |
| **Reaper** | $60 (60日試用無制限) | プロ並み機能で安価、軽い |
| **Logic Pro** | $200 (Mac 一括) | Mac ユーザーで本格的 |
| **GarageBand** | 無料 (Mac/iPad) | iPad で UR44 動く、軽さ重視 |
| **Ableton Live Lite** | UR44 同梱 (たまに) | loop / electronic 系 |

おすすめ: **Cubase AI で十分**、慣れたら Reaper か Logic。

---

## 2. 基本: 1 パートずつ録音 (track-by-track)

### vocal を録る (普通のマイク)

1. SM58 等のダイナミックマイクを **XLR → UR44 ch1**、phantom OFF (コンデンサなら +48V ON)
2. UR44 の gain knob (ch1) を回して **input meter が -12 〜 -6 dB** で peak するように
3. UR44 の **direct monitor** ON → ヘッドホンで遅延 0 で自分の声聞きながら
4. DAW で UR44 ch1 を input、新規 mono track に録音準備
5. **band-room を別タブで再生** (vocals stem を toggle off にしてカラオケ状態に)
6. DAW で record → 歌う → stop
7. DAW で wav export (44.1k / 24bit / mono)
8. band-room の `🎙 external vocal` に drag-drop

### bass を録る

1. bass を **1/4" シールド → UR44 ch のうち Hi-Z ボタン押した ch** (ch1 or ch2)
2. UR44 gain で -12 dB peak
3. 同じく band-room を bass stem 抜きで再生してモニタしながら録る
4. DAW で wav export → band-room の `🥁🎸🎹 external bass` slot に drop

### guitar (アンプ DI or アンプ後)

オプション A: **DI で UR44 直に**
- guitar → UR44 Hi-Z ch
- DAW のアンプシミュ (Cubase の VST AmpRack 等) で音作り

オプション B: **アンプの line out → UR44 line in**
- アンプの cabinet emulation / DI out から TRS → UR44 line ch
- 既にアンプの音色が乗ってる、後加工最小

どちらも band-room の `🥁🎸🎹 external other` (other = gtr/keys mix の slot) に流す。
※ band-room は guitar 専用 slot を持たないので、**other slot に流すか、stem ファイルとして外部 DAW で混ぜる**

---

## 3. 電子ドラム経由

電子ドラムは 1/4" stereo line out が普通。

1. 電子ドラム master out → UR44 ch3 (L) + ch4 (R) の line input
2. UR44 ch3/4 を **stereo link**
3. DAW で stereo track 作成、ch3/4 を record
4. 叩く (band-room を drum stem 抜きで再生してテンポ確認しながら)
5. wav export → band-room の `🥁🎸🎹 external drums` slot に drop

**電子ドラム単体だと kit の音色が好きじゃない場合**:
- UR44 経由で **MIDI で取ることもできる** (電子ドラムが MIDI out 持ってれば)
- MIDI を DAW で受け取って好きな drum kit (Superior Drummer / EZdrummer / Native Instruments) で発音
- そのバウンスを wav にして band-room へ

---

## 4. EP-133 K.O. II をどう使うか

Teenage Engineering EP-133 = pocket sampler / sequencer。USB-C は
MIDI / clock / sample transfer / firmware / 給電の lane として使う。
音声録音は 3.5mm stereo output から UR44 / Sonar に入れる。

### path A: EP-133 → USB-C → PC (sample / MIDI)

1. EP-133 を USB-C で PC に接続
2. Windows / browser で **"EP-133"** が MIDI / USB device として見える
3. EP sample tool で sample transfer / backup / restore を行う
4. 必要なら DAW / Band Room から MIDI clock / transport を扱う
5. 音声そのものは下の path B で録る

これは transfer / sync 用。USB-C だけでは Band Room に戻す録音 take は作らない。

### path B: EP-133 → 3.5mm line out → UR44

1. EP-133 phones / line out (3.5mm TRS) を 1/4" 変換 → UR44 ch3 (L) + ch4 (R)
2. UR44 経由で DAW に record
3. 利点: UR44 で他楽器と同時 multi-track 録音可能、Sonar の monitoring / export に乗る
4. 欠点: cable と input gain の人間確認が必要

### EP-133 の sequence を band-room の drum-frames に流用したい?

別 path: **EP-133 で叩いた MIDI を export → drum-frames JSON 形式に変換**
できる:

1. EP-133 でパターン作る
2. MIDI export (USB 経由で SysEx? あるいは pattern を録音 → MIDI 変換)
3. その MIDI を python script で drum-frames JSON 形式に変換
4. `presets/drum-frames-tabasco-<song>.json` の frame events を上書き

このパターン抽出は **`scripts/_extract_drum_patterns.py`** (v65) と同系統の
スクリプトを書けば可能。やる需要あれば実装。

---

## 5. multi-track 同時録音 (UR44 の本領)

UR44 は **4ch 同時録音可能**。1 take で:
- ch1: vocal (マイク)
- ch2: bass (Hi-Z DI)
- ch3+4: 電子ドラム (stereo) or EP-133 (stereo)

→ DAW で 4 track 別々に record → band-room の 4 external slot に流せば
1 ライブテイクで全パート差し替え可能。

ただし **演奏者が複数必要** (vocal 歌う人 + bass 弾く人 + drum 叩く人)。
個別取りの方が現実的。

---

## 6. 一番シンプルな 1-人セルフカバー手順

```
day 1: vocal だけ録る (1-2 hr)
  - SM58 → UR44 ch1
  - band-room で 📻 stems mode、vocals toggle off (= カラオケ)
  - DAW で 7 曲全部 vocal だけ録る
  - 各曲 wav export (vocal_<song>.wav 等)

day 2: bass / guitar / drum 取り直しは後回し、まず vocal だけで聴く
  - band-room の 🎙 external vocal slot に各曲の vocal wav を drop
  - 元 vocal stem を toggle off
  - 7 曲通しで違和感確認

day 3: 取り直したいパートだけ追加録音 (本人パート優先)
  - 例: bass は自分で弾きたい → UR44 で録る → external bass slot
  - 例: drum は EP-133 で叩く → external drums slot

day 4-7: DAW で本気 mix or band-room の master チェーン信頼してそのまま
  - band-room の 📦 stems pack export で 4 stem 別 webm
  - DAW で本気 mix master
  - mp3 / wav bounce → SoundCloud / Bandcamp 公開
```

= **1 週間で 7 曲セルフカバー album**。Suno と組み合わせれば最初の 1 曲で
voice clone Persona 作って残り 6 曲 AI 担当もアリ ([SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md))。

---

## 7. モニタリングの実用 tips

### "band-room 再生 + 自分の演奏" を mix してヘッドホンで聞きたい

3 つの path:

#### path A: UR44 の direct monitor + PC audio
1. PC audio (band-room の音) を UR44 line in (ch5/6 or DAW out 経由) に戻す
2. UR44 の monitor mix knob で「PC audio + 自分の input」を blend
3. UR44 のヘッドホン端子で聞く

#### path B: DAW 内で monitor
1. DAW で UR44 input track の **monitor ON**
2. 同じ DAW で band-room 録音を別 track で再生 (= band-room の出音を一旦 DAW に取り込む)
3. master out をヘッドホンに

ただし latency が乗る (~10 ms)。歌うには許容範囲、bass は微妙。

#### path C: PC audio → 物理 line → UR44 line in
1. PC headphone out → UR44 line in
2. UR44 direct monitor で自分の input と blend
3. UR44 phones out にヘッドホン

これだと完全アナログ monitor で latency 0。

実用おすすめ: **path C** (歌うときも bass 弾くときも)。

---

## 8. 録音設定の標準

UR44 + DAW の標準設定:

- **sample rate**: 48 kHz (映像連携考えるなら) or 44.1 kHz (CD互換)
- **bit depth**: 24 bit (16 bit は最終 bounce 段階で)
- **buffer size**: 録音中は 64 〜 128 sample (low latency)、mix 中は 512 〜 1024 (CPU余裕)
- **input gain**: peak が **-12 ~ -6 dB**、クリップ厳禁

### band-room へのアップロード形式

- wav (推奨): 44.1k or 48k / 16-24 bit / mono or stereo
- mp3 (容量節約): 192 kbps 以上
- どちらも band-room の Tone.Player が読める

---

## 9. 録音 → band-room までの最短コース (vocal だけ)

ここで答えにすると:

```
1. SM58 + ケーブル + UR44 + PC + DAW (Cubase AI/Audacity 等) 準備
2. ヘッドホン UR44 phones に挿す、direct monitor ON
3. PC で band-room (https://quietbriony.github.io/Music/band-room.html) 開く
4. 曲選ぶ → 📻 原音モード → vocals stem toggle OFF (カラオケ状態)
5. PC audio を path C で UR44 line in に戻して mix monitor
6. DAW で UR44 ch1 を input、new mono track 作成
7. DAW で record arm、PC で band-room START、3 秒待って歌い始める
8. 通し終わったら stop、wav export
9. PC ブラウザに戻って band-room の 🎙 external vocal slot に wav drop
10. 元 vocal は toggle off のまま、self-vocal で 1 通し再生して check
```

これで 1 曲約 30 分。7 曲で 4 時間 1 セッション。

EP-133 / 電子ドラムを追加するなら別日に同じ手順で external drums / other に
重ねていく。
