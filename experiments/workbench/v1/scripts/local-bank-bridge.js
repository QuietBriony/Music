// The pinned Strudel REPL preloads these public sample registries on startup.
// A local run only needs the four RolandTR909 sounds used by the published acid
// patterns; other registries are intentionally empty until a user goes online.
const registries = new Map([
  ['https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json', 'tidal-drum-machines'],
  ['https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json', 'piano'],
  ['https://raw.githubusercontent.com/felixroos/dough-samples/main/Dirt-Samples.json', 'Dirt-Samples'],
  ['https://raw.githubusercontent.com/felixroos/dough-samples/main/vcsl.json', 'vcsl'],
  ['https://raw.githubusercontent.com/felixroos/dough-samples/main/mridangam.json', 'mridangam'],
  ['https://raw.githubusercontent.com/tidalcycles/uzu-drumkit/main/strudel.json', 'strudel'],
  ['https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json', 'tidal-drum-machines-alias'],
]);

const originalFetch = window.fetch.bind(window);
window.fetch = (resource, options) => {
  const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource?.url;
  const registry = registries.get(url);
  return originalFetch(registry ? '/__local__/maps/' + registry + '.json' : resource, options);
};
