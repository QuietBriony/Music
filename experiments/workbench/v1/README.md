# 公開ブラウザ制作台（v1）

`Music` repo 内の独立した Strudel 試奏アプリ。PCとスマホで同じCloudflare Pages URLを開き、3本のループやStrudelの合成音・標準ドラムバンクを聴きながらコードを変える。既存の `music-stack.pages.dev` とGitHub Pagesの公開再生は変更しない。

入口: <https://music-private-live-workbench.pages.dev>。既存Pagesプロジェクトの名前には `private` が残るが、**このページ、試作コード、3本のWAVは公開**される。URLを知る人は音源を取得できる。検索結果には載せない設定だが、これはアクセス制限ではない。

## 使い方

1. スマホまたはPCで入口を開く。最初は `aphex1`。`Acid 303 / 909` のハード版と初稿、`Techno 01・直進`、`Techno 02・余白`、`Auto Groove・毎周変化`、前の高速版と従来の4小節テストも一覧から選べる。
2. 最初に `Play` を押す。再生中に別の試作を選ぶと、コードを読み込んで演奏を切り替える。iPhoneでは最初の音声再生にタップが必要。停止中に選んでも音は勝手に鳴らない。
3. コードを変更したら `コードを反映` を押す。`Stop` ですぐ停止する。`選択中の版に戻す` で元コードへ戻る。
4. 気に入った編集は `この端末に保存` を押し、画面内の名前欄で下書きとして保存する。同じブラウザの下書き一覧からコードを戻せる。未保存のまま切り替える時は画面内で確認できる。
5. `Acid 303 / 909` を選ぶとコードの上に4本の縦フェーダーが出る。Play後、CUTOFF（明るさ）、RESONANCE（みょん感）、DRIVE（歪み）、DECAY（うねりの長さ）を動かす。数値はその場でコードにも残り、次の発音から反映される。Stopでフェーダーは止まる。元に戻すなら初稿を選ぶか「選択中の版に戻す」を押す。
6. コードの上の「この試作の音量」で、公開試作ごとに0〜100%の音量を合わせる。100%は元の音量、0は消音。Play中も動き、値はコードと**この端末のブラウザ**に試作ID別で残る。音を自動採点・均一化する機能ではなく、耳で合わせる。
7. ページ先頭の「2つの試作を組み合わせる」で公開試作をA/Bに選び、「組み合わせを開く」→Play。A/B音量と横のCROSSFADEを動かす。左端はAだけ、中央は両方、右端はBだけ。BはAのテンポに同期するので、違うBPMの2曲を元の速さのまま独立再生するDJデッキではない。気に入った組み合わせは「この端末に保存」でコードごと下書きへ残せる。`?deck=acid-303-909,techno-dub`のようなURLは公開試作の組み合わせを開くが、端末内の音量値は共有しない。
8. ページ先頭の「音のモジュールを選ぶ」→「この中で開く」で、`acidBros`の2台の303と11パートの909を同じページ内で開く。スマホなら隣の「全画面で開く」が操作しやすい。Strudelの演奏は止まる。中の`RUN`で再生し、16ステップの打点と各つまみを触る。`FILE`で保存してから「閉じて停止」。直行URLは`/?module=acidbros`。StrudelのPlayに戻るとacidBrosを閉じて停止する。
9. 303＋909で`FILE → SAVE`すると、試奏台の「この端末の303＋909パッチ」に名前と更新時刻が出る。名前は中のFILEで変更できる。パッチ名を押すとページ内に読み込み、隣の「全画面 ↗」ならスマホ向けの全画面でそのパッチを開く。読み込み前に現在の303＋909を停止する。未保存の調整がある場合は先にFILEで保存する。
10. 303＋909をページ内で開いた後、「StrudelのBPM → 303＋909」で現在選択中のコードのBPMを機械へ渡せる。逆の「303＋909のBPM → コード」は機械を閉じてStrudelコードの`setcpm`行だけを更新する。Playで聴き直し、残すなら「この端末に保存」。どちらもボタンを押した時だけの転送で、再生位置や音を同期しない。`setcpm`行が一つに定まらないコードでは転送ボタンを使えない。

フェーダーを上げるほど数字が大きくなる。CUTOFF（初期420 Hz、範囲120〜2200 Hz）は高いほど明るく鋭く、低いほどこもる。RESONANCE（初期18、1〜35）は高いほど「ミョン」という共鳴が鋭く、低いほど丸い。DRIVE（初期3.2、0〜7）は高いほど歪んでザラつき、低いほど澄む。DECAY（初期0.18秒、0.03〜0.5秒）は高いほどフィルターのうねりが長く、低いほど短く切れる。DECAYは音符自体の長さを変えない。まず1本だけ動かし、Stop後に「選択中の版に戻す」で基準値へ戻すと差が分かりやすい。

