import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Diff from '../src/Diff.js';
import MemoryGit from '../src/MemoryGit.js';
import MemorySessionStore from '../src/MemorySessionStore.js';
import MemoryWorkspace from '../src/MemoryWorkspace.js';
import SessionStore from '../src/SessionStore.js';
import Splicemark from '../src/Splicemark.js';
import SplicemarkCore from '../src/SplicemarkCore.js';

const here =
	path.dirname(
		fileURLToPath(import.meta.url)
	);
const cli =
	path.resolve(
		here,
		'../bin/splicemark.js'
	);

function git(root, args, input) {
	return execFileSync(
		'git',
		args,
		{
			cwd: root,
			encoding: 'utf8',
			...(input === undefined
				? {
					stdio:
						['ignore', 'pipe', 'pipe']
				}
				: {
					input,
					stdio:
						['pipe', 'pipe', 'pipe']
				})
		}
	).trim();
}

function repository(
	t,
	{
		source = 'zero\nold\nlast\n',
		files = {}
	} = {}
) {
	const root =
		fs.mkdtempSync(
			path.join(
				os.tmpdir(),
				'splicemark-authorship-'
			)
		);

	t.after(() => {
		fs.rmSync(
			root,
			{
				recursive: true,
				force: true
			}
		);
	});

	git(root, ['init', '-q']);
	git(
		root,
		[
			'config',
			'user.name',
			'Splicemark Test'
		]
	);
	git(
		root,
		[
			'config',
			'user.email',
			'splicemark@example.invalid'
		]
	);

	fs.writeFileSync(
		path.join(root, 'source.txt'),
		source
	);

	for (
		const [file, content]
		of Object.entries(files)
	) {
		fs.writeFileSync(
			path.join(root, file),
			content
		);
	}

	git(root, ['add', '.']);
	git(
		root,
		['commit', '-qm', 'initial']
	);

	return root;
}

function runCli(root, args, input = '') {
	const result =
		spawnSync(
			process.execPath,
			[
				cli,
				...args
			],
			{
				cwd: root,
				encoding: 'utf8',
				input
			}
		);

	assert.equal(
		result.status,
		0,
		result.stderr
	);

	return result.stdout;
}

function failCli(root, args) {
	return spawnSync(
		process.execPath,
		[
			cli,
			...args
		],
		{
			cwd: root,
			encoding: 'utf8'
		}
	);
}

function sessionMeta(root, id) {
	const common =
		path.resolve(
			root,
			git(
				root,
				[
					'rev-parse',
					'--git-common-dir'
				]
			)
		);

	return JSON.parse(
		fs.readFileSync(
			path.join(
				common,
				'splicemark',
				'sessions',
				id,
				'meta.json'
			),
			'utf8'
		)
	);
}

function fixtureLines(count) {
	return Array.from(
		{ length: count },
		(_, index) =>
			'line-' + index
	);
}

function fixture(count) {
	return (
		fixtureLines(count)
			.join('\n') +
		'\n'
	);
}

function editLine(
	splicemark,
	session,
	root,
	line,
	expected,
	replacement
) {
	return splicemark.edit(
		session.id,
		path.join(root, 'source.txt'),
		{
			mode: 'lines',
			start: line,
			end: line,
			expectedStart:
				expected,
			expectedEnd:
				expected,
			replacement
		}
	);
}

function rendered(
	splicemark,
	session,
	{
		context = 0,
		lineBase = 0
	} = {}
) {
	const state =
		splicemark.diff(
			session.id,
			{
				includeSources:
					context > 0
			}
		);
	const output =
		new Diff({
			context,
			lineBase
		}).formatSession(
			state.session,
			state.edits,
			state.peers,
			state.sources,
			state.unattributed
		);

	return {
		state,
		output
	};
}

