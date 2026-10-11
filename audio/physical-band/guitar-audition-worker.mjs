import { syntheticAuditionNotes } from "./guitar-audition.mjs?v=1";
self.onmessage = () => {
  try {
    const notes = syntheticAuditionNotes();
    self.postMessage({ notes }, notes.map((note) => note.data.buffer));
  } catch (error) { self.postMessage({ error: error.message }); }
};
