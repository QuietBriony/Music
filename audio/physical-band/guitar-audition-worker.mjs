import { syntheticAuditionNotes } from "./guitar-audition.mjs?v=2";
self.onmessage = () => {
  try {
    const notes = { synthetic: syntheticAuditionNotes(), refined: syntheticAuditionNotes(true) };
    self.postMessage({ notes }, Object.values(notes).flatMap((voice) => voice.map((note) => note.data.buffer)));
  } catch (error) { self.postMessage({ error: error.message }); }
};
