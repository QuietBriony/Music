# Band Room — 使い方ガイド

2026-10-28 v441: Human Flyのパート別に任意のAcid LIVEを追加。既存acidBrosの303を2台、同じ音声コンテキスト／原音ミックスの全体出力へ接続し、録音の開始位置と採譜BPMを基準に発音。重ねる／ベースを303へ／元の4パート、個別音量・音色・固定・サイコロ、8小節ごとの小変化、端末保存とJSON編集を用意。初期OFF・開くだけでは音声を作らず、STOP／seek／曲・モード切替で旧発音を破棄し、速さの変更は録音に追従。新音源や独立した再生時計は追加しない。音符は根音推定へ追従し、生演奏の揺れを補正するものではない。v440は本人がiPhoneでDub再生成功を確認。Acidの本人聴感／実iPhoneは未確認。cache `hazama-fm-v441` / client `band-room.js?v=br-274` / CSS `band-room.css?v=br-100`。

2026-10-27 v440: v439でも続いたiPhoneの残響レートエラーに対応。Tone 14同梱のSafari向けnullクリア処理が44100 Hz固定のため、残響のリセット・破棄を現コンテキストのレートに合う1フレーム無音で行う。実Toneを通すSafari互換挙動でv439の同じエラーを再現。通常の残響・4パート・Dub展開は維持。実iPhoneでの再試聴は未確認。cache `hazama-fm-v440` / client `band-room.js?v=br-273` / CSS `band-room.css?v=br-99` / stem mix v9 / Dub v7。

2026-10-27 v439: iPhoneのパート別で報告された残響バッファと音声コンテキストのサンプルレート不一致に対応。レート変更時に残響を作り直し、それでもWebKitが拒否する場合は該当残響を省いて4パートとDubのエコーを継続し、互換再生と表示する。通常時のミックス・保存設定・原音は維持。実iPhoneでの再試聴は未確認。cache `hazama-fm-v439` / client `band-room.js?v=br-272` / CSS `band-room.css?v=br-99` / stem mix v8 / Dub v6。

2026-10-27 v438: Band Room上部に更新確認を追加。確認だけでは演奏や録音を止めず、再読み込みは明示操作。開始例外は処理段階と理由を表示し、原因不明のRESET AUDIO誘導を避ける。音源・保存形式・音声経路は変更しない。iPhoneの再生エラー原因と実機確認は未解決。cache `hazama-fm-v438` / client `band-room.js?v=br-271` / CSS `band-room.css?v=br-99`。

2026-10-26 v437: Human Fly Dubの声とギターを呼応させる。声8フレーズを語頭から戻し、語尾をechoへ。ギターは33打点に絞り、10箇所の返答／アクセントを強める。歌の間は反響だけを引き、間で広げ、繰り返しを左右へ渡して暗くほどく。ベース／ドラムの音量・打点・2小節loop・スネア反響と、調和の共通roomは保持。cache `hazama-fm-v437` / client `band-room.js?v=br-270` / CSS `band-room.css?v=br-99` / arrangement v3 / Dub v5。

2026-10-26 v436: 調和とDubの共通空間を更新。声の直接音・EQ・楽器の打感を保ち、19–139 msの近い反射に、52 msから暗く滑らかに減衰する最長720 msの共通残響を加える。声のsendを0.18→0.24へ。単一の手続きstereo IRで、録音素材の追加なし。途中移動・比較・mute・fader zeroで古いroomを消去。調和は元の演奏、Dubは出し引き・loop・echoによる別編曲。cache `hazama-fm-v436` / client `band-room.js?v=br-269` / CSS `band-room.css?v=br-99` / stem mix v7。

