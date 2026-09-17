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
					<div class="trace-heading">
						<span>terminal / attributed diff</span>
						<span>same-file collision</span>
					</div>

					<div class="terminal">
						<div class="terminal-bar">
							<div class="terminal-dots" aria-hidden="true">
								<span></span>
								<span></span>
								<span></span>
							</div>
							<span class="terminal-title">shared working tree</span>
							<span class="terminal-state">2 agents · 1 file</span>
						</div>

						<div class="terminal-command">
							<span class="prompt" aria-hidden="true">$</span>
							<code>splicemark diff sm-7a14d9c2</code>
						</div>

						<div class="terminal-output">
							<div class="output-block you">
								<code class="output-line attribution">[YOU · sm-7a14d9c2 · Cache resolved handlers]</code>
								<code class="output-line file">--- a/src/RequestPipeline.js</code>
								<code class="output-line file">+++ b/src/RequestPipeline.js</code>
								<code class="output-line hunk">@@ -450,1 +450,1 @@</code>
								<code class="output-line removed">-    return resolveHandler(route);</code>
								<code class="output-line added">+    return this.#handlerCache.get(route) ?? resolveHandler(route);</code>
							</div>

							<div class="output-block peer">
								<code class="output-line attribution">[PEER · sm-0fd321bb · Validate request headers]</code>
								<code class="output-line file">--- a/src/RequestPipeline.js</code>
								<code class="output-line file">+++ b/src/RequestPipeline.js</code>
								<code class="output-line hunk">@@ -100,1 +100,1 @@</code>
								<code class="output-line removed">-    const headers = request.headers;</code>
								<code class="output-line added">+    const headers = validateHeaders(request.headers);</code>
							</div>
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
