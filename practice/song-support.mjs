// Distinguish inspected maps from uncertain guides and publisher video scores.
import { ESTIMATED_COURSES } from './estimated-courses.mjs?v=28';
export function songSupport(instrument,id){
 if(instrument==='guitar'&&['tokiyo','jigsaw'].includes(id))return{badge:'自動コード',detail:'用意した動画にコード図が追従します。歌詞は動画か、自分のテキストを位置合わせして表示できます。'};
 if(instrument==='sanshin'&&id==='tinsagu')return{badge:'工工四＋歌詞',detail:'1節の簡略工工四・指図・歌詞で練習できます。先生の動画とは別の練習用の譜割りです。'};
 if(instrument==='guitar'&&ESTIMATED_COURSES[id])return{badge:'自動送り（推定・目安）',detail:'動画にコード図が追従します。誤判定やずれがあるため補正できます。歌詞は動画・字幕か自分のテキストで。',quality:'estimated'};
 return{badge:instrument==='sanshin'?'動画の工工四':'動画教材',detail:instrument==='guitar'?'先生の動画で弾き方を確認。自分のコード順・歌詞を曲別に保存できます。全曲の自動コード時刻は未設定です。':'教材動画内の工工四・歌詞を見て演奏を追います。止めて文字を選ぶと指を確認できます。アプリの指図は自動では進みません。'};
}
