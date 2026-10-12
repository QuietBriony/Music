import { renderRhythmStems } from "./rhythm-audition.mjs?v=1";
self.onmessage = () => {
  try {
    const stems = renderRhythmStems();
    const buffers = [stems.guitar, ...Object.values(stems.previous), ...Object.values(stems.refined)].map((data) => data.buffer);
    self.postMessage({ stems }, buffers);
  } catch (error) { self.postMessage({ error: error.message }); }
};
