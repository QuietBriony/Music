import { createScore } from "./score.mjs?v=3";
import { renderScore } from "./dsp.mjs?v=3";

self.onmessage = ({ data }) => {
  try {
    const rendered = renderScore(createScore(data.style), 32000,
      (progress) => self.postMessage({ progress }));
    self.postMessage({ rendered }, Object.values(rendered.stems).map((stem) => stem.buffer));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
