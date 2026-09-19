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
	'ActorType.js',
	'SplicemarkCore.js',
	'TextEditor.js',
	'MemoryWorkspace.js',
	'MemorySessionStore.js',
	'MemoryGit.js',
	'PeerRegistry.js',
	'Reconciler.js',
	'WorkingTreeAttribution.js',
	'Diff.js'
];

const check =
	process.argv.includes('--check');

if (check) {
	const mismatches = files.filter(file => {
		const source =
			path.join(root, 'src', file);
		const target =
			path.join(destination, file);

		return (
			!fs.existsSync(target) ||
			!fs.readFileSync(source).equals(
				fs.readFileSync(target)
			)
		);
	});

	if (mismatches.length > 0) {
		throw new Error(
			'Browser runtime is stale: ' +
			mismatches.join(', ') +
			'. Run node scripts/sync-site-core.js'
		);
	}

	process.stdout.write(
		'verified ' +
		files.length +
		' browser-safe production modules\n'
	);
} else {
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
}
