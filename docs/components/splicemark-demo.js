const stylesheet = new URL(
	'./splicemark-demo.css',
	import.meta.url
).href;

const scenarioLabels = {
	batch: 'Batch writes',
	peers: 'Peer overlap',
	notes: 'Code notes',
	relocation: 'Relocation',
	commit: 'Git lifecycle'
};

class SplicemarkDemo extends HTMLElement {
	#data = null;
	#error = '';
	#scenario = 0;
	#step = 0;
	#root;

	constructor() {
		super();

		this.#root = this.attachShadow({
			mode: 'open'
		});
	}

	set data(value) {
		this.#data = value;
		this.#scenario = 0;
		this.#step = 0;
		this.#render();
	}

	set error(value) {
		this.#error = value;
		this.#render();
	}

	connectedCallback() {
		this.#render();
	}

	#render() {
		if (this.#error) {
			this.#root.innerHTML = `
				<link rel="stylesheet" href="${stylesheet}">

				<div class="state error">
					${this.#escape(this.#error)}
				</div>
			`;
			return;
		}

		if (!this.#data) {
			this.#root.innerHTML = `
				<link rel="stylesheet" href="${stylesheet}">

				<div class="state">
					Loading generated CLI runs…
				</div>
			`;
			return;
		}

		const scenario =
			this.#data.scenarios[this.#scenario];
		const active =
			scenario.steps[this.#step];

		this.#root.innerHTML = `
			<link rel="stylesheet" href="${stylesheet}">

			<div class="demo">
				<div class="topbar">
					<div
						class="scenario-tabs"
						role="tablist"
						aria-label="Splicemark demos"
					>
						${this.#scenarioTabs()}
					</div>

					<div class="proof">
						<span></span>
						real CLI capture
					</div>
				</div>

				<header class="scenario-header">
					<div>
						<p class="kicker">
							${this.#escape(scenario.kicker)}
						</p>

						<h3>
							${this.#escape(scenario.title)}
						</h3>
					</div>

					<p class="description">
						${this.#escape(
							scenario.description
						)}
					</p>
				</header>

				<div class="stage">
					<section class="terminal-card">
						<div class="card-head">
							<div>
								<span class="step-count">
									${this.#step + 1}
									/
									${scenario.steps.length}
								</span>

								<strong>
									${this.#escape(
										active.title
									)}
								</strong>
							</div>

							<span>terminal</span>
						</div>

						<div class="terminal">
							${this.#command(active)}

							<div class="output">
								${this.#formatOutput(
									active.output
								)}
							</div>
						</div>

						<p class="detail">
							${this.#escape(active.detail)}
						</p>
					</section>

					<section class="source-card">
						<div class="card-head">
							<div>
								<strong>
									${this.#escape(
										scenario.file
									)}
								</strong>
							</div>

							<span>relevant source</span>
						</div>

						<div class="source">
							${this.#sourceExcerpt(
								scenario,
								active
							)}
						</div>
					</section>
				</div>

				<div class="stepbar">
					<div
						class="step-tabs"
						aria-label="Scenario steps"
					>
						${this.#stepTabs(scenario)}
					</div>

					<div class="navigation">
						<button
							class="secondary"
							data-action="back"
							type="button"
							${this.#step === 0 ? 'disabled' : ''}
						>
							← Back
						</button>

						<button
							class="primary"
							data-action="next"
							type="button"
							${
								this.#step ===
								scenario.steps.length - 1
									? 'disabled'
									: ''
							}
						>
							Next →
						</button>
					</div>
				</div>

				<footer>
					<span>
						generated from
						<code>
							${this.#escape(
								this.#data.cli
							)}
						</code>
					</span>

					<span>
						source
						<code>
							${this.#escape(
								this.#data.fingerprint
							)}
						</code>
					</span>
				</footer>
			</div>
		`;

		this.#bind();
	}

	#scenarioTabs() {
		return this.#data.scenarios
			.map((scenario, index) => `
				<button
					class="${
						index === this.#scenario
							? 'active'
							: ''
					}"
					data-scenario="${index}"
					type="button"
				>
					<span>
						${String(index + 1).padStart(2, '0')}
					</span>

					${this.#escape(
						scenarioLabels[scenario.id] ||
						scenario.title
					)}
				</button>
			`)
			.join('');
	}

	#stepTabs(scenario) {
		return scenario.steps
			.map((step, index) => `
				<button
					class="${
						index === this.#step
							? 'active'
							: ''
					}"
					data-step="${index}"
					type="button"
				>
					<span>
						${index + 1}
					</span>

					${this.#escape(step.title)}
				</button>
			`)
			.join('');
	}

	#bind() {
		for (
			const button of this.#root.querySelectorAll(
				'[data-scenario]'
			)
		) {
			button.addEventListener(
				'click',
				() => {
					this.#scenario =
						Number(
							button.dataset.scenario
						);
					this.#step = 0;
					this.#render();
				}
			);
		}

		for (
			const button of this.#root.querySelectorAll(
				'[data-step]'
			)
		) {
			button.addEventListener(
				'click',
				() => {
					this.#step =
						Number(
							button.dataset.step
						);
					this.#render();
				}
			);
		}

		this.#root
			.querySelector('[data-action="back"]')
			?.addEventListener(
				'click',
				() => {
					this.#step = Math.max(
						0,
						this.#step - 1
					);
					this.#render();
				}
			);

		this.#root
			.querySelector('[data-action="next"]')
			?.addEventListener(
				'click',
				() => {
					const max =
						this.#data
							.scenarios[this.#scenario]
							.steps.length - 1;

					this.#step = Math.min(
						max,
						this.#step + 1
					);
					this.#render();
				}
			);
	}

	#command(active) {
		const lines =
			active.command.split('\n');
		const first = lines[0];
		let summary = '';

		if (
			active.command.includes(
				"<<'JSON'"
			)
		) {
			const ranges = [
				...active.command.matchAll(
					/"start":\s*(\d+)/g
				)
			].map(match => match[1]);

			summary =
				ranges.length +
				' prevalidated splices' +
				(
					ranges.length > 0
						? ' · lines ' +
							ranges.join(', ')
						: ''
				);
		} else if (lines.length > 1) {
			summary =
				(lines.length - 1) +
				' additional command lines';
		}

		return `
			<div class="command">
				<div class="command-line">
					<span class="prompt">$</span>

					<code>
						${this.#escape(first)}
					</code>
				</div>

				${
					summary
						? `
							<div class="command-summary">
								${this.#escape(summary)}
							</div>
						`
						: ''
				}

				${
					lines.length > 1
						? `
							<details>
								<summary>
									Show exact command
								</summary>

								<pre>${this.#escape(
									active.command
								)}</pre>
							</details>
						`
						: ''
				}
			</div>
		`;
	}

	#formatOutput(output) {
		if (!output) {
			return `
				<div class="plain muted">
					(no output)
				</div>
			`;
		}

		const parts = [];
		let blockOpen = false;

		for (
			const raw of output.split('\n')
		) {
			if (
				raw.startsWith('[YOU') ||
				raw.startsWith('[PEER') ||
				raw.startsWith('[STALE')
			) {
				if (blockOpen) {
					parts.push('</div>');
				}

				let className = 'you';

				if (
					raw.startsWith('[PEER NOTE')
				) {
					className = 'note';
				} else if (
					raw.startsWith('[PEER')
				) {
					className = 'peer';
				} else if (
					raw.startsWith('[STALE')
				) {
					className = 'stale';
				}

				parts.push(
					'<div class="diff-block">'
				);
				parts.push(
					'<div class="identity ' +
					className +
					'">' +
					this.#escape(raw) +
					'</div>'
				);
				blockOpen = true;
				continue;
			}

			if (raw === '@@') {
				continue;
			}

			if (
				raw.startsWith('+') ||
				raw.startsWith('-')
			) {
				const sign = raw[0];
				const code =
					raw.slice(1).trimStart();

				parts.push(
					'<div class="diff-line ' +
					(
						sign === '+'
							? 'plus'
							: 'minus'
					) +
					'">' +
					'<span>' +
					sign +
					'</span>' +
					'<code>' +
					this.#escape(code) +
					'</code>' +
					'</div>'
				);
				continue;
			}

			if (
				raw.includes(' · lines ')
			) {
				parts.push(
					'<div class="location">' +
					this.#escape(raw.trim()) +
					'</div>'
				);
				continue;
			}

			if (raw.trim() === '') {
				continue;
			}

			parts.push(
				'<div class="plain">' +
				this.#escape(raw.trim()) +
				'</div>'
			);
		}

		if (blockOpen) {
			parts.push('</div>');
		}

		return parts.join('');
	}

	#sourceExcerpt(scenario, active) {
		const current = active.fileAfter
			.replace(/\n$/, '')
			.split('\n');
		const indices = this.#focusIndices(
			scenario,
			active,
			current
		);
		const ranges = this.#contextRanges(
			indices,
			current.length
		);
		const additions = this.#additionLines(
			scenario
		);

		if (ranges.length === 0) {
			return `
				<div class="source-empty">
					No file mutation in this step.
				</div>
			`;
		}

		const parts = [];

		for (
			let rangeIndex = 0;
			rangeIndex < ranges.length;
			rangeIndex++
		) {
			const [start, end] =
				ranges[rangeIndex];

			if (rangeIndex > 0) {
				parts.push(
					'<div class="gap">⋯</div>'
				);
			}

			for (
				let index = start;
				index <= end;
				index++
			) {
				const line =
					current[index] ?? '';
				const changed =
					additions.has(line);

				parts.push(`
					<div class="source-line ${
						changed
							? 'changed'
							: ''
					}">
						<span>${index}</span>

						<code>${
							this.#escape(line) ||
							'&nbsp;'
						}</code>
					</div>
				`);
			}
		}

		return parts.join('');
	}

	#focusIndices(scenario, active, current) {
		const indices = new Set();
		const additionLines =
			this.#additionLines(
				{
					...scenario,
					steps: [active]
				}
			);

		for (const addition of additionLines) {
			for (
				let index = 0;
				index < current.length;
				index++
			) {
				if (current[index] === addition) {
					indices.add(index);
				}
			}
		}

		for (
			const match of active.output.matchAll(
				/ · lines (\d+):(\d+)/g
			)
		) {
			indices.add(Number(match[1]));
			indices.add(Number(match[2]));
		}

		const commandRange =
			active.command.match(
				/--lines\s+(\d+):(\d+)/
			);

		if (commandRange) {
			indices.add(Number(commandRange[1]));
			indices.add(Number(commandRange[2]));
		}

		if (indices.size === 0) {
			const initial =
				scenario.initialFile
					.replace(/\n$/, '')
					.split('\n');

			let prefix = 0;

			while (
				prefix < initial.length &&
				prefix < current.length &&
				initial[prefix] === current[prefix]
			) {
				prefix++;
			}

			if (
				prefix < initial.length ||
				prefix < current.length
			) {
				indices.add(
					Math.min(
						prefix,
						Math.max(
							0,
							current.length - 1
						)
					)
				);
			}
		}

		if (indices.size === 0) {
			const allAdditions =
				this.#additionLines(scenario);

			for (const addition of allAdditions) {
				const index =
					current.indexOf(addition);

				if (index !== -1) {
					indices.add(index);
				}
			}
		}

		return [...indices]
			.filter(index =>
				Number.isInteger(index) &&
				index >= 0 &&
				index < current.length
			)
			.sort((a, b) => a - b);
	}

	#contextRanges(indices, lineCount) {
		if (indices.length === 0) {
			return [];
		}

		const ranges = indices.map(index => [
			Math.max(0, index - 3),
			Math.min(
				lineCount - 1,
				index + 3
			)
		]);
		const merged = [];

		for (const range of ranges) {
			const previous =
				merged.at(-1);

			if (
				previous &&
				range[0] <= previous[1] + 2
			) {
				previous[1] = Math.max(
					previous[1],
					range[1]
				);
			} else {
				merged.push([...range]);
			}
		}

		return merged;
	}

	#additionLines(scenario) {
		const additions = new Set();

		for (const step of scenario.steps) {
			for (
				const line of step.output.split('\n')
			) {
				if (
					line.startsWith('+') &&
					!line.startsWith('+++')
				) {
					additions.add(line.slice(1));
				}
			}
		}

		return additions;
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
	'splicemark-demo',
	SplicemarkDemo
);
