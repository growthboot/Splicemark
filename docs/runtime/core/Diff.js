export default class Diff {
	#lineBase;

	constructor({ lineBase = 0 } = {}) {
		const parsedLineBase =
			lineBase === '0'
				? 0
				: lineBase === '1'
					? 1
					: lineBase;

		if (parsedLineBase !== 0 && parsedLineBase !== 1) {
			throw new Error('lineBase must be 0 or 1');
		}

		this.#lineBase = parsedLineBase;
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

	#formatEdit(kind, session, file, edit, gutterWidth) {
		const lineStart = this.#lineStart(edit);
		const oldCount =
			this.#lineCount(edit.removed);
		const newCount =
			this.#lineCount(edit.inserted);
		const shift =
			edit.shift === 0
				? ''
				: ' shifted ' + (edit.shift > 0 ? '+' : '') + edit.shift;
		const header =
			Number.isInteger(lineStart)
				? '@@ -' + this.#coordinate(lineStart) + ',' + oldCount +
					' +' + this.#coordinate(lineStart) + ',' + newCount + ' @@' + shift
				: '@@';
		const removed =
			this.#content('-', edit.removed, lineStart, gutterWidth);
		const inserted =
			this.#content('+', edit.inserted, lineStart, gutterWidth);

		return [
			'[' + kind + ' · ' + session.id + ' · ' + session.description + ']',
			'--- a/' + file,
			'+++ b/' + file,
			header,
			removed,
			inserted
		].filter(Boolean).join('\n');
	}

	formatSession(session, edits, peers = []) {
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

	#gutterWidth(entries) {
		let largest = this.#lineBase;

		for (const entry of entries) {
			const lineStart = this.#lineStart(entry.edit);
			const rowCount = Math.max(
				this.#lineCount(entry.edit.removed),
				this.#lineCount(entry.edit.inserted)
			);

			if (!Number.isInteger(lineStart) || rowCount === 0) {
				continue;
			}

			largest = Math.max(
				largest,
				this.#coordinate(lineStart + rowCount - 1)
			);
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
