import fs from 'node:fs';
import path from 'node:path';
import Git from './Git.js';
import FileEditor from './FileEditor.js';
import Diff from './Diff.js';
import Reconciler from './Reconciler.js';
import SessionStore from './SessionStore.js';
import PeerRegistry from './PeerRegistry.js';

export default class Splicemark {
	#git;
	#cwd;

	constructor({ cwd = process.cwd() } = {}) {
		this.#git = new Git(cwd);
		this.#cwd = fs.realpathSync(cwd);
	}

	start(description) {
		const normalized = description.trim();

		if (!normalized) {
			throw new Error('task description is required');
		}

		const store = this.#getStore();

		return store.start(normalized, this.#git.getHead());
	}

	edit(sessionId, file, options) {
		const root = this.#git.getRoot();
		const absolute = fs.realpathSync(path.resolve(this.#cwd, file));
		const relative = path.relative(root, absolute);

		if (
			relative === '..' ||
			relative.startsWith('..' + path.sep) ||
			path.isAbsolute(relative)
		) {
			throw new Error('edit target must be inside the repository');
		}

		const store = this.#getStore();

		for (const active of store.listSessions()) {
			if (active.status === 'active') {
				this.#reconcile(active.id, store);
			}
		}

		const session = store.get(sessionId);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + sessionId);
		}

		const edit = new FileEditor().edit(absolute, options);
		const head = this.#git.getHead();
		const registry = new PeerRegistry(store);
		const peers = registry.find(
			sessionId,
			relative,
			edit.targetLineStart,
			edit.targetLineEnd,
			head
		);
		const notes = registry.findNotes(
			sessionId,
			relative,
			edit.targetLineStart,
			edit.targetLineEnd,
			head
		);

		registry.shift(
			relative,
			edit.targetLineStart,
			edit.targetLineEnd,
			edit.lineDelta,
			head
		);

		return {
			session,
			file: relative,
			peers,
			notes,
			edit: store.recordEdit(sessionId, {
				path: relative,
				head,
				locationStatus: 'current',
				...edit
			})
		};
	}

	batch(sessionId, file, options) {
		const root = this.#git.getRoot();
		const absolute = fs.realpathSync(path.resolve(this.#cwd, file));
		const relative = path.relative(root, absolute);

		if (
			relative === '..' ||
			relative.startsWith('..' + path.sep) ||
			path.isAbsolute(relative)
		) {
			throw new Error('batch target must be inside the repository');
		}

		const store = this.#getStore();

		for (const active of store.listSessions()) {
			if (active.status === 'active') {
				this.#reconcile(active.id, store);
			}
		}

		const session = store.get(sessionId);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + sessionId);
		}

		const head = this.#git.getHead();
		const registry = new PeerRegistry(store);
		const results = [];

		for (const edit of new FileEditor().batch(absolute, options)) {
			const peers = registry.find(
				sessionId,
				relative,
				edit.targetLineStart,
				edit.targetLineEnd,
				head
			);
			const notes = registry.findNotes(
				sessionId,
				relative,
				edit.targetLineStart,
				edit.targetLineEnd,
				head
			);

			registry.shift(
				relative,
				edit.targetLineStart,
				edit.targetLineEnd,
				edit.lineDelta,
				head
			);

			results.push({
				peers,
				notes,
				edit: store.recordEdit(sessionId, {
					path: relative,
					head,
					locationStatus: 'current',
					...edit
				})
			});
		}

		return {
			session,
			file: relative,
			results
		};
	}

	note(sessionId, file, options) {
		const root = this.#git.getRoot();
		const absolute = fs.realpathSync(path.resolve(this.#cwd, file));
		const relative = path.relative(root, absolute);

		if (
			relative === '..' ||
			relative.startsWith('..' + path.sep) ||
			path.isAbsolute(relative)
		) {
			throw new Error('note target must be inside the repository');
		}

		const store = this.#getStore();
		const session = this.#reconcile(sessionId, store);

		if (session.status !== 'active') {
			throw new Error('session is not active: ' + sessionId);
		}

		if (
			!Number.isInteger(options.start) ||
			!Number.isInteger(options.end) ||
			options.start < 0 ||
			options.end < options.start
		) {
			throw new Error('range must contain non-negative inclusive indexes');
		}

		const message = options.message.trim();

		if (!message) {
			throw new Error('note message is required');
		}

		const content = fs.readFileSync(absolute, 'utf8');
		let lineStart;
		let lineEnd;

		if (options.mode === 'lines') {
			const lines = content.split(/\r?\n/);

			if (options.end >= lines.length) {
				throw new Error('note line range is outside the file');
			}

			lineStart = options.start;
			lineEnd = options.end;
		} else if (options.mode === 'chars') {
			if (options.end >= content.length) {
				throw new Error('note character range is outside the file');
			}

			lineStart = (content.slice(0, options.start).match(/\n/g) || []).length;
			lineEnd = (content.slice(0, options.end).match(/\n/g) || []).length;
		} else {
			throw new Error('note mode must be lines or chars');
		}

		return {
			session,
			file: relative,
			note: store.recordNote(sessionId, {
				path: relative,
				head: this.#git.getHead(),
				mode: options.mode,
				requestedStart: options.start,
				requestedEnd: options.end,
				lineStart,
				lineEnd,
				message
			})
		};
	}

	finish(sessionId) {
		const store = this.#getStore();
		this.#reconcile(sessionId, store);

		return store.finish(sessionId);
	}

	clean() {
		return this.#getStore().clean(this.#git.getHead());
	}

	diff(sessionId) {
		const store = this.#getStore();
		const session = this.#reconcile(sessionId, store);

		return {
			session,
			edits: store.listEdits(sessionId)
		};
	}

	#reconcile(sessionId, store) {
		let session = store.get(sessionId);
		const currentHead = this.#git.getHead();

		if (!session.head || !currentHead || session.head === currentHead) {
			return session;
		}

		const reconciler = new Reconciler();

		for (const edit of store.listEdits(sessionId)) {
			if ((edit.status || 'active') !== 'active' || edit.head === currentHead) {
				continue;
			}

			const status = reconciler.classify(
				edit,
				this.#git.getCommittedDiff(edit.head, currentHead, edit.path),
				this.#git.getWorkingDiff(edit.path)
			);

			store.updateEditStatus(sessionId, edit.id, status, currentHead);
		}

		session = store.updateHead(sessionId, currentHead);

		return session;
	}

	#getStore() {
		return new SessionStore(
			path.join(this.#git.getCommonDir(), 'splicemark')
		);
	}
}
