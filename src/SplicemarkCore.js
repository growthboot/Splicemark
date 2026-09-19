import Reconciler from './Reconciler.js';
import PeerRegistry from './PeerRegistry.js';
import { normalizeNewActorType } from './ActorType.js';
import WorkingTreeAttribution from './WorkingTreeAttribution.js';

export default class SplicemarkCore {
	#git;
	#store;
	#storeFactory;
	#workspace;

	constructor({
		git,
		store = null,
		storeFactory = null,
		workspace
	} = {}) {
		if (!git) {
			throw new Error('git adapter is required');
		}

		if (!workspace) {
			throw new Error('workspace adapter is required');
		}

		if (!store && !storeFactory) {
			throw new Error('session store is required');
		}

		this.#git = git;
		this.#store = store;
		this.#storeFactory =
			storeFactory;
		this.#workspace = workspace;
	}

	start(
		description,
		{
			actorType = 'agent'
		} = {}
	) {
		const normalized =
			description.trim();

		if (!normalized) {
			throw new Error('task description is required');
		}

		return this.#getStore()
			.start(
				normalized,
				this.#git.getHead(),
				normalizeNewActorType(actorType)
			);
	}

	edit(sessionId, file, options) {
		const target =
			this.#resolve(file, 'edit');
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

		const edit =
			this.#workspace.edit(
				target.file,
				options
			);
		const head = this.#git.getHead();
		const registry =
			new PeerRegistry(store);
		const peers = registry.find(
			sessionId,
			target.relative,
			head
		);
		const notes = registry.findNotes(
			sessionId,
			target.relative,
			edit.targetLineStart,
			edit.targetLineEnd,
			head
		);

		registry.shift(
			target.relative,
			edit.targetLineStart,
			edit.targetLineEnd,
			edit.lineDelta,
			head
		);

