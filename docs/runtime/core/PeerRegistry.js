export default class PeerRegistry {
	#store;

	constructor(store) {
		this.#store = store;
	}

	find(sessionId, path, start, end, head) {
		const peers = [];

		for (const session of this.#store.listSessions()) {
			if (session.id === sessionId || session.status !== 'active') {
				continue;
			}

			for (const edit of this.#store.listEdits(session.id)) {
				if (
					(edit.status || 'active') !== 'active' ||
					edit.path !== path ||
					edit.locationStatus === 'overlapped' ||
					!this.#belongsToHead(edit, head) ||
					!Number.isInteger(edit.lineStart) ||
					!Number.isInteger(edit.lineEnd) ||
					edit.lineEnd < start ||
					edit.lineStart > end
				) {
					continue;
				}

				peers.push({
					session,
					edit
				});
			}
		}

		return peers;
	}

	findNotes(sessionId, path, start, end, head) {
		const notes = [];

		for (const session of this.#store.listSessions()) {
			if (session.id === sessionId || session.status !== 'active') {
				continue;
			}

			for (const note of this.#store.listNotes(session.id)) {
				if (
					(note.status || 'active') !== 'active' ||
					note.head !== head ||
					note.path !== path ||
					note.lineEnd < start ||
					note.lineStart > end
				) {
					continue;
				}

				notes.push({
					session,
					note
				});
			}
		}

		return notes;
	}

	shift(path, start, end, delta, head) {
		for (const session of this.#store.listSessions()) {
			if (session.status !== 'active') {
				continue;
			}

			for (const edit of this.#store.listEdits(session.id)) {
				if (
					(edit.status || 'active') !== 'active' ||
					edit.path !== path ||
					edit.locationStatus === 'overlapped' ||
					!this.#belongsToHead(edit, head) ||
					!Number.isInteger(edit.lineStart) ||
					!Number.isInteger(edit.lineEnd) ||
					edit.lineEnd < start
				) {
					continue;
				}

				if (edit.lineStart > end) {
					this.#store.updateEditLocation(
						session.id,
						edit.id,
						edit.lineStart + delta,
						edit.lineEnd + delta,
						'current'
					);
					continue;
				}

				this.#store.updateEditLocation(
					session.id,
					edit.id,
					edit.lineStart,
					edit.lineEnd,
					'overlapped'
				);
			}

			for (const note of this.#store.listNotes(session.id)) {
				if (
					(note.status || 'active') !== 'active' ||
					note.head !== head ||
					note.path !== path ||
					note.lineStart <= end
				) {
					continue;
				}

				this.#store.updateNoteLocation(
					session.id,
					note.id,
					note.lineStart + delta,
					note.lineEnd + delta
				);
			}
		}
	}

	#belongsToHead(edit, head) {
		return edit.head === head || edit.reconciledHead === head;
	}
}
