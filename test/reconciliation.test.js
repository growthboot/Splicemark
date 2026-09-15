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

function createRepository(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-git-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	git(root, ['init', '-q']);
	git(root, ['config', 'user.name', 'Splicemark Test']);
	git(root, ['config', 'user.email', 'splicemark@example.invalid']);

	fs.writeFileSync(path.join(root, 'source.txt'), 'zero\nold\nlast\n');
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'initial']);

	return root;
}

function authoredEdit(splicemark, session, root) {
	return splicemark.edit(session.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		start: 1,
		end: 1,
		expectedStart: 'old',
		expectedEnd: 'old',
		replacement: 'new'
	});
}

test('retires an authored edit after it is committed', t => {
	const root = createRepository(t);
	const splicemark = new Splicemark({ cwd: root });
	const session = splicemark.start('Change source');

	authoredEdit(splicemark, session, root);
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'apply authored edit']);

	const state = splicemark.diff(session.id);

	assert.equal(state.edits.length, 1);
	assert.equal(state.edits[0].status, 'retired');
	assert.equal(state.session.head, git(root, ['rev-parse', 'HEAD']));
});

test('keeps an authored edit active across an unrelated commit', t => {
	const root = createRepository(t);
	const splicemark = new Splicemark({ cwd: root });
	const session = splicemark.start('Change source');

	authoredEdit(splicemark, session, root);

	fs.writeFileSync(path.join(root, 'other.txt'), 'other\n');
	git(root, ['add', 'other.txt']);
	git(root, ['commit', '-qm', 'unrelated commit']);

	const state = splicemark.diff(session.id);

	assert.equal(state.edits.length, 1);
	assert.equal(state.edits[0].status, 'active');
});

test('marks attribution stale when an old edit can no longer be mapped', t => {
	const root = createRepository(t);
	const splicemark = new Splicemark({ cwd: root });
	const session = splicemark.start('Change source');

	authoredEdit(splicemark, session, root);
	fs.writeFileSync(path.join(root, 'source.txt'), 'zero\nold\nlast\n');

	fs.writeFileSync(path.join(root, 'other.txt'), 'other\n');
	git(root, ['add', 'other.txt']);
	git(root, ['commit', '-qm', 'unrelated commit']);

	const state = splicemark.diff(session.id);

	assert.equal(state.edits.length, 1);
	assert.equal(state.edits[0].status, 'stale');
});
