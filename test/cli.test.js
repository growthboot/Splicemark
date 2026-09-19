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

	assert.match(edit, /\[YOU · AGENT · sm-[0-9a-f]{8} · Change source\]/);
	assert.match(edit, /-old/);
	assert.match(edit, /\+new/);
	assert.equal(fs.readFileSync(path.join(root, 'source.txt'), 'utf8'), 'zero\nnew\nlast\n');

	const diff = run(root, ['diff', session]);
	const expectedDefault =
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -1,1 +1,1 @@\n' +
		'[YOU · AGENT · ' + session + ' · Change source]\n' +
		'1   -old\n' +
		'  1 +new\n';

	assert.equal(diff, expectedDefault);

	const explicitZero =
		run(root, ['diff', session, '--line-base=0']);

	assert.equal(explicitZero, diff);

	const oneBased =
		run(root, ['diff', session, '--line-base=1']);
	const expectedOneBased =
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -2,1 +2,1 @@\n' +
		'[YOU · AGENT · ' + session + ' · Change source]\n' +
		'2   -old\n' +
		'  2 +new\n';

	assert.equal(oneBased, expectedOneBased);
	assert.equal(
		run(root, ['diff', session, '--line-base', '1']),
		oneBased
	);
});

test('CLI diff rejects invalid line bases', t => {
	const root = repository(t);
	const session =
		run(root, ['start', 'Invalid line base']).trim();

	for (const value of ['2', '-1', 'foo', '01']) {
		const result = spawnSync(
			process.execPath,
			[cli, 'diff', session, '--line-base=' + value],
			{
				cwd: root,
				encoding: 'utf8'
			}
		);

		assert.equal(result.status, 1);
		assert.equal(result.stdout, '');
		assert.equal(
			result.stderr,
			'splicemark: lineBase must be 0 or 1\n'
		);
	}
});

test('CLI diff surfaces distant peer hunks from the same active file', t => {
	const root = repository(t);
	const content =
		Array.from(
			{ length: 500 },
			(_, index) => 'line-' + index
		).join('\n') + '\n';

	fs.writeFileSync(path.join(root, 'source.txt'), content);
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'expand source']);

	const peer =
		run(root, ['start', 'Change early region']).trim();
	const requested =
		run(root, ['start', 'Change distant region']).trim();

	run(root, [
		'edit',
		peer,
		'source.txt',
		'--lines',
		'99:99',
		'--expect-start',
		'line-99',
		'--expect-end',
		'line-99'
	], 'peer-100\n');

	run(root, [
		'edit',
		requested,
		'source.txt',
		'--lines',
		'449:449',
		'--expect-start',
		'line-449',
		'--expect-end',
		'line-449'
	], 'you-450\n');

	const diff =
		run(root, ['diff', requested, '--line-base=1']);

	const lines = diff.trimEnd().split('\n');
	const peerAttribution =
		lines.indexOf('[PEER · AGENT · ' + peer + ' · Change early region]');
	const youAttribution =
		lines.indexOf('[YOU · AGENT · ' + requested + ' · Change distant region]');

	assert.ok(peerAttribution >= 0);
	assert.ok(youAttribution >= 0);
	assert.equal(lines[peerAttribution - 1], '@@ -100,1 +100,1 @@');
	assert.equal(lines[peerAttribution + 1], '100     -line-99');
	assert.equal(lines[youAttribution - 1], '@@ -450,1 +450,1 @@');
	assert.equal(lines[youAttribution + 1], '450     -line-449');
	assert.ok(peerAttribution < youAttribution);
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

	assert.match(edit, /\[PEER NOTE · AGENT · .* · Protect source\]/);
	assert.match(edit, /Keep this region stable\./);

	const finish = run(root, ['finish', owner]);

	assert.equal(finish, owner + ' finished\n');

	const clean = run(root, ['clean']);

	assert.equal(clean, 'cleaned sessions=1 notes=0 edits=0\n');

	const help = run(root, ['help']);

	assert.match(
		help,
		/splicemark start "task description" \[--actor=agent\|human\|automation\]/
	);
	assert.match(help, /default: agent/);
	assert.match(
		help,
		/Persisted with the session and shown in diff attribution/
	);
	assert.match(help, /splicemark edit/);
	assert.match(help, /splicemark note/);
	assert.match(help, /splicemark diff SESSION \[--line-base=0\|1\]/);
	assert.match(
		help,
		/0 \(default, agent\/programmatic\), 1 \(human\/editor\)/
	);
	assert.match(help, /splicemark finish/);
	assert.match(help, /splicemark clean/);
});


