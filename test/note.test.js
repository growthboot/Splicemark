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

function repository(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-note-'));

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

	return root;
}

function edit(splicemark, session, root, start, expected, replacement) {
	return splicemark.edit(session.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start,
		end: start,
		expectedStart: expected,
		expectedEnd: expected,
		replacement
	});
}

test('surfaces only an overlapping peer note', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Protect return contract');
	const b = splicemark.start('Update implementation');

	splicemark.note(a.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start: 1,
		end: 1,
		message: 'Keep this return shape stable.'
	});

	const result = edit(splicemark, b, root, 1, 'one', 'ONE');

	assert.equal(result.notes.length, 1);
	assert.equal(result.notes[0].session.id, a.id);
	assert.equal(
		result.notes[0].note.message,
		'Keep this return shape stable.'
	);

	const output = new Diff().format(
		result.session,
		result.file,
		result.edit,
		result.peers,
		result.notes
	);

	assert.match(output, /\[PEER NOTE · .* · Protect return contract\]/);
	assert.match(output, /Keep this return shape stable\./);
});

test('does not surface a peer note from another region', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Protect first region');
	const b = splicemark.start('Change third region');

	splicemark.note(a.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start: 1,
		end: 1,
		message: 'Important nearby invariant.'
	});

	const result = edit(splicemark, b, root, 3, 'three', 'THREE');

	assert.deepEqual(result.notes, []);
});

test('notes expire immediately when HEAD changes', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Old-head note');
	const b = splicemark.start('Post-commit edit');

	splicemark.note(a.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start: 1,
		end: 1,
		message: 'This must expire.'
	});

	fs.writeFileSync(path.join(root, 'other.txt'), 'other\n');
	git(root, ['add', 'other.txt']);
	git(root, ['commit', '-qm', 'advance head']);

	const result = edit(splicemark, b, root, 1, 'one', 'ONE');

	assert.deepEqual(result.notes, []);
});

test('notes shift when an earlier edit moves their region', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Protect line two');
	const b = splicemark.start('Expand header');
	const c = splicemark.start('Touch shifted note');

	splicemark.note(a.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start: 2,
		end: 2,
		message: 'Line two moved.'
	});

	edit(splicemark, b, root, 0, 'zero', 'zero\ninserted');

	const result = edit(splicemark, c, root, 3, 'two', 'TWO');

	assert.equal(result.notes.length, 1);
	assert.equal(result.notes[0].note.lineStart, 3);
	assert.equal(result.notes[0].note.lineEnd, 3);
});

test('character notes normalize to line regions', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const a = splicemark.start('Character note');
	const b = splicemark.start('Line edit');
	const content = fs.readFileSync(path.join(root, 'source.txt'), 'utf8');
	const start = content.indexOf('two');

	splicemark.note(a.id, path.join(root, 'source.txt'), {
		mode: 'chars',
		start,
		end: start + 2,
		message: 'Character-scoped note.'
	});

	const result = edit(splicemark, b, root, 2, 'two', 'TWO');

	assert.equal(result.notes.length, 1);
	assert.equal(result.notes[0].note.lineStart, 2);
	assert.equal(result.notes[0].note.lineEnd, 2);
});
