# Band Room — 総合マニュアル（現行 playability）

2026-10-23 v431: AIギターの4曲26打点を、固定の和音から原音に裏付けのある単音リフへ補正。分離otherと分離前原音の異なる周波数解析が一致し、声とベースの漏れを抑える判定も通した候補に限定。実native出力で周波数の一致が悪化した3候補は見送り。打点・強弱・音長・奏法、ベース／ドラム、原曲マスタリングと調和ミックスは保持。途中移動で古いTransportの予約が小節位置を進める競合も修正し、全パートを選んだ譜面時刻から再開する。nativeの停止も先読み待ちを挟まず、音声時計の現在時刻で確定する。cache `hazama-fm-v431` / client `band-room.js?v=br-264` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v430: AIベースの休符を分離音源と分離前原音の両方へ照合。5曲8音だけ、譜面の音長より後の追加releaseを制限し、バンドが止まる間を保つ。音程・打点・強弱・譜面の保持音長、楽器bankと−3 dB基準は維持。原曲系は7曲21区間で低中域をさらに削る案を比較し、不採用。本人が評価した原音マスタリング／調和ミックスを維持。cache `hazama-fm-v430` / client `band-room.js?v=br-263` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v429: AIベースの前出を−3 dBで抑え、ほぼ無音の分離音源から最低音量へ持ち上げられた短い検出116音を6曲から除外。前後を含むRMS −65 dBFS未満・peak −45 dBFS未満、velocity 0.16以下・長さ0.25秒以下に限定。残す音符の音程・打点・強弱・長い余韻、ギター／ドラム音源は維持。原曲系のv428調和ミックスは保持。HAZAMAは公開済みの試作として専用入口を残し、Tabascoの通常リンクで未完成バンドが表示される条件を修正。正式昇格は行わない。cache `hazama-fm-v429` / client `band-room.js?v=br-262` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v428: 調和ミックスの共通反射だけを0.65倍（−3.74 dB）へ。7曲28区間で原音・v427・帯域制限案・反射なしの診断案と比較し、追加反射の重なりを控えめにする。直接音、録音済みの余韻、パート間の音量・send比、EQ・反射時刻は保持。gate・圧縮や新しい音源は加えない。cache `hazama-fm-v428` / client `band-room.js?v=br-261` / CSS `band-room.css?v=br-98` / stem mix v3。

2026-10-19 v427: 調和ミックスを分離前原音の28区間と音量を合わせて比較。声の基準を0.86→0.84、2.8 kHzを−0.8→−1.2 dB、全体の3.2 kHz shelfを+0.5→−0.5 dBへ。声のroom sendを0.22→0.18、共通反射は遅い成分を減らして近い反射へ配分。楽器の直接音を遅らせず、圧縮・gate・新しい残響を追加しない。原音ファイル・AI・旧仕上げ・個人のfader設定は保持。cache `hazama-fm-v427` / client `band-room.js?v=br-260` / CSS `band-room.css?v=br-98` / stem mix v2。

2026-10-19 v426: パート別の標準を「調和 · ライブ再ミックス」へ。4音源を従来の曲別boost・EQ・声FXの手前で取り出し、独立した基準音量、声の低域／突出帯域の軽い整理、全パート共通の19–139 msの短い反射でまとめる。新しい圧縮・歪み・長い残響・幅の拡張は加えない。7曲の全長測定で曲別headroomを校正。新しいバランスは80が基準、旧カスタム音量は保存して以前のライブ／厚めで呼び出せる。ライブ原音のv425補正・AI音源・採譜は不変。cache `hazama-fm-v426` / client `band-room.js?v=br-259` / CSS `band-room.css?v=br-98`。

2026-10-19 v425: 分離前の仮ミックス7曲に、26 Hzの低域整理・230 Hzの−1.5 dB・3.2 kHzからの+0.5 dBの軽いライブ補正を追加。圧縮・gate・追加残響・幅の拡張は使わず、原音ファイルを保持する。元の仮ミックスとのA/Bは曲ごとに音量を合わせ、40 msで切替。パート別は歌・ギターほか・ベース・ドラムのminus-oneをワンタップで選べる。分離漏れと元録音の歪みは残り、分離品質の向上を意味しない。cache `hazama-fm-v425` / client `band-room.js?v=br-258` / CSS `band-room.css?v=br-97`。

