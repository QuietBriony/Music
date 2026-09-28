# 公開ブラウザ制作台（v1）

`Music` repo 内の独立した Strudel 試奏アプリ。PCとスマホで同じCloudflare Pages URLを開き、3本のループを聴きながらコードを変える。既存の `music-stack.pages.dev` とGitHub Pagesの公開再生は変更しない。

入口: <https://music-private-live-workbench.pages.dev>。既存Pagesプロジェクトの名前には `private` が残るが、**このページ、保存コード、3本のWAVは公開**される。URLを知る人は音源を取得できる。検索結果には載せない設定だが、これはアクセス制限ではない。

## 使い方

1. スマホまたはPCで入口を開き、`Play` を押す。iPhoneでは再生開始にタップが必要。
2. コードを変更し、`コードを反映` を押す。`Stop` ですぐ停止する。
3. AIが保存版を更新したら、`元コードを読み直す` を押す。

ブラウザ内で直したコードはその端末だけの試奏で、保存版へ自動同期しない。読み直すと端末内の変更は破棄される。公開閲覧者にサーバーへの書き込み機能はない。

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

KV namespaceそのものはGitHubから見えないが、`GET /api/pattern` と `GET /api/sounds/{pad,sub,drums}` は公開される。音声ファイルと保存コードはGitHubに追加しない。APIは設定されたKV keyを読むだけで、書き込み口は設けない。知らないパート名は404で返す。

Pages本番の `LIVE_PATTERN_KEY` と `LIVE_SOUND_PREFIX` はCloudflare側に設定済み。`wrangler.toml`はローカル検証専用で、本番bindingの正本はCloudflare Pages側に置く。新しい音やコードを保存版へ反映する時は、管理者のWranglerからKVを書き換える。

Cloudflare Access / Zero Trustは使わない。Pages FunctionsとKVは[Workers Freeの上限](https://developers.cloudflare.com/pages/functions/pricing/)・[KV Freeの上限](https://developers.cloudflare.com/kv/platform/pricing/)内で運用し、上限超過時はリクエストが失敗する。音声3本を公開する方針は2026-09-28に本人が確認した。

mainへのpush後はPagesのdeployment一覧を確認する。Git連携で新規buildが始まらない場合は、このディレクトリで`npm ci`、`npm run build`を実行し、`npx wrangler@4.129.1 pages deploy dist --project-name music-private-live-workbench --branch main`で同じ成果物を手動反映できる。Wranglerがローカル専用設定を無視する警告は意図どおり。

## 保存版の更新

保存コードには `s("pad")`、`s("sub")`、`s("drums")` をそのまま書く。ページが公開音声URLの `samples(...)` 定義を先頭に足す。新しいパートを増やすにはAPIの許可名と音声ファイルを一緒に更新する。

管理者がローカルの保存コードをKVへ送る例（プロジェクトrootで実行）：

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