test('persistent sessions default to agent, persist explicit actors, and preserve them through clean', t => {
	const root =
		fs.mkdtempSync(
			path.join(
				os.tmpdir(),
				'splicemark-store-'
			)
		);

	t.after(() => {
		fs.rmSync(
			root,
			{
				recursive: true,
				force: true
			}
		);
	});

	const store =
		new SessionStore(root);
	const fallback =
		store.start(
			'Default',
			'head-1'
		);

	assert.equal(
		fallback.version,
		2
	);
	assert.equal(
		fallback.actorType,
		'agent'
	);

	for (
		const actorType
		of [
			'agent',
			'human',
			'automation'
		]
	) {
		const session =
			store.start(
				'Actor ' + actorType,
				'head-1',
				actorType
			);

		assert.equal(
			session.actorType,
			actorType
		);
		assert.equal(
			new SessionStore(root)
				.get(session.id)
				.actorType,
			actorType
		);
	}

	store.clean('head-1');

	assert.equal(
		store.get(fallback.id).actorType,
		'agent'
	);
});

test('MemorySessionStore matches actor-type behavior', () => {
	const store =
		new MemorySessionStore();
	const fallback =
		store.start(
			'Default',
			'head-1'
		);
	const human =
		store.start(
			'Human',
			'head-1',
			'human'
		);
	const automation =
		store.start(
			'Automation',
			'head-1',
			'automation'
		);

	assert.equal(
		fallback.actorType,
		'agent'
	);
	assert.equal(
		store.get(human.id).actorType,
		'human'
	);
	assert.equal(
		store.get(automation.id).actorType,
		'automation'
	);
});

test('legacy persisted sessions remain UNKNOWN and are not silently rewritten', t => {
	const root =
		fs.mkdtempSync(
			path.join(
				os.tmpdir(),
				'splicemark-legacy-'
			)
		);
	const id =
		'sm-87654321';
	const directory =
		path.join(
			root,
			'sessions',
			id
		);

	t.after(() => {
		fs.rmSync(
			root,
			{
				recursive: true,
				force: true
			}
		);
	});

	fs.mkdirSync(
		directory,
		{ recursive: true }
	);
	fs.writeFileSync(
		path.join(
			directory,
			'meta.json'
		),
		JSON.stringify(
			{
				version: 1,
				id,
				description:
					'Legacy task',
				status:
					'active',
				head:
					'old-head',
				startedAt:
					'2025-01-01T00:00:00.000Z'
			},
			null,
			'\t'
		) + '\n'
	);

	const store =
		new SessionStore(root);
	const legacy =
		store.get(id);

	assert.equal(
		legacy.actorType,
		'unknown'
	);

	store.updateHead(
		id,
		'new-head'
	);

	const raw =
		JSON.parse(
			fs.readFileSync(
				path.join(
					directory,
					'meta.json'
				),
				'utf8'
			)
		);

	assert.equal(
		Object.hasOwn(
			raw,
			'actorType'
		),
		false
	);

	const output =
		new Diff().formatSession(
			{
				id: 'sm-current',
				description:
					'Current',
				actorType:
					'agent'
			},
			[
				{
					id: 'edit-current',
					path:
						'source.txt',
					lineStart: 5,
					appliedStart: 5,
					shift: 0,
					removed:
						'old-current',
					inserted:
						'new-current'
				}
			],
			[
				{
					session:
						legacy,
					edit: {
						id:
							'edit-legacy',
						path:
							'source.txt',
						lineStart: 1,
						appliedStart: 1,
						shift: 0,
						removed:
							'old-legacy',
						inserted:
							'new-legacy'
					}
				}
			]
		);

	assert.match(
		output,
		/\[PEER · UNKNOWN · sm-87654321 · Legacy task\]/
	);
});

