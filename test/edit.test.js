import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import FileEditor from '../src/FileEditor.js';
import SessionStore from '../src/SessionStore.js';

function tempFile(t, content) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-edit-'));
	const file = path.join(root, 'source.txt');

	fs.writeFileSync(file, content);

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	return file;
}

test('replaces an exact inclusive line range', t => {
	const file = tempFile(t, 'zero\nstart\nmiddle\nend\nlast\n');
	const edit = new FileEditor().edit(file, {
		mode: 'lines',
		start: 1,
		end: 3,
		expectedStart: 'start',
		expectedEnd: 'end',
		replacement: 'START\nnew\nEND'
	});

	assert.equal(edit.shift, 0);
	assert.equal(edit.removed, 'start\nmiddle\nend');
	assert.equal(edit.inserted, 'START\nnew\nEND');
	assert.equal(fs.readFileSync(file, 'utf8'), 'zero\nSTART\nnew\nEND\nlast\n');
});

test('relocates a line range when both boundaries shift equally', t => {
	const file = tempFile(
		t,
		'inserted one\ninserted two\nzero\nstart\nmiddle\nend\nlast\n'
	);
	const edit = new FileEditor().edit(file, {
		mode: 'lines',
		start: 1,
		end: 3,
		expectedStart: 'start',
		expectedEnd: 'end',
		replacement: 'replacement'
	});

	assert.equal(edit.appliedStart, 3);
	assert.equal(edit.appliedEnd, 5);
	assert.equal(edit.shift, 2);
	assert.equal(
		fs.readFileSync(file, 'utf8'),
		'inserted one\ninserted two\nzero\nreplacement\nlast\n'
	);
});

test('refuses ambiguous line relocation without writing', t => {
	const original = 'start\nx\nend\nother\nstart\ny\nend\n';
	const file = tempFile(t, original);
	const editor = new FileEditor();

	assert.throws(() => {
		editor.edit(file, {
			mode: 'lines',
			start: 20,
			end: 22,
			expectedStart: 'start',
			expectedEnd: 'end',
			replacement: 'replacement'
		});
	}, /ambiguous/);

	assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('relocates an inclusive character range', t => {
	const file = tempFile(t, 'XXabcdefYY');
	const edit = new FileEditor().edit(file, {
		mode: 'chars',
		start: 0,
		end: 2,
		expectedStart: 'a',
		expectedEnd: 'c',
		replacement: 'XYZ'
	});

	assert.equal(edit.appliedStart, 2);
	assert.equal(edit.appliedEnd, 4);
	assert.equal(edit.shift, 2);
	assert.equal(fs.readFileSync(file, 'utf8'), 'XXXYZdefYY');
});

test('records the exact mutation under the session', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-store-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	const store = new SessionStore(root);
	const session = store.start('Edit shared code', 'abc123');
	const record = store.recordEdit(session.id, {
		path: 'source.js',
		head: 'abc123',
		mode: 'lines',
		appliedStart: 4,
		appliedEnd: 6,
		removed: 'old',
		inserted: 'new'
	});

	assert.equal(record.head, 'abc123');
	assert.match(record.id, /^edit-/);
	assert.equal(record.path, 'source.js');
	assert.equal(record.removed, 'old');
	assert.equal(record.inserted, 'new');
});
