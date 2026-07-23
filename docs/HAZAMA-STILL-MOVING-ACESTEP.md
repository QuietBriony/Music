# Still Moving — ACE-Step 実制作記録（二路線・確定レシピ）

[ACE-STEP-WORKFLOW.md](./ACE-STEP-WORKFLOW.md) が定義した「制作・参照レーン」の**最初の実運用**。
HAZAMA track01 "Still Moving" を ACE-Step 1.5（workerPC / RTX 2070 / float32 / `acestep-v15-turbo`）で
二路線に仕上げた確定レシピと、そこに至る判定履歴・機構的な法則を収蔵する。

- 歌詞の正本: **Lyric Lab 作品棚**「Still Moving (Hard) / アンダーフロア結合」
  （v3=日本語詩・人間ボーカル用 / v4=英語・AI生成用。[LYRIC-LAB-USAGE.md](./LYRIC-LAB-USAGE.md)）
- 音源の納品: ローカル `renders/完成版/`（母艦 chouta-surface。repo外・台帳は renders/README.md）
- 生成環境の運用: workerPC の API 常駐（keepalive スケジュールタスク）+ GPU 札システム

---

## 1. 二路線の確定形

### 01 メロウ路線（2026-07-21 確定）

> 判定: 「単調。これはこれでメロウ路線で置く」→ KEEP

| 項目 | 値 |
|---|---|
| BPM / key | 96 halftime / Am |
| 生成 | ode / shift 2.8 / seed 42 / 8 steps / 360s |
| 核 | 巨大サブベース上のペダルポイントA + sus9循環、マントラ反復ボーカル前面 |

### 02 ハード路線（2026-07-23 確定・Born Slippy 的アーク）

> 系譜: v6-B「まだBかな」→ ボーカル和化の試行（v7-v9）→ **AI日本語は間とわびさびが出ない**
> → **AI版=フル英語の渋声 / 日本語詩=人間ボーカル用に棚へ温存**

| 項目 | 値 |
|---|---|
| BPM / key | 128（メロウの倍速の双子）/ Am |
| 生成 | ode / shift 2.4 / seed 42 / 8 steps / 360s / vocal_language=english |
| 構造 | beatless浮遊 → kick叩き込み(シャウト) → ハンマー区間 → sub+声のみのブレイク → 倍速ベースでより強く復帰 → 声だけで終わる |
| 声 | low gravelly deadpan spoken word（行間に長い沈黙）+ slam同期の STILL MOVING! シャウト |

**アーク注入は二重**: キャプションに時系列で明記 + 歌詞タグ（`[kick slams in]` 等）をトークンとして流し込む。

### 共通マスタリング（重低音はEQで足す）

```
ffmpeg -af "bass=g=6:f=80:w=0.6,equalizer=f=45:t=q:w=1.2:g=2,alimiter=limit=0.95:level=false"
```

生成ガチャで低音を狙わない。骨格は生成・量感はマスタリング、が分業の正解（shift掃引で実証）。

---

## 2. プロンプトの法則（ソース検証済み・破ると事故る）

1. **negative prompt は存在しない**。否定形（no pop hooks 等）は**その語を注入する**＝v2がEDM化した主犯。肯定記述のみ。
2. **アーティスト名は書かない**。固有名詞は「generic electronic の平均」へ潰れる＝EDM盆地へ逆戻り。質感は物理記述に翻訳する（例: 渋い→ low gravelly weathered / 沖縄ソウル→ 拍の後ろに座る語り・生活の温度）。
3. **歌詞タグはパースされない**（生トークン）。沈黙・秒数の構文も無い→ **間を作る唯一の手段は語数を減らすこと**。
4. `guidance_scale` は turbo では**無効**（CFG蒸留済・1.0固定）。効くレバー= prompt / 語数 / seed / ode↔sde / shift。
5. **ode + shift 2.4-2.6 が基準**。sde と高shiftは子音・ハット・動きを溶かす（「微妙」の正体）。
6. ボーカルの言語は `vocal_language` と歌詞の言語構成が支配的。**AIの日本語は間とわびさびが出ない**（べちゃつく）→ AI版は英語、日本語は人間の仕事。

## 3. 判定履歴（要約）

| 版 | 内容 | 耳判定 |
|---|---|---|
| v1 | euphoric + 歌詞詰め込み | 半端な韓流 |
| v2 | 否定形 + 固有名詞 + techno語彙 | EDMみたい |
| v3 | 疎レシピ・声埋没・sde/高shift | 微妙（何も起きてない） |
| v4-E | 96BPM・巨大サブ・マントラ前面 | → メロウ路線として完成 |
| v6-B | 128BPM・落差アーク | まだBかな（採用）・声が韓流 |
| v7-v9 | 日本語ボーカル各種 | 発音べちゃつき・間が出ない→ダサい |
| **v10** | **フル英語・渋声・シャウト** | → ハード路線として完成 |

## 4. パイプライン（有機結合の形）

```
Lyric Lab 作品棚（歌詞の正本・クラウド同期）
   ↕ pull/push（api/lyric-drafts）
chouta-surface（司令塔: レシピ設計・投入・検証・台帳）
   → workerPC ACE-Step API（常駐・GPU札で画像生成/Blenderと共存）
   → ffmpeg マスタリング → renders/完成版/
   → 人間ボーカル録音時は band-room の live mic + REC（日本語詩=棚のv3を使う）
```

生成物・判定・法則は本ドキュメントと renders/README.md（母艦ローカル台帳）に還流する。
