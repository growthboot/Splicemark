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
					<div class="demo-intro">

						<h2>Two agents. One shared file.</h2>

						<p class="demo-description">
							Your task is changing one region while a peer works hundreds
							of lines away. Splicemark still treats the file as shared and
							keeps each change block attributed.
						</p>

						<div class="demo-agents" aria-label="Active authors in RequestPipeline.js">
							<div class="demo-agent you">
								<span class="agent-dot" aria-hidden="true"></span>
								<span class="agent-kind">you</span>
								<span class="agent-task">Cache resolved handlers</span>
								<code>~450</code>
							</div>
							<div class="demo-agent peer">
								<span class="agent-dot" aria-hidden="true"></span>
								<span class="agent-kind">peer</span>
								<span class="agent-task">Validate request headers</span>
								<code>~100</code>
							</div>
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
								<code>splicemark diff sm-7a14d9c2</code>
								<span class="terminal-cursor" aria-hidden="true"></span>
							</div>
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
