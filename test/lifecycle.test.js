import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import SessionStore from '../src/SessionStore.js';
import Splicemark from '../src/Splicemark.js';

function git(root, args) {
	return execFileSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function repository(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-life-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	git(root, ['init', '-q']);
	git(root, ['config', 'user.name', 'Splicemark Test']);
	git(root, ['config', 'user.email', 'splicemark@example.invalid']);
	fs.writeFileSync(path.join(root, 'source.txt'), 'zero\none\n');
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'initial']);

	return root;
}

test('finish marks a session inactive and blocks further edits', t => {
	const root = repository(t);
	const splicemark = new Splicemark({ cwd: root });
	const session = splicemark.start('Finished task');
	const finished = splicemark.finish(session.id);

	assert.equal(finished.status, 'finished');
	assert.ok(finished.finishedAt);

	assert.throws(() => {
		splicemark.edit(session.id, path.join(root, 'source.txt'), {
			mode: 'lines',
			start: 1,
			end: 1,
			expectedStart: 'one',
			expectedEnd: 'one',
			replacement: 'ONE'
		});
	}, /session is not active/);
});

test('clean removes only obsolete coordination state', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-clean-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	const store = new SessionStore(root);
	const active = store.start('Active task', 'head-new');
	const finished = store.start('Finished task', 'head-new');

	store.recordEdit(active.id, {
		path: 'source.js',
		head: 'head-old',
		removed: 'old',
		inserted: 'committed',
		status: 'retired'
	});

	const retired = store.listEdits(active.id)[0];
	store.updateEditStatus(active.id, retired.id, 'retired', 'head-new');

	store.recordEdit(active.id, {
		path: 'source.js',
		head: 'head-new',
		removed: 'a',
		inserted: 'b'
	});

	store.recordEdit(active.id, {
		path: 'source.js',
		head: 'head-old',
		removed: 'x',
		inserted: 'y'
	});

	const stale = store.listEdits(active.id).at(-1);
	store.updateEditStatus(active.id, stale.id, 'stale', 'head-new');

	store.recordNote(active.id, {
		path: 'source.js',
		head: 'head-old',
		lineStart: 1,
		lineEnd: 1,
		message: 'expired'
	});

	store.recordNote(active.id, {
		path: 'source.js',
		head: 'head-new',
		lineStart: 2,
		lineEnd: 2,
		message: 'current'
	});

	store.finish(finished.id);

	const result = store.clean('head-new');

	assert.deepEqual(result, {
		sessions: 1,
		notes: 1,
		edits: 1
	});

	const sessions = store.listSessions();
	assert.equal(sessions.length, 1);
	assert.equal(sessions[0].id, active.id);

	const edits = store.listEdits(active.id);
	assert.equal(edits.length, 2);
	assert.deepEqual(
		edits.map(edit => edit.status).sort(),
		['active', 'stale']
	);

	const notes = store.listNotes(active.id);
	assert.equal(notes.length, 1);
	assert.equal(notes[0].message, 'current');
});
