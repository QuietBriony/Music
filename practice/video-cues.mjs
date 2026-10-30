// Timing guide for this specific official video. No audio, video or lyrics.
// Repeated phrases are interpolated between manually inspected anchors.
export const TOKIYO_VIDEO_ID='KgKycz0uHbM';
export const TOKIYO_END=259.2;
const a=[0,4,6,8,12,20,22],b=[0,4,6,12,14,16,20,24,26,28];
const phrase=(start,end,positions,total)=>positions.map(p=>Number((start+(end-start)*p/total).toFixed(2)));
export const TOKIYO_TIMES=[
 0,2.4,4.8,7.2,
 ...phrase(9.6,25.4,a,26),...phrase(25.4,42,a,26),
 ...phrase(42,63.3,b,34),
 ...phrase(63.3,80.5,a,26),...phrase(80.5,98.1,a,26),
 ...phrase(98.1,117.7,b,34),
 ...phrase(117.7,134.8,a,26),...phrase(134.8,152.4,a,26),
 ...phrase(152.4,173.3,b,34),
 ...phrase(173.3,191,a,26),...phrase(191,208.8,a,26),
 ...phrase(208.8,233.2,b,36),
 233.2,235.9,237.25,238.6,241.3,244,245.35,246.7,
 249.4,254.3
];
export function cueAt(times,time,offset=0,end=TOKIYO_END){
 if(!times.length||!Number.isFinite(time))return null;
 const position=Math.max(0,time)+(Number.isFinite(offset)?Math.max(-2,Math.min(2,offset)):0);
 let low=0,high=times.length;
 while(low<high){const mid=(low+high)>>1;if(times[mid]<=position)low=mid+1;else high=mid;}
 const index=Math.max(0,low-1);
 return{index,remaining:times[index+1]===undefined?null:Math.max(0,times[index+1]-position),ended:Number.isFinite(end)&&position>=end};
}
