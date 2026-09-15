export default class Diff {
	format(session, file, edit, peers = [], notes = []) {
		const sections = [
			this.#formatEdit('YOU', session, file, edit)
		];

		for (const peer of peers) {
			sections.push(
				this.#formatEdit(
					'PEER',
					peer.session,
					peer.edit.path,
					peer.edit
				)
			);
		}

		for (const peer of notes) {
			sections.push(
				'[PEER NOTE · ' +
				peer.session.id +
				' · ' +
				peer.session.description +
				']\n' +
				peer.note.path +
				' · lines ' +
				peer.note.lineStart +
				':' +
				peer.note.lineEnd +
				'\n' +
				peer.note.message
			);
		}

		return sections.join('\n\n') + '\n';
	}

	#formatEdit(kind, session, file, edit) {
		const shift = edit.shift === 0
			? ''
			: ' · shifted ' + (edit.shift > 0 ? '+' : '') + edit.shift;
		const location =
			kind === 'PEER' && Number.isInteger(edit.lineStart)
				? 'lines ' + edit.lineStart + ':' + edit.lineEnd
				: edit.mode + ' ' + edit.appliedStart + ':' + edit.appliedEnd + shift;
		const removed = this.#prefix('-', edit.removed);
		const inserted = this.#prefix('+', edit.inserted);

		return [
			'[' + kind + ' · ' + session.id + ' · ' + session.description + ']',
			file + ' · ' + location,
			'@@',
			removed,
			inserted
		].filter(Boolean).join('\n');
	}

	formatSession(session, edits) {
		const active = edits.filter(edit => (edit.status || 'active') === 'active');
		const stale = edits.filter(edit => edit.status === 'stale');
		const sections = active.map(edit =>
			this.format(session, edit.path, edit).trimEnd()
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

	#prefix(prefix, text) {
		if (text === '') {
			return '';
		}

		return text
			.split(/\r?\n/)
			.map(line => prefix + line)
			.join('\n');
	}
}