2026-10-24 v435: Human Fly Dubを、リズムを保つversionへ組み直す。全体停止と1〜2拍の断片をやめ、ベース／ドラムを土台に声の語尾・ギター・選んだスネアが暗くなるfeedback echoへ応答する。ギターとドラムの帯域、反響の長さ・左右をフレーズで動かし、中盤は2小節のベース＋ドラムを8小節回す。声21・ギター54・スネア45のsource cueをCPUで選定。音源ファイルと曲の長さ・比較位置は保持。cache `hazama-fm-v435` / client `band-room.js?v=br-268` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v434: Human Fly Dubに5つの展開を追加。ベース／ギターの2拍ループ、ギターの1拍ループ、ドラムの2拍ループを既存録音から短く切り出し、ドラム／低音の抜き差し、反響だけの間、最後の1拍の静寂から全員で戻る。約29秒、61秒、127秒、163秒、225秒。音程と曲の長さは変えず、調和と同じ位置で比較。追加音声ファイルはなく、短いコピーだけをRAMへ作る。cache `hazama-fm-v434` / client `band-room.js?v=br-267` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v433: Human FlyのDubを語尾とギターの打点へ合わせる。声6箇所は帯域エネルギーが18 dB以上落ちる位置から引き、ギター7箇所は打点と230 msの胴鳴りを残してから引く。常時echo sendをやめ、選んだ語尾／ストロークだけを反響へ。声は付点8分、ギターは4分で応答し、小さく左右へ返して戻り際は奥へ下げる。ベースとドラムの経路・打点・余韻は保持。cache `hazama-fm-v433` / client `band-room.js?v=br-266` / CSS `band-room.css?v=br-99` / adapter v8。

Human FlyのDubは「パート別・再ミックス」→「Dubで聴く」→ START。再生中に「調和と比べる」で戻せます。最初の出し引きは約29〜33秒。ボーカル／ギターを消す練習ボタンは反響も消します。曲を替えると調和へ戻ります。全体RECにはDubを含み、4 stems packは従来の個別tapです。分離漏れがあるため完全な楽器除去にはなりません。

2026-10-24 v432: Human Flyの分離原音から任意のDubミックスを追加。ベースとドラムを保ち、7つの区間で歌とギターを引き、直前のフレーズを暗くなる4回の反響へ送る。調和と同じ位置で比較でき、ミュート・停止・途中移動で古い反響を消す。通常の調和、ライブ原音の補正、AI採譜と音源は維持。cache `hazama-fm-v432` / client `band-room.js?v=br-265` / CSS `band-room.css?v=br-99` / adapter v8。

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

2026-10-03: 現行runtime v422は原音の確かな区間から和音・音域を補正し、ロックの上下ストロークと弾き方を加え、ARCB 7曲の合奏バランス、余韻、採譜の時計と途中移動を補正しています。AI再現でSTARTし、ギターの音をクリーン／クランチ／ディストーションから選びます。採譜の空白小節は余計な音を足さず余韻を残します。melodyは採れた歌の音程のガイド。Electric Sheep／TABASCOでは未採譜表示で鳴りません。原音と切り替えて練習・RECできます。

> Listen hub: https://music-stack.pages.dev/listen.html
> Band Room: https://music-stack.pages.dev/band-room.html
> HAZAMA直接入口: https://music-stack.pages.dev/band-room.html?band=hazama
>
> Tabascoの原音 / AI再現をA/Bしたり、HAZAMAの原音（Still Moving完成レンダー）と
> AI再現を聴き比べたり、自分のtakeを録音・uploadしたりできる。

## いちばん短い遊び方

1. Listen hubのARCB / TabascoからHuman Flyを開き、`📻 原音`を選択して`START`を一度押す。ドラムだけなら原音の`all off`→`drums` ON、自分でドラムを叩くなら原音の`all on`→`drums` OFF。
2. 同じ区間を`🎛 AI 再現`へ切り替えて打点・強弱を比較する。AIは練習用で、ARCBの新音源は採譜の打点を24打/小節まで鳴らす。分離漏れもあるため、原音全体でも確認する。
3. ほかのTabasco曲は上の01〜07ボタンで選ぶ。HAZAMAはListenの直接入口から01 / 02と`📻 原音`（基準）/ `🎛 AI 再現`を比較する。
   02のAI再現は02固有ではなく01 frames共有の暫定版なので、02固有の判断は原音を使う。
   歌詞を外す／自分で歌う時はListenの01/02 `KARAOKE` linkを開く。
4. `WARMING UP` / `PREPARING AI`中はband・song・modeのbusy解除を待つ。
   失敗したらSTART直下の案内に従い、再度`START`、次に`RESET AUDIO`を使う。
