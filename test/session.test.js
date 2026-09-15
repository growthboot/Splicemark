import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import SessionStore from '../src/SessionStore.js';

test('starts an atomically claimed session with task metadata', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	const store = new SessionStore(root);
	const session = store.start('Fix proxy lifecycle', 'abc123');

	assert.match(session.id, /^sm-[0-9a-f]{8}$/);
	assert.equal(session.description, 'Fix proxy lifecycle');
	assert.equal(session.status, 'active');
	assert.equal(session.head, 'abc123');

	const saved = JSON.parse(
		fs.readFileSync(
			path.join(root, 'sessions', session.id, 'meta.json'),
			'utf8'
		)
	);

	assert.deepEqual(saved, session);
});

test('concurrent task identities do not reuse a session', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	const store = new SessionStore(root);
	const first = store.start('Task one', 'abc123');
	const second = store.start('Task two', 'abc123');

	assert.notEqual(first.id, second.id);
});