test('CLI start accepts default, inline, and spaced actor syntax and rejects invalid values', t => {
	const root =
		repository(t);
	const cases = [
		{
			args: [
				'start',
				'Default'
			],
			actorType:
				'agent'
		},
		{
			args: [
				'start',
				'Agent',
				'--actor=agent'
			],
			actorType:
				'agent'
		},
		{
			args: [
				'start',
				'Human',
				'--actor',
				'human'
			],
			actorType:
				'human'
		},
		{
			args: [
				'start',
				'Automation',
				'--actor=automation'
			],
			actorType:
				'automation'
		}
	];

	for (const item of cases) {
		const id =
			runCli(
				root,
				item.args
			).trim();

		assert.match(
			id,
			/^sm-[0-9a-f]{8}$/
		);
		assert.equal(
			sessionMeta(
				root,
				id
			).actorType,
			item.actorType
		);
	}

	for (
		const flag
		of [
			'--actor=bot',
			'--actor=person',
			'--actor=',
			'--actor=Agent'
		]
	) {
		const result =
			failCli(
				root,
				[
					'start',
					'Invalid',
					flag
				]
			);

		assert.equal(
			result.status,
			1
		);
		assert.equal(
			result.stdout,
			''
		);
		assert.equal(
			result.stderr,
			'splicemark: actor type must be agent, human, or automation\n'
		);
	}
});

test('actor type survives note, reconciliation, diff, and finish', t => {
	const root =
		repository(
			t,
			{
				files: {
					'other.txt':
						'base\n'
				}
			}
		);
	const splicemark =
		new Splicemark({
			cwd: root
		});
	const session =
		splicemark.start(
			'Human lifecycle',
			{
				actorType:
					'human'
			}
		);

	const note =
		splicemark.note(
			session.id,
			path.join(
				root,
				'source.txt'
			),
			{
				mode: 'lines',
				start: 1,
				end: 1,
				message:
					'Preserve intent.'
			}
		);

	assert.equal(
		note.session.actorType,
		'human'
	);

	editLine(
		splicemark,
		session,
		root,
		1,
		'old',
		'new'
	);

	fs.writeFileSync(
		path.join(
			root,
			'other.txt'
		),
		'committed\n'
	);
	git(
		root,
		[
			'add',
			'other.txt'
		]
	);
	git(
		root,
		[
			'commit',
			'-qm',
			'unrelated'
		]
	);

	const state =
		splicemark.diff(
			session.id
		);

	assert.equal(
		state.session.actorType,
		'human'
	);
	assert.equal(
		state.edits[0].status,
		'active'
	);
	assert.equal(
		splicemark.finish(
			session.id
		).actorType,
		'human'
	);
});

test('tracked-only diff has actor headers and no fake HUMAN residual', t => {
	const root =
		repository(
			t,
			{
				source:
					fixture(8)
			}
		);
	const splicemark =
		new Splicemark({
			cwd: root
		});
	const session =
		splicemark.start(
			'Tracked only',
			{
				actorType:
					'agent'
			}
		);

	editLine(
		splicemark,
		session,
		root,
		5,
		'line-5',
		'tracked-five'
	);

	const {
		state,
		output
	} =
		rendered(
			splicemark,
			session
		);

	assert.deepEqual(
		state.unattributed,
		[]
	);
	assert.match(
		output,
		new RegExp(
			'\\[YOU · AGENT · ' +
				session.id +
				' · Tracked only\\]'
		)
	);
	assert.doesNotMatch(
		output,
		/UNATTRIBUTED/
	);
});

test('manual replacement before tracked work is HUMAN and source ordered', t => {
	const root =
		repository(
			t,
			{
				source:
					fixture(8)
			}
		);
	const splicemark =
		new Splicemark({
			cwd: root
		});
	const session =
		splicemark.start(
			'Tracked later'
		);

	editLine(
		splicemark,
		session,
		root,
		5,
		'line-5',
		'tracked-five'
	);

	const source =
		fixtureLines(8);

	source[1] =
		'manual-one';
	source[5] =
		'tracked-five';
	fs.writeFileSync(
		path.join(
			root,
			'source.txt'
		),
		source.join('\n') + '\n'
	);

	const {
		state,
		output
	} =
		rendered(
			splicemark,
			session
		);

	assert.equal(
		state.unattributed.length,
		1
	);
	assert.equal(
		state.unattributed[0].actorType,
		'human'
	);
	assert.equal(
		state.unattributed[0].edit.removed,
		'line-1'
	);
	assert.equal(
		state.unattributed[0].edit.inserted,
		'manual-one'
	);
	assert.ok(
		output.indexOf(
			'[UNATTRIBUTED · HUMAN · working-tree]'
		) <
		output.indexOf(
			'[YOU · AGENT · ' +
				session.id
		)
	);
});

