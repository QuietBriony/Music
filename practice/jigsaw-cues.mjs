// Our easy accompaniment to this particular full cover. No lyrics, TAB or media.
// Standard EADGBE + capo 2. Bass inversions and ornamental notes are simplified.
import { songSteps } from './singalong-core.mjs?v=23';
export const JIGSAW_VIDEO_ID='x0YbxY-u7fI';
export const JIGSAW_END=270.2;
const sections=[
 ['イントロ 1',[[0,'Am'],[14.6,'E'],[18.8,'Cmaj7'],[20.1,'Am7'],[21.3,'Fmaj7'],[23.2,'Em'],[24.6,'Fmaj7'],[26,'Em']]],
 ['イントロ 2',[[27.4,'Am'],[31.7,'E'],[35.5,'Cmaj7'],[36.8,'Am7'],[37.8,'Fmaj7'],[39.2,'Em'],[40.7,'Fmaj7'],[42.1,'Em']]],
 ['イントロ 3',[[43.5,'Am'],[49.3,'E'],[51.3,'Cmaj7'],[52.6,'Am7'],[54,'Fmaj7'],[55.4,'Em'],[56.8,'Fmaj7'],[58.2,'Em']]],
 ['歌 1',[[59.3,'Am'],[71.2,'Fmaj7'],[71.9,'Em'],[72.6,'Dm'],[76,'G'],[76.7,'Fmaj7'],[77.4,'Em'],[78.1,'Dm']]],
 ['歌 2',[[81.4,'Am'],[93.1,'Fmaj7'],[93.8,'Em'],[94.5,'Dm'],[99.6,'G'],[100.3,'Fmaj7'],[101,'Em'],[101.7,'Dm']]],
 ['歌 3',[[103.7,'Am'],[115.2,'Fmaj7'],[116,'Em'],[116.8,'Dm'],[121.2,'G'],[121.9,'Fmaj7'],[122.6,'Em'],[123.3,'Dm']]],
 ['間奏',[[125.5,'Am'],[131.1,'Dm'],[136.6,'Am'],[142.2,'Dm']]],
 ['歌 4',[[145,'Am'],[157.6,'Fmaj7'],[158.35,'Em'],[159.1,'Dm'],[163,'G'],[163.7,'Fmaj7'],[164.4,'Em'],[165.1,'Dm']]],
 ['歌 5',[[167.4,'Am'],[179.5,'Fmaj7'],[180.2,'Em'],[180.9,'Dm'],[185.5,'G'],[186.2,'Fmaj7'],[186.9,'Em'],[187.6,'Dm']]],
 ['間奏 2',[[191,'Am'],[195.3,'E'],[198.6,'Cmaj7'],[200,'Am7'],[201.3,'Fmaj7'],[202.7,'Em'],[204.1,'Fmaj7'],[205.5,'Em']]],
 ['後半 1',[[207,'Am'],[211.4,'E'],[214.8,'Cmaj7'],[216.1,'Am7'],[217.5,'Fmaj7'],[218.9,'Em'],[220.3,'Fmaj7'],[221.7,'Em']]],
 ['後半 2',[[223.1,'Am'],[227.5,'E'],[230.7,'Cmaj7'],[232.1,'Am7'],[233.5,'Fmaj7'],[234.9,'Em'],[236.3,'Fmaj7'],[237.7,'Em']]],
 ['後半 3',[[238.8,'Am'],[243.2,'E'],[246.2,'Cmaj7'],[247.5,'Am7'],[249,'Fmaj7'],[250.4,'Em'],[251.8,'Fmaj7'],[253.2,'Em']]],
 ['おわり',[[254,'Am']]]
];
export const JIGSAW_TIMES=sections.flatMap(([,entries])=>entries.map(([time])=>time));
export const JIGSAW_STEPS=songSteps(sections.map(([title,entries])=>({title,names:entries.map(([,name])=>name)})));
