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
		source
	) {
		const lineStart = this.#lineStart(edit);
		const oldCount =
			this.#lineCount(edit.removed);
		const newCount =
			this.#lineCount(edit.inserted);
		const context =
			this.#contextRows(
				file,
				lineStart,
				newCount,
				source
			);
		const beforeCount =
			context.before.length;
		const afterCount =
			context.after.length;
		const hunkStart =
			lineStart - beforeCount;
		const oldHunkCount =
			beforeCount + oldCount + afterCount;
		const newHunkCount =
			beforeCount + newCount + afterCount;
		const shift =
			edit.shift === 0
				? ''
				: ' shifted ' + (edit.shift > 0 ? '+' : '') + edit.shift;
		const header =
			Number.isInteger(lineStart)
				? '@@ -' + this.#coordinate(hunkStart) + ',' + oldHunkCount +
					' +' + this.#coordinate(hunkStart) + ',' + newHunkCount + ' @@' + shift
				: '@@';
		const before =
			this.#contextContent(
				context.before,
				hunkStart,
				hunkStart,
				gutterWidth
			);
		const removed =
			this.#content('-', edit.removed, lineStart, gutterWidth);
		const inserted =
			this.#content('+', edit.inserted, lineStart, gutterWidth);
		const after =
			this.#contextContent(
				context.after,
				lineStart + oldCount,
				lineStart + newCount,
				gutterWidth
			);

		return [
			'--- a/' + file,
			'+++ b/' + file,
			header,
			before,
			'[' + kind + ' · ' + session.id + ' · ' + session.description + ']',
			removed,
			inserted,
			after
		].filter(Boolean).join('\n');
	}

	formatSession(session, edits, peers = [], sources = {}) {
		const active =
			edits.filter(edit => (edit.status || 'active') === 'active');
		const stale =
			edits.filter(edit => edit.status === 'stale');
		const files =
			[...new Set(active.map(edit => edit.path))];
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
				sources[entry.file]
			)
		);

		for (const edit of stale) {
			sections.push(
				'[STALE · ' + edit.path + ' · ' + edit.id + ']\n' +
				'Authorship could not be mapped unambiguously after HEAD changed.'
			);
		}

		if (sections.length === 0) {
			return (
				'[YOU · ' + session.id + ' · ' + session.description + ']\n' +
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
			const lineStart = this.#lineStart(entry.edit);
			const oldCount =
				this.#lineCount(entry.edit.removed);
			const newCount =
				this.#lineCount(entry.edit.inserted);

			if (!Number.isInteger(lineStart)) {
				continue;
			}

			if (this.#context === 0) {
				const rowCount =
					Math.max(oldCount, newCount);

				if (rowCount === 0) {
					continue;
				}

				largest = Math.max(
					largest,
					this.#coordinate(lineStart + rowCount - 1)
				);
				continue;
			}

			const context =
				this.#contextRows(
					entry.file,
					lineStart,
					newCount,
					sources[entry.file]
				);
			const start =
				lineStart - context.before.length;
			const oldRows =
				context.before.length +
				oldCount +
				context.after.length;
			const newRows =
				context.before.length +
				newCount +
				context.after.length;

			if (oldRows > 0) {
				largest = Math.max(
					largest,
					this.#coordinate(start + oldRows - 1)
				);
			}

			if (newRows > 0) {
				largest = Math.max(
					largest,
					this.#coordinate(start + newRows - 1)
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