test('manual insertion and deletion use truthful OLD/NEW coordinates and shift later tracked edits', async t => {
	for (
		const mode
		of [
			'insertion',
			'deletion'
		]
	) {
		await t.test(
			mode,
			t => {
				const root =
					repository(
						t,
						{
							source:
								fixture(8)
						}
					);
				const splicemark =
					new Splicemark({
						cwd: root
					});
				const session =
					splicemark.start(
						'Tracked shifted'
					);

				editLine(
					splicemark,
					session,
					root,
					5,
					'line-5',
					'tracked-five'
				);

				const source =
					fixtureLines(8);

				source[5] =
					'tracked-five';

				if (mode === 'insertion') {
					source.splice(
						1,
						0,
						'manual-insert'
					);
				} else {
					source.splice(
						1,
						1
					);
				}

				fs.writeFileSync(
					path.join(
						root,
						'source.txt'
					),
					source.join('\n') + '\n'
				);

				const {
					state,
					output
				} =
					rendered(
						splicemark,
						session
					);

				assert.equal(
					state.unattributed[0]
						.actorType,
					'human'
				);

				if (mode === 'insertion') {
					assert.equal(
						state.edits[0]
							.oldLineStart,
						5
					);
					assert.equal(
						state.edits[0]
							.newLineStart,
						6
					);
					assert.match(
						output,
						/@@ -1,0 \+1,1 @@/
					);
					assert.match(
						output,
						/@@ -5,1 \+6,1 @@/
					);
				} else {
					assert.equal(
						state.edits[0]
							.oldLineStart,
						5
					);
					assert.equal(
						state.edits[0]
							.newLineStart,
						4
					);
					assert.match(
						output,
						/@@ -1,1 \+1,0 @@/
					);
					assert.match(
						output,
						/@@ -5,1 \+4,1 @@/
					);
				}
			}
		);
	}
});

test('manual work after and between tracked edits remains source ordered', async t => {
	await t.test(
		'after',
		t => {
			const root =
				repository(
					t,
					{
						source:
							fixture(8)
					}
				);
			const splicemark =
				new Splicemark({
					cwd: root
				});
			const session =
				splicemark.start(
					'Tracked early'
				);

			editLine(
				splicemark,
				session,
				root,
				1,
				'line-1',
				'tracked-one'
			);

			const source =
				fixtureLines(8);

			source[1] =
				'tracked-one';
			source[6] =
				'manual-six';
			fs.writeFileSync(
				path.join(
					root,
					'source.txt'
				),
				source.join('\n') + '\n'
			);

			const { output } =
				rendered(
					splicemark,
					session
				);

			assert.ok(
				output.indexOf(
					'[YOU · AGENT · ' +
						session.id
				) <
				output.indexOf(
					'[UNATTRIBUTED · HUMAN · working-tree]'
				)
			);
		}
	);

	await t.test(
		'between',
		t => {
			const root =
				repository(
					t,
					{
						source:
							fixture(9)
					}
				);
			const splicemark =
				new Splicemark({
					cwd: root
				});
			const session =
				splicemark.start(
					'Two tracked'
				);

			editLine(
				splicemark,
				session,
				root,
				1,
				'line-1',
				'tracked-one'
			);
			editLine(
				splicemark,
				session,
				root,
				7,
				'line-7',
				'tracked-seven'
			);

			const source =
				fixtureLines(9);

			source[1] =
				'tracked-one';
			source[4] =
				'manual-four';
			source[7] =
				'tracked-seven';
			fs.writeFileSync(
				path.join(
					root,
					'source.txt'
				),
				source.join('\n') + '\n'
			);

			const { output } =
				rendered(
					splicemark,
					session
				);
			const first =
				output.indexOf(
					'[YOU · AGENT · ' +
						session.id
				);
			const human =
				output.indexOf(
					'[UNATTRIBUTED · HUMAN · working-tree]'
				);
			const second =
				output.indexOf(
					'[YOU · AGENT · ' +
						session.id,
					first + 1
				);

			assert.ok(first >= 0);
			assert.ok(human > first);
			assert.ok(second > human);
		}
	);
});