2026-10-18 v424: AIベースの長い保持音が3秒の音源末尾で途切れる問題を修正。ベースだけ16 kHz／8秒へ延ばし、譜面の音長・自然減衰と次音でのdampingを保つ。53 buffer／15,274,240 bytes、再生node数と128発の上限は維持。原音・採譜イベント・ギター／ドラム音色は保持。分離前原音の終端を7曲の譜面metadataへ結び、ベースのreleaseを録音終端以内に収める。シーク直後の小節処理を確実に起動し、全パートが1小節遅れて鳴るケースも修正。分離前原音も参照し、裏付けの弱い音高変更は不採用。cache `hazama-fm-v424` / client `br-257` / bank v5 / adapter v7。

2026-10-18 v423: 公開環境でCloudflare Pagesの音声Range要求が200の全体応答になることを確認。原音の音声だけを既存の同一Music GitHub Pagesへ向け、206の部分読み込みで途中移動できるようにする。CORSをsrc設定前に有効化し、Web Audioの消音を防ぐ。入口・7音源のbyte内容・共通−2.2 dB・AIの採譜と音色は保持。原音moduleにも版を付け、旧PWA cacheの参照を避ける。cache `hazama-fm-v423` / client `br-256` / CSS `br-96`。

2026-10-18 v422: Tabascoの通常入口を、本人が公開承認した分離前の仮ミックス7曲の直接再生へ変更。M4Aはbyte一致のまま、再生時の共通−2.2 dBだけを加える。単一media elementをストリーム再生し、原音では既存のstem／AIエンジンを起動しない。ライブ原音／パート別／AI再現は同じページの明示リンクで切り替え、停止して開く。HAZAMAと明示的な練習リンクは既存経路。元からのにじみ・録音品質は残る。実iPhoneと本人聴感は未確認。cache `hazama-fm-v422` / client `br-255` / CSS `br-96`。

2026-10-16 v421: 原音のライブ経路を各stemのEQ・声のコーラス／残響より前から合流させる。録音に含まれる位相と余韻を保ち、曲別trim・パート音量／ミュート・全体音量・REC・出力保護は共通。声は従来のdry量0.78に合わせる。厚めは従来のEQ／FX経路。ライブでは効かない声FXも無効表示し、設定値は保存する。原音・AIの音源／採譜は保持。数値は録音への忠実度を測るもので、本人聴感・実iPhoneの合格とはしない。cache `hazama-fm-v421` / client `br-254`。

2026-10-13 v420: 原音otherの帯域エネルギーとspectral fluxを照合し、5曲のギター351打点を約12〜65 ms前へ補正。note-offと強弱を保持し、ベース・ドラムと同じ原音時刻に寄せた。連続ストロークの前後で安定し、CQTとlinear STFTの両方が支持する5和音を追加。従来の和音注釈は補正後の各行へ結び直す。原音・他パート・音源bankは保持。分離漏れと未採譜／曖昧な音は残り、完全再現・聴感合格とはしない。cache `hazama-fm-v420` / client `br-253`。

2026-10-13 v419: 短いTABASCOを200打以上の固定条件で除外していた採譜処理を修正。原音drumsから204打を採用し、うち128打を立ち上がりへ合わせ、10打の弱い同時cymbalを補った。曲の進行に沿うドラム譜を通常ARCBで使用する。AIの開始／seekでは音の予約時刻と再生時計を一致させ、look-ahead分の先走りを修正。ギター・ベースの譜面、音源bank、原音と仕上げは保持。クラス推定・分離漏れと実iPhone聴感は未解決。cache `hazama-fm-v419` / client `br-252`。

