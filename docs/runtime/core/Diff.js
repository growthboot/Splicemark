import { actorTypeLabel } from './ActorType.js';

export default class Diff {
	#context;
	#lineBase;

	constructor({
		lineBase = 0,
		context = 0
	} = {}) {
		const parsedLineBase =
			lineBase === '0'
				? 0
				: lineBase === '1'
					? 1
					: lineBase;
		const parsedContext =
			typeof context === 'string' && /^\d+$/.test(context)
				? Number(context)
				: context;

		if (parsedLineBase !== 0 && parsedLineBase !== 1) {
			throw new Error('lineBase must be 0 or 1');
		}

		if (
			!Number.isSafeInteger(parsedContext) ||
			parsedContext < 0
		) {
			throw new Error('context must be a non-negative integer');
		}

		this.#lineBase = parsedLineBase;
		this.#context = parsedContext;
	}
	format(session, file, edit, peers = [], notes = []) {
		const entries = [
			{
				kind: 'YOU',
				session,
				file,
				edit
			},
			...peers.map(peer => ({
				kind: 'PEER',
				session: peer.session,
				file: peer.edit.path,
				edit: peer.edit
			}))
		].sort(
			(a, b) =>
				this.#lineStart(a.edit) - this.#lineStart(b.edit)
		);
		const gutterWidth =
			this.#gutterWidth(entries);
		const sections = entries.map(entry =>
			this.#formatEdit(
				entry.kind,
				entry.session,
				entry.file,
				entry.edit,
				gutterWidth
			)
		);

		for (const peer of notes) {
			sections.push(
				'[PEER NOTE · ' +
				actorTypeLabel(peer.session) +
				' · ' +
				peer.session.id +
				' · ' +
				peer.session.description +
				']\n' +
				peer.note.path +
				' · lines ' +
				this.#coordinate(peer.note.lineStart) +
				':' +
				this.#coordinate(peer.note.lineEnd) +
				'\n' +
				peer.note.message
			);
		}

