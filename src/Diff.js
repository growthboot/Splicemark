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
		const lineStart =
			Number.isInteger(edit.lineStart)
				? edit.lineStart
				: edit.appliedStart;
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
				? '@@ -' + (lineStart + 1) + ',' + oldCount +
					' +' + (lineStart + 1) + ',' + newCount + ' @@' + shift
				: '@@';
		const removed = this.#prefix('-', edit.removed);
		const inserted = this.#prefix('+', edit.inserted);

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
		const sections = [];

		for (const file of files) {
			for (const edit of active.filter(item => item.path === file)) {
				sections.push(
					this.#formatEdit('YOU', session, file, edit)
				);
			}

			for (const peer of peers.filter(item => item.edit.path === file)) {
				sections.push(
					this.#formatEdit(
						'PEER',
						peer.session,
						peer.edit.path,
						peer.edit
					)
				);
			}
		}

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