test('unrelated dirty file is excluded from task-local residual detection', t => {
	const root =
		repository(
			t,
			{
				source:
					fixture(6),
				files: {
					'other.txt':
						'other-old\n'
				}
			}
		);
	const splicemark =
		new Splicemark({
			cwd: root
		});
	const session =
		splicemark.start(
			'Only source'
		);

	editLine(
		splicemark,
		session,
		root,
		2,
		'line-2',
		'tracked-two'
	);
	fs.writeFileSync(
		path.join(
			root,
			'other.txt'
		),
		'manual-other\n'
	);

	const {
		state,
		output
	} =
		rendered(
			splicemark,
			session
		);

	assert.deepEqual(
		state.unattributed,
		[]
	);
	assert.doesNotMatch(
		output,
		/other\.txt|manual-other/
	);
});

test('same-file HEAD shift keeps a reconciled tracked edit attributable without a HUMAN residual', t => {
	const root =
		repository(
			t,
			{
				source:
					'zero\none\ntarget\nlast\n'
			}
		);
	const splicemark =
		new Splicemark({
			cwd: root
		});
	const session =
		splicemark.start(
			'Shifted automation',
			{
				actorType:
					'automation'
			}
		);

	editLine(
		splicemark,
		session,
		root,
		2,
		'target',
		'tracked'
	);

	const committed =
		'zero\ninserted\none\ntarget\nlast\n';
	const working =
		'zero\ninserted\none\ntracked\nlast\n';
	const blob =
		git(
			root,
			[
				'hash-object',
				'-w',
				'--stdin'
			],
			committed
		);

	fs.writeFileSync(
		path.join(
			root,
			'source.txt'
		),
		working
	);
	git(
		root,
		[
			'update-index',
			'--cacheinfo',
			'100644,' +
				blob +
				',source.txt'
		]
	);
	git(
		root,
		[
			'commit',
			'-qm',
			'insert before tracked'
		]
	);

	const {
		state,
		output
	} =
		rendered(
			splicemark,
			session
		);

	assert.equal(
		state.edits[0].status,
		'active'
	);
	assert.equal(
		state.edits[0].lineStart,
		3
	);
	assert.deepEqual(
		state.unattributed,
		[]
	);
	assert.match(
		output,
		new RegExp(
			'\\[YOU · AUTOMATION · ' +
				session.id
		)
	);
});