5. 聴き終えたらListen hubへ戻り、Lyric Labでkeep / fix・歌詞・制作先を手動で整理する。
   リンクを開くだけでmodel実行やdownloadが始まることはない。

復旧条件を含むこの導線の正本は
[BAND-ROOM-MANUAL.md](./BAND-ROOM-MANUAL.md)。
現行runtimeはv422（ARCBのロック奏法、採譜空白・未採譜melody表示と合奏補正）、HAZAMA playability候補はv401（authored rests + 02 AI明示 + session-only KARAOKE + 曲別歌詞境界）のまま。client markerは`br-256` / `br-96`。
実音・mobile合格とHAZAMAのmain selector昇格はBL-041 human gateで、まだ未判定。

### v401 AIの短時間レイヤー判定

AI再現を開き、`all off`から次の4つを各30–90秒だけ聴きます。切替時は必要な
checkboxだけONにし、最後に`defaults`で通常mixへ戻します。

1. `drums + bass` — 低音の初動、間、詰まりを確認。
2. `drums + arp` — 電子MIDI感や短音の連打がarp由来か確認。
3. `drums + bass + arp`、`vocal OFF` — v401のauthored基準配置20–21発/barを確認。
   実演時のbass ghost/dropは、この基準から発音を減らすだけです。
4. `defaults` — 全体mixで人間らしい間が残るか確認。

01 AIと02 AI暫定の両方で行います。02は01 authored framesデータ共有ですが、
曲ID seedによる微細な実演差があります。02固有アレンジの
合否には使わず、02原音を基準にします。Surface合格だけではreal mobile合格になりません。

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

### ARCBの合奏補正（v410）

原音のvocalsとAIのmelodyを両方OFFにすると、伴奏全体の低音・打感・ギターの響きを比べやすくなります。
単独パートの分離漏れを音色の正解にはしません。[合奏の測定結果](ARCB-MIX-MEASUREMENT.md)に補正前後の数値と残る違いを記録しています。

### ARCBの弦の響きと空気感（v408以降）

AI再現では、短い音符でもギターの和音とベースの響きが自然に減衰します。
次の和音／ベース音では前の音を滑らかに押さえ、低音が重なるのを防ぎます。
「空気感」は全パートの共通の部屋の響き。既定35%、0%で直接音だけになります。
ギターのクリーン／クランチ／ディストーションと組み合わせて、余韻と輪郭を聴き比べてください。
パートの音量は部屋へ送る音にも効き、STOPとseekは残響も止めます。


## 画面構成（現行: br-256 / br-96）

```
┌─────────────────────────────────┐
│  BAND ROOM                       │
├─────────────────────────────────┤
│  [-] master volume [====] 80 [+] │  ← 車 / touch 向け常時音量
├─────────────────────────────────┤
│  [Tabasco] [...]                 │  ← visible band 選択（HAZAMAはdeep-link）
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← song 選択 (7 曲)
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← HAZAMAは原音が既定（AI切替可）
├─────────────────────────────────┤
│  [ START ]                       │  ← warming / preparing / stop
│  01 Still Moving · 原音 4 stems   │  ← 選択文脈 / 読込サイズ
│  復旧案内                         │  ← START失敗時だけ表示
│  0:00 ━━━━━━━━━━━━━ 5:04          │  ← song timeline / seek
│  117 BPM · G major               │
│  verse-1 · 4/16 → chorus-1       │  ← 現在 / 次セクション
│  ▮▮▮▮▮▮▮▯▯▯▯ (RMS meter)      │
│  ▆▅▄▆▇▅▃▂▁▁ (spectrum)         │
│  [intro] [verse-1] [chorus-1]... │  ← section nav (click で jump)
├─────────────────────────────────┤
│  layer toggles (mode 別)         │
│  📻 vocals · drums · bass · other │
│  🎛 drums · bass · guitar · vocal · chords · arp · click │
├─────────────────────────────────┤
│  [ lyrics — current section が   │  ← 自動スクロール + ハイライト
│    glow して、他は dim ]         │
├─────────────────────────────────┤
│  chord: G                        │
├─────────────────────────────────┤
│  ▾ sound mix                    │  ← 折り畳み (space / vocal blend / parts)
│  ▾ 🎙 external vocal             │
│  ▾ 🎵 vocal phrase trigger       │     即発火 / 次小節 / ループ
│  ▾ 🥁 drum kit source            │     (AI 再現時のみ)
│  ▾ 🎼 genre pattern picker       │     Hazama FM suggestion 対応
│  ▾ 🐢 practice tempo (50-120%)   │     (AI 再現時のみ)
├─────────────────────────────────┤
│  ← Hazama FM · Music Core · Drum Floor │
│  [space] play/stop · [[]] sec    │  ← keyboard hint
└─────────────────────────────────┘
```