2026-10-12 v418: 読み込み中に選んだ原音の「ライブ／厚め」とA/B復元を、その後の保存設定の適用で戻さない。操作しなかった場合は従来どおり保存した仕上げを復元する。v417の音作り・採譜・原音ファイルは保持。

2026-10-12: v417でベースの弾き直しと打点、ドラムの打点と同時打ちを原音から補正しました。原音は sound mix → 原音の仕上げ で「ライブ · 録音の響き」（初期値）と「厚め · 従来の仕上げ」を切り替えられます。ライブは全体への歪み・広がり・長い残響の追加を通さず、強弱と録音の余韻を残します。録音ファイルは同じです。

2026-10-12: v416から通常のARCB「AI再現」に、比較で作った新しいギター・ベース・ドラムを採用しました。いつもの曲でSTARTすると、3楽器の合奏が鳴ります。原音との切替、パート別のON／OFF、クランチ／ディストーション、空気感とRECは同じ場所です。原音の録音は変更せず、ギターの和音をストロークごとに再分析しています。

2026-10-12: 「ベース・ドラムを比較」を追加。比較を準備 → ベースだけ／ドラムだけ／3人で合奏 → 新しい音／これまでの音。15秒の単音と一打から2小節へ進み、同じ平均音量で芯と余韻を比べます。録音素材の取得なし。前回のギター比較はその下にあり、この新しい合成音はv416で通常ARCBへ採用済みです。

2026-10-12: 一本の比較に「新しい弦合成で聴く」を追加。比較を準備 → 新しい弦合成 → これまでの合成 → 録音ギターで、低いEの芯、コードの余韻、ミュートの短さを同じ音量で確認します。新しい合成は録音を使わず、弦の倍音と減衰を作り直した候補です。新しい弦合成はv416で通常ARCBへ採用済みです。

2026-10-11: ギター一本の比較を追加。「ロックギター一本を比較」を開き、比較を準備 → 合成で聴く／録音ギターで聴く。同じクランチと平均音量で11秒を比較。録音4音は準備を押した時だけ約0.41 MB取得し、ARCBへは未採用。短いミュートは加工による近似、RECは通常曲で使用。実iPhoneと音色の採用は本人確認。

> 通常入口: https://quietbriony.github.io/Music/band-room.html
> HAZAMA直接入口: https://quietbriony.github.io/Music/band-room.html?band=hazama
>
> Tabasco LIVEの原音 / AI再現と、HAZAMAの原音 stems / AI再現をブラウザで遊ぶ
> 練習・比較・録音web app。install不要、PWA対応。
>
> このページの「最短導線」がSTART復旧を含む操作の正本。
> カラオケ・録音・Suno等の用途別レシピは
> [BAND-ROOM-USAGE.md](./BAND-ROOM-USAGE.md) を使う。

---

## 現在地とversion

- 現行Band Room runtimeは **v418**（原音から和音・音域を補正、ロックのストロークと弾き方）。HAZAMAのplayability候補は **v401** のまま。client markerは
  `band-room.js?v=br-256` / `band-room.css?v=br-96`。
- この文書を既存PWAへ届けるdocs cacheは **hazama-fm-v418**。v401はHAZAMA AIの
  arp + basslineのauthored基準配置をactive sectionあたり20–21発へ整理し、明示休符と
  約96–101 msのnote gateを入れた再試聴候補。実演時のbass ghost/dropは基準から発音を
  減らすだけ。v400の02 AI暫定表示、session-only KARAOKE導線、
  曲別歌詞一致も含む。原音stem、`engine.js`、model weightは変更していない。
- Tabascoの曲順 / title / catalog durationは`presets/bands.json`、BPM / key / 構成は
  7曲のdrum-frame、canonical / fallback歌詞はfinal文書が正本。原音karaokeでは任意の
  timed lyricsを重ねる。`tabasco-songs.json`は保守用の派生一覧で、
  再生runtimeやoffline起動には使わない。
