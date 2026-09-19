export default class MemoryGit {
	#counter = 1;
	#head;
	#root;
	#snapshots = new Map();
	#workspace;

	constructor({
		workspace,
		head = 'demo-head-1',
		root = null
	} = {}) {
		if (!workspace) {
			throw new Error('workspace adapter is required');
		}

		this.#workspace = workspace;
		this.#root =
			root || workspace.getRoot();
		this.#head = head;
		this.#snapshots.set(
			this.#head,
			this.#workspace.snapshot()
		);
	}

	getRoot() {
		return this.#root;
	}

	getHead() {
		return this.#head;
	}

	getHeadContent(file) {
		const base =
			this.#snapshots.get(
				this.#head
			);

		if (!base) {
			return null;
		}

		return Object.hasOwn(base, file)
			? base[file]
			: '';
	}


	getWorkingDiff(file) {
		const base =
			this.#snapshots.get(this.#head);

		if (!base) {
			return null;
		}

		return this.#diff(
			base[file] || '',
			this.#workspace.snapshot()[file] || ''
		);
	}

	getCommittedDiff(fromHead, toHead, file) {
		if (
			!fromHead ||
			!toHead ||
			fromHead === toHead
		) {
			return '';
		}

		const from =
			this.#snapshots.get(fromHead);
		const to =
			this.#snapshots.get(toHead);

		if (!from || !to) {
			return null;
		}

		return this.#diff(
			from[file] || '',
			to[file] || ''
		);
	}

	commit({
		head = null,
		files = null
	} = {}) {
		const previous =
			this.#snapshots.get(this.#head) || {};
		const working =
			this.#workspace.snapshot();
		const next =
			files
				? {
					...previous
				}
				: {
					...working
				};

		if (files) {
			for (const file of files) {
				if (Object.hasOwn(working, file)) {
					next[file] = working[file];
				} else {
					delete next[file];
				}
			}
		}

		this.#head =
			head ||
			'demo-head-' + (++this.#counter);
		this.#snapshots.set(
			this.#head,
			next
		);

		return this.#head;
	}

	#diff(before, after) {
		if (before === after) {
			return '';
		}

		const beforeLines =
			this.#lines(before);
		const afterLines =
			this.#lines(after);
		let start = 0;

		while (
			start < beforeLines.length &&
			start < afterLines.length &&
			beforeLines[start] === afterLines[start]
		) {
			start++;
		}

		let beforeEnd =
			beforeLines.length - 1;
		let afterEnd =
			afterLines.length - 1;

		while (
			beforeEnd >= start &&
			afterEnd >= start &&
			beforeLines[beforeEnd] === afterLines[afterEnd]
		) {
			beforeEnd--;
			afterEnd--;
		}

		const removed =
			beforeLines.slice(start, beforeEnd + 1);
		const inserted =
			afterLines.slice(start, afterEnd + 1);

		return [
			'@@ -' +
				(start + 1) +
				',' +
				removed.length +
				' +' +
				(start + 1) +
				',' +
				inserted.length +
				' @@',
			...removed.map(line => '-' + line),
			...inserted.map(line => '+' + line)
		].join('\n');
	}

	#lines(content) {
		if (content === '') {
			return [];
		}

		const lines =
			content.split('\n');

		if (lines.at(-1) === '') {
			lines.pop();
		}

		return lines;
	}
}
