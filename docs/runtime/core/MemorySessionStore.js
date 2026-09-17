export default class MemorySessionStore {
	#edits = new Map();
	#notes = new Map();
	#sessions = [];

	start(description, head) {
		const session = {
			version: 1,
			id: this.#uniqueSessionId(),
			description,
			status: 'active',
			head,
			startedAt:
				new Date().toISOString()
		};

		this.#sessions.push(session);
		this.#edits.set(session.id, []);
		this.#notes.set(session.id, []);

		return {
			...session
		};
	}

	get(id) {
		const session =
			this.#sessions.find(
				item => item.id === id
			);

		if (!session) {
			throw new Error('unknown session: ' + id);
		}

		return {
			...session
		};
	}

	recordEdit(id, edit) {
		const session = this.get(id);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + id);
		}

		const record = {
			version: 1,
			id:
				'edit-' +
				Date.now().toString(36) +
				'-' +
				this.#hex(3),
			createdAt:
				new Date().toISOString(),
			...edit,
			status: 'active'
		};

		this.#edits.get(id).push(record);

		return {
			...record
		};
	}

	listEdits(id) {
		this.get(id);

		return this.#edits
			.get(id)
			.map(edit => ({
				...edit
			}));
	}

	updateEditStatus(id, editId, status, head) {
		const edit =
			this.#findEdit(id, editId);

		edit.status = status;
		edit.reconciledHead = head;

		return {
			...edit
		};
	}

	updateHead(id, head) {
		const session =
			this.#findSession(id);

		session.head = head;

		return {
			...session
		};
	}

	listSessions() {
		return this.#sessions
			.map(session => ({
				...session
			}));
	}

	updateEditLocation(
		id,
		editId,
		lineStart,
		lineEnd,
		locationStatus
	) {
		const edit =
			this.#findEdit(id, editId);

		edit.lineStart = lineStart;
		edit.lineEnd = lineEnd;
		edit.locationStatus =
			locationStatus;

		return {
			...edit
		};
	}

	recordNote(id, note) {
		const session = this.get(id);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + id);
		}

		const record = {
			version: 1,
			id:
				'note-' +
				Date.now().toString(36) +
				'-' +
				this.#hex(3),
			createdAt:
				new Date().toISOString(),
			...note,
			status: 'active'
		};

		this.#notes.get(id).push(record);

		return {
			...record
		};
	}

	listNotes(id) {
		this.get(id);

		return this.#notes
			.get(id)
			.map(note => ({
				...note
			}));
	}

	updateNoteLocation(
		id,
		noteId,
		lineStart,
		lineEnd
	) {
		const note =
			this.#findNote(id, noteId);

		note.lineStart = lineStart;
		note.lineEnd = lineEnd;

		return {
			...note
		};
	}

	finish(id) {
		const session =
			this.#findSession(id);

		if (session.status === 'finished') {
			return {
				...session
			};
		}

		session.status = 'finished';
		session.finishedAt =
			new Date().toISOString();

		return {
			...session
		};
	}

	clean(currentHead) {
		const result = {
			sessions: 0,
			notes: 0,
			edits: 0
		};
		const active = [];

		for (const session of this.#sessions) {
			if (session.status !== 'active') {
				this.#edits.delete(session.id);
				this.#notes.delete(session.id);
				result.sessions++;
				continue;
			}

			const notes =
				this.#notes.get(session.id) || [];
			const nextNotes =
				notes.filter(note => {
					if (note.head !== currentHead) {
						result.notes++;
						return false;
					}

					return true;
				});
			const edits =
				this.#edits.get(session.id) || [];
			const nextEdits =
				edits.filter(edit => {
					if (edit.status === 'retired') {
						result.edits++;
						return false;
					}

					return true;
				});

			this.#notes.set(session.id, nextNotes);
			this.#edits.set(session.id, nextEdits);
			active.push(session);
		}

		this.#sessions = active;

		return result;
	}

	#findSession(id) {
		const session =
			this.#sessions.find(
				item => item.id === id
			);

		if (!session) {
			throw new Error('unknown session: ' + id);
		}

		return session;
	}

	#findEdit(id, editId) {
		this.get(id);

		const edit =
			this.#edits
				.get(id)
				.find(
					item => item.id === editId
				);

		if (!edit) {
			throw new Error('unknown edit: ' + editId);
		}

		return edit;
	}

	#findNote(id, noteId) {
		this.get(id);

		const note =
			this.#notes
				.get(id)
				.find(
					item => item.id === noteId
				);

		if (!note) {
			throw new Error('unknown note: ' + noteId);
		}

		return note;
	}

	#uniqueSessionId() {
		for (;;) {
			const id = 'sm-' + this.#hex(4);

			if (
				!this.#sessions.some(
					session => session.id === id
				)
			) {
				return id;
			}
		}
	}

	#hex(byteCount) {
		const bytes =
			new Uint8Array(byteCount);

		if (globalThis.crypto?.getRandomValues) {
			globalThis.crypto.getRandomValues(bytes);
		} else {
			for (
				let index = 0;
				index < bytes.length;
				index++
			) {
				bytes[index] =
					Math.floor(Math.random() * 256);
			}
		}

		return [...bytes]
			.map(byte =>
				byte.toString(16).padStart(2, '0')
			)
			.join('');
	}
}
