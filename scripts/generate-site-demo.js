import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const cli = path.join(root, 'bin', 'splicemark.js');
const output = path.join(root, 'docs', 'demo-data.json');

function git(cwd, args) {
	return execFileSync('git', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function run(cwd, args, input = '') {
	const result = spawnSync(
		process.execPath,
		[cli, ...args],
		{
			cwd,
			encoding: 'utf8',
			input
		}
	);

	if (result.status !== 0) {
		throw new Error(
			result.stderr ||
			'Splicemark command failed'
		);
	}

	return result.stdout.trimEnd();
}

function source(relative) {
	return fs.readFileSync(
		path.join(root, relative),
		'utf8'
	);
}

function repository(relative) {
	const cwd = fs.mkdtempSync(
		path.join(
			os.tmpdir(),
			'splicemark-site-'
		)
	);
	const content = source(relative);
	const destination = path.join(
		cwd,
		relative
	);

	fs.mkdirSync(
		path.dirname(destination),
		{
			recursive: true
		}
	);

	fs.writeFileSync(
		destination,
		content
	);

	git(cwd, ['init', '-q']);
	git(cwd, [
		'config',
		'user.name',
		'Splicemark Demo'
	]);
	git(cwd, [
		'config',
		'user.email',
		'splicemark@example.invalid'
	]);
	git(cwd, ['add', '.']);
	git(cwd, [
		'commit',
		'-qm',
		'initial'
	]);

	return {
		cwd,
		content
	};
}

function current(cwd, relative) {
	return fs.readFileSync(
		path.join(cwd, relative),
		'utf8'
	);
}

function lineOf(
	content,
	fragment,
	occurrence = 0
) {
	const matches = content
		.split('\n')
		.map((line, index) => ({
			line,
			index
		}))
		.filter(item =>
			item.line.includes(fragment)
		);

	if (!matches[occurrence]) {
		throw new Error(
			'Unable to find source anchor: ' +
			fragment
		);
	}

	return matches[occurrence].index;
}

function lineAt(content, index) {
	const line = content.split('\n')[index];

	if (line === undefined) {
		throw new Error(
			'Line outside source: ' +
			index
		);
	}

	return line;
}

function indentOf(line) {
	return line.match(/^\s*/)?.[0] || '';
}

function step(
	title,
	command,
	outputText,
	fileBefore,
	fileAfter,
	detail
) {
	return {
		title,
		command,
		output: outputText,
		fileBefore,
		fileAfter,
		detail
	};
}

function batchScenario() {
	const target = 'src/FileEditor.js';
	const repo = repository(target);

	try {
		const session = run(
			repo.cwd,
			[
				'start',
				'Clarify batch validation'
			]
		);
		const upper = lineOf(
			repo.content,
			'batch requires at least one splice'
		);
		const lower = lineOf(
			repo.content,
			'batch ranges must not overlap'
		);
		const upperLine = lineAt(
			repo.content,
			upper
		);
		const lowerLine = lineAt(
			repo.content,
			lower
		);
		const splices = [
			{
				start: upper,
				end: upper,
				replacement:
					upperLine +
					'\n' +
					indentOf(upperLine) +
					'// This inserted line would shift every lower target.'
			},
			{
				start: lower,
				end: lower,
				replacement:
					lowerLine.replace(
						'batch ranges must not overlap',
						'batch ranges cannot overlap'
					)
			}
		];
		const before = current(
			repo.cwd,
			target
		);
		const outputText = run(
			repo.cwd,
			[
				'batch',
				session,
				target,
				'--lines'
			],
			JSON.stringify(splices)
		);
		const after = current(
			repo.cwd,
			target
		);
		const diff = run(
			repo.cwd,
			[
				'diff',
				session
			]
		);

		return {
			id: 'batch',
			kicker: 'Prevalidated batch',
			title:
				'Multiple writes without line drift',
			description:
				'This demo edits the real FileEditor.js. The upper replacement inserts a line, but the lower target still lands correctly because accepted ranges are applied bottom-to-top.',
			file: target,
			initialFile: before,
			steps: [
				step(
					'Apply two real source edits in one batch',
					[
						'splicemark batch ' +
							session +
							' ' +
							target +
							" --lines <<'JSON'",
						JSON.stringify(
							splices,
							null,
							2
						),
						'JSON'
					].join('\n'),
					outputText,
					before,
					after,
					'Input order is top-first. Splicemark rejects overlap, sorts by descending position, writes once, and records each splice separately.'
				),
				step(
					'Review only this session',
					'splicemark diff ' +
						session,
					diff,
					after,
					after,
					'The task-local diff contains only mutations attributed to this session.'
				)
			]
		};
	} finally {
		fs.rmSync(
			repo.cwd,
			{
				recursive: true,
				force: true
			}
		);
	}
}

function peerScenario() {
	const target = 'src/Reconciler.js';
	const repo = repository(target);

	try {
		const first = run(
			repo.cwd,
			[
				'start',
				'Explain active reconciliation'
			]
		);
		const second = run(
			repo.cwd,
			[
				'start',
				'Refine active reconciliation'
			]
		);
		const originalIndex = lineOf(
			repo.content,
			"return 'active';"
		);
		const originalLine = lineAt(
			repo.content,
			originalIndex
		);
		const beforeFirst = current(
			repo.cwd,
			target
		);
		const firstReplacement =
			indentOf(originalLine) +
			'// Agent A documents this active path.\n' +
			originalLine;

		const firstOutput = run(
			repo.cwd,
			[
				'edit',
				first,
				target,
				'--lines',
				originalIndex +
					':' +
					originalIndex,
				'--expect-start',
				originalLine,
				'--expect-end',
				originalLine
			],
			firstReplacement + '\n'
		);

		const afterFirst = current(
			repo.cwd,
			target
		);
		const secondIndex =
			originalIndex + 1;
		const secondLine = lineAt(
			afterFirst,
			secondIndex
		);

		const secondOutput = run(
			repo.cwd,
			[
				'edit',
				second,
				target,
				'--lines',
				secondIndex +
					':' +
					secondIndex,
				'--expect-start',
				secondLine,
				'--expect-end',
				secondLine
			],
			secondLine +
				' // Agent B touches the same authored region.\n'
		);

		const afterSecond = current(
			repo.cwd,
			target
		);
		const diff = run(
			repo.cwd,
			[
				'diff',
				second
			]
		);

		return {
			id: 'peers',
			kicker:
				'Shared tree, local awareness',
			title:
				'Peer work appears only when it overlaps',
			description:
				'Two sessions edit the same real Reconciler.js. Agent B receives Agent A’s attributed edit because their regions intersect. Unrelated sessions stay invisible.',
			file: target,
			initialFile: beforeFirst,
			steps: [
				step(
					'Agent A edits Reconciler.js',
					'splicemark edit ' +
						first +
						' ' +
						target +
						' --lines ' +
						originalIndex +
						':' +
						originalIndex +
						' ...',
					firstOutput,
					beforeFirst,
					afterFirst,
					'Splicemark records exactly what Agent A changed under Agent A’s session and task description.'
				),
				step(
					'Agent B enters the same region',
					'splicemark edit ' +
						second +
						' ' +
						target +
						' --lines ' +
						secondIndex +
						':' +
						secondIndex +
						' ...',
					secondOutput,
					afterFirst,
					afterSecond,
					'The output includes Agent B’s mutation plus Agent A’s locally relevant mutation labeled PEER.'
				),
				step(
					'Agent B reviews its task-local diff',
					'splicemark diff ' +
						second,
					diff,
					afterSecond,
					afterSecond,
					'Routine review remains scoped to Agent B even though both sessions changed the physical file.'
				)
			]
		};
	} finally {
		fs.rmSync(
			repo.cwd,
			{
				recursive: true,
				force: true
			}
		);
	}
}

function noteScenario() {
	const target = 'src/PeerRegistry.js';
	const repo = repository(target);

	try {
		const owner = run(
			repo.cwd,
			[
				'start',
				'Preserve peer filtering'
			]
		);
		const worker = run(
			repo.cwd,
			[
				'start',
				'Clarify peer return'
			]
		);
		const index = lineOf(
			repo.content,
			'return peers;'
		);
		const expected = lineAt(
			repo.content,
			index
		);
		const noteOutput = run(
			repo.cwd,
			[
				'note',
				owner,
				target,
				'--lines',
				index +
					':' +
					index,
				'--message',
				'Keep this return local to relevant peer edits; do not expand it into a global registry dump.'
			]
		);
		const before = current(
			repo.cwd,
			target
		);
		const editOutput = run(
			repo.cwd,
			[
				'edit',
				worker,
				target,
				'--lines',
				index +
					':' +
					index,
				'--expect-start',
				expected,
				'--expect-end',
				expected
			],
			expected +
				' // The return remains intentionally local.\n'
		);
		const after = current(
			repo.cwd,
			target
		);

		return {
			id: 'notes',
			kicker:
				'Code-bound coordination',
			title:
				'Important notes, not agent chat',
			description:
				'A note is attached to a real PeerRegistry.js region. It stays silent until another active session enters that exact area.',
			file: target,
			initialFile: before,
			steps: [
				step(
					'Attach an exceptional note',
					'splicemark note ' +
						owner +
						' ' +
						target +
						' --lines ' +
						index +
						':' +
						index +
						' --message "Keep this return local..."',
					noteOutput,
					before,
					before,
					'The note is stored against the current HEAD and code region. It is not a direct message or inbox.'
				),
				step(
					'Another session enters that region',
					'splicemark edit ' +
						worker +
						' ' +
						target +
						' --lines ' +
						index +
						':' +
						index +
						' ...',
					editOutput,
					before,
					after,
					'The peer note appears automatically because this edit intersects the noted region.'
				)
			]
		};
	} finally {
		fs.rmSync(
			repo.cwd,
			{
				recursive: true,
				force: true
			}
		);
	}
}

function relocationScenario() {
	const target = 'src/Reconciler.js';
	const repo = repository(target);

	try {
		const reader = run(
			repo.cwd,
			[
				'start',
				'Annotate working diff lookup'
			]
		);
		const shifter = run(
			repo.cwd,
			[
				'start',
				'Add reconciliation context'
			]
		);
		const targetIndex = lineOf(
			repo.content,
			'const working = this.#matchCount'
		);
		const targetLine = lineAt(
			repo.content,
			targetIndex
		);
		const firstLine = lineAt(
			repo.content,
			0
		);
		const beforeShift = current(
			repo.cwd,
			target
		);

		const shiftOutput = run(
			repo.cwd,
			[
				'edit',
				shifter,
				target,
				'--lines',
				'0:0',
				'--expect-start',
				firstLine,
				'--expect-end',
				firstLine
			],
			'// Reconciliation compares committed and working mutations.\n' +
				'// These comments intentionally shift every lower line.\n' +
				firstLine +
				'\n'
		);

		const afterShift = current(
			repo.cwd,
			target
		);

		const relocateOutput = run(
			repo.cwd,
			[
				'edit',
				reader,
				target,
				'--lines',
				targetIndex +
					':' +
					targetIndex,
				'--expect-start',
				targetLine,
				'--expect-end',
				targetLine
			],
			targetLine +
				' // Relocated from the agent’s validated position.\n'
		);

		const afterRelocation = current(
			repo.cwd,
			target
		);

		return {
			id: 'relocation',
			kicker:
				'Boundary shift recovery',
			title:
				'A shifted target can still land safely',
			description:
				'Agent A validated a real Reconciler.js line. Another session inserted two lines above it. The boundary remained unique, so Splicemark relocated the single edit by +2.',
			file: target,
			initialFile: beforeShift,
			steps: [
				step(
					'Another session shifts the file',
					'splicemark edit ' +
						shifter +
						' ' +
						target +
						' --lines 0:0 ...',
					shiftOutput,
					beforeShift,
					afterShift,
					'The intended Agent A target moved, but its content stayed intact and unique.'
				),
				step(
					'Agent A submits the stale original range',
					'splicemark edit ' +
						reader +
						' ' +
						target +
						' --lines ' +
						targetIndex +
						':' +
						targetIndex +
						' --expect-start ' +
						JSON.stringify(
							targetLine
						) +
						' ...',
					relocateOutput,
					afterShift,
					afterRelocation,
					'Splicemark reports the shift and applies the edit at the uniquely relocated boundary.'
				)
			]
		};
	} finally {
		fs.rmSync(
			repo.cwd,
			{
				recursive: true,
				force: true
			}
		);
	}
}

function commitScenario() {
	const target = 'src/Diff.js';
	const repo = repository(target);

	try {
		const session = run(
			repo.cwd,
			[
				'start',
				'Clarify empty diff output'
			]
		);
		const index = lineOf(
			repo.content,
			'No active authored changes.'
		);
		const originalLine = lineAt(
			repo.content,
			index
		);
		const before = current(
			repo.cwd,
			target
		);

		const editOutput = run(
			repo.cwd,
			[
				'edit',
				session,
				target,
				'--lines',
				index +
					':' +
					index,
				'--expect-start',
				originalLine,
				'--expect-end',
				originalLine
			],
			originalLine +
				' // Retires after Git absorbs the mutation.\n'
		);

		const after = current(
			repo.cwd,
			target
		);
		const beforeCommitDiff = run(
			repo.cwd,
			[
				'diff',
				session
			]
		);
		const commit = git(
			repo.cwd,
			[
				'commit',
				'-am',
				'capture demo mutation'
			]
		);
		const afterCommitDiff = run(
			repo.cwd,
			[
				'diff',
				session
			]
		);

		return {
			id: 'commit',
			kicker:
				'Git lifecycle reconciliation',
			title:
				'A normal commit retires active authorship',
			description:
				'Splicemark does not replace Git. This scenario edits the real Diff.js, then commits normally. The mutation disappears from the active task diff after HEAD advances.',
			file: target,
			initialFile: before,
			steps: [
				step(
					'Create an attributed mutation',
					'splicemark edit ' +
						session +
						' ' +
						target +
						' --lines ' +
						index +
						':' +
						index +
						' ...',
					editOutput,
					before,
					after,
					'Before the commit, the mutation belongs to the working tree and remains active in Splicemark.'
				),
				step(
					'Review before Git absorbs it',
					'splicemark diff ' +
						session,
					beforeCommitDiff,
					after,
					after,
					'The session-local diff still contains the authored mutation.'
				),
				step(
					'Commit normally and reconcile HEAD',
					'git commit -am "capture demo mutation"\n' +
						'splicemark diff ' +
						session,
					commit +
						'\n\n' +
						afterCommitDiff,
					after,
					after,
					'Once HEAD contains the mutation, Splicemark retires it from active coordination automatically.'
				)
			]
		};
	} finally {
		fs.rmSync(
			repo.cwd,
			{
				recursive: true,
				force: true
			}
		);
	}
}

function fingerprint() {
	const hash = createHash('sha256');

	for (const relative of [
		'bin/splicemark.js',
		'src/Diff.js',
		'src/FileEditor.js',
		'src/Git.js',
		'src/PeerRegistry.js',
		'src/Reconciler.js',
		'src/SessionStore.js',
		'src/Splicemark.js'
	]) {
		hash.update(
			fs.readFileSync(
				path.join(
					root,
					relative
				)
			)
		);
	}

	return hash
		.digest('hex')
		.slice(0, 16);
}

const pkg = JSON.parse(
	fs.readFileSync(
		path.join(
			root,
			'package.json'
		),
		'utf8'
	)
);

const data = {
	generatedAt:
		new Date().toISOString(),
	version: pkg.version,
	fingerprint: fingerprint(),
	repository:
		'https://github.com/growthboot/Splicemark',
	license: 'MIT',
	generator:
		'scripts/generate-site-demo.js',
	cli:
		'bin/splicemark.js',
	help:
		run(
			root,
			['help']
		),
	scenarios: [
		batchScenario(),
		peerScenario(),
		noteScenario(),
		relocationScenario(),
		commitScenario()
	]
};

fs.mkdirSync(
	path.dirname(output),
	{
		recursive: true
	}
);

fs.writeFileSync(
	output,
	JSON.stringify(
		data,
		null,
		'\t'
	) + '\n'
);

console.log(
	'generated ' +
	path.relative(
		root,
		output
	) +
	' from ' +
	data.scenarios.length +
	' real CLI scenarios'
);
