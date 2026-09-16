const stylesheet = new URL(
	'./splicemark-hero.css',
	import.meta.url
).href;

class SplicemarkHero extends HTMLElement {
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
		const version = this.#data?.version || '0.1.0';
		const fingerprint =
			this.#data?.fingerprint || 'generating';

		this.#root.innerHTML = `
			<link rel="stylesheet" href="${stylesheet}">

			<section class="hero">
				<div class="glow"></div>

				<div class="copy">
					<div class="badge">
						<span class="pulse"></span>
						MIT · shared working tree · v${version}
					</div>

					<h1>
						Let coding agents
						<span>edit together</span>
						without merging their workflows.
					</h1>

					<p class="lead">
						Splicemark is a small open-source CLI that performs
						precise attributed edits, keeps routine diffs local to
						each agent, surfaces overlapping peer work only when it
						matters, and leaves Git in charge of the aggregate tree.
					</p>

					<div class="actions">
						<a class="primary" href="#demos">
							Run the demos
						</a>

						<a
							class="secondary"
							href="https://github.com/growthboot/Splicemark"
							target="_blank"
							rel="noreferrer"
						>
							View source
						</a>
					</div>

					<div class="facts">
						<div>
							<strong>0</strong>
							<span>branches required</span>
						</div>

						<div>
							<strong>2</strong>
							<span>range modes</span>
						</div>

						<div>
							<strong>1 tree</strong>
							<span>shared by every agent</span>
						</div>
					</div>
				</div>

				<div class="artifact">
					<div class="artifact-bar">
						<span></span>
						<span></span>
						<span></span>
						<em>agent-b · shared tree</em>
					</div>

					<pre><code><span class="prompt">$</span> splicemark edit sm-b src/Reconciler.js \
  --lines 18:18 \
  --expect-start "    return 'active';"</code></pre>

					<div class="diff">
						<strong>
							[YOU · sm-b · Refine active reconciliation]
						</strong>

						<span class="minus">
							-    return 'active';
						</span>

						<span class="plus">
							+    return 'active'; // Agent B touched this region.
						</span>

						<strong class="peer">
							[PEER · sm-a · Explain active reconciliation]
						</strong>

						<span class="plus">
							+    // Agent A documents this active path.
						</span>
					</div>

					<footer>
						<span>source fingerprint</span>
						<code>${fingerprint}</code>
					</footer>
				</div>
			</section>
		`;
	}
}

customElements.define(
	'splicemark-hero',
	SplicemarkHero
);
