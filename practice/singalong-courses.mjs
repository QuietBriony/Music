import { TOKIYO_STEPS,normalizeSingState } from './singalong-core.mjs?v=14';
import { TOKIYO_VIDEO_ID,TOKIYO_TIMES,TOKIYO_END } from './video-cues.mjs?v=14';
import { JIGSAW_STEPS,JIGSAW_TIMES,JIGSAW_END,JIGSAW_VIDEO_ID } from './jigsaw-cues.mjs?v=14';

export const PREPARED_COURSES={
 tokiyo:{key:'tokiyo-v1',legacy:true,video:TOKIYO_VIDEO_ID,url:`https://www.youtube.com/watch?v=${TOKIYO_VIDEO_ID}`,steps:TOKIYO_STEPS,times:TOKIYO_TIMES,end:TOKIYO_END,capo:4,note:'オーリーズの音楽室の歌詞・コード付き通し演奏。カポ4のコード名を案内します。'},
 jigsaw:{key:'jigsaw-cover-easy-v1',legacy:false,video:JIGSAW_VIDEO_ID,url:`https://www.youtube.com/watch?v=${JIGSAW_VIDEO_ID}`,steps:JIGSAW_STEPS,times:JIGSAW_TIMES,end:JIGSAW_END,capo:2,note:'imamuzxの通し弾き語りカバーに追従。図は標準調弦 EADGBE＋カポ2・セーハなしのかんたん伴奏です。動画の演奏は変則調弦なので、動画の指の位置とは異なります。細かなリフと低音の動きを省いています。'}
};
export function courseState(stored,course,steps,custom=false){
 const state=normalizeSingState(stored,steps.length);
 if(!course)return state;
 const same=stored&&(stored.timeline===course.key||(course.legacy&&!stored.timeline));
 if(!custom&&!same)return {...normalizeSingState(null,steps.length),capo:course.capo};
 return state;
}
