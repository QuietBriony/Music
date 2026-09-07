# 和声マップ＋アシッド演奏面 — 既存Music Stackを育てる設計

Status: **planned / 未実装**。2026-09-07の全体統合に伴う設計。
これは実行許可や聴感合格の代わりではありません。作業順は[BACKLOG](autonomy/BACKLOG.md)に集約します。
使い方の入口は[総合manual](MUSIC-STACK-SYSTEM-MANUAL.md)へ。

## 目指す音と操作

深くノれる反復を芯に、和声と音色が少しずつ溶ける。
拍とアシッドが別々に鳴る感じ、音を足すだけのジャズ寄り生成、毎小節の忙しい転調を避ける。
既存曲のメロディ・録音・固有フレーズはコピーせず、休符・強弱・共通音・質感の設計へ翻訳する。

最小画面は**8小節 / Drums・Acid・Airの3レーン**。

- Drums: 少数のkick / hat等。まず反復の気持ちよさを固定する。
- Acid: 単音の16-step、休符、accent、slide、cutoff / resonance / envelope。
  ドラムと同じ時間軸で編集する。808/909はドラムの音色系統、303はベースの音作りとして分ける。
- Air: 低音の軸と共通音を保ち、上声一音や薄い和音をゆっくり移す。最初はOFFも選べる。
- 和声マップ: 共通音数、近い声部移動、モード／全音音階等を表示。
  五度圏やドミナントの矢印は一つの見方であり、必ず機能和声で解決する装置にはしない。
- 保存: seedと編集内容のJSON、3レーンのMIDI、音色・調律・slide対応メモ。

「無段階」の第一段階は連続した音色・声部・密度変化。微分音まで同時に盛り込まない。
microtuningは別途音源対応を確認する。MIDI音符だけに周波数や303 slideの再現を期待しない。

## 既にあるものと不足分

| 役割 | 再利用・参照する現物 | 足りないこと |
|---|---|---|
| 和声と声部 | Musicの`band-room.js`にchord / voice-leading処理 | 和声の近さを目で見て選ぶUI、編集状態の単独契約 |
| アシッドの質感 | Core RigのACID culture / lock、fader思想 | 独立した303的16-step編集、accent / slideの明示状態 |
| ドラム・MIDI | drum-floorのgroove grammar、`src/midi-output.js`、`drum_floor/midi.py` | 共通8小節へ受け渡す明示adapter、専用演奏画面 |
| MIDI読込 | Band Roomの既存`@tonejs/midi`利用 | ドラム先頭1小節を越える3レーンの書出し契約 |
| 薄い和声と余白 | chillのpiano / rest設計、Musicのreference | Airレーンとして限定した独自実装・試聴 |
| 仕上げ・人力演奏 | Sonar / NI workflow、private機材台帳 | 選んだ音源とCCの対応、実機での音・録音確認 |

既存runtimeをコピーして一つに結合しない。Musicはpublicなsession契約を所有し、
drum-floorはgrooveの専門性を保つ。最初はMusic内のoff-by-defaultな独立preview候補。
`engine.js`、既定の再生、REC、OUTPUTを変えず、音を出すのは人間のSTART後だけにする。

## GitHubから採るなら小さく

以下は比較候補。今回は依存を追加せず、forkもしません。

- [tonnetz-viz](https://github.com/cifkao/tonnetz-viz): MIDIと和声関係を結ぶ視覚表現の参考。
- [Tonal](https://github.com/tonaljs/tonal): 音程・音階・コード計算の候補。音源エンジンではない。
- [Tonejs/Midi](https://github.com/Tonejs/Midi): 既存の読込利用と書出しの適合を確認する候補。
- パターンをコードで演奏する別UIは選択肢だが、最初の学習導線には増やさない。

採用時に現行license・version・必要機能を確認し、外部依存台帳とテストに追加する。
写真の市販教材のレイアウト・図版・本文を移植しない。一般理論から独自に組み立てる。

## 実装順と完成条件

1. **session契約**: BPM・8小節・3レーン・note / rest / accent / slide・seed・音色メモ。
   保存→読込で一致し、note範囲やBPM不正を拒否。再生やMIDI送信はまだ不要。
2. **編集と静かなpreview**: マウスで16-stepと休符を編集。一つのtransport、STOP / panic、
   Air OFF、層のON/OFF。自動再生・外部MIDI・マイクは既定OFF。
3. **MIDIとSonar往復**: 3トラックと拍位置を保持。slide等の表現限界を明記し、
   音源設定を別保存。同じネタを開き直せることを確認。
4. **人間の試聴**: drumsだけ → drums＋acid → Airを足す。各30–90秒。
   「ノれる」「分離していない」「音が多すぎない」「変化しても拍の芯が残る」を人が判定。
5. **実機adapter**: 選んだノブ・鍵盤をMIDI learn等で明示接続。EP-133への音源・project書込み、
   実配線変更は別の人間ゲート。画面試作の完成条件には含めない。

最初の完成: **機材なしで8小節を編集し、保存・読込・MIDI持出しができる**。
完成としないもの: 音量が出た、MIDIファイルがある、スクリーンショットが綺麗、だけの状態。
