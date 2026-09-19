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

test('website peer example executes current production modules on a large source file', async () => {
	const example =
		fs.readFileSync(
			path.join(
				root,
				'docs/examples/WorldPhysics.js'
			),
			'utf8'
		);
	const lineCount =
		example.split('\n').length - 1;
	const demo =
		new LiveDemo({
			exampleLoader: file =>
				fs.readFileSync(
					path.join(
						root,
						'docs/examples',
						file
					),
					'utf8'
				),
			sourceLoader: file =>
				fs.readFileSync(
					path.join(root, 'src', file),
					'utf8'
				)
		});
	const result =
		await demo.run('peers');

	assert.ok(lineCount >= 680 && lineCount <= 820);
	assert.equal(result.id, 'peers');
	assert.equal(
		result.file,
		'docs/examples/WorldPhysics.js'
	);
	assert.match(
		result.command,
		/^splicemark diff sm-[0-9a-f]{8} --context=2$/
	);
	assert.match(
		result.output,
		/\[PEER · AGENT · sm-[0-9a-f]{8} · Cache inverse vector length\]/
	);
	assert.match(
		result.output,
		/\[YOU · AGENT · sm-[0-9a-f]{8} · Name collision skin tolerance\]/
	);

	const hunks =
		[...result.output.matchAll(
			/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/gm
		)].map(match => ({
			oldStart: Number(match[1]),
			oldCount: Number(match[2]),
			newStart: Number(match[3]),
			newCount: Number(match[4])
		}));

	assert.equal(hunks.length, 2);
	for (const hunk of hunks) {
		assert.equal(hunk.oldCount, 5);
		assert.equal(hunk.newCount, 6);
	}

	const contextRows =
		result.output
			.split('\n')
			.filter(line =>
				/^\s*\d+\s+\d+\s{2}/.test(line)
			);

	assert.equal(contextRows.length, 8);

	const positions =
		[...result.output.matchAll(/^@@ -(\d+)/gm)]
			.map(match => Number(match[1]));

	assert.equal(positions.length, 2);
	assert.deepEqual(
		positions,
		[...positions].sort((a, b) => a - b)
	);
	assert.ok(
		positions[1] - positions[0] >= 450
	);
});
