import assert from 'node:assert/strict';
import test from 'node:test';
import Diff from '../src/Diff.js';

const session = {
	id: 'sm-current',
	description: 'Change source'
};

function authored(overrides = {}) {
	return {
		path: 'source.txt',
		lineStart: 145,
		lineEnd: 145,
		appliedStart: 145,
		shift: 0,
		removed: 'old',
		inserted: 'new\nnext',
		...overrides
	};
}

test('defaults to 0-based hunk and gutter coordinates', () => {
	const edit = authored();
	const expected =
		'[YOU · sm-current · Change source]\n' +
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -145,1 +145,2 @@\n' +
		'145     -old\n' +
		'    145 +new\n' +
		'    146 +next\n';

	assert.equal(
		new Diff().formatSession(session, [edit]),
		expected
	);
	assert.equal(
		new Diff({ lineBase: 0 }).formatSession(session, [edit]),
		expected
	);
});

test('lineBase 1 shifts only displayed source coordinates', () => {
	const edit = authored();
	const expected =
		'[YOU · sm-current · Change source]\n' +
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -146,1 +146,2 @@\n' +
		'146     -old\n' +
		'    146 +new\n' +
		'    147 +next\n';

	assert.equal(
		new Diff({ lineBase: 1 }).formatSession(session, [edit]),
		expected
	);
});

test('rejects unsupported line bases', () => {
	for (const lineBase of [2, -1, 'foo']) {
		assert.throws(
			() => new Diff({ lineBase }),
			/lineBase must be 0 or 1/
		);
	}
});

test('replacement rows keep old and new coordinates on their own sides', () => {
	const output =
		new Diff().formatSession(session, [
			authored({
				lineStart: 8,
				lineEnd: 8,
				appliedStart: 8,
				removed: 'before',
				inserted: 'after'
			})
		]);

	assert.match(output, /^8   -before$/m);
	assert.match(output, /^  8 \+after$/m);
});

test('insertion rows leave old coordinates blank and increment only new coordinates', () => {
	const output =
		new Diff().formatSession(session, [
			authored({
				lineStart: 9998,
				lineEnd: 10000,
				appliedStart: 9998,
				removed: '',
				inserted: 'x\ny\nz'
			})
		]);
	const lines = output.trimEnd().split('\n');
	const header = lines.indexOf('@@ -9998,0 +9998,3 @@');
	const rows = lines.slice(header + 1);

	assert.equal(rows.length, 3);

	for (const [index, coordinate] of [9998, 9999, 10000].entries()) {
		assert.equal(rows[index].slice(0, 5), '     ');
		assert.equal(rows[index].slice(5, 6), ' ');
		assert.equal(
			rows[index].slice(6, 11),
			String(coordinate).padStart(5)
		);
		assert.equal(rows[index].slice(11, 12), ' ');
		assert.equal(rows[index].slice(12), '+' + ['x', 'y', 'z'][index]);
	}
});

test('deletion rows leave new coordinates blank and increment only old coordinates', () => {
	const output =
		new Diff().formatSession(session, [
			authored({
				lineStart: 9999,
				lineEnd: 9999,
				appliedStart: 9999,
				removed: 'x\ny',
				inserted: ''
			})
		]);
	const lines = output.trimEnd().split('\n');
	const header = lines.indexOf('@@ -9999,2 +9999,0 @@');
	const rows = lines.slice(header + 1);

	assert.equal(rows.length, 2);

	for (const [index, coordinate] of [9999, 10000].entries()) {
		assert.equal(
			rows[index].slice(0, 5),
			String(coordinate).padStart(5)
		);
		assert.equal(rows[index].slice(5, 6), ' ');
		assert.equal(rows[index].slice(6, 11), '     ');
		assert.equal(rows[index].slice(11, 12), ' ');
		assert.equal(rows[index].slice(12), '-' + ['x', 'y'][index]);
	}
});

test('multiple hunks reset counters from each hunk start', () => {
	const output =
		new Diff().formatSession(session, [
			authored({
				lineStart: 10,
				lineEnd: 10,
				appliedStart: 10,
				removed: 'a\nb',
				inserted: 'A'
			}),
			authored({
				lineStart: 20,
				lineEnd: 21,
				appliedStart: 20,
				removed: '',
				inserted: 'X\nY'
			})
		]);

	assert.match(output, /@@ -10,2 \+10,1 @@\n10    -a\n11    -b\n   10 \+A/);
	assert.match(output, /@@ -20,0 \+20,2 @@\n   20 \+X\n   21 \+Y/);
});

test('peer note line metadata uses the selected coordinate base', () => {
	const output =
		new Diff({ lineBase: 1 }).format(
			session,
			'source.txt',
			authored({
				lineStart: 1,
				lineEnd: 1,
				appliedStart: 1
			}),
			[],
			[
				{
					session: {
						id: 'sm-peer',
						description: 'Protect source'
					},
					note: {
						path: 'source.txt',
						lineStart: 4,
						lineEnd: 5,
						message: 'Keep stable.'
					}
				}
			]
		);

	assert.match(output, /source\.txt · lines 5:6\nKeep stable\./);
});