版ごとの詳細は[BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md)、
操作の全体像は[BAND-ROOM-MANUAL.md](./BAND-ROOM-MANUAL.md)を参照。

## 通常入口とdeep-link

初回の通常入口はTabascoの01 `TABASCO`から始まります。以後のqueryなしreloadは
保存済みのvisible bandを復元し、そのbandの01へ戻ります。前回のsongやplayback modeは
復元せず、volume / mixer / kit等の操作prefsを保持します。

`?band=hazama`は保存済みbandより優先され、HAZAMAの01 `Still Moving`と
`📻 原音`を開きます。`song` / `mode` queryで01/02 × 原音/AIの4ケースへ直接入れます。
`mix=karaoke`を原音linkへ加えると、vocalsだけOFF・drums / bass / other ONで開きます。
このvocal-offはsession限定で保存されず、別bandへ移ると原音vocalへ戻ります。
Drum Floorからの明示的な戻りqueryも通常復元より優先されます。

曲末は同じ曲を loop せず、set list 順に次の track へ進みます。01 終了後は
02 `Hey`、以降 03, 04... と続き、最後の曲だけ停止します。A/B loop を明示した時は
その loop 指定を優先します。

ロック画面 / 車載側の next / previous track 信号も同じ set list 順に合わせています。
再生中に画面上の track button や車載の曲送りを使っても、hidden media bridge は
維持したまま曲を差し替えます。

START 下の分秒バーは普通の music bar です。停止中に任意地点へ動かすと、次の
START はその位置から始まります。再生中に動かすと原音 stems / external stems も
同じ offset へ seek します。

AI 再現モードでは、各パートが原曲 drum-frame を読む part agent として動きます。
bass は kick と ghost の位置にロックし、guitar は snare / crash / hat 密度で刻みを
変え、vocal guide と chords は section role と accent へ応答します。

現行default mixは少し余裕を持たせています。masterはlimiterに張り付き
にくく、stem vocal blend は控えめ、AI 再現は bass / guitar / chords が前に出すぎない
バランスです。旧 default が保存済みのブラウザも、完全一致する旧 slider 値だけ
新 default へ移行します。大きくしたい時は master volume を上げるのが一番安全です。

## Drum Floor へ渡す

footer の `Drum Floor` を押すと、現在の曲 / BPM / section / drum frame を
Music Stack の metadata-only packet として同じブラウザに保存してから
drum-floor を開きます。drum-floor 側は kit / pocket / controls の候補だけを
受け取り、音を出すには向こうで手動で `再生` を押します。

drum-floor から `Band Room` へ戻る場合は `song` query を受け取り、通常 reload
は 01 start のまま、その戻り操作だけ source song を開きます。

## Hazama FM から来た pattern

Hazama FM の `band room →` から開くと、FM の genre に近い Band Room pattern が
`FM suggests ...` として表示されます。`AI` で AI 再現モードへ切り替え、
`inject` で現在 frame に入れます。どちらも自動再生はしません。

## Lyric Labへ渡す

Band Roomから自動転送はしません。Listen hubへ戻って
[Lyric Lab](../lyric-lab.html)を開き、制作元をBand Roomとして、keep / fix、歌詞、
BPM / key / 尺、制作先を手動で入力します。`下書きを作る`後に棚へ保存するか、
ACE-Step等へ渡すproduction handoffを整理します。この操作だけで外部modelやGPU処理は
起動しません。

## 用途別の遊び方

