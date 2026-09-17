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
					aria-label="Unified working tree diff with Splicemark agent attribution"
				>
					<div class="trace-heading">
						<span>working tree diff</span>
						<span>splicemark attribution</span>
					</div>

					<div class="diff">
						<div class="diff-file">
							<span class="diff-status" aria-hidden="true">M</span>
							<code>src/Reconciler.js</code>
						</div>

						<div class="diff-hunk">
							<code>@@ -18,3 +18,5 @@ function reconcile(edits) {</code>
						</div>

						<div class="diff-row context">
							<span class="diff-line">18</span>
							<span class="diff-line">18</span>
							<span class="diff-sign"></span>
							<code>const ranges = collectRanges(edits);</code>
							<span></span>
						</div>

						<div class="diff-row removed">
							<span class="diff-line">19</span>
							<span class="diff-line"></span>
							<span class="diff-sign">−</span>
							<code>return applyEdits(ranges);</code>
							<span class="agent-label agent-a">sm-a</span>
						</div>

						<div class="diff-row added">
							<span class="diff-line"></span>
							<span class="diff-line">19</span>
							<span class="diff-sign">+</span>
							<code>assertBoundaries(ranges);</code>
							<span class="agent-label agent-a">sm-a</span>
						</div>

						<div class="diff-row added">
							<span class="diff-line"></span>
							<span class="diff-line">20</span>
							<span class="diff-sign">+</span>
							<code>markIntersections(ranges);</code>
							<span class="agent-label agent-b">sm-b</span>
						</div>

						<div class="diff-row added">
							<span class="diff-line"></span>
							<span class="diff-line">21</span>
							<span class="diff-sign">+</span>
							<code>return applyEdits(ranges);</code>
							<span class="agent-label agent-a">sm-a</span>
						</div>

						<div class="diff-row context">
							<span class="diff-line">20</span>
							<span class="diff-line">22</span>
							<span class="diff-sign"></span>
							<code>}</code>
							<span></span>
						</div>
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
