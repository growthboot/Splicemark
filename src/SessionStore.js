import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export default class SessionStore {
	#root;

	constructor(root) {
		this.#root = root;
	}

	start(description, head) {
		const sessions = path.join(this.#root, 'sessions');

		fs.mkdirSync(sessions, { recursive: true });

		for (;;) {
			const id = 'sm-' + randomBytes(4).toString('hex');
			const directory = path.join(sessions, id);

			try {
				fs.mkdirSync(directory);
			} catch (error) {
				if (error.code === 'EEXIST') {
					continue;
				}

				throw error;
			}

			const session = {
				version: 1,
				id,
				description,
				status: 'active',
				head,
				startedAt: new Date().toISOString()
			};

			fs.writeFileSync(
				path.join(directory, 'meta.json'),
				JSON.stringify(session, null, '\t') + '\n'
			);

			return session;
		}
	}

	get(id) {
		const file = path.join(this.#root, 'sessions', id, 'meta.json');

		if (!fs.existsSync(file)) {
			throw new Error('unknown session: ' + id);
		}

		return JSON.parse(fs.readFileSync(file, 'utf8'));
	}

	recordEdit(id, edit) {
		const session = this.get(id);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + id);
		}

		const edits = path.join(this.#root, 'sessions', id, 'edits');
		fs.mkdirSync(edits, { recursive: true });

		for (;;) {
			const editId = 'edit-' + Date.now().toString(36) + '-' + randomBytes(3).toString('hex');
			const file = path.join(edits, editId + '.json');
			const record = {
				version: 1,
				id: editId,
				createdAt: new Date().toISOString(),
				...edit,
				status: 'active'
			};

			try {
				fs.writeFileSync(file, JSON.stringify(record, null, '\t') + '\n', {
					flag: 'wx'
				});
				return record;
			} catch (error) {
				if (error.code === 'EEXIST') {
					continue;
				}

				throw error;
			}
		}
	}

	listEdits(id) {
		this.get(id);

		const directory = path.join(this.#root, 'sessions', id, 'edits');

		if (!fs.existsSync(directory)) {
			return [];
		}

		return fs.readdirSync(directory)
			.filter(file => file.endsWith('.json'))
			.sort()
			.map(file => JSON.parse(
				fs.readFileSync(path.join(directory, file), 'utf8')
			));
	}

	updateEditStatus(id, editId, status, head) {
		const file = path.join(
			this.#root,
			'sessions',
			id,
			'edits',
			editId + '.json'
		);

		if (!fs.existsSync(file)) {
			throw new Error('unknown edit: ' + editId);
		}

		const edit = JSON.parse(fs.readFileSync(file, 'utf8'));
		edit.status = status;
		edit.reconciledHead = head;

		fs.writeFileSync(file, JSON.stringify(edit, null, '\t') + '\n');

		return edit;
	}

	updateHead(id, head) {
		const file = path.join(this.#root, 'sessions', id, 'meta.json');
		const session = this.get(id);

		session.head = head;
		fs.writeFileSync(file, JSON.stringify(session, null, '\t') + '\n');

		return session;
	}

	listSessions() {
		const directory = path.join(this.#root, 'sessions');

		if (!fs.existsSync(directory)) {
			return [];
		}

		return fs.readdirSync(directory)
			.sort()
			.map(id => path.join(directory, id, 'meta.json'))
			.filter(file => fs.existsSync(file))
			.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
	}

	updateEditLocation(id, editId, lineStart, lineEnd, locationStatus) {
		const file = path.join(
			this.#root,
			'sessions',
			id,
			'edits',
			editId + '.json'
		);

		if (!fs.existsSync(file)) {
			throw new Error('unknown edit: ' + editId);
		}

		const edit = JSON.parse(fs.readFileSync(file, 'utf8'));
		edit.lineStart = lineStart;
		edit.lineEnd = lineEnd;
		edit.locationStatus = locationStatus;

		fs.writeFileSync(file, JSON.stringify(edit, null, '\t') + '\n');

		return edit;
	}

	recordNote(id, note) {
		const session = this.get(id);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + id);
		}

		const notes = path.join(this.#root, 'sessions', id, 'notes');
		fs.mkdirSync(notes, { recursive: true });

		for (;;) {
			const noteId = 'note-' + Date.now().toString(36) + '-' + randomBytes(3).toString('hex');
			const file = path.join(notes, noteId + '.json');
			const record = {
				version: 1,
				id: noteId,
				createdAt: new Date().toISOString(),
				...note,
				status: 'active'
			};

			try {
				fs.writeFileSync(file, JSON.stringify(record, null, '\t') + '\n', {
					flag: 'wx'
				});
				return record;
			} catch (error) {
				if (error.code === 'EEXIST') {
					continue;
				}

				throw error;
			}
		}
	}

	listNotes(id) {
		this.get(id);

		const directory = path.join(this.#root, 'sessions', id, 'notes');

		if (!fs.existsSync(directory)) {
			return [];
		}

		return fs.readdirSync(directory)
			.filter(file => file.endsWith('.json'))
			.sort()
			.map(file => JSON.parse(
				fs.readFileSync(path.join(directory, file), 'utf8')
			));
	}

	updateNoteLocation(id, noteId, lineStart, lineEnd) {
		const file = path.join(
			this.#root,
			'sessions',
			id,
			'notes',
			noteId + '.json'
		);

		if (!fs.existsSync(file)) {
			throw new Error('unknown note: ' + noteId);
		}

		const note = JSON.parse(fs.readFileSync(file, 'utf8'));
		note.lineStart = lineStart;
		note.lineEnd = lineEnd;

		fs.writeFileSync(file, JSON.stringify(note, null, '\t') + '\n');

		return note;
	}

	finish(id) {
		const file = path.join(this.#root, 'sessions', id, 'meta.json');
		const session = this.get(id);

		if (session.status === 'finished') {
			return session;
		}

		session.status = 'finished';
		session.finishedAt = new Date().toISOString();
		fs.writeFileSync(file, JSON.stringify(session, null, '\t') + '\n');

		return session;
	}

	clean(currentHead) {
		const result = {
			sessions: 0,
			notes: 0,
			edits: 0
		};
		const sessions = path.join(this.#root, 'sessions');

		if (!fs.existsSync(sessions)) {
			return result;
		}

		for (const id of fs.readdirSync(sessions)) {
			const directory = path.join(sessions, id);
			const meta = path.join(directory, 'meta.json');

			if (!fs.existsSync(meta)) {
				continue;
			}

			const session = JSON.parse(fs.readFileSync(meta, 'utf8'));

			if (session.status !== 'active') {
				fs.rmSync(directory, { recursive: true, force: true });
				result.sessions++;
				continue;
			}

			const notes = path.join(directory, 'notes');

			if (fs.existsSync(notes)) {
				for (const name of fs.readdirSync(notes)) {
					if (!name.endsWith('.json')) {
						continue;
					}

					const file = path.join(notes, name);
					const note = JSON.parse(fs.readFileSync(file, 'utf8'));

					if (note.head !== currentHead) {
						fs.rmSync(file);
						result.notes++;
					}
				}
			}

			const edits = path.join(directory, 'edits');

			if (fs.existsSync(edits)) {
				for (const name of fs.readdirSync(edits)) {
					if (!name.endsWith('.json')) {
						continue;
					}

					const file = path.join(edits, name);
					const edit = JSON.parse(fs.readFileSync(file, 'utf8'));

					if (edit.status === 'retired') {
						fs.rmSync(file);
						result.edits++;
					}
				}
			}
		}

		return result;
	}
}
