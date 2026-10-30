// Curated reference metadata only. No third-party scores, lyrics, recordings or embeds.
import { PREPARED_COURSES } from './singalong-courses.mjs?v=16';
export const STUDIES = {
  guitar:[
    {id:'tokiyo',title:'時間よ止まれ',artist:'矢沢永吉',focus:'まずCとAmの2つだけ。1・2・3・4と数えて、1で下へ1回弾きます。慣れたらDmとG7、最後に6コードへ。',names:['C','Em','G7','Am','Dm','G7'],stages:[{title:'1. CとAmだけ',names:['C','Am','C','Am']},{title:'2. DmとG7だけ',names:['Dm','G7','Dm','G7']},{title:'3. 6コードをつなぐ',names:['C','Em','G7','Am','Dm','G7']}],lesson:'https://note.com/mickeykogure/n/n41986bc8627a',video:'https://www.youtube.com/watch?v=apHhVfpeAh4',chart:'https://gakufu.gakki.me/m/data/big00022.html',label:'小暮貢朗「ギターで歌おうch」の解説',note:'アプリはカポなし・低いキーの準備練習です。セーハなし、1コード4拍の仮ガイド。原曲の全譜・リズム・歌詞は同梱しません。参考動画とはキーやカポ位置が異なります。'},
    {id:'santeria',title:'Santeria',artist:'Sublime',focus:'E → G# → C#m → Bの短いコード練習。まず各音を確かめ、次に裏拍で軽く弾く練習へ。',names:['E','G#','C#m','B'],lesson:'https://creativeguitarstudio.blogspot.com/2018/04/qwik-songs-004-santeria-by-sublime.html',label:'Creative Guitar Studioの解説・動画',note:'冒頭の和音を使う簡易練習です。曲全体の構成・ソロは参照レッスンへ。'},
    {id:'blackbird',title:'Blackbird',artist:'The Beatles',focus:'G → Am7 → G/B → Gの和音を、一弦ずつ確かめる導入練習。親指の低音と指で弾く高音を分けて聴きます。',names:['G','Am7','G/B','G'],lesson:'https://www.justinguitar.com/songs/the-beatles-blackbird-chords-tabs-guitar-lesson-sb-113',video:'https://www.youtube.com/watch?v=mEn2SEwZKNE',label:'JustinGuitarの解説',note:'原曲の運指や二音の動きは動画で確認します。このアプリ内は和音の準備練習です。'},
    {id:'jigsaw',title:'Jigsaw Falling Into Place',artist:'Radiohead',focus:'「この曲を1曲通して練習」から、標準調弦＋カポ2のかんたん伴奏へ。動画に合わせてAm・E・Cmaj7などの図が進みます。まず0.75倍で、コードの切替で下に1回ずつ弾いてみましょう。',names:['Bm','Bm','Bm','Bm'],referenceChord:'Bm',practiceLabel:'先にBmの押さえ方を練習',practiceTitle:'Jigsaw · Bmの準備',lesson:'https://www.youtube.com/watch?v=daD3x6XudqY',video:'https://www.youtube.com/watch?v=daD3x6XudqY',label:'Cole Johnstoneの標準調弦レッスン（英語）',referenceNote:'通し伴奏は標準調弦 EADGBE＋カポ2。図のコード名はカポから数えます。動画に合わせて自動で進み、速度・A/B反復も使えます。',note:'準備ボタンはカポなしのBm練習です。通し伴奏は標準調弦＋カポ2で、細かなリフ・低音・装飾を省いた練習版。通し動画の変則調弦の運指とは異なります。解説リンクはCole Johnstoneの標準調弦レッスンです。'}
  ],
  sanshin:[
    {id:'tinsagu',title:'てぃんさぐぬ花',artist:'沖縄民謡',focus:'本調子を合わせ、動画を短く区切って、工工四の文字を声に出してから弾きます。',lesson:'https://miyazatohidekatsu.com/sanshin/',video:'https://www.youtube.com/watch?v=XkmKijcH63s',label:'宮里英克の三線教室・譜面',score:'https://commons.wikimedia.org/wiki/File:Kunkunshi_for_Tinsagu_nu_Hana.png',note:'1節の工工四・指図・歌詞・読み方・意味を収録。歌詞は手動で送れます。先生の動画とは装飾・速さが異なります。'},
    {id:'tsukinu',title:'月ぬ美しゃ',artist:'八重山民謡',focus:'ゆったりした歌の流れを先に聴き、1フレーズずつ口ずさんでから三線を重ねます。動画の調弦・キーを確かめて合わせます。',lesson:'https://ameblo.jp/irei-blog/entry-12356649318.html',video:'https://www.youtube.com/watch?v=7GmB2WV4D4A',label:'伊禮俊一の工工四付き練習動画',note:'歌詞・工工四は配信元の動画で確認できます。曲の全譜をアプリに転載していません。'},
    {id:'jidai',title:'時代の流れ',artist:'三線で弾き語り',focus:'先生の工工四付き動画を見ながら、分からない文字を押して指の位置を確認。5秒戻る・ゆっくり再生・A/B反復で、短い部分から練習できます。',lesson:'https://miyazatohidekatsu.com/sanshin/',video:'https://www.youtube.com/watch?v=xtf0OAu-qVY',label:'宮里英克の三線教室・譜面',note:'動画と指図をアプリ内で表示。指図は文字を選んで手動で切り替えます。曲全体の音符・歌詞・自動追従は未収録です。'}
  ]
};
export const BASICS = {
  guitar:{title:'TABとコード図の読み方',steps:[
    '調弦 → 開放弦 → 1つのコード → 2つのコードの切り替え、の順で始めます。最初は5分でも十分です。',
    'TABの6本線は弦です。上が細い1弦、下が太い6弦。数字は押さえるフレットで、0は左手で押さえずに弾きます。',
    'コード図は左から6弦→1弦、上の太い線がナット。丸の中の数字は指番号です。1＝人差し指、2＝中指、3＝薬指、4＝小指。○は開放、×は弾かない弦です。',
    'まず1弦ずつ鳴るか確かめ、次にまとめてストロークします。セーハは人差し指で複数の弦を押さえる形です。',
    '今日はEmとAmをゆっくり交互に。音が鳴る位置を確かめてから速くします。痛みが出たら休みましょう。'
  ],links:[['アプリで段階的に練習（Simply Guitar・公式）','https://www.hellosimply.com/simply-guitar'],['調弦・コード図・構え方を動画で学ぶ（JustinGuitar・英語）','https://www.justinguitar.com/modules/before-you-begin-guitar-basics'],['最初のコードと短い反復練習（JustinGuitar・英語）','https://www.justinguitar.com/modules/beginner-1-first-steps']]},
  sanshin:{title:'工工四の読み方と練習の順番',steps:[
    '最初にチンダミ（調弦）。本調子Cなら、男弦C・中弦F・女弦Cです。女弦は男弦の1オクターブ上。動画と基準が違うときは、調弦を確かめてください。',
    '縦書きの工工四は右の列の上から下へ。次に左の列へ進みます。文字は弦と勘所を示します。横書きの譜面は、その譜面の読み順に従います。',
    '合＝男弦の開放、四＝中弦の開放、工＝女弦の開放。最初はこの3つを、名前を声に出しながら弾いてみます。',
    '○は休みの記号として使われます。小さい字・点・線などの意味は版や流派で違うため、参照する譜面の凡例と先生の説明を確認します。',
    '勘所にはギターのようなフレットがありません。文字と指の位置を結び付け、音を聴きながら少しずつ調整します。',
    '1フレーズを口ずさむ → 工工四を読む → ゆっくり弾く、の順で。最初から全部を通さず、短い範囲を繰り返します。'
  ],links:[['指の位置を写真で見る（栗山新也 三線教室）','https://ks-sanshin.com/三線の勘所とは？初心者が押さえられるようにな/'],['歌の意味や背景を読む（沖縄県）','https://www.pref.okinawa.jp/kyoiku/kodomo/1002688/1002693.html'],['本調子のチンダミ・基礎動画（宜保和也）','https://gibokazuya.com/youtube/'],['三線と工工四の教室・動画（宮里英克）','https://miyazatohidekatsu.com/sanshin/'],['工工四を読んでみる（三線ショップ島風）','https://shimakaji.com/user_data/sanshin_05_6.php']]}
};
export function mountLearning({onPractice,onBasics,onLeave,onSingalong}) {
  const $=id=>document.getElementById(id);let instrument='guitar',selected='tokiyo';
  const anchor=(title,url)=>{const a=document.createElement('a');a.textContent=title+' ↗';a.href=url;a.target='_blank';a.rel='noopener';a.addEventListener('click',onLeave);return a;};
  function showStudy(){
    const study=STUDIES[instrument].find(s=>s.id===selected)||STUDIES[instrument][0];selected=study.id;
    $('study-title').textContent=`${study.title} / ${study.artist}`;$('study-focus').textContent=study.focus;$('study-note').textContent=study.note;
    $('study-links').replaceChildren(anchor(study.label,study.lesson),...(study.video?[anchor('YouTubeで見る',study.video)]:[]),...(study.chart?[anchor('初心者向けコード譜を見る',study.chart)]:[]),...(study.score?[anchor('工工四の参照（Lrschneider / CC BY-SA 4.0）',study.score)]:[]));
    $('study-stages').replaceChildren(...(study.stages||[]).map((stage,i)=>{const button=document.createElement('button');button.textContent=stage.title;button.onclick=()=>onPractice(stage.names,`${study.title} · ${stage.title}`,`study:${study.id}:${i}`,{easy:true});return button;}));
    $('study-practice').hidden=!!study.stages;
    $('study-practice').textContent=study.practiceLabel||(study.names?'この曲の導入コードを練習':'先に合・四・工を練習');
    $('study-practice').onclick=()=>study.names?onPractice(study.names,study.practiceTitle||`${study.title} · 導入のコード`,`study:${study.id}`):onBasics(`study:${study.id}`,study.title);
    const songButton=$('study-song');if(songButton){songButton.textContent=instrument==='sanshin'?(study.id==='tinsagu'?'1節を工工四と指図で練習':'動画と指の位置を開く'):PREPARED_COURSES[study.id]?'この曲を1曲通して練習':'参考動画とコード図を開く';songButton.onclick=()=>onSingalong(study.id);}
  }
  $('study-select').onchange=()=>{selected=$('study-select').value;showStudy();};
  return function render(next){
    instrument=next;const basics=BASICS[instrument];$('learn-title').textContent=basics.title;
    $('beginner-tip').textContent=instrument==='sanshin'?'左手で押さえない合・四・工から。音の名前を言って、一本ずつ弾いてみましょう。':'最初は2つのコードだけ。止まりながら指を置いて、きれいに鳴る弦を増やしていきましょう。';
    $('beginner-drill').textContent=instrument==='sanshin'?'2. 合・四・工をゆっくり':'2. EmとAmをゆっくり';
    $('beginner-song').textContent=instrument==='sanshin'?'3. てぃんさぐぬ花を8音から':'3. 時間よ止まれのC・Amへ';
    $('learn-steps').replaceChildren(...basics.steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    $('learn-links').replaceChildren(...basics.links.map(([title,url])=>anchor(title,url)));
    $('study-select').replaceChildren(...STUDIES[instrument].map(s=>new Option(s.title,s.id)));
    if(!STUDIES[instrument].some(s=>s.id===selected))selected=STUDIES[instrument][0].id;
    $('study-select').value=selected;showStudy();
  };
}