### 1. カラオケ — 元バンドの演奏で自分が歌う

1. 📻 原音 stems モード
2. **vocals** stem toggle → OFF
3. drums / bass / other stem は全 ON
4. START → 自分の声で歌う
5. 必要なら space reverb 上げて部屋っぽく

### 2. AI 再現を聴く — 完全打ち込み

1. 🎛 AI 再現モード
2. drum-floor / bass / guitar / chord guide 全 ON
3. (オプション) 🥁 drum kit source で UNRIPE/Definition 等の本物 sample に差し替え
4. START → 全部合成で曲が走る

Human Fly のように vocal OFF で原音 stem の伴奏が欠ける曲は、
`docs/AI-RECREATION-EXPORT.md` の offline export で `drums/bass/other`
を mp3 stem 化し、`mix.wav` を `scripts/compare-capture.py` で測れます。
原音 stems モードの `stem source` から `AI recreation` として A/B できます。
これは原音復旧ではなく、Band Room の AI 再現を独立 stem として検証する
ルートです。

### 3. 厚み出し — 本物 + AI レイヤ

1. 📻 原音 stems モード (主役)
2. 🎛 AI 再現セクション (overlay): drum-floor OFF / guitar ON (合成 guitar 重ね)
3. 🥁 drum kit source = UNRIPE Continuous (元音源 drums の隣に本物 UNRIPE drums)
4. → 倍音増えて密度上がる

### 4. Final 歌詞を Suno に投げて生成

1. `docs/tabasco-lyrics-final.md` で歌う曲の英語歌詞を取得
2. https://suno.com/ で Custom Mode → prompt 貼って generate
3. mp3 ダウンロード → band-room の 🎙 external vocal で upload
4. 自動で stem vocal mute → external が鳴る
5. sound mix の vocal blend (spread / room) で更に加工

### 5. ad-lib / SFX で遊ぶ

1. 📻 原音 stems モード、START
2. 🎵 vocal phrase trigger に 01-20 の番号ボタン
3. クリックで自分の声フレーズが発火 (元音源から切り出した RMS 上位 20 個)
4. 元の歌の上に重ねて adlib / textural 使用

### 6. Hazama FM から groove 候補を受ける

1. Hazama FM で lofi / jazz / funk / techno などの genre pill を選ぶ
2. Band Room を開くと、対応する genre pattern button が suggestion 表示される
3. ボタンをタップすると現在 frame に pattern inject
4. `reset to original` で元 frame に戻せる

自動 inject はしません。現在 frame の drum events を置き換える操作なので、
必ず Band Room 側でタップしてから適用します。

## 車 / Bluetooth 音量

header 直下の master volume bar は常時表示です。車の物理音量ボタンが
Web Audio に届かない環境でも、画面上の `- / +` と slider で 0-100 を操作できます。
対応する車載機が rewind / fast-forward 系の Media Session 信号を送る場合は、
それも master volume の 5 刻み上下に割り当てます。
next / previous track 系の信号は album flow の曲送りに使います。

Band Room の最終 mix は hidden `<audio srcObject=MediaStream>` bridge にも流しており、
iOS Safari / 車載 Bluetooth で通常メディア音声として扱われやすくしています。
master volume bar は scroll 中も上に残ります。広めの画面では右側が `bridge` なら
hidden media bridge 経由、`direct` なら通常の Web Audio 出力、`failed` なら
bridge が落ちて direct 出力に復帰済みです。狭い車載/スマホ幅では、操作性優先で
route pill は `B` / `D` / `F` の短い badge に縮め、`- / slider / +` を必ず収めます。

## モード切替の意味

| モード | 主役 | overlay (薄く) | こんな時 |
|---|---|---|---|
| 📻 原音 stems | 本物の Tabasco LIVE 演奏 | 🎛 AI 再現を被せると倍音増 | 歌い直し練習、聴感 polish 確認 |
| 🎛 AI 再現 | drum-floor synth + bass + guitar | 📻 stems は薄く混ぜられる | 完全 AI で雰囲気再現、新曲合成 |

## drum kit source オプション

🎛 AI 再現モードで使う drum kit の音色:

