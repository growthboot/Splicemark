import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import FileEditor from '../src/FileEditor.js';
import Splicemark from '../src/Splicemark.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../bin/splicemark.js');

function tempFile(t, content) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-batch-'));
	const file = path.join(root, 'source.txt');

	fs.writeFileSync(file, content);

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	return file;
}

function git(root, args) {
	return execFileSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

test('line batch sorts writes bottom-to-top so line shifts cannot move later targets', t => {
	const file = tempFile(
		t,
		'zero\none\ntwo\nthree\nfour\nfive\n'
	);

	const edits = new FileEditor().batch(file, {
		mode: 'lines',
		splices: [
			{
				start: 1,
				end: 1,
				replacement: 'ONE\ninserted'
			},
			{
				start: 4,
				end: 4,
				replacement: 'FOUR'
			}
		]
	});

	assert.deepEqual(
		edits.map(edit => edit.appliedStart),
		[4, 1]
	);

	assert.equal(
		fs.readFileSync(file, 'utf8'),
		'zero\nONE\ninserted\ntwo\nthree\nFOUR\nfive\n'
	);
});

test('character batch sorts writes bottom-to-top', t => {
	const file = tempFile(t, 'abcdefghij');

	new FileEditor().batch(file, {
		mode: 'chars',
		splices: [
			{
				start: 1,
				end: 2,
				replacement: 'BCX'
			},
			{
				start: 7,
				end: 8,
				replacement: 'HI'
			}
		]
	});

	assert.equal(
		fs.readFileSync(file, 'utf8'),
		'aBCXdefgHIj'
	);
});

test('batch rejects overlapping ranges without writing', t => {
	const original = 'zero\none\ntwo\nthree\n';
	const file = tempFile(t, original);

	assert.throws(() => {
		new FileEditor().batch(file, {
			mode: 'lines',
			splices: [
				{
					start: 1,
					end: 2,
					replacement: 'first'
				},
				{
					start: 2,
					end: 3,
					replacement: 'second'
				}
			]
		});
	}, /must not overlap/);

	assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('CLI batch applies prevalidated JSON splices and records each mutation', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-batch-cli-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	git(root, ['init', '-q']);
	git(root, ['config', 'user.name', 'Splicemark Test']);
	git(root, ['config', 'user.email', 'splicemark@example.invalid']);

	fs.writeFileSync(
		path.join(root, 'source.txt'),
		'zero\none\ntwo\nthree\nfour\nfive\n'
	);

	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'initial']);

	const start = spawnSync(
		process.execPath,
		[cli, 'start', 'Batch source'],
		{
			cwd: root,
			encoding: 'utf8'
		}
	);

	assert.equal(start.status, 0, start.stderr);

	const session = start.stdout.trim();
	const batch = spawnSync(
		process.execPath,
		[cli, 'batch', session, 'source.txt', '--lines'],
		{
			cwd: root,
			encoding: 'utf8',
			input: JSON.stringify([
				{
					start: 1,
					end: 1,
					replacement: 'ONE\ninserted'
				},
				{
					start: 4,
					end: 4,
					replacement: 'FOUR'
				}
			])
		}
	);

	assert.equal(batch.status, 0, batch.stderr);
	assert.match(batch.stdout, /@@ -4,1 \+4,1 @@/);
	assert.match(batch.stdout, /@@ -1,1 \+1,2 @@/);

	const diff = spawnSync(
		process.execPath,
		[cli, 'diff', session],
		{
			cwd: root,
			encoding: 'utf8'
		}
	);

	assert.equal(diff.status, 0, diff.stderr);

	const authored = diff.stdout.match(/\[YOU ·/g) || [];

	assert.equal(authored.length, 2);
	assert.equal(
		fs.readFileSync(path.join(root, 'source.txt'), 'utf8'),
		'zero\nONE\ninserted\ntwo\nthree\nFOUR\nfive\n'
	);
});


test('upper batch splices shift earlier batch authorship for later peer detection', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-batch-peer-'));

	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	git(root, ['init', '-q']);
	git(root, ['config', 'user.name', 'Splicemark Test']);
	git(root, ['config', 'user.email', 'splicemark@example.invalid']);

	fs.writeFileSync(
		path.join(root, 'source.txt'),
		'zero\none\ntwo\nthree\nfour\nfive\n'
	);

	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'initial']);

	const splicemark = new Splicemark({ cwd: root });
	const batchSession = splicemark.start('Batch author');
	const laterSession = splicemark.start('Later editor');

	splicemark.batch(batchSession.id, path.join(root, 'source.txt'), {
		mode: 'lines',
		splices: [
			{
				start: 1,
				end: 1,
				replacement: 'ONE\ninserted'
			},
			{
				start: 4,
				end: 4,
				replacement: 'FOUR'
			}
		]
	});

	const result = splicemark.edit(
		laterSession.id,
		path.join(root, 'source.txt'),
		{
			mode: 'lines',
			start: 5,
			end: 5,
			expectedStart: 'FOUR',
			expectedEnd: 'FOUR',
			replacement: 'final-four'
		}
	);

	assert.equal(result.peers.length, 2);

	const shifted =
		result.peers.find(peer => peer.edit.inserted === 'FOUR');

	assert.ok(shifted);
	assert.equal(shifted.session.id, batchSession.id);
	assert.equal(shifted.edit.lineStart, 5);
	assert.equal(shifted.edit.lineEnd, 5);
	assert.ok(
		result.peers.some(
			peer => peer.edit.inserted === 'ONE\ninserted'
		)
	);
});