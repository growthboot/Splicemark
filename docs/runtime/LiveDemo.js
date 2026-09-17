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
		SplicemarkCore,
		MemoryWorkspace,
		MemorySessionStore,
		MemoryGit,
		Diff
	}) {
		const file =
			'Reconciler.js';
		const path =
			'src/' + file;
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
		const workspace =
			new MemoryWorkspace({
				[path]: before
			});
		const git =
			new MemoryGit({
				workspace
			});
		const splicemark =
			new SplicemarkCore({
				git,
				store:
					new MemorySessionStore(),
				workspace
			});
		const session =
			splicemark.start(
				'Annotate working diff lookup'
			);
		const result =
			splicemark.edit(
				session.id,
				path,
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
		const after =
			workspace.read(path);

		return {
			id: 'edit',
			title:
				'Precise edits and relocation',
			file: result.file,
			before,
			after,
			output:
				new Diff().format(
					result.session,
					result.file,
					result.edit,
					result.peers,
					result.notes
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
		SplicemarkCore,
		MemoryWorkspace,
		MemorySessionStore,
		MemoryGit,
		Diff
	}) {
		const file =
			'TextEditor.js';
		const path =
			'src/' + file;
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
		const workspace =
			new MemoryWorkspace({
				[path]: before
			});
		const git =
			new MemoryGit({
				workspace
			});
		const splicemark =
			new SplicemarkCore({
				git,
				store:
					new MemorySessionStore(),
				workspace
			});
		const session =
			splicemark.start(
				'Clarify batch validation'
			);
		const result =
			splicemark.batch(
				session.id,
				path,
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
		const after =
			workspace.read(path);
		const diff = new Diff();
		const output =
			result.results
				.map(item =>
					diff.format(
						result.session,
						result.file,
						item.edit,
						item.peers,
						item.notes
					).trimEnd()
				)
				.join('\n\n') +
			'\n';

		return {
			id: 'batch',
			title:
				'Prevalidated batch writes',
			file: result.file,
			before,
			after,
			output,
			focus:
				result.results.map(
					item =>
						item.edit.lineStart
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
					result.results
						.map(
							item =>
								item.edit.appliedStart
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
		SplicemarkCore,
		MemoryWorkspace,
		MemorySessionStore,
		MemoryGit,
		Diff
	}) {
		const file =
			'PeerRegistry.js';
		const path =
			'src/' + file;
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
		const workspace =
			new MemoryWorkspace({
				[path]: original
			});
		const git =
			new MemoryGit({
				workspace,
				head: 'demo-head'
			});
		const splicemark =
			new SplicemarkCore({
				git,
				store:
					new MemorySessionStore(),
				workspace
			});
		const first =
			splicemark.start(
				'Document peer return'
			);
		const second =
			splicemark.start(
				'Refine peer return'
			);

		splicemark.edit(
			first.id,
			path,
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

		const before =
			workspace.read(path);
		const secondTarget =
			target + 1;
		const secondLine =
			this.#lineAt(
				before,
				secondTarget
			);
		const result =
			splicemark.edit(
				second.id,
				path,
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
		const after =
			workspace.read(path);

		return {
			id: 'peers',
			title:
				'Locally relevant peer edits',
			file: result.file,
			before,
			after,
			output:
				new Diff().format(
					result.session,
					result.file,
					result.edit,
					result.peers,
					result.notes
				),
			focus: [
				result.edit.lineStart
			],
			facts: [
				[
					'active sessions',
					'2'
				],
				[
					'peer edits surfaced',
					String(
						result.peers.length
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
		SplicemarkCore,
		MemoryWorkspace,
		MemorySessionStore,
		MemoryGit,
		Diff
	}) {
		const file =
			'PeerRegistry.js';
		const path =
			'src/' + file;
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
		const workspace =
			new MemoryWorkspace({
				[path]: before
			});
		const git =
			new MemoryGit({
				workspace,
				head: 'demo-head'
			});
		const splicemark =
			new SplicemarkCore({
				git,
				store:
					new MemorySessionStore(),
				workspace
			});
		const owner =
			splicemark.start(
				'Protect local note scope'
			);
		const worker =
			splicemark.start(
				'Clarify peer return'
			);

		splicemark.note(
			owner.id,
			path,
			{
				mode: 'lines',
				start: target,
				end: target,
				message:
					'Keep this return scoped to locally relevant peers.'
			}
		);

		const result =
			splicemark.edit(
				worker.id,
				path,
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
		const after =
			workspace.read(path);

		return {
			id: 'notes',
			title:
				'Code-bound coordination notes',
			file: result.file,
			before,
			after,
			output:
				new Diff().format(
					result.session,
					result.file,
					result.edit,
					result.peers,
					result.notes
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
						result.notes.length
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
		SplicemarkCore,
		MemoryWorkspace,
		MemorySessionStore,
		MemoryGit
	}) {
		const file =
			'Reconciler.js';
		const path =
			'src/' + file;
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
		const runtime = () => {
			const workspace =
				new MemoryWorkspace({
					[path]: before
				});
			const git =
				new MemoryGit({
					workspace,
					head: 'demo-head'
				});
			const splicemark =
				new SplicemarkCore({
					git,
					store:
						new MemorySessionStore(),
					workspace
				});
			const session =
				splicemark.start(
					'Track authored mutation'
				);

			splicemark.edit(
				session.id,
				path,
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

			return {
				workspace,
				git,
				splicemark,
				session
			};
		};

		const activeRuntime = runtime();

		activeRuntime.workspace.write(
			'other.txt',
			'other\n'
		);
		activeRuntime.git.commit({
			files: [
				'other.txt'
			]
		});

		const active =
			activeRuntime.splicemark
				.diff(
					activeRuntime.session.id
				)
				.edits[0]
				.status;
		const after =
			activeRuntime.workspace.read(path);

		const retiredRuntime = runtime();

		retiredRuntime.git.commit();

		const retired =
			retiredRuntime.splicemark
				.diff(
					retiredRuntime.session.id
				)
				.edits[0]
				.status;

		const staleRuntime = runtime();

		staleRuntime.workspace.write(
			path,
			before
		);
		staleRuntime.workspace.write(
			'other.txt',
			'other\n'
		);
		staleRuntime.git.commit({
			files: [
				'other.txt'
			]
		});

		const stale =
			staleRuntime.splicemark
				.diff(
					staleRuntime.session.id
				)
				.edits[0]
				.status;

		return {
			id: 'reconcile',
			title:
				'Git HEAD reconciliation',
			file: path,
			before,
			after,
			output: [
				'SplicemarkCore.diff(sessionId)',
				'',
				'unrelated commit    → ' +
					active,
				'authored commit     → ' +
					retired,
				'reverted + new HEAD → ' +
					stale
			].join('\n'),
			focus: [target],
			facts: [
				[
					'unrelated commit',
					active
				],
				[
					'authored commit',
					retired
				],
				[
					'reverted before HEAD',
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
			splicemarkCore,
			memoryWorkspace,
			memorySessionStore,
			memoryGit,
			diff
		] = await Promise.all([
			import(
				'./core/SplicemarkCore.js' +
					token
			),
			import(
				'./core/MemoryWorkspace.js' +
					token
			),
			import(
				'./core/MemorySessionStore.js' +
					token
			),
			import(
				'./core/MemoryGit.js' +
					token
			),
			import(
				'./core/Diff.js' +
					token
			)
		]);

		return {
			SplicemarkCore:
				splicemarkCore.default,
			MemoryWorkspace:
				memoryWorkspace.default,
			MemorySessionStore:
				memorySessionStore.default,
			MemoryGit:
				memoryGit.default,
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

}
