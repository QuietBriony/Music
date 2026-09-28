# 公開ブラウザ制作台（v1）

`Music` repo 内の独立した Strudel 試奏アプリ。PCとスマホで同じCloudflare Pages URLを開き、3本のループを聴きながらコードを変える。既存の `music-stack.pages.dev` とGitHub Pagesの公開再生は変更しない。

入口: <https://music-private-live-workbench.pages.dev>。既存Pagesプロジェクトの名前には `private` が残るが、**このページ、試作コード、3本のWAVは公開**される。URLを知る人は音源を取得できる。検索結果には載せない設定だが、これはアクセス制限ではない。

## 使い方

1. スマホまたはPCで入口を開く。最初はドラムを間引いた `aphex1` を表示する。前の高速版は `aphex1 初稿・高速版`、従来の4小節は `namima IDM・4小節テスト` として残す。
2. 一覧で試作を選ぶと、そのコードが編集欄へ戻る。音は自動では鳴らないので `Play` を押す。iPhoneでは再生開始にタップが必要。
3. コードを変更したら `コードを反映` を押す。`Stop` ですぐ停止する。`選択中の版に戻す` で元コードへ戻る。
4. 気に入った編集は `この端末に保存` で名前付き下書きにする。同じブラウザの下書き一覧からコードを戻せる。公開版を切り替える前には未保存の変更について確認が出る。

公開試作3件はGitの `src/library.json` と `src/patterns/*.txt` で版管理し、Pagesへ配信する。作品の日付ではなく、この試奏台へ登録した日付を一覧に表示する。`aphex1` は初稿への「ドラムが速くて混雑している」という聴感フィードバックを受け、108→96 BPM相当、ドラムの発音をおよそ半分以下、速いゴースト音なしにした調整版。初稿は別IDからコードへ戻せる。調整版の聴感は本人の再試聴で判断する。

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

各 `src/patterns/*.txt` には `s("pad")`、`s("sub")`、`s("drums")` をそのまま書く。ページが公開音声URLの `samples(...)` 定義を先頭に足す。公開試作は一覧から選ぶとコードが戻り、更新は同じIDの内容を直すか、新IDを追加して旧版を残す。新しいパートを増やすにはAPIの許可名と音声ファイルを一緒に更新する。

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

Strudel本体は `@strudel/repl@1.3.0` をnpmで固定し、ビルド時に同じPages配信へ同梱する。この独立アプリのコードはStrudelの[利用条件](https://strudel.cc/technical-manual/project-start/)に合わせてAGPL-3.0で公開する（[LICENSE](LICENSE)）。既存Musicランタイムとはコードを結合しない。
