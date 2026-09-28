import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
await mkdir(output, { recursive: true });
await cp(join(root, 'src', 'index.html.template'), join(output, 'index.html'));
await cp(join(root, 'src', 'app.js'), join(output, 'app.js'));
await cp(join(root, 'src', 'style.css'), join(output, 'style.css'));
await cp(join(root, 'src', 'library.json'), join(output, 'library.json'));
await cp(join(root, 'src', 'patterns'), join(output, 'patterns'), { recursive: true });
await cp(join(root, 'src', '_headers'), join(output, '_headers'));
await cp(join(root, 'LICENSE'), join(output, 'LICENSE'));
await cp(join(root, 'node_modules', '@strudel', 'repl', 'dist'), join(output, 'vendor', 'strudel'), { recursive: true });
await cp(join(root, 'node_modules', '@strudel', 'repl', 'LICENSE'), join(output, 'vendor', 'strudel', 'LICENSE'));