公開試作8件はGitの `src/library.json` と `src/patterns/*.txt` で版管理し、Pagesへ配信する。作品の日付ではなく、この試奏台へ登録した日付を一覧に表示する。`Techno 01` は124 BPM相当の4つ打ち、`Techno 02` は112 BPM相当で音数を減らす。`Auto Groove` は116 BPM相当で高音パートを確率的に間引き、8小節ごとにキックを一度抜く。これはStrudelのパターンによる自動変奏で、AIが音を聴いて生成しているわけではない。音の好みは本人試聴で判断する。

2デッキはStrudelの単一clockで2つのパターンを`xfade`し、作品内の各パートのgainを保ったまま作品全体のgainを掛ける。中央で両方が鳴るため合成後に0.7倍のheadroomを設けた。大きさの最終判定と実iPhoneでの同時再生負荷は未確認。旧形式の標準下書きには音量フェーダーを追加して開き、独自構造のコードは変更せずに開く。

`Acid 303 / 909` は128 BPM相当。ドラムはStrudel標準の `RolandTR909` バンクを再生時に外部から読み、303風ベースは鋸歯波・共鳴ラダーフィルター・フィルターエンベロープ・歪みでブラウザ内合成する。初稿より共鳴、フィルターのうねり、歪みを強め、歪みの後で音量を抑える。このStrudel版で参照する909バンクはrepoへ複製しない。初回は標準バンクの読み込みを待つ。画面の縦フェーダーはStrudelのコード内スライダーを操作するので、変更値はコードに残り再評価なしで次の発音へ反映される。コード中の青いスライダーからも操作できる。初稿は別IDで残し、一覧で選べば元のコードに戻る。気に入った状態は「この端末に保存」で名前を付け、公開版へ採用する時はGitの試作コードとListenの入口を同じ変更で更新する。

## 303＋909ブラウザモジュール

`acidBros` v153を独立した画面として同梱した。2台の303は発振器→フィルター→ディレイをつまみで変え、909は11パートの16ステップと音色パラメータを触れる。これは**モジュラー風の制作入口**で、自由なケーブル配線やVST読み込みはまだない。Strudelの2デッキとは別の音声エンジン・時計・保存形式。FILE保存の一覧を同じoriginの試奏台から参照し、明示操作でBPMを双方向に転送する。連続BPM同期、パターンのコードへの自動変換、音声の内部ミックスはまだしない。切替時に前の演奏を止める。

同梱した909用WAVはハイハット・オープンハット・クラッシュ・ライドの4本、計438,798バイト。残りのドラムと303はブラウザ合成。外部サイトからこれらのWAVを毎回取得する必要はないが、初回は同じPages URLから読み込む。容量を小さくしたことが音声処理負荷やiPhoneのバックグラウンド再生を保証するわけではない。演奏中の各つまみの即時反映と端末上の保存を確認する。

`acidBros`の`FILE`保存は、その端末・そのブラウザの`localStorage`へ残り、Strudelの「この端末に保存」とは別。元のacidBrosサイトとの保存データも別。試奏台の保存一覧はこのacidBrosのFILEを参照しているので、同じブラウザ内だけで再開できる。`/modules/acidbros/?file=<ID>`はそのブラウザに既にあるFILEを選ぶ全画面URLで、他端末へパッチを渡す共有URLではない。共有したい時はacidBros内の`SHARE URL`を使う。公開版に採用するには、人の試聴後にこのrepoで更新する。上流版は自動更新されず、現在の出所・変更点・ライセンスは[`third_party/acidbros/UPSTREAM.md`](third_party/acidbros/UPSTREAM.md)を参照する。

## 人とComputer Useで一緒に触る

1. 人が音を聴きながらPlay、縦フェーダー、試作切り替えを操作する。同じブラウザ画面へComputer Useが接続できる場合は、AIもその画面の操作を手伝える。Stopは画面ですぐ押せる。
2. 「低音を短く」「909を少し薄く」など、聴感の要望をチャットで伝える。つまみだけで足りる変更は演奏中に操作し、ノート列・構成・音色の変更はコードを書き換えて「コードを反映」で試聴する。
3. 良い状態は「この端末に保存」で名前付き下書きにする。公開版に採用するコードと説明を選んだ後、Music repoの `src/patterns/`、`src/library.json`、Listen索引をまとめて更新し、チェックとデプロイを行う。

