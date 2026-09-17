import LiveDemo from '../runtime/LiveDemo.js';

const stylesheet = new URL(
	'./splicemark-live-example.css',
	import.meta.url
).href;

class SplicemarkLiveExample extends HTMLElement {
	#root;
	#running = false;
	#result = null;
	#error = '';

	constructor() {
		super();

		this.#root = this.attachShadow({
			mode: 'open'
		});
	}

	connectedCallback() {
		this.#render();
		this.#run();
	}

	async #run() {
		if (this.#running) {
			return;
		}

		this.#running = true;
		this.#error = '';
		this.#render();

		try {
			this.#result =
				await new LiveDemo().run(
					this.getAttribute('scenario')
				);
		} catch (error) {
			this.#error =
				error instanceof Error
					? error.message
					: String(error);
		} finally {
			this.#running = false;
			this.#render();
		}
	}

	#render() {
		this.#root.innerHTML = `
			<link rel="stylesheet" href="${stylesheet}">

			<div class="example">
				<div class="example-head">
					<div class="live-label">
						<span></span>
						Live example
					</div>

					<div class="head-right">
						<small>
							current production modules
						</small>

						<button
							type="button"
							${this.#running ? 'disabled' : ''}
						>
							${this.#running ? 'running…' : 'run again'}
						</button>
					</div>
				</div>

				${this.#body()}
			</div>
		`;

		this.#root
			.querySelector('button')
			?.addEventListener(
				'click',
				() => this.#run()
			);
	}

	#body() {
		if (this.#error) {
			return `
				<div class="error">
					${this.#escape(this.#error)}
				</div>
			`;
		}

		if (!this.#result) {
			return `
				<div class="loading">
					Executing current source in the browser…
				</div>
			`;
		}

		return `
			<div class="result-head">
				<div>
					<strong>
						${this.#escape(
							this.#result.title
						)}
					</strong>

					<code>
						${this.#escape(
							this.#result.file
						)}
					</code>
				</div>

				<div class="facts">
					${this.#facts()}
				</div>
			</div>

			<div class="panes">
				<section>
					<header>Relevant source after run</header>

					<div class="source">
						${this.#source()}
					</div>
				</section>

				<section>
					<header>Actual result</header>

					<div class="output">
						${this.#output()}
					</div>
				</section>
			</div>

			<div class="runtime-note">
				Executed through the real
				<code>SplicemarkCore</code>
				using browser-only Git, workspace,
				and session-store adapters.
			</div>
		`;
	}

	#facts() {
		return this.#result.facts
			.map(([key, value]) => `
				<div>
					<span>${this.#escape(key)}</span>
					<strong>${this.#escape(value)}</strong>
				</div>
			`)
			.join('');
	}

	#source() {
		const lines =
			this.#result.after
				.replace(/\n$/, '')
				.split('\n');
		const ranges =
			this.#ranges(
				this.#result.focus || [],
				lines.length
			);
		const parts = [];

		for (
			let rangeIndex = 0;
			rangeIndex < ranges.length;
			rangeIndex++
		) {
			if (rangeIndex > 0) {
				parts.push(
					'<div class="gap">⋯</div>'
				);
			}

			const [start, end] =
				ranges[rangeIndex];

			for (
				let index = start;
				index <= end;
				index++
			) {
				const focus =
					(this.#result.focus || [])
						.includes(index);

				parts.push(`
					<div class="source-line ${
						focus ? 'focus' : ''
					}">
						<span>${index}</span>

						<code>${
							this.#escape(
								lines[index] || ''
							) || '&nbsp;'
						}</code>
					</div>
				`);
			}
		}

		return parts.join('');
	}

	#ranges(indices, lineCount) {
		if (indices.length === 0) {
			return [
				[
					0,
					Math.min(
						6,
						lineCount - 1
					)
				]
			];
		}

		const ranges =
			[...new Set(indices)]
				.sort((a, b) => a - b)
				.map(index => [
					Math.max(0, index - 3),
					Math.min(
						lineCount - 1,
						index + 3
					)
				]);
		const merged = [];

		for (const range of ranges) {
			const previous =
				merged.at(-1);

			if (
				previous &&
				range[0] <= previous[1] + 2
			) {
				previous[1] =
					Math.max(
						previous[1],
						range[1]
					);
			} else {
				merged.push([...range]);
			}
		}

		return merged;
	}

	#output() {
		return this.#result.output
			.split('\n')
			.map(line => {
				let kind = '';

				if (line.startsWith('+')) {
					kind = 'plus';
				} else if (line.startsWith('-')) {
					kind = 'minus';
				} else if (
					line.startsWith('[YOU')
				) {
					kind = 'you';
				} else if (
					line.startsWith('[PEER NOTE')
				) {
					kind = 'note';
				} else if (
					line.startsWith('[PEER')
				) {
					kind = 'peer';
				} else if (
					line.startsWith('[STALE')
				) {
					kind = 'stale';
				}

				return `
					<div class="${kind}">
						${
							this.#escape(line) ||
							'&nbsp;'
						}
					</div>
				`;
			})
			.join('');
	}

	#escape(value) {
		return String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#039;');
	}
}

customElements.define(
	'splicemark-live-example',
	SplicemarkLiveExample
);
