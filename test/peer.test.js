import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Diff from '../src/Diff.js';
import Splicemark from '../src/Splicemark.js';

function git(root, args) {
	return execFileSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function repository(t, content = 'zero\nold\nthird\nlast\n') {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-peer-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	git(root, ['init', '-q']);
	git(root, ['config', 'user.name', 'Splicemark Test']);
	git(root, ['config', 'user.email', 'splicemark@example.invalid']);
	fs.writeFileSync(path.join(root, 'source.txt'), content);
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'initial']);

	return root;
}

function edit(splicemark, session, root, start, end, expectedStart, expectedEnd, replacement) {
	return splicemark.edit(session.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start,
		end,
		expectedStart,
		expectedEnd,
		replacement
	});
}

test('surfaces an overlapping active peer edit with task identity', t => {
	const root = repository(t);
	const first = new Splicemark({ cwd: root });
	const second = new Splicemark({ cwd: root });
	const a = first.start('Change return shape');
	const b = second.start('Update caller');

	edit(first, a, root, 1, 1, 'old', 'old', 'agent-a');

	const result = edit(
		second,
		b,
		root,
		1,
		1,
		'agent-a',
		'agent-a',
		'agent-b'
	);

	assert.equal(result.peers.length, 1);
	assert.equal(result.peers[0].session.id, a.id);
	assert.equal(result.peers[0].session.description, 'Change return shape');
	assert.equal(result.peers[0].edit.inserted, 'agent-a');

	const output = new Diff().format(
		result.session,
		result.file,
		result.edit,
		result.peers
	);

	assert.match(output, /\[YOU · .* · Update caller\]/);
	assert.match(output, /\[PEER · .* · Change return shape\]/);
	assert.match(output, /\+agent-a/);
});

test('does not surface unrelated edits in the same file', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Change middle');
	const b = splicemark.start('Change tail');

	edit(splicemark, a, root, 1, 1, 'old', 'old', 'middle');

	const result = edit(
		splicemark,
		b,
		root,
		3,
		3,
		'last',
		'last',
		'tail'
	);

	assert.deepEqual(result.peers, []);
});

test('shifts peer locations after an earlier line-count change', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Change third line');
	const b = splicemark.start('Expand header');
	const c = splicemark.start('Touch shifted third line');

	edit(splicemark, a, root, 2, 2, 'third', 'third', 'peer-third');

	edit(
		splicemark,
		b,
		root,
		0,
		0,
		'zero',
		'zero',
		'zero\ninserted'
	);

	const result = edit(
		splicemark,
		c,
		root,
		3,
		3,
		'peer-third',
		'peer-third',
		'final-third'
	);

	assert.equal(result.peers.length, 1);
	assert.equal(result.peers[0].session.id, a.id);
	assert.equal(result.peers[0].edit.lineStart, 3);
	assert.equal(result.peers[0].edit.lineEnd, 3);
});

test('line edits detect peer authorship created through character edits', t => {
	const root = repository(t, 'zero\nabcdef\nlast\n');
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Change characters');
	const b = splicemark.start('Change line');

	splicemark.edit(a.id, path.join(root, 'source.txt'), {
		mode: 'chars',
		start: 5,
		end: 7,
		expectedStart: 'a',
		expectedEnd: 'c',
		replacement: 'ABC'
	});

	const result = edit(
		splicemark,
		b,
		root,
		1,
		1,
		'ABCdef',
		'ABCdef',
		'changed-line'
	);

	assert.equal(result.peers.length, 1);
	assert.equal(result.peers[0].session.id, a.id);
});
