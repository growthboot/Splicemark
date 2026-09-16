export default class MemorySessionStore {
	#sessions = [];
	#edits = new Map();
	#notes = new Map();
	#nextSession = 1;
	#nextEdit = 1;
	#nextNote = 1;

	start(description, head = 'demo-head') {
		const session = {
			version: 1,
			id:
				'sm-demo-' +
				String(
					this.#nextSession++
				).padStart(2, '0'),
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
			throw new Error(
				'unknown session: ' + id
			);
		}

		return {
			...session
		};
	}

	listSessions() {
		return this.#sessions.map(
			session => ({
				...session
			})
		);
	}

	recordEdit(id, edit) {
		const session = this.get(id);

		if (session.status !== 'active') {
			throw new Error(
				'session is not active: ' + id
			);
		}

		const record = {
			version: 1,
			id:
				'edit-demo-' +
				String(
					this.#nextEdit++
				).padStart(2, '0'),
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

	updateEditLocation(
		id,
		editId,
		lineStart,
		lineEnd,
		locationStatus
	) {
		const edit = this.#findEdit(
			id,
			editId
		);

		edit.lineStart = lineStart;
		edit.lineEnd = lineEnd;
		edit.locationStatus =
			locationStatus;

		return {
			...edit
		};
	}

	updateEditStatus(
		id,
		editId,
		status,
		head
	) {
		const edit = this.#findEdit(
			id,
			editId
		);

		edit.status = status;
		edit.reconciledHead = head;

		return {
			...edit
		};
	}

	recordNote(id, note) {
		const session = this.get(id);

		if (session.status !== 'active') {
			throw new Error(
				'session is not active: ' + id
			);
		}

		const record = {
			version: 1,
			id:
				'note-demo-' +
				String(
					this.#nextNote++
				).padStart(2, '0'),
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
		const note = this.#findNote(
			id,
			noteId
		);

		note.lineStart = lineStart;
		note.lineEnd = lineEnd;

		return {
			...note
		};
	}

	#findEdit(id, editId) {
		this.get(id);

		const edit =
			this.#edits
				.get(id)
				.find(
					item =>
						item.id === editId
				);

		if (!edit) {
			throw new Error(
				'unknown edit: ' + editId
			);
		}

		return edit;
	}

	#findNote(id, noteId) {
		this.get(id);

		const note =
			this.#notes
				.get(id)
				.find(
					item =>
						item.id === noteId
				);

		if (!note) {
			throw new Error(
				'unknown note: ' + noteId
			);
		}

		return note;
	}
}
