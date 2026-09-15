import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../bin/splicemark.js');

function git(root, args) {
	return execFileSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function run(root, args, input = '') {
	const result = spawnSync(process.execPath, [cli, ...args], {
		cwd: root,
		encoding: 'utf8',
		input
	});

	assert.equal(result.status, 0, result.stderr);
	return result.stdout;
}

function repository(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'splicemark-cli-'));

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

test('CLI start, edit, and diff use real newlines and task-local attribution', t => {
	const root = repository(t);
	const start = run(root, ['start', 'Change source']);

	assert.match(start, /^sm-[0-9a-f]{8}\n$/);

	const session = start.trim();
	const edit = run(root, [
		'edit',
		session,
		'source.txt',
		'--lines',
		'1:1',
		'--expect-start',
		'old',
		'--expect-end',
		'old'
	], 'new\n');

	assert.match(edit, /\[YOU · sm-[0-9a-f]{8} · Change source\]/);
	assert.match(edit, /-old\n\+new\n/);
	assert.equal(fs.readFileSync(path.join(root, 'source.txt'), 'utf8'), 'zero\nnew\nlast\n');

	const diff = run(root, ['diff', session]);

	assert.match(diff, /\[YOU · sm-[0-9a-f]{8} · Change source\]/);
	assert.match(diff, /source\.txt · lines 1:1/);
	assert.match(diff, /-old\n\+new\n/);
});


test('CLI note, finish, clean, and help complete the agent lifecycle', t => {
	const root = repository(t);
	const owner = run(root, ['start', 'Protect source']).trim();
	const worker = run(root, ['start', 'Edit source']).trim();

	const note = run(root, [
		'note',
		owner,
		'source.txt',
		'--lines',
		'1:1',
		'--message',
		'Keep this region stable.'
	]);

	assert.match(note, /^note-[a-z0-9]+-[0-9a-f]{6}\n$/);

	const edit = run(root, [
		'edit',
		worker,
		'source.txt',
		'--lines',
		'1:1',
		'--expect-start',
		'old',
		'--expect-end',
		'old'
	], 'new\n');

	assert.match(edit, /\[PEER NOTE · .* · Protect source\]/);
	assert.match(edit, /Keep this region stable\./);

	const finish = run(root, ['finish', owner]);

	assert.equal(finish, owner + ' finished\n');

	const clean = run(root, ['clean']);

	assert.equal(clean, 'cleaned sessions=1 notes=0 edits=0\n');

	const help = run(root, ['help']);

	assert.match(help, /splicemark start/);
	assert.match(help, /splicemark edit/);
	assert.match(help, /splicemark note/);
	assert.match(help, /splicemark diff/);
	assert.match(help, /splicemark finish/);
	assert.match(help, /splicemark clean/);
});
