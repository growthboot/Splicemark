import LiveDemo from '../runtime/LiveDemo.js';

const stylesheet = new URL(
	'./splicemark-hero.css',
	import.meta.url
).href;
class SplicemarkHero extends HTMLElement {
	#result = null;
	#error = '';
	#root;

	constructor() {
		super();

		this.#root = this.attachShadow({
			mode: 'open'
		});
	}

	connectedCallback() {
		this.#render();
		void this.#run();
	}

	async #run() {
		try {
			this.#result = await new LiveDemo().run('peers');
			this.#error = '';
		} catch (error) {
			this.#error =
				error instanceof Error
					? error.message
					: String(error);
		}

		this.#render();
	}

	#render() {
		const capture = this.#capture();

		this.#root.innerHTML = `
			<link rel="stylesheet" href="${stylesheet}">

			<section class="hero" aria-labelledby="hero-title">
				<div class="copy">
					<p class="kicker">
						<span>Splicemark</span> / shared-tree coordination
					</p>

					<h1 id="hero-title">
						One tree.
						<br>
						Every edit
						<br>
						<span>accounted for.</span>
					</h1>

					<p class="summary">
						A small CLI for coding agents working in the same Git
						working tree. Splicemark records authorship when edits
						happen, keeps review local to each task, and surfaces peer
						work when active tasks share a file.
					</p>

					<div class="links" aria-label="Primary links">
						<a href="#field-notes">Why this exists ↓</a>
						<a href="#overview">Read the guide</a>
						<a
							href="https://github.com/growthboot/Splicemark"
							target="_blank"
							rel="noreferrer"
						>
							View source ↗
						</a>
					</div>
				</div>

				<div
					class="trace"
					aria-label="Terminal showing your changes and a peer's changes in one shared file"
				>
					<div class="demo-intro">

						<h2>Stay collision-aware while you code.</h2>

						<p class="demo-description">
							The agent runs <code>splicemark diff</code> for its session.
							The terminal below shows the literal output it receives,
							including active peer work in the same file.
						</p>

					</div>

					<div class="terminal">
						<div class="terminal-command">
							<div class="terminal-context">
								<span class="terminal-user">agent@local</span>
								<span class="terminal-path">~/src/splicemark</span>
							</div>
							<div class="terminal-input">
								<span class="prompt" aria-hidden="true">❯</span>
								<code>${this.#escape(capture?.command || 'Executing live Splicemark scenario…')}</code>
								<span class="terminal-cursor" aria-hidden="true"></span>
							</div>
						</div>

						<div class="terminal-output">
							${this.#output(capture)}
						</div>
					</div>
				</div>
			</section>
		`;
	}

	#capture() {
		if (!this.#result || typeof this.#result.output !== 'string') {
			return null;
		}

		return {
			command: this.#result.command,
			output: this.#result.output
		};
	}


	#output(capture) {
		const output =
			capture?.output ??
			this.#error ??
			'Executing current Splicemark modules…';

		return (
			'<pre class="output-transcript">' +
			this.#highlightOutput(output) +
			'</pre>'
		);
	}

	#highlightOutput(output) {
		return output
			.split('\n')
			.map(line => {
				const kind =
					this.#lineClass(line);

				return (
					'<span class="output-line ' +
					kind +
					'">' +
					this.#escape(line) +
					'</span>'
				);
			})
			.join('\n');
	}

	#lineClass(line) {
		if (line.startsWith('[YOU')) {
			return 'you attribution';
		}

		if (line.startsWith('[PEER NOTE')) {
			return 'note attribution';
		}

		if (line.startsWith('[PEER')) {
			return 'peer attribution';
		}

		if (line.startsWith('[STALE')) {
			return 'stale attribution';
		}

		if (
			line.startsWith('--- ') ||
			line.startsWith('+++ ')
		) {
			return 'file';
		}

		if (line.startsWith('@@')) {
			return 'hunk';
		}

		const content =
			line.match(
				/^([ 0-9]+) ([ 0-9]+) ([+\- ])/
			);

		if (content?.[3] === '-') {
			return 'removed';
		}

		if (content?.[3] === '+') {
			return 'added';
		}

		if (content?.[3] === ' ') {
			return 'context';
		}

		return '';
	}

	#escape(value) {
		return String(value).replace(/[&<>"']/g, character => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		})[character]);
	}
}

customElements.define(
	'splicemark-hero',
	SplicemarkHero
);
