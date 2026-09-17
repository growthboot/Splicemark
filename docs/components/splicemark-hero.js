const stylesheet = new URL(
	'./splicemark-hero.css',
	import.meta.url
).href;

class SplicemarkHero extends HTMLElement {
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
						happen, keeps review local to each task, and only surfaces
						peer work when code overlaps.
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
					aria-label="Authorship trace across one shared working tree"
				>
					<div class="trace-heading">
						<span>mutation log</span>
						<span>shared working tree</span>
					</div>

					<div class="trace-file">src/Reconciler.js</div>

					<div class="trace-row">
						<span class="trace-line">018</span>
						<span class="trace-mark agent-a"></span>
						<code>sm-a records boundary-checked edit</code>
					</div>

					<div class="trace-row active">
						<span class="trace-line">019</span>
						<span class="trace-mark agent-b"></span>
						<code>sm-b touches intersecting range</code>
					</div>

					<div class="trace-row">
						<span class="trace-line">020</span>
						<span class="trace-mark git"></span>
						<code>Git remains aggregate source of truth</code>
					</div>

					<div class="trace-note">
						<span>no daemon</span>
						<span>no branch orchestration</span>
						<span>no inferred authorship</span>
					</div>
				</div>
			</section>
		`;
	}
}

customElements.define(
	'splicemark-hero',
	SplicemarkHero
);
