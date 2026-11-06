import { SING_SHAPES } from './singalong-core.mjs?v=35';

// Simplified accompaniment, tied to the publisher's recording. Only harmonic
// labels are stored. Section anchors are visually sampled; changes within each
// phrase follow its rhythmic weights and remain estimates, not a transcription.
export function phraseCourse({id,video,capo=0,easyCapo=capo,end,phrases,note}){
 const steps=[],times=[];
 for(const [section,[start,stop,title,pattern]] of phrases.entries()){
  if(!Number.isFinite(start)||!Number.isFinite(stop)||start<0||stop<=start||stop>end||section&&start!==phrases[section-1][1])throw Error('伴奏の区切りを確認してください。');
  const cells=pattern.split(/\s+/).map(token=>{const [name,raw='1']=token.split(':');const weight=Number(raw);if(name!=='N'&&!Object.hasOwn(SING_SHAPES,name)||!Number.isFinite(weight)||weight<=0)throw Error('伴奏のコードを確認してください。');return {name,weight};});
  const total=cells.reduce((sum,c)=>sum+c.weight,0);let weight=0;
  for(const cell of cells){const time=Math.round((start+(stop-start)*weight/total)*1000)/1000;times.push(time);steps.push({name:cell.name,silent:cell.name==='N',section,title,index:steps.length});weight+=cell.weight;}
 }
 if(!steps.length||times.some((t,i)=>i&&t<=times[i-1])||phrases.at(-1)[1]!==end)throw Error('伴奏の時刻を確認してください。');
 const url=`https://www.youtube.com/watch?v=${video}`;
 return {key:`${id}-${video}-material-v2`,video,url,source:url,capo,easyCapo,end,steps,times,material:true,lyricsInVideo:true,estimated:true,precision:'phrase-estimate',note:note+' 歌詞は教材動画内に表示。区切りとリズムに沿う簡略伴奏で、細かな切替時刻は目安です。'};
}

const repeat=(pattern,n)=>Array(n).fill(pattern).join(' ');
const santeriaVerse='C:2 E:2 Am:2 G:2';
const santeriaChorus=repeat('F G C Am',3)+' F G';
const sleep='E:2 A G B7:2 E:2';
const birdStart='G Am G:5';
const birdVerse=birdStart+' C A7 D B7 Em:2 Eb:2 D A7 C:2 Cm:2 G:2 A7:2 D7:2 G:2';
const birdChorus='F Em Dm C Bb:2 C:2 F Em Dm C Bb:2 A7:2 D7:2';
const birdSolo='C A7 D B7 Em:2 Eb:2 D A7 C:2 Cm:2 G:2 A7:2 D7:2 G:2';
const bridgeLine='E:2 B:2 C#m:2 G#m A';
const bridgeVerse=bridgeLine+' E:2 B:2 C#m:2 A:2 '+bridgeLine+' E:2 B:2 C#m:2 A:2 E:8';
const bridgeChorus=repeat('F#m E B F#m',4);
const yourA='C F G Em Am G D F';
const yourB='C G E Am C Dm F';

