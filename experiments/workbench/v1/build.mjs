import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
if (relative(root, output) !== 'dist') throw new Error('Build output must stay inside this app root');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'src', 'index.html.template'), join(output, 'index.html'));
await cp(join(root, 'src', 'app.js'), join(output, 'app.js'));
await cp(join(root, 'src', 'performance.js'), join(output, 'performance.js'));
await cp(join(root, 'src', 'performance-code.js'), join(output, 'performance-code.js'));
await cp(join(root, 'src', 'slider-bridge.js'), join(output, 'slider-bridge.js'));
await cp(join(root, 'src', 'groove-code.js'), join(output, 'groove-code.js'));
await cp(join(root, 'src', 'live-code.js'), join(output, 'live-code.js'));
await cp(join(root, 'src', 'live-plan.js'), join(output, 'live-plan.js'));
await cp(join(root, 'src', 'mix-code.js'), join(output, 'mix-code.js'));
await cp(join(root, 'src', 'tempo-bridge.js'), join(output, 'tempo-bridge.js'));
await cp(join(root, 'src', 'session-backup.js'), join(output, 'session-backup.js'));
await cp(join(root, 'src', 'pwa.js'), join(output, 'pwa.js'));
await cp(join(root, 'src', 'manifest.webmanifest'), join(output, 'manifest.webmanifest'));
await cp(join(root, 'src', 'icons'), join(output, 'icons'), { recursive: true });
await cp(join(root, 'src', 'style.css'), join(output, 'style.css'));
await cp(join(root, 'src', 'library.json'), join(output, 'library.json'));
await cp(join(root, 'src', 'patterns'), join(output, 'patterns'), { recursive: true });
await cp(join(root, 'src', '_headers'), join(output, '_headers'));
await cp(join(root, 'LICENSE'), join(output, 'LICENSE'));
await cp(join(root, 'third_party', 'acidbros'), join(output, 'modules', 'acidbros'), { recursive: true });
await cp(join(root, 'node_modules', '@strudel', 'repl', 'dist'), join(output, 'vendor', 'strudel'), { recursive: true });
await cp(join(root, 'node_modules', '@strudel', 'repl', 'LICENSE'), join(output, 'vendor', 'strudel', 'LICENSE'));

// One immutable app generation: a waiting worker is activated only by the user.
// Hashes also prevent a deploy halfway through from mixing two app versions.
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function assetsIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await assetsIn(path));
    else {
      const url = '/' + relative(output, path).replaceAll('\\', '/');
      if (['/_headers', '/sw.js', '/offline-assets.json'].includes(url)) continue;
      const bytes = await readFile(path);
      result.push({ url, sha256: digest(bytes), bytes: bytes.length });
    }
  }
  return result;
}
const assets = (await assetsIn(output)).sort((a, b) => a.url.localeCompare(b.url, 'en'));
const policy = await readFile(join(root, 'src', 'offline-policy.js'), 'utf8');
const pack = await readFile(join(root, 'src', 'offline-pack.js'), 'utf8');
const template = await readFile(join(root, 'src', 'sw.js.template'), 'utf8');
const release = digest(JSON.stringify(assets) + policy + pack + template).slice(0, 20);
const worker = policy.replaceAll('export ', '') + '\n'
  + pack.replace(/^import[\s\S]*?from '\.\/offline-policy\.js';\s*/, '').replaceAll('export ', '') + '\n'
  + template.replace('__RELEASE_JSON__', JSON.stringify(release)).replace('__ASSETS_JSON__', JSON.stringify(assets));
await writeFile(join(output, 'sw.js'), worker);
await writeFile(join(output, 'offline-assets.json'), JSON.stringify({ release, assets }, null, 2) + '\n');
console.log(`PWA ${release}: ${assets.length} app files / ${assets.reduce((sum, file) => sum + file.bytes, 0)} bytes`);
