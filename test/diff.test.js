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
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -145,1 +145,2 @@\n' +
		'[YOU · sm-current · Change source]\n' +
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
		'--- a/source.txt\n' +
		'+++ b/source.txt\n' +
		'@@ -146,1 +146,2 @@\n' +
		'[YOU · sm-current · Change source]\n' +
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
	const attribution =
		lines.indexOf('[YOU · sm-current · Change source]');
	const rows = lines.slice(attribution + 1);

	assert.equal(attribution, header + 1);
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
	const attribution =
		lines.indexOf('[YOU · sm-current · Change source]');
	const rows = lines.slice(attribution + 1);

	assert.equal(attribution, header + 1);
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

	assert.match(output, /@@ -10,2 \+10,1 @@\n\[YOU · sm-current · Change source\]\n10    -a\n11    -b\n   10 \+A/);
	assert.match(output, /@@ -20,0 \+20,2 @@\n\[YOU · sm-current · Change source\]\n   20 \+X\n   21 \+Y/);
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


test('context defaults to zero and explicit zero is byte-identical', () => {
	const edit =
		authored({
			lineStart: 2,
			lineEnd: 2,
			appliedStart: 2,
			removed: 'old',
			inserted: 'new'
		});
	const sources = {
		'source.txt': 'zero\none\nnew\nthree\nfour\n'
	};
	const implicit =
		new Diff().formatSession(session, [edit]);
	const explicit =
		new Diff({ context: 0 }).formatSession(
			session,
			[edit],
			[],
			sources
		);

	assert.equal(explicit, implicit);
});

test('replacement context expands truthful hunks and shifts with lineBase', () => {
	const edit =
		authored({
			lineStart: 2,
			lineEnd: 2,
			appliedStart: 2,
			removed: 'old',
			inserted: 'new'
		});
	const sources = {
		'source.txt':
			'zero\none\nnew\nthree\nfour\nfive\n'
	};
	const zeroBased =
		new Diff({ context: 2 }).formatSession(
			session,
			[edit],
			[],
			sources
		);
	const oneBased =
		new Diff({
			context: 2,
			lineBase: 1
		}).formatSession(
			session,
			[edit],
			[],
			sources
		);

	assert.equal(
		zeroBased,
		'--- a/source.txt\n' +
			'+++ b/source.txt\n' +
			'@@ -0,5 +0,5 @@\n' +
			'0 0  zero\n' +
			'1 1  one\n' +
			'[YOU · sm-current · Change source]\n' +
			'2   -old\n' +
			'  2 +new\n' +
			'3 3  three\n' +
			'4 4  four\n'
	);
	assert.equal(
		oneBased,
		'--- a/source.txt\n' +
			'+++ b/source.txt\n' +
			'@@ -1,5 +1,5 @@\n' +
			'1 1  zero\n' +
			'2 2  one\n' +
			'[YOU · sm-current · Change source]\n' +
			'3   -old\n' +
			'  3 +new\n' +
			'4 4  three\n' +
			'5 5  four\n'
	);
});

test('context stops at real file boundaries', () => {
	const beginning =
		new Diff({ context: 4 }).formatSession(
			session,
			[
				authored({
					lineStart: 0,
					lineEnd: 0,
					appliedStart: 0,
					removed: 'old',
					inserted: 'new'
				})
			],
			[],
			{
				'source.txt': 'new\none\ntwo\n'
			}
		);
	const end =
		new Diff({ context: 4 }).formatSession(
			session,
			[
				authored({
					lineStart: 2,
					lineEnd: 2,
					appliedStart: 2,
					removed: 'old',
					inserted: 'new'
				})
			],
			[],
			{
				'source.txt': 'zero\none\nnew\n'
			}
		);

	assert.match(
		beginning,
		/@@ -0,3 \+0,3 @@\n\[YOU · sm-current · Change source\]\n0   -old\n  0 \+new\n1 1  one\n2 2  two\n$/
	);
	assert.match(
		end,
		/@@ -0,3 \+0,3 @@\n0 0  zero\n1 1  one\n\[YOU · sm-current · Change source\]\n2   -old\n  2 \+new\n$/
	);
});

test('insertion and deletion context advance old and new coordinates independently', () => {
	const insertion =
		new Diff({ context: 1 }).formatSession(
			session,
			[
				authored({
					lineStart: 2,
					lineEnd: 2,
					appliedStart: 2,
					removed: '',
					inserted: 'x\ny'
				})
			],
			[],
			{
				'source.txt': 'a\nb\nx\ny\nc\nd\n'
			}
		);
	const deletion =
		new Diff({ context: 1 }).formatSession(
			session,
			[
				authored({
					lineStart: 2,
					lineEnd: 2,
					appliedStart: 2,
					removed: 'x\ny',
					inserted: ''
				})
			],
			[],
			{
				'source.txt': 'a\nb\nc\nd\n'
			}
		);

	assert.match(
		insertion,
		/@@ -1,2 \+1,4 @@\n1 1  b\n\[YOU · sm-current · Change source\]\n  2 \+x\n  3 \+y\n2 4  c/
	);
	assert.match(
		deletion,
		/@@ -1,4 \+1,2 @@\n1 1  b\n\[YOU · sm-current · Change source\]\n2   -x\n3   -y\n4 2  c/
	);
});

test('context gutters remain correct at large source coordinates', () => {
	const lines =
		Array.from(
			{ length: 10005 },
			(_, index) => 'line-' + index
		);
	lines[10000] = 'new-10000';

	const output =
		new Diff({ context: 2 }).formatSession(
			session,
			[
				authored({
					lineStart: 10000,
					lineEnd: 10000,
					appliedStart: 10000,
					removed: 'old-10000',
					inserted: 'new-10000'
				})
			],
			[],
			{
				'source.txt': lines.join('\n') + '\n'
			}
		);

	assert.match(output, /@@ -9998,5 \+9998,5 @@/);
	assert.match(output, /^ 9998  9998  line-9998$/m);
	assert.match(output, /^10000       -old-10000$/m);
	assert.match(output, /^      10000 \+new-10000$/m);
	assert.match(output, /^10002 10002  line-10002$/m);
});