- **AI synth (default)**: Tone.js の MembraneSynth (kick) + NoiseSynth (snare/hat) — 合成音、軽い
- **UNRIPE / Continuous (103 BPM)**: ダーク mid-tempo の本物 drums
- **UNRIPE / List of Words (103)**: 同上、別曲の音色
- **UNRIPE / Definition (144)**: 暗くて速い、agro 系
- **UNRIPE / Past and Fate (144)**: 同上、別タイトル
- **UNRIPE / End Falls (108)**: ミドルテンポ
- **UNRIPE / Erase (136)**: テクスチャ系

各曲の本物 drums から切り出した kick/snare/hat/crash サンプルを直接 trigger。

## vocal blend defaults

| use | spread | room |
|---|---|---|
| plain vocal | 0% | 10% |
| less dry | 20% | 24% |
| washed room | 36% | 44% |
| Suno blend | 18% | 24% |

## ファイル配置 (Music repo)

```
band-room.html / .css / .js
presets/
  bands.json                                   # band registry
  drum-frames-tabasco-{songid}.json            # 7 曲分 song-track JSON
  tabasco-stems/{songid}/{stem}.mp3            # 28 stem mp3 (Tabasco 4×7)
  unripe-stems/{songid}/{stem}.mp3             # 24 stem mp3 (UNRIPE 4×6)
  sample-kits/{source}/{song}/                  # 抽出した個別サンプル
    {kick,snare,hat,crash}-NN.wav              # drum hits (8 each)
    vocal-phrase-NN.wav                        # vocal phrases (top 20)
    summary.json                               # manifest
docs/
  tabasco-lyrics-final.md                      # 全 7 曲歌詞 (final singable)
  VOCAL-REGENERATION-PATH.md                   # Suno workflow
  BAND-ROOM-ADD-BAND.md                        # 新バンド追加手順
  BAND-ROOM-USAGE.md                           # この doc
  STEM-REUSE-PATH.md                           # Phase B/C 流用設計
scripts/
  _separate_band.py                            # Demucs 4-stem 切り出し
  _slice_drum_hits.py                          # drum sample 抽出
  _slice_vocal_phrases.py                      # vocal phrase 抽出
  _recompress_stems.py                         # 192→96 kbps 再エンコ
  _copy_stems.py                               # Demucs 出力を repo へコピー
```

## トラブルシューティング

### iPhone Safari で音が出ない
→ `WARMING UP` / `PREPARING AI`が終わるまで待ちます。START直下に音声停止の
   案内が出てボタンが`START`へ戻ったら、画面を一度tapして`START`を一度押します。
   直らなければ`RESET AUDIO`、次にreloadを試します。準備中の連打は不要です。

### 曲再生中に止まる / 遅れる
→ 初回のstems / online sample取得にはnetworkが必要です。取得後は対応assetがcacheされ、
   Wi-Fiだけが必須ではありません。HAZAMAの弱端末比較は
   `?band=hazama&aiLight=1`を使い、それでも止まる場合はBL-041の実機結果へ記録します。

### Suno 生成 mp3 を upload してもズレる
→ Suno の BPM/key は近似なので Tabasco 本来の構造と微妙にズレる。
   external vocal は単体で聴ける形で出してるので、stem drums/bass を OFF
   にして external vocal だけ流すか、自分で歌い直す方が綺麗。

### サンプルキットに切り替えると無音
→ 初回asset取得中は`sample kit: ...`表示まで待ちます。失敗案内が出た場合は
   通信を確認し、mode / song切替が終わってから`START`を押します。

### vocal phrase trigger が空
→ その曲の vocal stem から十分な phrases が検出できなかった (短すぎ等)。
   01 TABASCO は 44 秒の opener なので 0 個になる。他の曲は 20 個ある。

## ギター・ベース・ドラムの8小節試奏

既存Band Roomの折り畳み試奏でrock/jazzを選び、パートON/OFFと試奏音量を動かせる。
曲のAI再現とは別の短い候補。ARCB採譜・RECへ未接続。
音はWorkerで準備し、停止は準備中でも有効。
詳細と音質・端末負荷の境界は[試奏ガイド](PHYSICAL-BAND-REHEARSAL.md)。
