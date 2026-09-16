import MemorySessionStore from './MemorySessionStore.js';

export default class LiveDemo {
	#sourceLoader;

	constructor({
		sourceLoader = null
	} = {}) {
		this.#sourceLoader =
			sourceLoader;
	}

	async run(name) {
		const core = await this.#core();

		if (name === 'edit') {
			return this.#edit(core);
		}

		if (name === 'batch') {
			return this.#batch(core);
		}

		if (name === 'peers') {
			return this.#peers(core);
		}

		if (name === 'notes') {
			return this.#notes(core);
		}

		if (name === 'reconcile') {
			return this.#reconcile(core);
		}

		throw new Error(
			'unknown live demo: ' + name
		);
	}

	async #edit({
		TextEditor,
		Diff
	}) {
		const file =
			'Reconciler.js';
		const original =
			await this.#source(file);
		const target =
			this.#lineOf(
				original,
				'const working = this.#matchCount(workingDiff, edit);'
			);
		const targetLine =
			this.#lineAt(
				original,
				target
			);
		const before =
			[
				'// Concurrent edit one.',
				'// Concurrent edit two.',
				original
			].join('\n');
		const result =
			new TextEditor().edit(
				before,
				{
					mode: 'lines',
					start: target,
					end: target,
					expectedStart:
						targetLine,
					expectedEnd:
						targetLine,
					replacement:
						targetLine +
						' // safely relocated'
				}
			);
		const session = {
			id: 'sm-demo-01',
			description:
				'Annotate working diff lookup'
		};

		return {
			id: 'edit',
			title:
				'Precise edits and relocation',
			file:
				'src/' + file,
			before,
			after: result.content,
			output:
				new Diff().format(
					session,
					'src/' + file,
					result.edit
				),
			focus: [
				result.edit.appliedStart
			],
			facts: [
				[
					'validated at',
					'line ' + target
				],
				[
					'applied at',
					'line ' +
					result.edit.appliedStart
				],
				[
					'relocation',
					'+' +
					result.edit.shift
				]
			]
		};
	}

	async #batch({
		TextEditor,
		Diff
	}) {
		const file =
			'TextEditor.js';
		const before =
			await this.#source(file);
		const upper =
			this.#lineOf(
				before,
				'batch requires at least one splice'
			);
		const lower =
			this.#lineOf(
				before,
				'batch ranges must not overlap'
			);
		const upperLine =
			this.#lineAt(
				before,
				upper
			);
		const lowerLine =
			this.#lineAt(
				before,
				lower
			);
		const result =
			new TextEditor().batch(
				before,
				{
					mode: 'lines',
					splices: [
						{
							start: upper,
							end: upper,
							replacement:
								upperLine +
								'\n' +
								this.#indent(
									upperLine
								) +
								'// Inserted above the lower target.'
						},
						{
							start: lower,
							end: lower,
							replacement:
								lowerLine.replace(
									'batch ranges must not overlap',
									'batch ranges cannot overlap'
								)
						}
					]
				}
			);
		const session = {
			id: 'sm-demo-01',
			description:
				'Clarify batch validation'
		};
		const diff = new Diff();
		const output =
			result.edits
				.map(edit =>
					diff.format(
						session,
						'src/' + file,
						edit
					).trimEnd()
				)
				.join('\n\n') +
			'\n';

		return {
			id: 'batch',
			title:
				'Prevalidated batch writes',
			file:
				'src/' + file,
			before,
			after: result.content,
			output,
			focus:
				result.edits.map(
					edit =>
						edit.lineStart
				),
			facts: [
				[
					'input order',
					upper +
						' → ' +
						lower
				],
				[
					'apply order',
					result.edits
						.map(
							edit =>
								edit.appliedStart
						)
						.join(' → ')
				],
				[
					'physical writes',
					'one'
				]
			]
		};
	}

	async #peers({
		TextEditor,
		PeerRegistry,
		Diff
	}) {
		const file =
			'PeerRegistry.js';
		const path =
			'src/' + file;
		const head =
			'demo-head';
		const store =
			new MemorySessionStore();
		const registry =
			new PeerRegistry(store);
		const editor =
			new TextEditor();
		const first =
			store.start(
				'Document peer return',
				head
			);
		const second =
			store.start(
				'Refine peer return',
				head
			);
		const original =
			await this.#source(file);
		const target =
			this.#lineOf(
				original,
				'return peers;'
			);
		const originalLine =
			this.#lineAt(
				original,
				target
			);
		const firstResult =
			editor.edit(
				original,
				{
					mode: 'lines',
					start: target,
					end: target,
					expectedStart:
						originalLine,
					expectedEnd:
						originalLine,
					replacement:
						this.#indent(
							originalLine
						) +
						'// First session owns this local region.\n' +
						originalLine
				}
			);

		registry.shift(
			path,
			firstResult.edit
				.targetLineStart,
			firstResult.edit
				.targetLineEnd,
			firstResult.edit.lineDelta,
			head
		);

		store.recordEdit(
			first.id,
			{
				path,
				head,
				locationStatus:
					'current',
				...firstResult.edit
			}
		);

		const secondTarget =
			target + 1;
		const secondLine =
			this.#lineAt(
				firstResult.content,
				secondTarget
			);
		const secondResult =
			editor.edit(
				firstResult.content,
				{
					mode: 'lines',
					start:
						secondTarget,
					end:
						secondTarget,
					expectedStart:
						secondLine,
					expectedEnd:
						secondLine,
					replacement:
						secondLine +
						' // second session'
				}
			);
		const peers =
			registry.find(
				second.id,
				path,
				secondResult.edit
					.targetLineStart,
				secondResult.edit
					.targetLineEnd,
				head
			);

		return {
			id: 'peers',
			title:
				'Locally relevant peer edits',
			file: path,
			before:
				firstResult.content,
			after:
				secondResult.content,
			output:
				new Diff().format(
					second,
					path,
					secondResult.edit,
					peers
				),
			focus: [
				secondResult.edit
					.lineStart
			],
			facts: [
				[
					'active sessions',
					'2'
				],
				[
					'peer edits surfaced',
					String(
						peers.length
					)
				],
				[
					'global peer feed',
					'none'
				]
			]
		};
	}

	async #notes({
		TextEditor,
		PeerRegistry,
		Diff
	}) {
		const file =
			'PeerRegistry.js';
		const path =
			'src/' + file;
		const head =
			'demo-head';
		const store =
			new MemorySessionStore();
		const registry =
			new PeerRegistry(store);
		const owner =
			store.start(
				'Protect local note scope',
				head
			);
		const worker =
			store.start(
				'Clarify peer return',
				head
			);
		const before =
			await this.#source(file);
		const target =
			this.#lineOf(
				before,
				'return peers;'
			);
		const targetLine =
			this.#lineAt(
				before,
				target
			);

		store.recordNote(
			owner.id,
			{
				path,
				head,
				mode: 'lines',
				requestedStart:
					target,
				requestedEnd:
					target,
				lineStart: target,
				lineEnd: target,
				message:
					'Keep this return scoped to locally relevant peers.'
			}
		);

		const result =
			new TextEditor().edit(
				before,
				{
					mode: 'lines',
					start: target,
					end: target,
					expectedStart:
						targetLine,
					expectedEnd:
						targetLine,
					replacement:
						targetLine +
						' // preserve local scope'
				}
			);
		const notes =
			registry.findNotes(
				worker.id,
				path,
				result.edit
					.targetLineStart,
				result.edit
					.targetLineEnd,
				head
			);

		return {
			id: 'notes',
			title:
				'Code-bound coordination notes',
			file: path,
			before,
			after: result.content,
			output:
				new Diff().format(
					worker,
					path,
					result.edit,
					[],
					notes
				),
			focus: [
				result.edit.lineStart
			],
			facts: [
				[
					'notes stored',
					'1'
				],
				[
					'notes surfaced',
					String(
						notes.length
					)
				],
				[
					'scope',
					'overlap + HEAD'
				]
			]
		};
	}

	async #reconcile({
		TextEditor,
		Reconciler
	}) {
		const file =
			'Reconciler.js';
		const before =
			await this.#source(file);
		const target =
			this.#lineOf(
				before,
				"return 'active';"
			);
		const targetLine =
			this.#lineAt(
				before,
				target
			);
		const result =
			new TextEditor().edit(
				before,
				{
					mode: 'lines',
					start: target,
					end: target,
					expectedStart:
						targetLine,
					expectedEnd:
						targetLine,
					replacement:
						targetLine +
						' // authored mutation'
				}
			);
		const workingDiff =
			this.#diffFor(
				result.edit
			);
		const committedDiff =
			this.#diffFor(
				result.edit
			);
		const reconciler =
			new Reconciler();
		const active =
			reconciler.classify(
				result.edit,
				'',
				workingDiff
			);
		const retired =
			reconciler.classify(
				result.edit,
				committedDiff,
				''
			);
		const stale =
			reconciler.classify(
				result.edit,
				committedDiff,
				workingDiff
			);

		return {
			id: 'reconcile',
			title:
				'Git HEAD reconciliation',
			file:
				'src/' + file,
			before,
			after: result.content,
			output: [
				'Reconciler.classify(edit, committedDiff, workingDiff)',
				'',
				'working tree only  → ' +
					active,
				'committed only     → ' +
					retired,
				'both match         → ' +
					stale
			].join('\n'),
			focus: [target],
			facts: [
				[
					'working only',
					active
				],
				[
					'committed only',
					retired
				],
				[
					'ambiguous',
					stale
				]
			]
		};
	}

	async #core() {
		const token =
			'?run=' +
			Date.now() +
			'-' +
			Math.random()
				.toString(16)
				.slice(2);
		const [
			textEditor,
			peerRegistry,
			reconciler,
			diff
		] = await Promise.all([
			import(
				'./core/TextEditor.js' +
				token
			),
			import(
				'./core/PeerRegistry.js' +
				token
			),
			import(
				'./core/Reconciler.js' +
				token
			),
			import(
				'./core/Diff.js' +
				token
			)
		]);

		return {
			TextEditor:
				textEditor.default,
			PeerRegistry:
				peerRegistry.default,
			Reconciler:
				reconciler.default,
			Diff:
				diff.default
		};
	}

	async #source(file) {
		if (this.#sourceLoader) {
			return this.#sourceLoader(
				file
			);
		}

		const url =
			new URL(
				'./core/' + file,
				import.meta.url
			);

		url.searchParams.set(
			'source',
			Date.now() +
				'-' +
				Math.random()
					.toString(16)
					.slice(2)
		);

		const response =
			await fetch(
				url,
				{
					cache: 'no-store'
				}
			);

		if (!response.ok) {
			throw new Error(
				'Unable to load current source: ' +
				file
			);
		}

		return response.text();
	}

	#lineOf(
		content,
		fragment
	) {
		const lines =
			content.split('\n');
		const matches = [];

		for (
			let index = 0;
			index < lines.length;
			index++
		) {
			if (
				lines[index].includes(
					fragment
				)
			) {
				matches.push(index);
			}
		}

		if (matches.length !== 1) {
			throw new Error(
				'Expected one current-source match for: ' +
					fragment +
					'; found ' +
					matches.length
			);
		}

		return matches[0];
	}

	#lineAt(
		content,
		index
	) {
		const line =
			content.split('\n')[index];

		if (line === undefined) {
			throw new Error(
				'line outside current source: ' +
					index
			);
		}

		return line;
	}

	#indent(line) {
		return (
			line.match(/^\s*/)?.[0] ||
			''
		);
	}

	#diffFor(edit) {
		const removed =
			edit.removed
				.split(/\r?\n/)
				.map(
					line =>
						'-' + line
				)
				.join('\n');
		const inserted =
			edit.inserted
				.split(/\r?\n/)
				.map(
					line =>
						'+' + line
				)
				.join('\n');

		return [
			'@@',
			removed,
			inserted
		].filter(Boolean).join('\n');
	}
}
