const stylesheet = new URL(
	'./splicemark-flow.css',
	import.meta.url
).href;

class SplicemarkFlow extends HTMLElement {
	#root;

	constructor() {
		super();

		this.#root = this.attachShadow({
			mode: 'open'
		});
	}

	connectedCallback() {
		this.#root.innerHTML = `
			<link rel="stylesheet" href="${stylesheet}">

			<section>
				<div class="copy">
					<p>Lifecycle</p>

					<h2>
						One shared tree.
						Small coordination state.
						Ordinary Git.
					</h2>

					<span>
						Splicemark only owns the narrow period between an agent
						deciding what to change and Git eventually absorbing
						that change.
					</span>
				</div>

				<div class="flow">
					<div class="node">
						<small>01</small>
						<strong>start</strong>
						<span>session + task description</span>
					</div>

					<div class="arrow">→</div>

					<div class="node emphasis">
						<small>02</small>
						<strong>edit / batch</strong>
						<span>exact attributed mutations</span>
					</div>

					<div class="arrow">→</div>

					<div class="node">
						<small>03</small>
						<strong>local context</strong>
						<span>peer edits + relevant notes</span>
					</div>

					<div class="arrow">→</div>

					<div class="node git">
						<small>04</small>
						<strong>Git commit</strong>
						<span>HEAD becomes authoritative</span>
					</div>

					<div class="arrow">→</div>

					<div class="node">
						<small>05</small>
						<strong>reconcile</strong>
						<span>retire, retain, or mark stale</span>
					</div>
				</div>
			</section>
		`;
	}
}

customElements.define(
	'splicemark-flow',
	SplicemarkFlow
);