Computer Useの画面操作はその接続先の1ブラウザに限られ、スマホとPCの操作・音声・下書きは同期しない。チャットでのコード変更とGit/Pages更新には時間がかかるため、演奏中の即時操作はブラウザ内で行う。本人の聴感をAIが自動取得・採点する機能もない。

再生中の試作切り替えと、編集後の `コードを反映` はブラウザ内で演奏を更新する。GPT Liveとの直接接続、マイク・EP-133連動はまだ実装していない。

ブラウザ内で直したコードは自動で公開版へ同期しない。端末内下書きは `localStorage` に残り、別のスマホ・PCには渡らない。ブラウザの保存データを消すと下書きも消える。公開閲覧者にサーバーへの書き込み機能はない。

## 配置と公開範囲

新しいrepoは作らず、`QuietBriony/Music` の `experiments/workbench/v1` を既存のCloudflare Pagesプロジェクトへ配信する。

| 設定 | 値 |
|---|---|
| Project | `music-private-live-workbench`（旧名称） |
| Repository | `QuietBriony/Music` |
| Root directory | `experiments/workbench/v1` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output | `dist` |
| Functions | このrootの `functions/` |
| KV binding | `MUSIC_LIVE_ASSETS`（Pages本番設定） |

KV namespaceそのものはGitHubから見えないが、`GET /api/sounds/{pad,sub,drums}` は公開される。音声ファイルはGitHubに追加しない。現在の画面はGitで版管理したコードを読み、既存の `GET /api/pattern` は旧URLとの互換用に残す（画面は使わない）。APIに書き込み口は設けない。知らないパート名は404で返す。

Pages本番の `LIVE_PATTERN_KEY`（旧互換）と `LIVE_SOUND_PREFIX` はCloudflare側に設定済み。`wrangler.toml`はローカル検証専用で、本番bindingの正本はCloudflare Pages側に置く。新しい音を反映する時は、管理者のWranglerからKVを書き換える。新しい試作コードを公開する時は `src/patterns/` と `src/library.json` を更新し、ビルド・PR・Pages配信を行う。

Cloudflare Access / Zero Trustは使わない。Pages FunctionsとKVは[Workers Freeの上限](https://developers.cloudflare.com/pages/functions/pricing/)・[KV Freeの上限](https://developers.cloudflare.com/kv/platform/pricing/)内で運用し、上限超過時はリクエストが失敗する。音声3本を公開する方針は2026-09-28に本人が確認した。

mainへのpush後はPagesのdeployment一覧を確認する。Git連携で新規buildが始まらない場合は、このディレクトリで`npm ci`、`npm run build`を実行し、`npx wrangler@4.129.1 pages deploy dist --project-name music-private-live-workbench --branch main`で同じ成果物を手動反映できる。Wranglerがローカル専用設定を無視する警告は意図どおり。

## 公開試作の更新

`src/patterns/*.txt` にはStrudelの演奏コードを書く。既存3本の音声を使う時は `s("pad")`、`s("sub")`、`s("drums")` を指定でき、ページが公開音声URLの `samples(...)` 定義を先頭に足す。合成音やStrudel標準バンクは別に指定できる。公開試作は一覧から選ぶとコードが戻り、更新は同じIDの内容を直すか、新IDを追加して旧版を残す。KVに新しいパートを増やす場合はAPIの許可名と音声ファイルを一緒に更新する。

既存の `GET /api/pattern` の互換用KVコードを管理者が更新する例（通常の試作一覧には反映されない）：

```powershell
npx wrangler@4.129.1 kv key put '<LIVE_PATTERN_KEY>' --path '<pattern-file>' --namespace-id '<KV_NAMESPACE_ID>' --remote
```

## ローカル確認

```powershell
npm ci
npm run build
npm test
npx wrangler@4.129.1 pages functions build --outdir .wrangler/function-build
npx wrangler@4.129.1 pages dev dist
```

Strudel本体は `@strudel/repl@1.3.0` をnpmで固定し、ビルド時に同じPages配信へ同梱する。この独立アプリのコードはStrudelの[利用条件](https://strudel.cc/technical-manual/project-start/)に合わせてAGPL-3.0で公開する（[LICENSE](LICENSE)）。同梱acidBros部分は上流READMEがMITを宣言する固定snapshotで、[`third_party/acidbros/LICENSE`](third_party/acidbros/LICENSE)と出所記録を一緒に配信する。既存Musicランタイムとはコードを結合しない。