- TabascoもHAZAMAも `📻 原音` と `🎛 AI 再現` を切替可能。HAZAMAの原音は
  01 メロウ / 02 Hard完成レンダーのDemucs 4-stem（各約33.0 MiB）で、
  deep-link時は `📻 原音` を自動選択する。02のAI再現は01 authored framesデータ共有の暫定版で、
  曲ID seedによる微細な実演差はある。
  02固有の基準は原音。v390〜v396は
  **synth-only / AI再現専用**（`🎛 AI 再現`を自動選択・原音disabled）だった。
- HAZAMAはまだmain band selectorでは `ui_hidden`。v400時点のSurface試聴ではSTART、
  ピーポーなし、途切れなし、画面ロック解除後の復帰、Tabasco復帰は前進したが、
  AIの短音過密は音質×。v401はその再試聴候補で、Surfaceとreal mobileの実音確認後に判定する。
  real mobileの安定性確認と
  公開昇格は **BL-041 human gate**、車載 / Bluetoothの実機確認は
  **BL-003 human gate**であり、この文書更新では合格扱いにしない。
- 詳細な版履歴は [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md)、
  未完了タスクの正本は [autonomy/BACKLOG.md](./autonomy/BACKLOG.md)。

### 原音に基づくギターの和音と音域（v412）

