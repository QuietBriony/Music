import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readConsent,CONSENT_KEY,POLICY_VERSION} from '../practice/privacy.mjs';
import {SANSHIN_PLAYLIST} from '../practice/sanshin-playlist.mjs';
import {ANATA_PERFORMANCE} from '../practice/sanshin-materials.mjs';
import {PREPARED_COURSES} from '../practice/singalong-courses.mjs';
import {MATERIAL_COURSES} from '../practice/material-courses.mjs';
import {HAND_LESSONS} from '../practice/hand-guide-core.mjs';
import {videoId} from '../practice/singalong-core.mjs';
const storage=value=>({getItem:key=>{assert.equal(key,CONSENT_KEY);return value;}});
for(const bad of [null,'invalid','{}','{"accepted":true}','{"version":"old","accepted":true}',JSON.stringify({version:POLICY_VERSION,accepted:'true'})])assert.equal(readConsent(storage(bad)),null);
assert.equal(readConsent({getItem(){throw Error('disabled');}}),null);
for(const accepted of [true,false])assert.equal(readConsent(storage(JSON.stringify({version:POLICY_VERSION,accepted}))).accepted,accepted);
const read=name=>readFileSync(new URL('../practice/'+name,import.meta.url),'utf8');
for(const page of ['terms.html','privacy.html']){assert.match(read(page),/https:\/\/www.youtube.com\/t\/terms/);assert.match(read('sw.js'),new RegExp('./'+page));assert.ok(!/<script[^>]*src="https?:/.test(read(page)),'Policy pages load no external service');}
assert.match(read('privacy.html'),/https:\/\/www.google.com\/policies\/privacy/);
assert.match(read('privacy.html'),/music-practice-mic-gain-v1/);
assert.match(read('privacy.html'),/localStorage/);
const metadata=JSON.parse(read('songs/youtube-status.json')),ids=new Set();
for(const t of [...SANSHIN_PLAYLIST.tracks,...SANSHIN_PLAYLIST.basicTracks])ids.add(videoId(t.video));
ids.add(ANATA_PERFORMANCE.video);
for(const c of [...Object.values(PREPARED_COURSES),...Object.values(MATERIAL_COURSES),...Object.values(HAND_LESSONS)])if(c.video)ids.add(videoId(c.video));
assert.deepEqual(new Set(metadata.videos.map(v=>v.id)),ids,'Every embedded bundled ID has a status record');
for(const v of metadata.videos){assert.equal(v.madeForKids,null,'An unavailable lookup must not become a guessed negative');assert.equal(v.verification,'unconfirmed');assert.ok(v.uses.length);}
console.log(`Practice privacy: versioned optional consent storage, offline local policies and ${ids.size} honestly recorded video statuses PASS`);
