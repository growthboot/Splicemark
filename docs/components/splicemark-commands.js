const stylesheet = new URL(
	'./splicemark-commands.css',
	import.meta.url
).href;

class SplicemarkCommands extends HTMLElement {
	#data = null;
	#root;

	constructor() {
		super();

		this.#root = this.attachShadow({
			mode: 'open'
		});
	}

	set data(value) {
		this.#data = value;
		this.#render();
	}

	connectedCallback() {
		this.#render();
	}

	#render() {
		const help =
			this.#data?.help ||
			'Loading CLI command surface…';
		const repository =
			this.#data?.repository ||
			'https://github.com/growthboot/Splicemark';

		this.#root.innerHTML = `
			<link rel="stylesheet" href="${stylesheet}">

			<section>
				<div class="heading">
					<p>Use it</p>

					<h2>
						A small command surface
						for agent instructions.
					</h2>

					<span>
						There is no daemon or service to teach the agent.
						Start one session, use Splicemark for writes and
						task-local review, then finish the session.
					</span>
				</div>

				<div class="grid">
					<div class="install">
						<div class="bar">
							<span>Current source install</span>

							<a
								href="${this.#escape(repository)}"
								target="_blank"
								rel="noreferrer"
							>
								growthboot/Splicemark
							</a>
						</div>

						<pre><code>git clone https://github.com/growthboot/Splicemark.git
cd Splicemark
npm link

splicemark start "your task"</code></pre>

						<div class="license">
							<strong>MIT licensed</strong>

							<span>
								Free and open source. Node 20+.
							</span>
						</div>
					</div>

					<div class="commands">
						<div class="bar">
							<span>Actual CLI help</span>
							<code>splicemark help</code>
						</div>

						<pre><code>${this.#escape(help)}</code></pre>
					</div>
				</div>

				<div class="agent-prompt">
					<strong>
						Short enough for a system prompt
					</strong>

					<p>
						Start a Splicemark session for the task and retain its
						ID. Use <code>edit</code> for single validated writes,
						or validate all ranges then use one
						<code>batch</code> for multiple non-overlapping writes
						to a file. Use <code>diff</code> for task-local review,
						leave region notes only for important coordination,
						and finish the session when the task is complete.
					</p>
				</div>
			</section>
		`;
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
	'splicemark-commands',
	SplicemarkCommands
);
