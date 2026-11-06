// Positions are navigation aids, not a transcription of copyrighted melodies.
// The publisher's player shows the score and lyrics in its own arrangement.
export const SANSHIN_MATERIALS={
 shimauta:{start:870,end:1120,scope:'先生の通し演奏。原曲の全番を収録した譜面ではありません。',chapters:[[0,'解説・調弦'],[600,'高い音の工工四'],[870,'通し演奏']]},
 jidai:{start:518,end:629,scope:'先生の通し演奏（2番まで）。工工四・歌詞のページが演奏と一緒に進みます。',chapters:[[0,'解説・調弦'],[210,'前奏の工工四'],[518,'通し演奏'],[577,'2番'],[620,'後奏']]},
 warabigami:{start:690,end:835,scope:'先生の通し練習。教材に表示される節を工工四と歌詞で追います。',chapters:[[0,'解説・調弦'],[400,'工工四で部分練習'],[690,'通し練習']]},
 nadasoso:{start:872,end:1020,scope:'先生の通し練習。原曲の全番を収録した譜面ではありません。',chapters:[[0,'解説・調弦'],[650,'工工四で部分練習'],[872,'通し練習'],[950,'後半の工工四']]},
 sanshinnohana:{start:180,end:546,tuning:'二揚げ · 2弦を本調子から1音上げます。高さは先生の動画に合わせてください。',scope:'先生のフルバージョン。歌詞を添えた工工四を動画内で表示します。',chapters:[[0,'解説'],[125,'二揚げの説明'],[180,'通し演奏'],[400,'後半の工工四']]},
 tinsagu:{start:663,end:765,scope:'先生の1節と後奏。アプリ内の1節の簡略譜とは譜割りが異なります。',chapters:[[0,'解説・調弦'],[540,'工工四で部分練習'],[663,'1節を通して練習'],[750,'後奏']]},
 tsukinu:{start:0,end:164,tuning:'二揚げ · C–G–C（ド・ソ・ド）。本調子 C–F–C から2弦を1音上げます。',scope:'伊禮俊一の演奏。歌詞と工工四を同時に表示します。',chapters:[[0,'調弦・前奏'],[25,'歌の部分'],[70,'囃子'],[120,'後半']]},
 'anata-ni':{start:690,end:865,scope:'先生の通し練習。前奏からパート11まで、歌詞付き工工四が演奏に合わせて進みます。原曲と同じ繰り返し数ではありません。',chapters:[[0,'解説・調弦'],[505,'部分練習'],[690,'通し練習'],[827,'終わりの反復']]}
};
export const ANATA_PERFORMANCE={video:'yTmLDZZFDrA',source:'https://miyazatohidekatsu.com/sanshin/',credit:'宮里英克沖縄三線教室',sheets:[{label:'工工四付き動画の掲載ページ',url:'https://miyazatohidekatsu.com/sanshin/'}],note:'先生の歌詞付き工工四で通して練習します。指の解説を細かく確認したいときは「以前の指のレッスン」に切り替えられます。'};
export const ANATA_LESSON={start:0,end:null,scope:'指使い・弾き方を解説する初級教材です。通し練習は教材を切り替えてください。',chapters:[[0,'初級の教材'],[800,'サビの工工四']]};
export function sanshinMaterialChoice(id,preference,hasOldSession,requested){
 if(id!=='anata-ni')return 'original';
 if(['performance','original'].includes(requested))return requested;
 if(['performance','original'].includes(preference))return preference;
 return hasOldSession?'original':'performance';
}
export const sanshinSessionKey=(id,variant)=>`music-practice-sanshin-video-${id}-v1${id==='anata-ni'&&variant==='performance'?':video:'+ANATA_PERFORMANCE.video:''}`;
export const sanshinLyricKey=(id,variant)=>`video:sanshin:${id}${id==='anata-ni'&&variant==='performance'?':video:'+ANATA_PERFORMANCE.video:''}`;
export function lessonChapter(material,time){
 if(!material||!Number.isFinite(time))return null;
 const list=material.chapters;let index=0;while(index+1<list.length&&list[index+1][0]<=time)index++;
 return {index,time:list[index][0],label:list[index][1],next:list[index+1]||null};
}
