#!/usr/bin/env node

import fs from 'node:fs';
import Diff from '../src/Diff.js';
import Splicemark from '../src/Splicemark.js';

function option(args, name) {
	const index = args.indexOf(name);

	if (index === -1 || index + 1 >= args.length) {
		throw new Error('missing ' + name);
	}

	return args[index + 1];
}

function diffLineBase(args) {
	const inline =
		args.filter(arg => arg.startsWith('--line-base='));
	const separateIndex =
		args.indexOf('--line-base');

	if (
		inline.length > 1 ||
		(inline.length === 1 && separateIndex !== -1)
	) {
		throw new Error('--line-base may be specified once');
	}

	if (inline.length === 1) {
		const value =
			inline[0].slice('--line-base='.length);

		return value;
	}

	if (separateIndex !== -1) {
		const value =
			option(args, '--line-base');

		return value;
	}

	return 0;
}

function diffContext(args) {
	const values = [];

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];

		if (arg.startsWith('--context=')) {
			values.push(
				arg.slice('--context='.length)
			);
			continue;
		}

		if (arg.startsWith('--unified=')) {
			values.push(
				arg.slice('--unified='.length)
			);
			continue;
		}

		if (arg.startsWith('-U') && arg !== '-U') {
			values.push(arg.slice(2));
			continue;
		}

		if (
			arg === '--context' ||
			arg === '--unified' ||
			arg === '-U'
		) {
			if (index + 1 >= args.length) {
				throw new Error('missing ' + arg);
			}

			values.push(args[index + 1]);
			index++;
		}
	}

	if (values.length > 1) {
		throw new Error('context may be specified once');
	}

	const value =
		values.length === 0 ? '0' : values[0];

	if (!/^\d+$/.test(value)) {
		throw new Error(
			'context must be a non-negative integer'
		);
	}

	const parsed =
		Number(value);

	if (!Number.isSafeInteger(parsed)) {
		throw new Error(
			'context must be a non-negative integer'
		);
	}

	return parsed;
}

function range(value) {
	const match = /^(\d+):(\d+)$/.exec(value);

	if (!match) {
		throw new Error('range must be START:END');
	}

	return {
		start: Number(match[1]),
		end: Number(match[2])
	};
}

function replacementFromStdin() {
	const input = fs.readFileSync(0, 'utf8');
	return input.endsWith('\n')
		? input.slice(0, input.endsWith('\r\n') ? -2 : -1)
		: input;
}

