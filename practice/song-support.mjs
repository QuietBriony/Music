// Distinguish inspected maps from uncertain guides and publisher video scores.
import { ESTIMATED_COURSES } from './estimated-courses.mjs?v=46';
export const SANSHIN_LYRIC_SCORES=['tinsagu','tsukinu','aha'];
// Every requested song has a lyric-score route. Only these native studies
// promise note-by-note microphone following; other routes use the teacher video.
export function sanshinLyricRoute(id){
 return SANSHIN_LYRIC_SCORES.includes(id)?{kind:'score',verses:id==='aha'?'1番':'1〜3番'}:{kind:'video',variant:id==='anata-ni'?'performance':'original'};
}
export function songSupport(instrument,id){
 if(instrument==='sanshin'&&id==='asatoya')return{badge:'工工四＋マイク',detail:'前奏＋1節のかんたん版。全画面の譜面が自分の音で進みます。歌詞と本来の譜割りは先生の教材で確認できます。'};
 if(instrument==='sanshin'&&id==='aha')return{badge:'歌詞付き工工四 · 内蔵',detail:'本調子で歌う1番の基礎練習。歌詞の行ごとに反復でき、マイク・ガイド・手動で譜面と歌詞が進みます。先生とは異なる等拍の練習版です。'};
 if(instrument==='sanshin'&&['akata','tancha'].includes(id))return{badge:'教材動画＋読み方',detail:'先生の動画内で工工四と歌詞を見て練習。アプリにも伝承の1番・囃子と読み方・意味を収録し、この歌詞欄は手動で送れます。内蔵音符判定・動画への歌詞自動同期は未設定です。'};
 if(instrument==='guitar'&&['tokiyo','jigsaw'].includes(id))return{badge:'自動コード',detail:'用意した動画にコード図が追従します。歌詞は動画か、自分のテキストを位置合わせして表示できます。'};
 if(instrument==='sanshin'&&SANSHIN_LYRIC_SCORES.includes(id))return{badge:'歌詞付き工工四 · 内蔵',detail:'歌詞の1〜3番を切り替え、1番分ずつ同じやさしい譜面で練習。マイク・ガイド・手動で今の音と歌詞が進みます。先生の動画とは別の練習用の譜割りです。'};
 if(instrument==='guitar'&&ESTIMATED_COURSES[id])return{badge:'自動送り（推定・目安）',detail:'動画にコード図が追従します。誤判定やずれがあるため補正できます。歌詞は動画・字幕か自分のテキストで。',quality:'estimated'};
 return{badge:instrument==='sanshin'?'歌詞付き工工四 · 教材動画':'動画教材',detail:instrument==='guitar'?'先生の動画で弾き方を確認。自分のコード順・歌詞を曲別に保存できます。全曲の自動コード時刻は未設定です。':'先生の動画内で、歌詞と工工四を一緒に見て練習。再生・ゆっくり再生・反復が使えます。内蔵の音符判定や、文字ごとの自動追従には未対応です。'};
}
