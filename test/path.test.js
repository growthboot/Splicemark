import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Splicemark from '../src/Splicemark.js';

function git(root, args) {
	return execFileSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

test('relative edit, batch, and note paths resolve from the configured cwd', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-path-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	git(root, ['init', '-q']);
	git(root, ['config', 'user.name', 'Splicemark Test']);
	git(root, ['config', 'user.email', 'splicemark@example.invalid']);

	fs.writeFileSync(
		path.join(root, 'source.txt'),
		'zero\none\ntwo\nthree\n'
	);

	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'initial']);

	const splicemark = new Splicemark({ cwd: root });
	const session = splicemark.start('Relative path task');

	splicemark.edit(session.id, 'source.txt', {
		mode: 'lines',
		start: 1,
		end: 1,
		expectedStart: 'one',
		expectedEnd: 'one',
		replacement: 'ONE'
	});

	splicemark.batch(session.id, 'source.txt', {
		mode: 'lines',
		splices: [
			{
				start: 2,
				end: 2,
				replacement: 'TWO'
			}
		]
	});

	const note = splicemark.note(session.id, 'source.txt', {
		mode: 'lines',
		start: 3,
		end: 3,
		message: 'Keep this region stable.'
	});

	assert.equal(note.file, 'source.txt');
	assert.equal(note.note.lineStart, 3);
	assert.equal(
		fs.readFileSync(path.join(root, 'source.txt'), 'utf8'),
		'zero\nONE\nTWO\nthree\n'
	);
});
