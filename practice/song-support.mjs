// Describes verified app capabilities, not availability of a complete score.
export function songSupport(instrument,id){
 if(instrument==='guitar'&&['tokiyo','jigsaw'].includes(id))return{badge:'自動コード',detail:'用意した動画にコード図が追従します。歌詞は動画か、自分のテキストを位置合わせして表示できます。'};
 if(instrument==='sanshin'&&id==='tinsagu')return{badge:'工工四＋歌詞',detail:'1節の簡略工工四・指図・歌詞で練習できます。先生の動画とは別の練習用の譜割りです。'};
 if(instrument==='guitar'&&['santeria','blackbird'].includes(id))return{badge:'導入＋動画',detail:'導入コードと先生の教材を用意。自分のコード順・歌詞を入れると、演奏に合わせて進められます。全曲の自動コード時刻は未設定です。'};
 return{badge:'動画教材',detail:instrument==='guitar'?'先生の動画で弾き方を確認。自分のコード順・歌詞を曲別に保存できます。全曲の自動コード時刻は未設定です。':'先生の動画・工工四の参照と指の確認。自分の歌詞を動画の位置に合わせて表示できます。アプリ内の全曲工工四と自動の指図は未収録です。'};
}