export const PHRASE_COURSES=Object.fromEntries([
 {id:'santeria',video:'5wlQ-AYhb2M',capo:4,end:202,note:'MunsonMusicの通し演奏。標準調弦・カポ4。C・E・Am・G・小さなFを中心に、低音の動きと細かなソロを省いて伴奏します。',phrases:[
  [2.5,14.3,'前奏',santeriaVerse],[14.3,40.7,'1番',repeat(santeriaVerse,2)],[40.7,61.1,'サビ',santeriaChorus],
  [61.1,85.4,'2番',repeat(santeriaVerse,2)],[85.4,103,'サビ',santeriaChorus],[103,129,'間奏',repeat(santeriaVerse,2)],
  [129,151.2,'サビ',santeriaChorus],[151.2,174,'3番',repeat(santeriaVerse,2)],[174,194.5,'最後のサビ',santeriaChorus],
  [194.5,202,'最後', 'C G Am G F G C7:4']
 ]},
 {id:'sleep-last-night',video:'YC8HVwq0Tks',end:265,note:'MunsonCoversのEの調の通し演奏。標準調弦・カポなし。E・A・G・B7の4つで、まず各コードの頭を下向きに1回弾きます。原曲の半音下げ調弦には合わせません。',phrases:[
  [4,20,'前奏',sleep],[20,51,'1番',repeat(sleep,2)],[51,82,'2番',repeat(sleep,2)],[82,111,'3番',repeat(sleep,2)],
  [111,141,'4番',repeat(sleep,2)],[141,171,'間奏',repeat(sleep,2)],[171,201,'5番',repeat(sleep,2)],
  [201,232,'6番',repeat(sleep,2)],[232,262,'7番',repeat(sleep,2)],[262,265,'最後','E']
 ]},
 {id:'blackbird',video:'2EPFtnTex9g',end:131,note:'MunsonMusicの通し演奏。標準調弦・カポなし。原曲の指弾きは省き、コードが変わるときに1回ずつ鳴らす伴奏です。分数コードの低音は省いています。',phrases:[
  [3,7.5,'前奏',birdStart],[7.5,25,'1番',birdVerse],[25,30,'つなぎ','C G A7:2 D7:2 G:2'],
  [30,47,'2番',birdVerse],[47,61,'サビ',birdChorus+' '+birdStart],[61,77,'間奏',birdSolo],
  [77,88,'サビ',birdChorus],[88,102,'間奏・鳥の声',birdStart+' G:8 G Am G C G A7 D7:2'],
  [102,119,'3番',birdVerse],[119,131,'最後',repeat('C G A7:2 D7:2 G:2',2)]
 ]},
 {id:'under-the-bridge',video:'vPnURDDWMW0',easyCapo:2,end:238,note:'MunsonMusicの通し演奏。動画はカポなし、かんたんな形はカポ2で同じ音の高さです。小さな3本の形で伴奏し、イントロのリフと分数コードの低音は省きます。',phrases:[
  [3,25.5,'前奏',repeat('D:2 F#:2',4)],[25.5,54.5,'1番',bridgeVerse],[54.5,78.5,'2番',bridgeVerse],
  [78.5,99.5,'サビ',bridgeChorus],[99.5,111,'間奏',bridgeLine+' E:2 B:2 C#m:2 A:2'],
  [111,133.6,'3番',bridgeVerse],[133.6,155.3,'サビ',bridgeChorus],[155.3,175.2,'後半・前半',repeat('A Am G F',3)+' F:2 E G'],
  [175.2,195.5,'後半・中ほど',repeat('A Am G F',4)],[195.5,216.5,'後半・繰り返し',repeat('A Am G F',4)],
  [216.5,235.8,'後奏',repeat('A Am G F',4)],[235.8,238,'最後','A']
 ]},
 {id:'your-song',video:'8KBAuOBoemw',end:567,note:'MunsonCoversのCの調のゆっくりした通し演奏（約9分半）。標準調弦・カポなし。低音の動きを省き、各コードをゆっくり鳴らします。原曲のカポ3とは異なります。',phrases:[
  [4,22,'前奏','C F G F'],[22,54,'1番・前半',yourA],[54,94,'1番・後半',yourB+' G:2'],
  [94,130,'2番・前半',yourA],[130,170,'2番・後半',yourB+' C:2'],[170,206,'サビ・前半','G Am Dm F G Am Dm F'],
  [206,230,'サビ・後半','Am G D F:2'],[230,252,'サビ・結び','C Dm:2 G:2'],[252,270,'間奏','C F G F'],
  [270,306,'3番・前半',yourA],[306,346,'3番・後半',yourB+' G:2'],[346,382,'4番・前半',yourA],
  [382,422,'4番・後半',yourB+' C:2'],[422,458,'最後のサビ・前半','G Am Dm F G Am Dm F'],
  [458,478,'最後のサビ・後半','Am G D F:2'],[478,502,'最後のサビ・結び','C F:2 G:2'],[502,526,'繰り返し','Am G D F:2'],
  [526,558,'最後','C F:2 C F G F'],[558,567,'最後の響き','C']
 ]}
].map(spec=>[spec.id,phraseCourse(spec)]));