		return {
			session,
			file: target.relative,
			peers,
			notes,
			edit: store.recordEdit(sessionId, {
				path: target.relative,
				head,
				locationStatus: 'current',
				...edit
			})
		};
	}

	batch(sessionId, file, options) {
		const target =
			this.#resolve(file, 'batch');
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
		const registry =
			new PeerRegistry(store);
		const results = [];

		for (
			const edit of this.#workspace.batch(
				target.file,
				options
			)
		) {
			const peers = registry.find(
				sessionId,
				target.relative,
				head
			);
			const notes = registry.findNotes(
				sessionId,
				target.relative,
				edit.targetLineStart,
				edit.targetLineEnd,
				head
			);

			registry.shift(
				target.relative,
				edit.targetLineStart,
				edit.targetLineEnd,
				edit.lineDelta,
				head
			);

			results.push({
				peers,
				notes,
				edit: store.recordEdit(sessionId, {
					path: target.relative,
					head,
					locationStatus: 'current',
					...edit
				})
			});
		}

		return {
			session,
			file: target.relative,
			results
		};
	}

	note(sessionId, file, options) {
		const target =
			this.#resolve(file, 'note');
		const store = this.#getStore();
		const session =
			this.#reconcile(sessionId, store);

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

		const message =
			options.message.trim();

		if (!message) {
			throw new Error('note message is required');
		}

		const content =
			this.#workspace.read(target.file);
		let lineStart;
		let lineEnd;

		if (options.mode === 'lines') {
			const lines =
				content.split(/\r?\n/);

			if (options.end >= lines.length) {
				throw new Error('note line range is outside the file');
			}

			lineStart = options.start;
			lineEnd = options.end;
		} else if (options.mode === 'chars') {
			if (options.end >= content.length) {
				throw new Error('note character range is outside the file');
			}

			lineStart =
				(
					content
						.slice(0, options.start)
						.match(/\n/g) || []
				).length;
			lineEnd =
				(
					content
						.slice(0, options.end)
						.match(/\n/g) || []
				).length;
		} else {
			throw new Error('note mode must be lines or chars');
		}

		return {
			session,
			file: target.relative,
			note: store.recordNote(sessionId, {
				path: target.relative,
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
		return this.#getStore()
			.clean(this.#git.getHead());
	}

	diff(sessionId, { includeSources = false } = {}) {
		const store = this.#getStore();

		for (const active of store.listSessions()) {
			if (active.status === 'active') {
				this.#reconcile(active.id, store);
			}
		}

		const session =
			this.#reconcile(sessionId, store);
		const edits =
			store.listEdits(sessionId);
		const activeFiles =
			new Set(
				edits
					.filter(edit => (edit.status || 'active') === 'active')
					.map(edit => edit.path)
			);
		const registry =
			new PeerRegistry(store);
		const head =
			this.#git.getHead();
		const peers = [];

		for (const file of activeFiles) {
			peers.push(
				...registry.find(
					sessionId,
					file,
					head
				)
			);
		}

		const sources = {};
		const unattributed = [];
		const locations =
			new Map();
		const analyzedFiles =
			new Set();
		const attributed =
			new Set();
		const attribution =
			new WorkingTreeAttribution();

		for (const file of activeFiles) {
			const target =
				this.#resolve(file, 'diff');
			const source =
				this.#workspace.read(target.file);
			const base =
				this.#git.getHeadContent(file);

			if (typeof base === 'string') {
				analyzedFiles.add(file);

				const analysis =
					attribution.analyze(
						file,
						base,
						source,
						[
							...edits
								.filter(edit =>
									(edit.status || 'active') === 'active' &&
									edit.path === file
								)
								.map(edit => ({
									session,
									edit
								})),
							...peers
								.filter(peer =>
									peer.edit.path === file
								)
						]
					);

				unattributed.push(
					...analysis.unattributed
				);

				for (const key of analysis.attributed) {
					attributed.add(key);
				}

				for (
					const [key, location]
					of analysis.locations
				) {
					locations.set(
						key,
						location
					);
				}
			}

			if (includeSources) {
				sources[file] =
					source;
			}
		}

		const locatedEdits =
			edits.map(edit =>
				this.#withAttributionLocation(
					session.id,
					edit,
					locations,
					analyzedFiles,
					attributed
				)
			);
		const locatedPeers =
			peers
				.filter(peer => {
					if (
						!analyzedFiles.has(
							peer.edit.path
						)
					) {
						return true;
					}

					return attributed.has(
						peer.session.id +
							'\u0000' +
							peer.edit.id
					);
				})
				.map(peer => ({
					...peer,
					edit:
						this.#withAttributionLocation(
							peer.session.id,
							peer.edit,
							locations,
							analyzedFiles,
							attributed
						)
				}));

		return {
			session,
			edits: locatedEdits,
			peers: locatedPeers,
			unattributed,
			...(includeSources ? { sources } : {})
		};
	}

	#withAttributionLocation(
		sessionId,
		edit,
		locations,
		analyzedFiles,
		attributed
	) {
		const key =
			sessionId +
			'\u0000' +
			edit.id;
		const analyzed =
			analyzedFiles.has(edit.path);

		if (
			(edit.status || 'active') === 'active' &&
			analyzed &&
			!attributed.has(key)
		) {
			return {
				...edit,
				status: 'stale',
				attributionStatus:
					'unmapped-working-tree'
			};
		}

		const location =
			locations.get(key);

		if (!location) {
			return edit;
		}

		const newCount =
			edit.inserted === ''
				? 0
				: edit.inserted
					.split(/\r?\n/)
					.length;

		return {
			...edit,
			...location,
			lineStart:
				location.newLineStart,
			lineEnd:
				location.newLineStart +
				Math.max(newCount, 1) -
				1
		};
	}

	#resolve(file, action) {
		try {
			return this.#workspace.resolve(
				file,
				this.#git.getRoot()
			);
		} catch (error) {
			if (error?.code === 'OUTSIDE_REPOSITORY') {
				throw new Error(
					action +
					' target must be inside the repository'
				);
			}

			throw error;
		}
	}

	#reconcile(sessionId, store) {
		let session = store.get(sessionId);
		const currentHead =
			this.#git.getHead();

		if (
			!session.head ||
			!currentHead ||
			session.head === currentHead
		) {
			return session;
		}

		const reconciler =
			new Reconciler();

		for (const edit of store.listEdits(sessionId)) {
			if (
				(edit.status || 'active') !== 'active' ||
				edit.head === currentHead
			) {
				continue;
			}

			const status = reconciler.classify(
				edit,
				this.#git.getCommittedDiff(
					edit.head,
					currentHead,
					edit.path
				),
				this.#git.getWorkingDiff(edit.path)
			);

			store.updateEditStatus(
				sessionId,
				edit.id,
				status,
				currentHead
			);
		}

		session =
			store.updateHead(
				sessionId,
				currentHead
			);

		return session;
	}

	#getStore() {
		if (this.#store) {
			return this.#store;
		}

		return this.#storeFactory();
	}
}