async function main() {
	const [command, ...args] = process.argv.slice(2);
	const splicemark = new Splicemark();

	if (command === 'start') {
		const session = splicemark.start(args.join(' '));
		process.stdout.write(session.id + '\n');
		return;
	}

	if (command === 'edit') {
		const [sessionId, file, ...flags] = args;

		if (!sessionId || !file) {
			throw new Error('edit requires SESSION and FILE');
		}

		const lineRange = flags.includes('--lines')
			? range(option(flags, '--lines'))
			: null;
		const charRange = flags.includes('--chars')
			? range(option(flags, '--chars'))
			: null;

		if ((lineRange ? 1 : 0) + (charRange ? 1 : 0) !== 1) {
			throw new Error('edit requires exactly one of --lines or --chars');
		}

		const selected = lineRange || charRange;
		const result = splicemark.edit(sessionId, file, {
			mode: lineRange ? 'lines' : 'chars',
			start: selected.start,
			end: selected.end,
			expectedStart: option(flags, '--expect-start'),
			expectedEnd: option(flags, '--expect-end'),
			replacement: replacementFromStdin()
		});

		process.stdout.write(
			new Diff().format(
				result.session,
				result.file,
				result.edit,
				result.peers,
				result.notes
			)
		);
		return;
	}

	if (command === 'batch') {
		const [sessionId, file, ...flags] = args;

		if (!sessionId || !file) {
			throw new Error('batch requires SESSION and FILE');
		}

		const linesMode = flags.includes('--lines');
		const charsMode = flags.includes('--chars');

		if ((linesMode ? 1 : 0) + (charsMode ? 1 : 0) !== 1) {
			throw new Error('batch requires exactly one of --lines or --chars');
		}

		let splices;

		try {
			splices = JSON.parse(fs.readFileSync(0, 'utf8'));
		} catch {
			throw new Error('batch stdin must be valid JSON');
		}

		const result = splicemark.batch(sessionId, file, {
			mode: linesMode ? 'lines' : 'chars',
			splices
		});
		const diff = new Diff();
		const sections = result.results.map(item =>
			diff.format(
				result.session,
				result.file,
				item.edit,
				item.peers,
				item.notes
			).trimEnd()
		);

		process.stdout.write(sections.join('\n\n') + '\n');
		return;
	}

	if (command === 'note') {
		const [sessionId, file, ...flags] = args;

		if (!sessionId || !file) {
			throw new Error('note requires SESSION and FILE');
		}

		const lineRange = flags.includes('--lines')
			? range(option(flags, '--lines'))
			: null;
		const charRange = flags.includes('--chars')
			? range(option(flags, '--chars'))
			: null;

		if ((lineRange ? 1 : 0) + (charRange ? 1 : 0) !== 1) {
			throw new Error('note requires exactly one of --lines or --chars');
		}

		const selected = lineRange || charRange;
		const result = splicemark.note(sessionId, file, {
			mode: lineRange ? 'lines' : 'chars',
			start: selected.start,
			end: selected.end,
			message: option(flags, '--message')
		});

		process.stdout.write(result.note.id + '\n');
		return;
	}

	if (command === 'finish') {
		const [sessionId] = args;

		if (!sessionId) {
			throw new Error('finish requires SESSION');
		}

		const session = splicemark.finish(sessionId);
		process.stdout.write(session.id + ' finished\n');
		return;
	}

	if (command === 'clean') {
		const result = splicemark.clean();
		process.stdout.write(
			'cleaned sessions=' + result.sessions +
			' notes=' + result.notes +
			' edits=' + result.edits + '\n'
		);
		return;
	}

	if (command === 'diff') {
		const [sessionId, ...flags] = args;

		if (!sessionId) {
			throw new Error('diff requires SESSION');
		}

		const context =
			diffContext(flags);
		const diff =
			new Diff({
				lineBase: diffLineBase(flags),
				context
			});
		const result =
			splicemark.diff(
				sessionId,
				{
					includeSources: context > 0
				}
			);

		process.stdout.write(
			diff.formatSession(
				result.session,
				result.edits,
				result.peers,
				result.sources
			)
		);
		return;
	}

	if (!command || command === 'help' || command === '--help' || command === '-h') {
		process.stdout.write(
			'Usage:\n' +
			'  splicemark start "task description"\n' +
			'  splicemark edit SESSION FILE --lines START:END --expect-start TEXT --expect-end TEXT\n' +
			'  splicemark edit SESSION FILE --chars START:END --expect-start TEXT --expect-end TEXT\n' +
			'  splicemark batch SESSION FILE --lines < splices.json\n' +
			'  splicemark batch SESSION FILE --chars < splices.json\n' +
			'  splicemark note SESSION FILE --lines START:END --message TEXT\n' +
			'  splicemark note SESSION FILE --chars START:END --message TEXT\n' +
			'  splicemark diff SESSION [--line-base=0|1] [--context=N]\n' +
			'  splicemark finish SESSION\n' +
			'  splicemark clean\n\n' +
			'Diff options:\n' +
			'  --line-base=0|1  Source coordinates: 0 (default, agent/programmatic), 1 (human/editor)\n' +
			'  --context=N       Unchanged source lines before and after each edit (default: 0)\n' +
			'                    Also: --context N, --unified=N, --unified N, -UN, -U N\n'
		);
		return;
	}

	throw new Error('unknown command: ' + command);
}

main().catch(error => {
	process.stderr.write('splicemark: ' + error.message + '\n');
	process.exitCode = 1;
});