test('CLI diff emits literal real context and all supported aliases are equivalent', t => {
	const root = repository(t);
	const content =
		Array.from(
			{ length: 7 },
			(_, index) => 'line-' + index
		).join('\n') + '\n';

	fs.writeFileSync(
		path.join(root, 'source.txt'),
		content
	);
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'context fixture']);

	const session =
		run(root, ['start', 'Change middle line']).trim();

	run(root, [
		'edit',
		session,
		'source.txt',
		'--lines',
		'3:3',
		'--expect-start',
		'line-3',
		'--expect-end',
		'line-3'
	], 'changed-3\n');

	const withoutContext =
		run(root, ['diff', session]);

	assert.equal(
		run(root, ['diff', session, '--context=0']),
		withoutContext
	);

	const context =
		run(root, ['diff', session, '--context=2']);
	const expected =
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -1,5 +1,5 @@\n' +
		'1 1  line-1\n' +
		'2 2  line-2\n' +
		'[YOU · AGENT · ' + session + ' · Change middle line]\n' +
		'3   -line-3\n' +
		'  3 +changed-3\n' +
		'4 4  line-4\n' +
		'5 5  line-5\n';

	assert.equal(context, expected);

	for (const alias of [
		['--context', '2'],
		['--unified=2'],
		['--unified', '2'],
		['-U2'],
		['-U', '2']
	]) {
		assert.equal(
			run(root, ['diff', session, ...alias]),
			context
		);
	}

	assert.equal(
		run(root, [
			'diff',
			session,
			'--context=2',
			'--line-base=1'
		]),
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -2,5 +2,5 @@\n' +
		'2 2  line-1\n' +
		'3 3  line-2\n' +
		'[YOU · AGENT · ' + session + ' · Change middle line]\n' +
		'4   -line-3\n' +
		'  4 +changed-3\n' +
		'5 5  line-4\n' +
		'6 6  line-5\n'
	);
});

test('CLI diff rejects invalid context values', t => {
	const root = repository(t);
	const session =
		run(root, ['start', 'Invalid context']).trim();

	for (const flags of [
		['--context=-1'],
		['--context=foo'],
		['--context=1.5'],
		['--unified=-1'],
		['-U', 'foo']
	]) {
		const result =
			spawnSync(
				process.execPath,
				[cli, 'diff', session, ...flags],
				{
					cwd: root,
					encoding: 'utf8'
				}
			);

		assert.equal(result.status, 1);
		assert.equal(result.stdout, '');
		assert.equal(
			result.stderr,
			'splicemark: context must be a non-negative integer\n'
		);
	}
});

test('CLI context follows a peer location shifted by an earlier line-count change', t => {
	const root = repository(t);

	fs.writeFileSync(
		path.join(root, 'source.txt'),
		'zero\none\nthird\nlast\n'
	);
	git(root, ['add', 'source.txt']);
	git(root, ['commit', '-qm', 'peer context fixture']);

	const peer =
		run(root, ['start', 'Change third line']).trim();
	const requested =
		run(root, ['start', 'Expand header']).trim();

	run(root, [
		'edit',
		peer,
		'source.txt',
		'--lines',
		'2:2',
		'--expect-start',
		'third',
		'--expect-end',
		'third'
	], 'peer-third\n');

	run(root, [
		'edit',
		requested,
		'source.txt',
		'--lines',
		'0:0',
		'--expect-start',
		'zero',
		'--expect-end',
		'zero'
	], 'zero\ninserted\n');

	const diff =
		run(root, [
			'diff',
			requested,
			'--context=1'
		]);

	const lines = diff.trimEnd().split('\n');
	const youAttribution =
		lines.indexOf('[YOU · AGENT · ' + requested + ' · Expand header]');
	const peerAttribution =
		lines.indexOf('[PEER · AGENT · ' + peer + ' · Change third line]');

	assert.ok(youAttribution >= 0);
	assert.ok(peerAttribution >= 0);
	assert.equal(lines[youAttribution - 1], '@@ -0,2 +0,3 @@');
	assert.equal(lines[youAttribution + 1], '0   -zero');
	assert.equal(lines[peerAttribution - 1], '1 2  one');
	assert.equal(lines[peerAttribution + 1], '2   -third');
	assert.ok(youAttribution < peerAttribution);
});

test('CLI help documents context defaults, aliases, and line-base interaction', t => {
	const root = repository(t);
	const help =
		run(root, ['help']);

	assert.match(
		help,
		/splicemark diff SESSION \[--line-base=0\|1\] \[--context=N\]/
	);
	assert.match(
		help,
		/--context=N +Unchanged source lines before and after each edit \(default: 0\)/
	);
	assert.match(
		help,
		/--context N, --unified=N, --unified N, -UN, -U N/
	);
});
