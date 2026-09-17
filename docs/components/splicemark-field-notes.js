const stylesheet = new URL(
	'./splicemark-field-notes.css',
	import.meta.url
).href;

class SplicemarkFieldNotes extends HTMLElement {
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

			<section class="field-notes" aria-labelledby="field-notes-title">
				<header class="heading">
					<p class="eyebrow">Field notes / shared authorship</p>

					<div>
						<h2 id="field-notes-title">
							Track each agent’s changes.
							<span>Surface when agents share a file.</span>
						</h2>

						<p class="lede">
							Splicemark records which mutations belong to each active
							session inside the same workspace. An agent can reason about
							its own work without keeping every other dirty change in its
							head, while another session becomes visible when it works in the same file.
						</p>
					</div>
				</header>

				<div class="workbench">
					<div class="story">
						<p class="label">the actual problem</p>

						<p class="statement">
							Agents can usually distinguish their own work from the rest.
							The problem is having to keep reconstructing that distinction
							as other agents change the same workspace.
						</p>

						<p>
							Splicemark records authorship as edits happen. Each session
							can inspect its own attributed mutations without
							reconstructing them from unrelated changes already present
							in the workspace.
						</p>

						<p>
							When another active session is working in the same file, its
							authorship becomes relevant. Splicemark can surface that
							shared-file context, giving the agents enough local context
							to coordinate without either one tracking everybody else’s work.
						</p>
					</div>

					<div class="scratchpad" aria-label="Example authorship and overlap notes">
						<div class="scratchpad-head">
							<span>authorship.log</span>
							<span>2 active sessions</span>
						</div>

						<div class="thought">
							<span class="time">09:41</span>
							<div>
								<strong>sm-14 · retry experiment</strong>
								<p>authored src/queue.js : 88–102</p>
							</div>
						</div>

						<div class="thought">
							<span class="time">09:46</span>
							<div>
								<strong>sm-19 · logging pass</strong>
								<p>editing src/queue.js : 96–111</p>
							</div>
						</div>

						<div class="thought signal">
							<span class="time">peer</span>
							<div>
								<strong>two active sessions share this file</strong>
								<p>surface peer authorship for src/queue.js</p>
							</div>
						</div>

						<div class="thought note">
							<span class="time">note</span>
							<div>
								<strong>“retry semantics are moving here”</strong>
								<p>context stays attached to this code region</p>
							</div>
						</div>
					</div>
				</div>

				<div class="beats">
					<div class="beat">
						<span class="number">01</span>
						<strong>Authorship is per session</strong>
						<p>
							Each session gets a record of the mutations it authored,
							separate from unrelated changes in the same working tree.
						</p>
					</div>

					<div class="beat">
						<span class="number">02</span>
						<strong>No reconstruction step</strong>
						<p>
							An agent can ask for its own changes directly instead of
							inferring them by subtracting everybody else’s work from
							the workspace.
						</p>
					</div>

					<div class="beat">
						<span class="number">03</span>
						<strong>Same-file work becomes context</strong>
						<p>
							When two active sessions are working in the same file,
							Splicemark can surface the other session as coordination context.
						</p>
					</div>

					<div class="beat">
						<span class="number">04</span>
						<strong>Notes stay attached to code</strong>
						<p>
							Exceptional context can be pinned to a range and stay
							quiet until another active session reaches that region.
						</p>
					</div>
				</div>

				<p class="closing">
					Splicemark is not a branch manager, worktree manager, or
					task orchestrator. Those tools separate agents into different
					environments or coordinate them from above. Splicemark operates
					inside the shared working tree itself, keeping authorship distinct
					at the point where edits are made.
				</p>
			</section>
		`;
	}
}

customElements.define(
	'splicemark-field-notes',
	SplicemarkFieldNotes
);
