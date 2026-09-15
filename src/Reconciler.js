export default class Reconciler {
	classify(edit, committedDiff, workingDiff) {
		const committed = this.#matchCount(committedDiff, edit);
		const working = this.#matchCount(workingDiff, edit);

		if (working === 1 && committed === 0) {
			return 'active';
		}

		if (committed === 1 && working === 0) {
			return 'retired';
		}

		return 'stale';
	}

	#matchCount(diff, edit) {
		if (diff === null) {
			return -1;
		}

		if (!diff) {
			return 0;
		}

		const hunks = [];
		let current = null;

		for (const line of diff.split('\n')) {
			if (line.startsWith('@@')) {
				current = [];
				hunks.push(current);
				continue;
			}

			if (current) {
				current.push(line);
			}
		}

		return hunks.filter(hunk => this.#matches(hunk, edit)).length;
	}

	#matches(hunk, edit) {
		const removed = hunk
			.filter(line => line.startsWith('-') && !line.startsWith('---'))
			.map(line => line.slice(1))
			.join('\n');
		const inserted = hunk
			.filter(line => line.startsWith('+') && !line.startsWith('+++'))
			.map(line => line.slice(1))
			.join('\n');

		return (
			(edit.removed === '' || removed.includes(edit.removed)) &&
			(edit.inserted === '' || inserted.includes(edit.inserted))
		);
	}
}
