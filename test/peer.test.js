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

	const state = second.diff(b.id);

	assert.equal(state.peers.length, 1);
	assert.equal(state.peers[0].session.id, a.id);
	assert.equal(state.peers[0].edit.locationStatus, 'overlapped');

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

test('surfaces distant edits in the same active file as peer collisions', t => {
	const content =
		Array.from(
			{ length: 500 },
			(_, index) => 'line-' + index
		).join('\n') + '\n';
	const root = repository(t, content);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Change early region');
	const b = splicemark.start('Change distant region');

	edit(
		splicemark,
		a,
		root,
		100,
		100,
		'line-100',
		'line-100',
		'peer-100'
	);

	const result = edit(
		splicemark,
		b,
		root,
		450,
		450,
		'line-450',
		'line-450',
		'you-450'
	);

	assert.equal(result.peers.length, 1);
	assert.equal(result.peers[0].session.id, a.id);
	assert.equal(result.peers[0].edit.lineStart, 100);
	assert.equal(result.peers[0].edit.lineEnd, 100);

	const state = splicemark.diff(b.id);
	const output =
		new Diff().formatSession(
			state.session,
			state.edits,
			state.peers
		);

	assert.equal(state.peers.length, 1);
	assert.match(output, /\[YOU · .* · Change distant region\]/);
	assert.match(output, /@@ -451,1 \+451,1 @@/);
	assert.match(output, /\+you-450/);
	assert.match(output, /\[PEER · .* · Change early region\]/);
	assert.match(output, /@@ -101,1 \+101,1 @@/);
	assert.match(output, /\+peer-100/);
	assert.ok(
		output.indexOf('@@ -101,1 +101,1 @@') <
		output.indexOf('@@ -451,1 +451,1 @@')
	);
});

test('does not surface edits from a different file as peer collisions', t => {
	const root = repository(t);
	fs.writeFileSync(path.join(root, 'other.txt'), 'other-old\n');
	git(root, ['add', 'other.txt']);
	git(root, ['commit', '-qm', 'add other file']);

	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Change source');
	const b = splicemark.start('Change other');

	edit(splicemark, a, root, 1, 1, 'old', 'old', 'source-new');

	const result = splicemark.edit(
		b.id,
		path.join(root, 'other.txt'),
		{
			mode: 'lines',
			start: 0,
			end: 0,
			expectedStart: 'other-old',
			expectedEnd: 'other-old',
			replacement: 'other-new'
		}
	);

	assert.deepEqual(result.peers, []);

	const state = splicemark.diff(b.id);
	assert.deepEqual(state.peers, []);
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

	assert.equal(result.peers.length, 2);

	const shifted =
		result.peers.find(peer => peer.session.id === a.id);

	assert.ok(shifted);
	assert.equal(shifted.edit.lineStart, 3);
	assert.equal(shifted.edit.lineEnd, 3);
	assert.ok(result.peers.some(peer => peer.session.id === b.id));
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
