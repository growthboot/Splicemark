import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import LiveDemo from '../docs/runtime/LiveDemo.js';

const root =
	path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		'..'
	);

test('website peer example executes current production modules', async () => {
	const demo =
		new LiveDemo({
			sourceLoader: file =>
				fs.readFileSync(
					path.join(root, 'src', file),
					'utf8'
				)
		});
	const result =
		await demo.run('peers');

	assert.equal(result.id, 'peers');
	assert.equal(result.file, 'src/PeerRegistry.js');
	assert.match(
		result.command,
		/^splicemark diff sm-[0-9a-f]{8}$/
	);
	assert.match(
		result.output,
		/\[PEER · sm-[0-9a-f]{8} · Document peer return\]/
	);
	assert.match(
		result.output,
		/\[YOU · sm-[0-9a-f]{8} · Refine peer return\]/
	);

	const positions =
		[...result.output.matchAll(/^@@ -(\d+)/gm)]
			.map(match => Number(match[1]));

	assert.ok(positions.length >= 2);
	assert.deepEqual(
		positions,
		[...positions].sort((a, b) => a - b)
	);
});