		return sections.join('\n\n') + '\n';
	}

	#coordinate(line) {
		return line + this.#lineBase;
	}

	#lineStart(edit) {
		return this.#newLineStart(edit);
	}

	#oldLineStart(edit) {
		if (Number.isInteger(edit.oldLineStart)) {
			return edit.oldLineStart;
		}

		return Number.isInteger(edit.lineStart)
			? edit.lineStart
			: edit.appliedStart;
	}

	#newLineStart(edit) {
		if (Number.isInteger(edit.newLineStart)) {
			return edit.newLineStart;
		}

		return Number.isInteger(edit.lineStart)
			? edit.lineStart
			: edit.appliedStart;
	}

	#formatEdit(
		kind,
		session,
		file,
		edit,
		gutterWidth,
		source,
		actorType = null
	) {
		const oldLineStart =
			this.#oldLineStart(edit);
		const newLineStart =
			this.#newLineStart(edit);
		const oldCount =
			this.#lineCount(edit.removed);
		const newCount =
			this.#lineCount(edit.inserted);
		const context =
			this.#contextRows(
				file,
				newLineStart,
				newCount,
				source
			);
		const beforeCount =
			context.before.length;
		const afterCount =
			context.after.length;
		const oldHunkStart =
			oldLineStart - beforeCount;
		const newHunkStart =
			newLineStart - beforeCount;
		const oldHunkCount =
			beforeCount + oldCount + afterCount;
		const newHunkCount =
			beforeCount + newCount + afterCount;
		const shift =
			edit.shift === 0
				? ''
				: ' shifted ' + (edit.shift > 0 ? '+' : '') + edit.shift;
		const header =
			Number.isInteger(oldLineStart) &&
			Number.isInteger(newLineStart)
				? '@@ -' + this.#coordinate(oldHunkStart) + ',' + oldHunkCount +
					' +' + this.#coordinate(newHunkStart) + ',' + newHunkCount + ' @@' + shift
				: '@@';
		const before =
			this.#contextContent(
				context.before,
				oldHunkStart,
				newHunkStart,
				gutterWidth
			);
		const removed =
			this.#content(
				'-',
				edit.removed,
				oldLineStart,
				gutterWidth
			);
		const inserted =
			this.#content(
				'+',
				edit.inserted,
				newLineStart,
				gutterWidth
			);
		const after =
			this.#contextContent(
				context.after,
				oldLineStart + oldCount,
				newLineStart + newCount,
				gutterWidth
			);
		const attribution =
			kind === 'UNATTRIBUTED'
				? '[UNATTRIBUTED · ' +
					String(actorType || 'unknown').toUpperCase() +
					' · working-tree]'
				: '[' +
					kind +
					' · ' +
					actorTypeLabel(session) +
					' · ' +
					session.id +
					' · ' +
					session.description +
					']';

		return [
			'--- a/' + file,
			'+++ b/' + file,
			header,
			before,
			attribution,
			removed,
			inserted,
			after
		].filter(Boolean).join('\n');
	}

	formatSession(
		session,
		edits,
		peers = [],
		sources = {},
		unattributed = []
	) {
		const active =
			edits.filter(edit => (edit.status || 'active') === 'active');
		const stale =
			edits.filter(edit => edit.status === 'stale');
		const files =
			[
				...new Set([
					...active.map(edit => edit.path),
					...unattributed.map(item => item.file)
				])
			];
		const entries = files.flatMap(file =>
			[
				...active
					.filter(item => item.path === file)
					.map(edit => ({
						kind: 'YOU',
						session,
						file,
						edit
					})),
				...peers
					.filter(item => item.edit.path === file)
					.map(peer => ({
						kind: 'PEER',
						session: peer.session,
						file: peer.edit.path,
						edit: peer.edit
					})),
				...unattributed
					.filter(item => item.file === file)
					.map(item => ({
						kind: 'UNATTRIBUTED',
						actorType:
							item.actorType,
						session: null,
						file: item.file,
						edit: item.edit
					}))
			].sort(
				(a, b) =>
					this.#lineStart(a.edit) - this.#lineStart(b.edit)
			)
		);
		const gutterWidth =
			this.#gutterWidth(entries, sources);
		const sections = entries.map(entry =>
			this.#formatEdit(
				entry.kind,
				entry.session,
				entry.file,
				entry.edit,
				gutterWidth,
				sources[entry.file],
				entry.actorType
			)
		);

		for (const edit of stale) {
			sections.push(
				'[STALE · ' + edit.path + ' · ' + edit.id + ']\n' +
				'Authorship could not be mapped unambiguously to the current working tree.'
			);
		}

		if (sections.length === 0) {
			return (
				'[YOU · ' +
				actorTypeLabel(session) +
				' · ' +
				session.id +
				' · ' +
				session.description +
				']\n' +
				'No active authored changes.\n'
			);
		}

		return sections.join('\n\n') + '\n';
	}

	#lineCount(text) {
		return text === ''
			? 0
			: text.split(/\r?\n/).length;
	}

	#gutterWidth(entries, sources = {}) {
		let largest = this.#lineBase;

		for (const entry of entries) {
			const oldLineStart =
				this.#oldLineStart(entry.edit);
			const newLineStart =
				this.#newLineStart(entry.edit);
			const oldCount =
				this.#lineCount(entry.edit.removed);
			const newCount =
				this.#lineCount(entry.edit.inserted);

			if (
				!Number.isInteger(oldLineStart) ||
				!Number.isInteger(newLineStart)
			) {
				continue;
			}

			if (this.#context === 0) {
				if (oldCount > 0) {
					largest = Math.max(
						largest,
						this.#coordinate(
							oldLineStart +
								oldCount -
								1
						)
					);
				}

				if (newCount > 0) {
					largest = Math.max(
						largest,
						this.#coordinate(
							newLineStart +
								newCount -
								1
						)
					);
				}

				continue;
			}

			const context =
				this.#contextRows(
					entry.file,
					newLineStart,
					newCount,
					sources[entry.file]
				);
			const beforeCount =
				context.before.length;
			const afterCount =
				context.after.length;
			const oldStart =
				oldLineStart - beforeCount;
			const newStart =
				newLineStart - beforeCount;
			const oldRows =
				beforeCount +
				oldCount +
				afterCount;
			const newRows =
				beforeCount +
				newCount +
				afterCount;

			if (oldRows > 0) {
				largest = Math.max(
					largest,
					this.#coordinate(
						oldStart +
							oldRows -
							1
					)
				);
			}

			if (newRows > 0) {
				largest = Math.max(
					largest,
					this.#coordinate(
						newStart +
							newRows -
							1
					)
				);
			}
		}

		return String(largest).length;
	}

	#content(marker, text, lineStart, gutterWidth) {
		if (text === '') {
			return '';
		}

		return text
			.split(/\r?\n/)
			.map((line, index) => {
				const coordinate =
					this.#coordinate(lineStart + index);
				const oldCoordinate =
					marker === '-' ? coordinate : null;
				const newCoordinate =
					marker === '+' ? coordinate : null;

				return this.#gutter(
					oldCoordinate,
					newCoordinate,
					marker + line,
					gutterWidth
				);
			})
			.join('\n');
	}

	#contextRows(file, lineStart, newCount, source) {
		if (this.#context === 0) {
			return {
				before: [],
				after: []
			};
		}

		if (typeof source !== 'string') {
			throw new Error(
				'context requires current source for ' + file
			);
		}

		if (!Number.isInteger(lineStart) || lineStart < 0) {
			throw new Error(
				'context requires a current line location for ' + file
			);
		}

		const lines =
			this.#sourceLines(source);
		const beforeStart =
			Math.max(0, lineStart - this.#context);
		const afterStart =
			lineStart + newCount;

		return {
			before:
				lines.slice(
					beforeStart,
					lineStart
				),
			after:
				lines.slice(
					afterStart,
					afterStart + this.#context
				)
		};
	}

	#sourceLines(source) {
		if (source === '') {
			return [];
		}

		const lines =
			source.split(/\r?\n/);

		if (/\r?\n$/.test(source)) {
			lines.pop();
		}

		return lines;
	}

	#contextContent(
		lines,
		oldStart,
		newStart,
		gutterWidth
	) {
		return lines
			.map((line, index) =>
				this.#gutter(
					this.#coordinate(oldStart + index),
					this.#coordinate(newStart + index),
					' ' + line,
					gutterWidth
				)
			)
			.join('\n');
	}

	#gutter(oldCoordinate, newCoordinate, content, width) {
		const oldValue =
			oldCoordinate === null ? '' : String(oldCoordinate);
		const newValue =
			newCoordinate === null ? '' : String(newCoordinate);

		return (
			oldValue.padStart(width) +
			' ' +
			newValue.padStart(width) +
			' ' +
			content
		);
	}
}
