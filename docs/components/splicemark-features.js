const stylesheet = new URL(
	'./splicemark-features.css',
	import.meta.url
).href;

class SplicemarkFeatures extends HTMLElement {
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
				<div class="heading">
					<p>What it owns</p>

					<h2>
						A narrow editing layer.
						Not another version-control system.
					</h2>
				</div>

				<div class="grid">
					<article>
						<span>01</span>
						<h3>Attributed edits</h3>
						<p>
							Authorship is captured when Splicemark performs the
							mutation. It does not guess ownership later from a
							whole-file diff.
						</p>
					</article>

					<article>
						<span>02</span>
						<h3>Task-local diffs</h3>
						<p>
							An agent can review only its own active mutations
							without repeatedly pulling unrelated shared-tree
							changes into context.
						</p>
					</article>

					<article>
						<span>03</span>
						<h3>Prevalidated batch writes</h3>
						<p>
							Multiple non-overlapping line or character ranges
							are sorted bottom-to-top so one write cannot shift
							a target that has not been applied yet.
						</p>
					</article>

					<article>
						<span>04</span>
						<h3>Local peer awareness</h3>
						<p>
							Other sessions appear only when their attributed
							work intersects the same local code. There is no
							global agent-noise feed.
						</p>
					</article>

					<article>
						<span>05</span>
						<h3>Code-bound notes</h3>
						<p>
							Important coordination can be pinned to a region.
							Notes are not direct messages and are surfaced only
							when another session enters that code.
						</p>
					</article>

					<article>
						<span>06</span>
						<h3>Git stays authoritative</h3>
						<p>
							Normal Git remains the aggregate tree and history.
							When HEAD changes, Splicemark reconciles active
							attribution instead of creating a parallel VCS.
						</p>
					</article>
				</div>

				<div class="non-goals">
					<strong>Deliberate non-goals</strong>

					<div>
						<span>no branches</span>
						<span>no worktrees</span>
						<span>no staging model</span>
						<span>no merge workflow</span>
						<span>no agent chat</span>
						<span>no persistent code annotations</span>
					</div>
				</div>
			</section>
		`;
	}
}

customElements.define(
	'splicemark-features',
	SplicemarkFeatures
);
