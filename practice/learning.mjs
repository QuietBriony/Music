// Curated reference metadata only. No third-party scores, lyrics, recordings or embeds.
export const STUDIES = {
  guitar:[
    {id:'santeria',title:'Santeria',artist:'Sublime',focus:'E → G# → C#m → Bの短いコード練習。まず各音を確かめ、次に裏拍で軽く弾く練習へ。',names:['E','G#','C#m','B'],lesson:'https://creativeguitarstudio.blogspot.com/2018/04/qwik-songs-004-santeria-by-sublime.html',label:'Creative Guitar Studioの解説・動画',note:'冒頭の和音を使う簡易練習です。曲全体の構成・ソロは参照レッスンへ。'},
    {id:'blackbird',title:'Blackbird',artist:'The Beatles',focus:'G → Am7 → G/B → Gの和音を、一弦ずつ確かめる導入練習。親指の低音と指で弾く高音を分けて聴きます。',names:['G','Am7','G/B','G'],lesson:'https://www.justinguitar.com/songs/the-beatles-blackbird-chords-tabs-guitar-lesson-sb-113',video:'https://www.youtube.com/watch?v=mEn2SEwZKNE',label:'JustinGuitarの解説',note:'原曲の運指や二音の動きは動画で確認します。このアプリ内は和音の準備練習です。'}
  ],
  sanshin:[
    {id:'tinsagu',title:'てぃんさぐぬ花',artist:'沖縄民謡',focus:'本調子を合わせ、動画を短く区切って、工工四の文字を声に出してから弾きます。',lesson:'https://miyazatohidekatsu.com/sanshin/',video:'https://www.youtube.com/watch?v=mDGIJr9wNQw',label:'宮里英克の三線教室・譜面',score:'https://commons.wikimedia.org/wiki/File:Kunkunshi_for_Tinsagu_nu_Hana.png',note:'曲の全譜をアプリに同梱していません。譜面・教室動画を参照し、先に開放弦と勘所を確認できます。'},
    {id:'tsukinu',title:'月ぬ美しゃ',artist:'八重山民謡',focus:'ゆったりした歌の流れを先に聴き、1フレーズずつ口ずさんでから三線を重ねます。動画の調弦・キーを確かめて合わせます。',lesson:'https://ameblo.jp/irei-blog/entry-12356649318.html',video:'https://www.youtube.com/watch?v=7GmB2WV4D4A',label:'伊禮俊一の工工四付き練習動画',note:'歌詞・工工四は配信元の動画で確認できます。曲の全譜をアプリに転載していません。'},
    {id:'jidai',title:'時代の流れ',artist:'三線で練習したい曲',focus:'まず参考演奏で歌の節回しと三線の間を聴きます。手元の工工四と演奏の版をそろえ、短いまとまりで練習します。',lesson:'https://www.youtube.com/watch?v=I71DNvj756Y',label:'嘉手苅林昌の参考演奏',note:'こちらは弾き方解説ではなく参考演奏です。全譜・歌詞・自動追従データは未収録です。'}
  ]
};
export const BASICS = {
  guitar:{title:'TABとコード図の読み方',steps:[
    '調弦 → 開放弦 → 1つのコード → 2つのコードの切り替え、の順で始めます。最初は5分でも十分です。',
    'TABの6本線は弦です。上が細い1弦、下が太い6弦。数字は押さえるフレットで、0は左手で押さえずに弾きます。',
    'コード図は左から6弦→1弦、上の太い線がナット。丸の中の数字は指番号です。1＝人差し指、2＝中指、3＝薬指、4＝小指。○は開放、×は弾かない弦です。',
    'まず1弦ずつ鳴るか確かめ、次にまとめてストロークします。セーハは人差し指で複数の弦を押さえる形です。',
    '今日はEmとAmをゆっくり交互に。音が鳴る位置を確かめてから速くします。痛みが出たら休みましょう。'
  ],links:[['調弦・コード図・構え方を動画で学ぶ（JustinGuitar）','https://www.justinguitar.com/modules/before-you-begin-guitar-basics'],['最初のコードを学ぶ（JustinGuitar）','https://www.justinguitar.com/modules/beginner-1-first-steps']]},
  sanshin:{title:'工工四の読み方と練習の順番',steps:[
    '最初にチンダミ（調弦）。本調子Cなら、男弦C・中弦F・女弦Cです。女弦は男弦の1オクターブ上。動画と基準が違うときは、調弦を確かめてください。',
    '縦書きの工工四は右の列の上から下へ。次に左の列へ進みます。文字は弦と勘所を示します。横書きの譜面は、その譜面の読み順に従います。',
    '合＝男弦の開放、四＝中弦の開放、工＝女弦の開放。最初はこの3つを、名前を声に出しながら弾いてみます。',
    '○は休みの記号として使われます。小さい字・点・線などの意味は版や流派で違うため、参照する譜面の凡例と先生の説明を確認します。',
    '勘所にはギターのようなフレットがありません。文字と指の位置を結び付け、音を聴きながら少しずつ調整します。',
    '1フレーズを口ずさむ → 工工四を読む → ゆっくり弾く、の順で。最初から全部を通さず、短い範囲を繰り返します。'
  ],links:[['本調子のチンダミ・基礎動画（宜保和也）','https://gibokazuya.com/youtube/'],['三線と工工四の教室・動画（宮里英克）','https://miyazatohidekatsu.com/sanshin/'],['工工四を読んでみる（三線ショップ島風）','https://shimakaji.com/user_data/sanshin_05_6.php']]}
};
export function mountLearning({onPractice,onBasics,onLeave}) {
  const $=id=>document.getElementById(id);let instrument='guitar',selected='santeria';
  const anchor=(title,url)=>{const a=document.createElement('a');a.textContent=title+' ↗';a.href=url;a.target='_blank';a.rel='noopener';a.addEventListener('click',onLeave);return a;};
  function showStudy(){
    const study=STUDIES[instrument].find(s=>s.id===selected)||STUDIES[instrument][0];selected=study.id;
    $('study-title').textContent=`${study.title} / ${study.artist}`;$('study-focus').textContent=study.focus;$('study-note').textContent=study.note;
    $('study-links').replaceChildren(anchor(study.label,study.lesson),...(study.video?[anchor('YouTubeで見る',study.video)]:[]),...(study.score?[anchor('工工四の参照（Lrschneider / CC BY-SA 4.0）',study.score)]:[]));
    $('study-practice').textContent=study.names?'この曲の導入コードを練習':'先に合・四・工を練習';
    $('study-practice').onclick=()=>study.names?onPractice(study.names,`${study.title} · 導入のコード`,`study:${study.id}`):onBasics(`study:${study.id}`,study.title);
  }
  $('study-select').onchange=()=>{selected=$('study-select').value;showStudy();};
  return function render(next){
    instrument=next;const basics=BASICS[instrument];$('learn-title').textContent=basics.title;
    $('learn-steps').replaceChildren(...basics.steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    $('learn-links').replaceChildren(...basics.links.map(([title,url])=>anchor(title,url)));
    $('study-select').replaceChildren(...STUDIES[instrument].map(s=>new Option(s.title,s.id)));
    if(!STUDIES[instrument].some(s=>s.id===selected))selected=STUDIES[instrument][0].id;
    $('study-select').value=selected;showStudy();
  };
}