原音のotherから、同じ響きが続く区間だけギターの和音と音域を補正します。
7曲の234小節に採用。曖昧な区間は従来の音符を保ちます。ベース由来の根音だけで全コードを決める方式を一部改善しました。
打点と強弱、ベース・ドラムのノリ、弦の余韻と弾き方は保ちます。分離漏れがあり、完全な多声採譜ではありません。
実際の合奏録音と原音の比較は[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。

### ロックのギターの弾き方（v411）

ギターの音を「クランチ」または「ディストーション」にして、弾き方を選びます。
「ロック」は8分／16分の上下ストロークで和音を鳴らし、速く弱い刻みの一部をパームミュートします。
「響かせる」は和音の胴と余韻を残し、「カッティング」は弦をまとめて短く切り、
「パームミュート」はブリッジ側を押さえた弦の音を使います。
弾き方はセッション内の選択です。原曲の手の動きやミュートを検出したものではなく、音符からの推定です。
通常のコードを短い検出音符だけで切らず、次のストロークまで響かせます。ベースとドラムの余韻も残します。
実出力と修正前後の比較は[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。

### 採譜の空白と歌の音程（v410）

採譜のあるパートは音符のない小節に自動伴奏を足さず、前の音の余韻を残します。
空白には検出漏れも含まれ、原曲の完全な休符判定ではありません。
Electric Sheep／TABASCOの歌の音程は未採譜のため、melodyを鳴らさず画面に表示します。
採譜のある曲へ戻すと、元のmelody選択で使えます。明示的な「再構築」は従来どおり別の伴奏を作ります。
実測と残る違いは[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。

### ARCBの合奏補正（v409以降）

ギター・ベースの芯、打楽器の低音と高域、弦の余韻を合奏で調整しています。
途中へ移動した後の長い無音と、採譜の時刻を別テンポで鳴らす累積ずれを修正しました。
原音と比較するときは、原音のvocalsとAIのmelodyをOFFにして伴奏同士を聴くと判断しやすくなります。
原音には分離漏れがあるため、パート単体の漏れをその楽器の正しい音として扱いません。
melodyは歌声ではなく音程のガイドです。実出力の測定は[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。

### ARCBの弦の響きと空気感（v408以降）

AI再現では、短い音符でもギターの和音とベースの響きが自然に減衰します。
次の和音／ベース音では前の音を滑らかに押さえ、低音が重なるのを防ぎます。
「空気感」は全パートの共通の部屋の響き。既定35%、0%で直接音だけになります。
ギターのクリーン／クランチ／ディストーションと組み合わせて、余韻と輪郭を聴き比べてください。
パートの音量は部屋へ送る音にも効き、STOPとseekは残響も止めます。


## 最短導線 — ARCB / Tabascoのドラムからバンド練習

1. [Human Flyの原音](../band-room.html?band=tabasco&song=human-fly&mode=stems)を開き、`START`を押す。4 stemsを聴いたら原音の`all off`→`drums`だけONでドラムの打ち方を確認する。
2. 同じ小節を[Human FlyのAI再現](../band-room.html?band=tabasco&song=human-fly&mode=synth)で聴く。`all off`→`drums`だけONで打点、フィル、強弱を比較する。7曲は画面上部の曲ボタンから選ぶ。
3. 自分でドラムを叩く練習では`📻 原音`で`all on`→`drums`だけOFFにして残りの3 stemsを伴奏にする。逆にドラムだけ聴きたいときは手順1。音が出るのは手動`START`後だけ。
4. AI再現は練習用。新ARCBは最大24打/小節、弦とmelodyは各16行まで再生します。採譜の取りこぼしやハイハット・和音の近似は残るため、原音全体と比較してください。

## HAZAMAを聴いてLyric Labへ渡す

1. [Listen hub](../listen.html)を開き、current passの
   [HAZAMA Band Room](../band-room.html?band=hazama)へ進む。
2. 01 / 02を選び、`📻 原音`（基準）と`🎛 AI 再現`を切り替える。02のAI再現には
   「02固有AIではない・01 authored frames共有・比較基準は02原音」と表示される。4ケースの直接linkはListen hubにある。
   歌詞を外して演奏を聴く／自分で歌う時は01/02の`KARAOKE` linkを使う。
3. `START`を一度押す。表示が `WARMING UP` / `PREPARING AI` の間は、
   band / song / modeがbusy中なので切替を待つ。
4. v401 AIはまず`all off`から、`drums + bass`、`drums + arp`、
   `drums + bass + arp`（vocal OFF）、`defaults`の順に各30–90秒聴く。
   どの層で短音過密になるかを分け、続けられれば約6分のarcを聴く。弱端末の比較だけ
   [phone-light](../band-room.html?band=hazama&aiLight=1)を使う。
5. Listen hubへ戻って[Lyric Lab](../lyric-lab.html)を開き、制作元をBand Roomとして
   keep / fix、歌詞、BPM / key / 尺、制作先を手動で整理する。リンクを開くだけでは、
   ACE-Step等のmodel実行、weight download、音声生成は始まらない。

### STARTに失敗したら

- 失敗時はplayingへ進まず、ボタンは`START`へ戻り、直下に復旧案内が出る。
  REC / stems packも無音のまま開始しない。
- AudioContext停止なら画面を一度tapしてから`START`を一度押す。
- 直らなければ`RESET AUDIO`を使い、必要ならreloadして通信状態を確認する。
- 「曲または再生モードを切り替えています」と出た場合や、
  `WARMING UP` / `PREPARING AI`中は連打せず、band / song / modeのbusy解除を待つ。

## Tabascoをまず触る

1. [通常のBand Room](../band-room.html)を開く。初回はTabascoの01 `TABASCO`と
   `📻 原音`から始まる。以後のqueryなしreloadは保存済みのvisible bandを復元し、
   そのbandの01へ戻る。HAZAMA deep-linkはこの復元より優先される。
2. `START`を押し、分秒バーで任意地点へseekする。STOP後もその位置から再開できる。
3. 曲末は02 `Hey`以降へ進む。`📻 原音` / `🎛 AI 再現`を切り替えて比較する。
4. `📖 ?`ボタンでkeyboard shortcutを確認する。

---

## ARCBの新しい楽器音

AI再現のSTARTで、新しいギター・ベース・ドラムを準備して既存7曲の採譜を鳴らします。
ギターの音はクリーン／クランチ／ディストーションを演奏中にも切り替えられます。
melodyは歌の音程を弦でなぞるパートです。歌声の再現ではありません。
パートを消して練習し、原音と切り替え、通常のRECで録音できます。
Radiohead／レッチリのような輪郭と打感を方向性とし、特定録音の音色コピーは主張しません。
採譜の誤り、ギターの全構成音・細かな奏法、実iPhone負荷は次の評価対象です。

## 画面構成（現行: br-256 / br-96）

```
┌─────────────────────────────────┐
│  BAND ROOM                 [?]   │  ← ヘッダ + help button
├─────────────────────────────────┤
│  [-] master volume [====] 80 [bridge] [+] │  ← sticky 車 / touch 向け常時音量 (狭幅は route 非表示)
├─────────────────────────────────┤
│  [Tabasco] [...]                 │  ← visible band 選択（HAZAMAはdeep-linkのみ）
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← Tabasco の 7 曲
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← HAZAMAでは原音を自動選択（AI切替可）
├─────────────────────────────────┤
│  [ START ]                       │  ← 再生 / warming / preparing / stop
│  01 Still Moving · 原音 4 stems   │  ← 選択文脈 / 読込サイズ
│  復旧案内                         │  ← START失敗時だけ表示
│  0:00 ━━━━━━━━━━━━━ 5:04          │  ← song timeline / seek
│  117 BPM · G major               │
│  verse-1 · 4/16 → chorus-1       │  ← セクションナビ
│  ▮▮▮▮▮▮▮▯▯▯▯ (RMS meter)      │
│  ▆▅▄▆▇▅▃▂▁▁ (spectrum 64-bin)  │
│  [intro] [verse-1] [chorus-1]... │  ← click=jump, shift-click=A/B loop
├─────────────────────────────────┤
│  ▸ listening note               │  ← 端末内保存 / context付きcopy
├─────────────────────────────────┤
│  layer toggles (mode 別)         │
│  📻 vocals · drums · bass · other │
│  🎛 drums · bass · guitar · vocal · chords · arp · click │
├─────────────────────────────────┤
│  [ lyrics — current section が    │  ← 自動スクロール + ハイライト
│    glow して、他は dim ]          │
├─────────────────────────────────┤
│  chord: G                        │
├─────────────────────────────────┤
│  ▾ sound mix                     │
│  ▾ 🎙 external vocal              │
│  ▾ 🥁🎸🎹 external stems          │
│  ▾ 🎵 vocal phrase trigger        │
│  ▾ 🥁 drum kit + synth profile    │   ← v91-v102 の中心
│  ▾ 🐢 practice tempo (50-120%)    │
│  ▾ 🔀 A/B compare                 │
│  ▾ 🎹 MIDI in/out                 │
│  ▾ ⏺ live record                  │
│  ▾ 📦 stems pack export           │
├─────────────────────────────────┤
│  別 app · Drum Floor · 歌詞 · DAW │   ← footer リンク群
└─────────────────────────────────┘
```

---

## 主要機能の入口リンク

### モード切替

- **📻 原音 stems** — Demucs で分離した 4 stem (vocals/drums/bass/other) を再生
- **🎛 AI 再現** — Tone.js 合成器で打ち込み再現
- 両対応bandはmode barで切替（v397からHAZAMAも両対応・原音が既定）。
  非対応modeのpillはdisabledになり、`m` shortcutでも移らない。

### 練習 / 再生

- `space` キー = play/stop
- `[` `]` = 前 / 次 section (audio + lyrics 同時 jump)
- `1..9` = section index に jump
- **section chip shift-click** = A→B loop 範囲設定 (= サビだけ無限ループ)
- `🐢 practice tempo` で 50-120% 倍速

### 自分のテイク差し替え

- **🎙 external vocal** = Suno / 自分歌い直しの mp3 を drag-drop
- **🥁🎸🎹 external stems** = drums / bass / other も同じ要領で差し替え
- 元 stem は自動 mute、master チェーンは自分のテイクにも掛かる
- 詳細: [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)

### 音色いじり

- **🥁 drum kit + synth profile** が一番遊べる
  - kit = local (auto-self / tabasco-X / unripe-X) または **🌐 online** (CDN 経由 9 種)
  - synth profile = default / sakanaction / lcd-motorik / cramps-punk (drum + bass + chord + vocal 全 voice を一斉切替)
  - **per-voice override** = kick だけ 808, snare だけ acoustic, hat だけ 909 みたいに 1 voice 単位で別 kit からピック
  - **chord instr** = synth or Salamander Grand Piano / Casio synth (Tone.Sampler 経由)
  - **+ custom kit URL** = 任意の wav URL を catalog に追加 (localStorage 永続)
  - **▶ preview** = kit / voice 単位で試聴
- **音源追加の手順** (search クエリ集 + license フローチャート + nbrosowsky の note 一覧取得法 + NSynth 追加チュートリアル):
  → [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md)

### マスタリング

- **sound mix / space** = reverb / width / warmth / loudness の 4 slider
- **master preset chips** = neutral / lo-fi / club / rock / ambient で 1 クリック切替
- 内部: per-stem EQ + 2 段 master comp + StereoWidener + tape sat + reverb wet
- 詳細: [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md)

### 録音 / DAW 連携

- **⏺ live record** = post-limiter master mixをWAVへ変換してdownload
  （browser側の変換失敗時だけMediaRecorder形式へfallback）
- **📦 stems pack export** = 4 stem を別々に同時録音 (DAW 投入用)
- **🎹 MIDI in/out** = ドラムマシン / DAW に MIDI Clock 送出 (24 PPQ)、外部 MIDI note 受信で phrase trigger / section nav
- 詳細: [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)

### A/B 比較

- 🔀 A/B compare = 全 sliders / toggles / mode / profile / preset を A, B にスナップショット → 瞬時切替
- 「Sakanaction vs LCD-motorik」「club vs lo-fi」「original vs all-external」等の比較

### 状態保存

- slider / toggle / kit / profile / voice override / instrument等を
  **localStorageに自動保存**。playback modeは保存せず、起動時にbandの対応modeへ戻す。
- queryなしreloadは保存済みvisible bandの01へ戻る。HAZAMAの`band` queryと
  Drum Floorの`from=drum-floor` + `song` queryは通常復元より優先する。
- custom kits も別キー `band-room.custom-kits.v1` で保存

---

## キーボード一覧

| key                | action                                          |
|--------------------|-------------------------------------------------|
| `space`            | play / stop                                     |
| `[` / `]`          | previous / next section (audio + lyrics seek)   |
| `1`..`9`           | jump to section index (1-based)                 |
| `m`                | toggle stems ↔ AI 再現 mode                     |
| `?`                | open quick help overlay                         |
| `Escape`           | close overlay                                   |
| `q`..`p`, `a`..`l`, `;` | fire phrase trigger 01..20                 |
| **shift+click** on section chip | A→B loop range 設定                |

入力欄 (textbox/file/select) にフォーカスしてるときは無効。Ctrl/Cmd/Alt と
組み合わせは browser ショートカット優先。

---

## 歌詞

- **canonical / synth / fallback** — [tabasco-lyrics-final.md](./tabasco-lyrics-final.md)
- **原音karaoke timing** — `tabasco-lyrics-timed.json`。Whisper ASR由来で、Hey /
  I got a feeling / Under the Moon / Human Fly / Sisterの5曲だけ。歌詞正本や人間確認済み
  transcriptionではなく、原音modeの行表示と時刻にだけ使う。
- timed dataがないTABASCO / Electric Sheepとload失敗時はfinal singableへfallbackする。
  旧 draft / cut-up / syllabic はarchive扱い。

歌詞 panel は section の bar 進行に合わせて自動でハイライト + scroll する
(v73)。歌わせたい行が大きく見える。

---

## バンド追加

Tabasco 以外のバンドを追加するなら別 doc:

- [BAND-ROOM-ADD-BAND.md](./BAND-ROOM-ADD-BAND.md)
- presets/bands.json + drum-frames + sample-kits 一式作成手順

---

## ボーカル再生成 (Suno など)

- [VOCAL-REGENERATION-PATH.md](./VOCAL-REGENERATION-PATH.md)
- 3 path (自分で歌う / Suno で生成 / 既存テイク upload)

---

## DAW / ハードウェア連携

- [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)
- Ableton / BandLab / Logic に stem 流す or 自分のテイク戻す
- ドラムマシン (133 等) に MIDI Clock 同期 or audio out を external slot に

---

## 履歴

- [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) — v65から現行までのcompact履歴
- 設計判断 / パラメータの数値 / 各機能の commit ハッシュもここに

---

## 関連 doc

| doc | 用途 |
|-----|------|
| [BAND-ROOM-USAGE.md](./BAND-ROOM-USAGE.md) | HAZAMA最短入口と用途別レシピ (カラオケ / AI再現 / 厚み出し / Suno / ad-lib) |
| [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) | v65から現行までのcompact履歴、各wave詳細 |
| [BAND-ROOM-ADD-BAND.md](./BAND-ROOM-ADD-BAND.md) | 新バンド追加手順 |
| [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) | **「作品」として世に出す道筋** (album 制作 / 30 min lofi set / 配信 platform 比較) |
| [RECORDING-WORKFLOW.md](./RECORDING-WORKFLOW.md) | UR44 + マイク / bass / 電子ドラム / EP-133 経由で band-room の external slot に流す具体手順 |
| [EP133-KOII-BANDROOM-WORKFLOW.md](./EP133-KOII-BANDROOM-WORKFLOW.md) | EP-133 K.O.II の USB/sample/audio routing と Band Room への戻し方 |
| [music-hardware-dashboard.html](./music-hardware-dashboard.html) | worker-gaming / hardware / Sonar 作業の静的ダッシュボード |
| [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) | Ableton / BandLab / Logic / ハードウェア連携 |
| [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md) | 音色設計の哲学、synth profile 詳細 |
| [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md) | online catalog json の編集 / 拡張 |
| [VOCAL-REGENERATION-PATH.md](./VOCAL-REGENERATION-PATH.md) | ボーカル再生成の 3 path |
| [STEM-REUSE-PATH.md](./STEM-REUSE-PATH.md) | stem 抽出 / 再利用ワークフロー |
| [REPO-MANAGEMENT.md](./REPO-MANAGEMENT.md) | Pages 制限 / repo サイズ管理 |
| [HAZAMA-FM-ARCHITECTURE.md](./HAZAMA-FM-ARCHITECTURE.md) | Music スタック全体のアーキテクチャ |
| [tabasco-lyrics-final.md](./tabasco-lyrics-final.md) | Band Room 表示用の一本化済み歌詞 |
| [tabasco-lyrics-draft.md](./tabasco-lyrics-draft.md) / [tabasco-lyrics-burroughs.md](./tabasco-lyrics-burroughs.md) / [tabasco-lyrics-v4-syllabic.md](./tabasco-lyrics-v4-syllabic.md) | 旧候補 archive |
| [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) | Suno で AI 歌唱生成する手順 (プラン比較 / Cover Mode / Persona / Voice Clone) |

---

## 別 app の入り口

- **Listen hub** (`listen.html`) — 現在の試聴順。HAZAMAを聴いた後にここからLyric Labへ進む
- **Lyric Lab** (`lyric-lab.html`) — 歌詞・keep/fix・制作先を手動で整理するmetadata handoff
- **Hazama FM** (`fm.html`) — 集中作業 BGM ジェネレーター
- **Music Core Rig** (`index.html`) — 同じ engine.js を共有する mixer / 環境音作り
- **Drum Floor** (`https://quietbriony.github.io/drum-floor/`) — 現曲 / BPM / section / frame を metadata-only で受ける手動ドラム preview
- これらは **隔離されたアプリ** (catalog / 操作モデル別)、band-room と素材レベルで
  橋渡し可 ([DAW-INTEGRATION.md](./DAW-INTEGRATION.md) 参照)

## ギター・ベース・ドラムの8小節試奏

既存Band Roomの折り畳み試奏でrock/jazzを選び、パートON/OFFと試奏音量を動かせる。
曲のAI再現とは別の短い候補。ARCB採譜・RECへ未接続。
音はWorkerで準備し、停止は準備中でも有効。
詳細と音質・端末負荷の境界は[試奏ガイド](PHYSICAL-BAND-REHEARSAL.md)。
