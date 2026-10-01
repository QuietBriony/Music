import { renderInstrumentBank } from "./bank.mjs?v=2";
self.onmessage = () => {
  try {
    const bank = renderInstrumentBank((progress) => self.postMessage({ progress }));
    self.postMessage({ bank }, Object.values(bank.samples).map((sample) => sample.buffer));
  } catch (error) { self.postMessage({ error: error.message }); }
};