test('manual mutation or revert of tracked code never becomes falsely HUMAN', async t => {
	await t.test(
		'mutation',
		t => {
			const root =
				repository(
					t,
					{
						source:
							fixture(6)
					}
				);
			const splicemark =
				new Splicemark({
					cwd: root
				});
			const session =
				splicemark.start(
					'Ambiguous tracked'
				);

			editLine(
				splicemark,
				session,
				root,
				2,
				'line-2',
				'tracked-two'
			);

			const source =
				fixtureLines(6);

			source[2] =
				'manual-mutated';
			fs.writeFileSync(
				path.join(
					root,
					'source.txt'
				),
				source.join('\n') + '\n'
			);

			const {
				state,
				output
			} =
				rendered(
					splicemark,
					session
				);

			assert.equal(
				state.edits[0].status,
				'stale'
			);
			assert.equal(
				state.unattributed[0]
					.actorType,
				'unknown'
			);
			assert.match(
				output,
				/\[UNATTRIBUTED · UNKNOWN · working-tree\]/
			);
			assert.doesNotMatch(
				output,
				/\[UNATTRIBUTED · HUMAN · working-tree\]/
			);
			assert.doesNotMatch(
				output,
				/\+tracked-two/
			);
		}
	);

	await t.test(
		'revert',
		t => {
			const root =
				repository(
					t,
					{
						source:
							fixture(6)
					}
				);
			const splicemark =
				new Splicemark({
					cwd: root
				});
			const session =
				splicemark.start(
					'Reverted tracked'
				);

			editLine(
				splicemark,
				session,
				root,
				2,
				'line-2',
				'tracked-two'
			);
			fs.writeFileSync(
				path.join(
					root,
					'source.txt'
				),
				fixture(6)
			);

			const {
				state,
				output
			} =
				rendered(
					splicemark,
					session
				);

			assert.equal(
				state.edits[0].status,
				'stale'
			);
			assert.deepEqual(
				state.unattributed,
				[]
			);
			assert.match(
				output,
				/\[STALE · source\.txt · /
			);
			assert.doesNotMatch(
				output,
				/UNATTRIBUTED|\+tracked-two/
			);
		}
	);
});

test('HUMAN residual context, line bases, and large coordinates use the formatter coordinate system', async t => {
	await t.test(
		'context and line base',
		t => {
			const root =
				repository(
					t,
					{
						source:
							fixture(8)
					}
				);
			const splicemark =
				new Splicemark({
					cwd: root
				});
			const session =
				splicemark.start(
					'Context tracked'
				);

			editLine(
				splicemark,
				session,
				root,
				6,
				'line-6',
				'tracked-six'
			);

			const source =
				fixtureLines(8);

			source[2] =
				'manual-two';
			source[6] =
				'tracked-six';
			fs.writeFileSync(
				path.join(
					root,
					'source.txt'
				),
				source.join('\n') + '\n'
			);

			const zero =
				rendered(
					splicemark,
					session,
					{
						context: 2,
						lineBase: 0
					}
				).output;
			const one =
				rendered(
					splicemark,
					session,
					{
						context: 2,
						lineBase: 1
					}
				).output;
			const rows =
				zero.split('\n');
			const attribution =
				rows.indexOf(
					'[UNATTRIBUTED · HUMAN · working-tree]'
				);

			assert.equal(
				rows[attribution - 2],
				'0 0  line-0'
			);
			assert.equal(
				rows[attribution - 1],
				'1 1  line-1'
			);
			assert.match(
				rows[attribution + 1],
				/-line-2$/
			);
			assert.match(
				rows[attribution + 2],
				/\+manual-two$/
			);
			assert.equal(
				rows[attribution + 3],
				'3 3  line-3'
			);
			assert.equal(
				rows[attribution + 4],
				'4 4  line-4'
			);
			assert.match(
				zero,
				/@@ -0,5 \+0,5 @@/
			);
			assert.match(
				one,
				/@@ -1,5 \+1,5 @@/
			);
		}
	);

	await t.test(
		'large coordinates',
		t => {
			const root =
				repository(
					t,
					{
						source:
							fixture(10005)
					}
				);
			const splicemark =
				new Splicemark({
					cwd: root
				});
			const session =
				splicemark.start(
					'Large tracked'
				);

			editLine(
				splicemark,
				session,
				root,
				10002,
				'line-10002',
				'tracked-10002'
			);

			const source =
				fixtureLines(10005);

			source[10000] =
				'manual-10000';
			source[10002] =
				'tracked-10002';
			fs.writeFileSync(
				path.join(
					root,
					'source.txt'
				),
				source.join('\n') + '\n'
			);

			const { output } =
				rendered(
					splicemark,
					session
				);

			assert.match(
				output,
				/@@ -10000,1 \+10000,1 @@/
			);
			assert.match(
				output,
				/\[UNATTRIBUTED · HUMAN · working-tree\]/
			);
		}
	);
});

test('AGENT, AUTOMATION, and HUMAN residual attribution coexist in source order', t => {
	const root =
		repository(
			t,
			{
				source:
					fixture(9)
			}
		);
	const splicemark =
		new Splicemark({
			cwd: root
		});
	const automation =
		splicemark.start(
			'Regenerate bindings',
			{
				actorType:
					'automation'
			}
		);
	const agent =
		splicemark.start(
			'Refactor movement',
			{
				actorType:
					'agent'
			}
		);

	editLine(
		splicemark,
		automation,
		root,
		1,
		'line-1',
		'automation-one'
	);
	editLine(
		splicemark,
		agent,
		root,
		7,
		'line-7',
		'agent-seven'
	);

	const source =
		fixtureLines(9);

	source[1] =
		'automation-one';
	source[4] =
		'manual-four';
	source[7] =
		'agent-seven';
	fs.writeFileSync(
		path.join(
			root,
			'source.txt'
		),
		source.join('\n') + '\n'
	);

	const { output } =
		rendered(
			splicemark,
			agent
		);
	const peer =
		output.indexOf(
			'[PEER · AUTOMATION · ' +
				automation.id +
				' · Regenerate bindings]'
		);
	const human =
		output.indexOf(
			'[UNATTRIBUTED · HUMAN · working-tree]'
		);
	const you =
		output.indexOf(
			'[YOU · AGENT · ' +
				agent.id +
				' · Refactor movement]'
		);

	assert.ok(peer >= 0);
	assert.ok(human > peer);
	assert.ok(you > human);
});

test('literal CLI stdout contains YOU actor, PEER actor, and HUMAN working-tree attribution', t => {
	const root =
		repository(
			t,
			{
				source:
					fixture(9)
			}
		);
	const peer =
		runCli(
			root,
			[
				'start',
				'Peer automation',
				'--actor=automation'
			]
		).trim();
	const current =
		runCli(
			root,
			[
				'start',
				'Current agent',
				'--actor=agent'
			]
		).trim();

	runCli(
		root,
		[
			'edit',
			peer,
			'source.txt',
			'--lines',
			'1:1',
			'--expect-start',
			'line-1',
			'--expect-end',
			'line-1'
		],
		'automation-one\n'
	);
	runCli(
		root,
		[
			'edit',
			current,
			'source.txt',
			'--lines',
			'7:7',
			'--expect-start',
			'line-7',
			'--expect-end',
			'line-7'
		],
		'agent-seven\n'
	);

	const source =
		fixtureLines(9);

	source[1] =
		'automation-one';
	source[4] =
		'manual-four';
	source[7] =
		'agent-seven';
	fs.writeFileSync(
		path.join(
			root,
			'source.txt'
		),
		source.join('\n') + '\n'
	);

	const output =
		runCli(
			root,
			[
				'diff',
				current
			]
		);

	assert.ok(
		output.includes(
			'[PEER · AUTOMATION · ' +
				peer +
				' · Peer automation]'
		)
	);
	assert.ok(
		output.includes(
			'[UNATTRIBUTED · HUMAN · working-tree]'
		)
	);
	assert.ok(
		output.includes(
			'[YOU · AGENT · ' +
				current +
				' · Current agent]'
		)
	);
});

test('browser-safe production adapters classify residual work with the same model', () => {
	const workspace =
		new MemoryWorkspace({
			'source.txt':
				fixture(7)
		});
	const gitAdapter =
		new MemoryGit({
			workspace
		});
	const splicemark =
		new SplicemarkCore({
			git: gitAdapter,
			store:
				new MemorySessionStore(),
			workspace
		});
	const session =
		splicemark.start(
			'Memory automation',
			{
				actorType:
					'automation'
			}
		);

	splicemark.edit(
		session.id,
		'source.txt',
		{
			mode: 'lines',
			start: 5,
			end: 5,
			expectedStart:
				'line-5',
			expectedEnd:
				'line-5',
			replacement:
				'tracked-five'
		}
	);

	const source =
		fixtureLines(7);

	source[2] =
		'manual-two';
	source[5] =
		'tracked-five';
	workspace.write(
		'source.txt',
		source.join('\n') + '\n'
	);

	const state =
		splicemark.diff(
			session.id
		);

	assert.equal(
		state.session.actorType,
		'automation'
	);
	assert.equal(
		state.unattributed.length,
		1
	);
	assert.equal(
		state.unattributed[0].actorType,
		'human'
	);
});
