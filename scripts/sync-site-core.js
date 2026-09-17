import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const destination = path.join(
	root,
	'docs',
	'runtime',
	'core'
);
const files = [
	'SplicemarkCore.js',
	'TextEditor.js',
	'MemoryWorkspace.js',
	'MemorySessionStore.js',
	'MemoryGit.js',
	'PeerRegistry.js',
	'Reconciler.js',
	'Diff.js'
];

fs.mkdirSync(destination, {
	recursive: true
});

for (const file of files) {
	fs.copyFileSync(
		path.join(root, 'src', file),
		path.join(destination, file)
	);
}

process.stdout.write(
	'synced ' +
	files.length +
	' browser-safe production modules\n'
);
