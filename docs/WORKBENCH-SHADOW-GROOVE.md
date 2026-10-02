# Workbenchの影グルーヴ — 設計と検証

基準はmain `061adda`。作業は`feature/workbench-shadow-groove`の独立worktree。
Afterimage曲棚PR435／`1656e342`、relay候補は含めない。独立再レビューPASS後、本人の承認により既存Workbenchへの公開対象とした。初期量0と未聴取の条件を維持する。

## 仮説と反証

仮説は1件だけ。主kickと既存打点・強弱を保持し、空いている裏拍へ低ゲイン・HPFの補助層を足すことで、細かな動きと奥行きを増す。

参考は本人指定の[O.N.O公式ビート制作講座](https://www.youtube.com/watch?v=z4ZbEsKRPvQ)の2:18–2:34と12:51–13:30。
親の自動字幕・画面確認を根拠とする設計仮説であり、動画音声を直接聴いていない。動画音源や固有フレーズは取り込まない。

同じseed・BPM・8小節、音量を揃えたA/Bで「騒がしいだけ」「kickが弱くなる」「動き／奥行きが良くならない」と感じたら不採用。
数値PASSを聴感PASSに置き換えない。直接の聴取と実iPhone評価は未実施で、初期量は0を維持する。

## 操作と音の正本

既存のライブセットのドラム欄に「影グルーヴ・低音カット」を追加した。
量0–25%、HPF 900–6000 Hz、ミュートを操作できる。量0または有効0で補助層のイベントを出さない。
追加打楽器のMUTEも優先し、INTRO／アンビエントでは既存の展開ゲートに従って抑える。

音の正本は表示されたStrudelコード。V4には影の8小節の音符、強弱、左右位置、音源参照、短い包絡、HPFとQ、音量、ゲート、量／HPF／ミュートを次の小節へ反映する`shadowControl`と`setScore.shadowInput`も出力する。
そのコードを既存の同一schedulerが実行する。別時計や画面外の補助DSPは追加しない。
入力時に同じschedulerの演奏cycleを取得し、表示コードの`setScore.shadowInput`へ渡す。lookupの先読みcycleと操作cycleを分け、queryが既に次小節へ進んでいても操作cycleの次の境界に予約する。同じ小節への連打は最後の値へまとめる。
`withQuerySpan`も休符中の変更を拾う。外部から直接signalを変更した場合のfallbackはnativeの`getTime()`を使う。
すでにnative音声ノードへ予約した音は変更前の値を保持し、予約前の次の音から反映する。これはUIにも明記する。手編集で音を小節頭へ移した例でも、予約済みの頭の音は保ち、同じ小節の次の未予約音は新HPFになることを検証した。音の予約を一小節後へ丸ごとずらさない。
Stop後に再生を起こすタイマーやglobal予約はない。再評価時は保存した値から新しい制御を作る。

909の影ハットは許可済みで既に同梱されている`experiments/workbench/v1/third_party/acidbros/assets/samples/tr909/hh01.wav`だけ。
808の影ハットは既存のwhite合成、リムは既存のtriangle合成を使う。新しい音声ファイル・依存・外部音源・認証・配信先は追加しない。

通常のセット生成は8小節最大2発／小節の範囲で、kick・snare・閉／開hat・bell・選択済み追加打楽器の打点と、既存の最終小節pickupを避ける。
既存打点を密にした場合は影を減らし、空きがなければ出さない。既存の変奏や追加キットを重複新設しない。

V1–V3は自動で書き換えない。旧版は明示的な「この版から影つきLIVEを作る」で移行し、初期量0。
手編集した音符・音色・HPF・左右・関数を生成器で上書きしない。構造操作は無効化し、接続が一意な数値フェーダーと影ミュートだけが対応するliteralを変更する。
保存・復元には編集後のコード全体を残す。再開時に自動再生しない。

## 検証と再現

- Workbench: `node --test experiments/workbench/v1/tests/*.test.mjs`。83 PASS／FAIL 0。旧版往復、8小節の再現・衝突回避、小節同期、異常値、手編集保護を含む。
- `shadow-clock.test.mjs`は同梱REPL 1.3.0の実Cyclist／Pattern／miniを使う4つの時計注入試験。演奏cycle0.98133／先読み1.06667、入力後のqueryが境界後へ遅延する場合、量／mute／HPF、連打、BPM60／96／180、Stopと再評価、予約済みの手編集打点を検証する。
- aggregate: canonical repoの`node scripts/stack-check.mjs --music-from <このworktree>`で既存5 repoを検証。39 PASS／FAIL 0／SKIP 0。
- 実ブラウザの`output/playwright/shadow-ui.js`、`shadow-events.js`、`shadow-render.js`、`shadow-analyze.py`が再現用。
- 基準mainのV3生成器と4プリセットのコードを直接比較。byte一致と旧版復元を`shadow-baseline-comparison.json`へ記録。
- 実ブラウザUIは15項目PASS。開始、休符中の変更と次小節反映、HPF／mute同期、連打、Stop、手編集保護、保存復元、非自動再生、390px幅、script error 0。結果は`shadow-ui-result.json`。
- 停止せずに動く実ブラウザschedulerでさらに24項目PASS。実演奏cycle0.97付近で先読みが次小節に進んだ状態から入力し、量／HPF／mute／unmute／連打／BPM変更を確認。描画用queryを除外したnative発音だけを記録し、重複0、Stop後4.5秒も停止を維持。結果は`shadow-live-clock-result.json`。
- seed731／BPM128／ACID固定／8小節の実Strudel onsetは旧版281、量0は281、muteは281、量12%は293。0/offは旧版と完全一致、既存打点・gain・kickは影追加後も完全一致。結果は`shadow-events-result.json`。
- 取得した実onset／音響parameterを同梱Strudel 1.3.0のnative `superdough`へ渡し、OfflineAudioContextで44100 Hz／8小節＋2秒の余韻をレンダー。
  各条件を新しいブラウザpageと単一audio contextでレンダーし、native node poolのcontext混在を避ける。全8小節の先行スケジュールで音を盗まないよう測定用polyphonyを4096にする。noise cacheを同じcontextでgain0の無音から準備し、seed731とonset同一性で測定用乱数を固定する。既存の音はABで同じ乱数列になる。測定用設定はruntimeコードに追加しない。
- 量0、mute、量12%／HPF1800、最大量25%／最低HPF900を比較。数値、20–120 Hz帯域、音量合わせ係数、WAV SHA-256は`output/playwright/shadow-ab/metrics.json`。
- 最終レンダーは5条件ともclip／nonfinite 0、peak約0.283。音量を揃えた20–120Hz帯の変化は12%で−0.000052dB、最大量で−0.000189dB。0/offの旧版との最大波形差は約5.96×10⁻⁸で、native浮動小数・worklet差の範囲。波形のbit完全一致は主張しない。
- P2の時計修正後も静的ABの5条件すべてで実Strudelのonset／全parameterが修正前と完全一致（`shadow-static-comparison.json`）。既存WAVはこの一致を根拠に保持し、演奏コード全文は修正版へ更新した。P2後に音声レンダーを繰り返したという主張はしない。

比較WAVとスクリーンショットはignoredのローカル検証出力のみ。録音・音源はGit差分へ追加しない。
音量を揃えた`A-shadow-off.wav`／`B-shadow-12.wav`を聴感反証に使う。数値結果の要約とファイルの場所は返却用レポートに残す。
