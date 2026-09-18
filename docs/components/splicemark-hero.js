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

						<h2>Two agents. One shared file.</h2>

						<p class="demo-description">
							When two agents work in the same file, Splicemark makes that shared
							work visible with labeled change blocks. Each agent can see who is
							changing what and where.
						</p>

						<div
							class="demo-agents"
							aria-label="Active authors in ${this.#escape(capture?.file || 'shared file')}"
						>
							${this.#agents(capture)}
						</div>
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
			file: this.#result.file,
			blocks: this.#result.output
				.trim()
				.split(/\n\s*\n/)
				.map(section => this.#block(section))
				.filter(Boolean)
		};
	}

	#block(section) {
		const lines = section.split('\n');
		const attribution = lines[0]?.match(
			/^\[(YOU|PEER) · ([^·]+) · (.+)\]$/
		);

		if (!attribution) {
			return null;
		}

		const hunk = lines.find(line => line.startsWith('@@'));
		const location = hunk?.match(/^@@ -(\d+)/);

		return {
			kind: attribution[1],
			task: attribution[3],
			line: location ? Number(location[1]) : null,
			lines
		};
	}

	#agents(capture) {
		if (!capture) {
			return '';
		}

		return capture.blocks.map(block => `
			<div class="demo-agent ${block.kind.toLowerCase()}">
				<span class="agent-dot" aria-hidden="true"></span>
				<span class="agent-kind">${this.#escape(block.kind)}</span>
				<span class="agent-task">${this.#escape(block.task)}</span>
				<code>${block.line === null ? '' : `line ${block.line}`}</code>
			</div>
		`).join('');
	}

	#output(capture) {
		if (!capture) {
			return `
				<div class="output-block">
					<div class="output-line">
						<span class="line-number old" aria-hidden="true"></span>
						<span class="line-number new" aria-hidden="true"></span>
						<code>${this.#escape(
							this.#error || 'Executing current Splicemark modules…'
						)}</code>
					</div>
				</div>
			`;
		}

		return capture.blocks.map(block => `
			<div class="output-block ${block.kind.toLowerCase()}">
				${this.#outputLines(block.lines)}
			</div>
		`).join('');
	}

	#outputLines(lines) {
		let oldLine = null;
		let newLine = null;

		return lines.map((line, index) => {
			const kind =
				this.#lineClass(line, index);
			const hunk =
				line.match(
					/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/
				);
			let oldNumber = '';
			let newNumber = '';

			if (hunk) {
				oldLine = Number(hunk[1]);
				newLine = Number(hunk[2]);
			} else if (kind === 'removed') {
				oldNumber = oldLine ?? '';

				if (oldLine !== null) {
					oldLine++;
				}
			} else if (kind === 'added') {
				newNumber = newLine ?? '';

				if (newLine !== null) {
					newLine++;
				}
			} else if (line.startsWith(' ')) {
				oldNumber = oldLine ?? '';
				newNumber = newLine ?? '';

				if (oldLine !== null) {
					oldLine++;
				}

				if (newLine !== null) {
					newLine++;
				}
			}

			return `
				<div class="output-line ${kind}">
					<span class="line-number old" aria-hidden="true">${oldNumber}</span>
					<span class="line-number new" aria-hidden="true">${newNumber}</span>
					<code>${this.#escape(line) || '&nbsp;'}</code>
				</div>
			`;
		}).join('');
	}

	#lineClass(line, index) {
		if (index === 0) {
			return 'attribution';
		}

		if (line.startsWith('--- ') || line.startsWith('+++ ')) {
			return 'file';
		}

		if (line.startsWith('@@')) {
			return 'hunk';
		}

		if (line.startsWith('-')) {
			return 'removed';
		}

		if (line.startsWith('+')) {
			return 'added';
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
