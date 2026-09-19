export default class WorkingTreeAttribution {
	analyze(file, base, source, entries = []) {
		const active =
			entries.filter(entry =>
				(entry.edit.status || 'active') === 'active' &&
				entry.edit.path === file
			);
		const hunks =
			this.#hunks(base, source);
		const evidence =
			this.#evidence(active, hunks);
		const used =
			new Set();
		const locations =
			new Map();
		const unattributed = [];
		let residualDelta = 0;
		let positionReliable = true;

		for (
			let index = 0;
			index < hunks.length;
			index++
		) {
			const hunk =
				hunks[index];
			const candidates =
				active.filter(entry => {
					const key =
						this.#key(entry);
					const seen =
						evidence.get(key);

					if (used.has(key)) {
						return false;
					}

					if (
						seen?.size === 1 &&
						seen.has(index)
					) {
						return true;
					}

					return (
						positionReliable &&
						this.#positionTouches(
							entry.edit,
							hunk,
							residualDelta
						)
					);
				});
			const replay =
				this.#replay(
					hunk,
					candidates
				);

			if (replay.matched) {
				for (
					const application of replay.applications
				) {
					used.add(
						this.#key(application.entry)
					);
				}

				if (
					replay.applications.length === 1 &&
					replay.locationUnique
				) {
					const application =
						replay.applications[0];
					const oldLineStart =
						hunk.oldStart +
						this.#newlineCount(
							application.before.slice(
								0,
								application.index
							)
						) -
						application.prefixLines;
					const newLineStart =
						hunk.newStart +
						this.#newlineCount(
							application.after.slice(
								0,
								application.index
							)
						) -
						application.prefixLines;

					locations.set(
						this.#key(application.entry),
						{
							oldLineStart,
							newLineStart
						}
					);
				}

				continue;
			}

			const unproven =
				active.filter(entry =>
					!used.has(
						this.#key(entry)
					)
				);
			const related =
				(
					!positionReliable &&
					unproven.length > 0
				) ||
				unproven.some(entry => {
					const seen =
						evidence.get(
							this.#key(entry)
						);

					if (seen?.has(index)) {
						return true;
					}

					return (
						positionReliable &&
						this.#positionTouches(
							entry.edit,
							hunk,
							residualDelta
						)
					);
				}) ||
				replay.ambiguous;
			const actorType =
				related
					? 'unknown'
					: 'human';

			unattributed.push({
				actorType,
				file,
				edit: {
					path: file,
					status: 'active',
					locationStatus:
						related
							? 'ambiguous'
							: 'current',
					oldLineStart:
						hunk.oldStart,
					newLineStart:
						hunk.newStart,
					lineStart:
						hunk.newStart,
					lineEnd:
						hunk.newStart +
						Math.max(
							hunk.inserted.length,
							1
						) -
						1,
					shift: 0,
					removed:
						hunk.removedText,
					inserted:
						hunk.insertedText
				}
			});

			if (related) {
				positionReliable = false;
			} else {
				residualDelta +=
					hunk.inserted.length -
					hunk.removed.length;
			}
		}

		return {
			locations,
			unattributed,
			attributed: used
		};
	}

	#evidence(entries, hunks) {
		const result =
			new Map();

		for (const entry of entries) {
			const indexes =
				new Set();
			const normalized =
				this.#normalizedEdit(
					entry.edit
				);
			const removed =
				normalized.removed;
			const inserted =
				normalized.inserted;

			for (
				let index = 0;
				index < hunks.length;
				index++
			) {
				const hunk =
					hunks[index];

				if (
					(
						removed !== '' &&
						hunk.removedText.includes(removed)
					) ||
					(
						inserted !== '' &&
						hunk.insertedText.includes(inserted)
					)
				) {
					indexes.add(index);
				}
			}

			result.set(
				this.#key(entry),
				indexes
			);
		}

		return result;
	}

	#positionTouches(edit, hunk, delta) {
		const lineStart =
			Number.isInteger(edit.lineStart)
				? edit.lineStart + delta
				: Number.isInteger(edit.appliedStart)
					? edit.appliedStart + delta
					: null;

		if (!Number.isInteger(lineStart)) {
			return false;
		}

		const removedCount =
			this.#textLineCount(edit.removed || '');
		const insertedCount =
			this.#textLineCount(edit.inserted || '');
		const editEnd =
			lineStart +
			Math.max(
				removedCount,
				insertedCount,
				1
			) -
			1;
		const hunkEnd =
			hunk.newStart +
			Math.max(
				hunk.removed.length,
				hunk.inserted.length,
				1
			) -
			1;

		return (
			lineStart <= hunkEnd &&
			editEnd >= hunk.newStart
		);
	}

	#replay(hunk, candidates) {
		if (candidates.length === 0) {
			return {
				matched: false,
				applications: [],
				ambiguous: false
			};
		}

		const target =
			hunk.insertedText;
		const stack = [
			{
				text: hunk.removedText,
				remaining: candidates,
				applications: []
			}
		];
		const visited =
			new Set();
		const solutions = [];
		const ownership =
			new Set();
		let explored = 0;
		let exhausted = false;

		while (stack.length > 0) {
			if (++explored > 256) {
				exhausted = true;
				break;
			}

			const state =
				stack.pop();
			const applicationSignature =
				state.applications
					.map(application =>
						this.#key(
							application.entry
						) +
						'@' +
						application.index
					)
					.sort()
					.join(',');
			const signature =
				state.text +
				'\u0000' +
				state.remaining
					.map(entry =>
						this.#key(entry)
					)
					.sort()
					.join(',') +
				'\u0000' +
				applicationSignature;

			if (visited.has(signature)) {
				continue;
			}

			visited.add(signature);

			if (
				state.text === target &&
				state.applications.length > 0
			) {
				const ownerSignature =
					state.applications
						.map(application =>
							this.#key(
								application.entry
							)
						)
						.sort()
						.join(',');

				ownership.add(
					ownerSignature
				);
				solutions.push(
					state.applications
				);

				continue;
			}

			for (
				let candidateIndex = 0;
				candidateIndex < state.remaining.length;
				candidateIndex++
			) {
				const entry =
					state.remaining[
						candidateIndex
					];
				const normalized =
					this.#normalizedEdit(
						entry.edit
					);
				const removed =
					normalized.removed;
				const inserted =
					normalized.inserted;
				const indexes =
					removed === ''
						? this.#directInsertionIndexes(
							state.text,
							target,
							inserted
						)
						: this.#occurrences(
							state.text,
							removed
						);

				for (const index of indexes) {
					const next =
						state.text.slice(0, index) +
						inserted +
						state.text.slice(
							index +
								removed.length
						);
					const remaining = [
						...state.remaining.slice(
							0,
							candidateIndex
						),
						...state.remaining.slice(
							candidateIndex + 1
						)
					];

					stack.push({
						text: next,
						remaining,
						applications: [
							...state.applications,
							{
								entry,
								index,
								prefixLines:
									normalized.prefixLines,
								before:
									state.text,
								after:
									next
							}
						]
					});
				}
			}
		}

		if (
			exhausted ||
			solutions.length === 0 ||
			ownership.size !== 1
		) {
			return {
				matched: false,
				applications: [],
				ambiguous:
					exhausted ||
					ownership.size > 1
			};
		}

		const first =
			solutions[0];
		const locationUnique =
			first.length !== 1 ||
			new Set(
				solutions.map(solution => {
					const application =
						solution[0];

					return (
						this.#key(
							application.entry
						) +
						'@' +
						application.index
					);
				})
			).size === 1;

		return {
			matched: true,
			applications: first,
			locationUnique,
			ambiguous: false
		};
	}

	#directInsertionIndexes(text, target, inserted) {
		if (
			inserted === '' ||
			target.length !==
				text.length + inserted.length
		) {
			return [];
		}

		const matches = [];

		for (
			let index = 0;
			index <= text.length;
			index++
		) {
			if (
				text.slice(0, index) +
					inserted +
					text.slice(index) ===
				target
			) {
				matches.push(index);

				if (matches.length >= 16) {
					break;
				}
			}
		}

		return matches;
	}

	#normalizedEdit(edit) {
		const removed =
			this.#canonical(
				edit.removed || ''
			);
		const inserted =
			this.#canonical(
				edit.inserted || ''
			);

		if (edit.mode !== 'lines') {
			return {
				removed,
				inserted,
				prefixLines: 0
			};
		}

		const removedLines =
			removed === ''
				? []
				: removed.split('\n');
		const insertedLines =
			inserted === ''
				? []
				: inserted.split('\n');
		let prefixLines = 0;

		while (
			prefixLines < removedLines.length &&
			prefixLines < insertedLines.length &&
			removedLines[prefixLines] ===
				insertedLines[prefixLines]
		) {
			prefixLines++;
		}

		let removedEnd =
			removedLines.length;
		let insertedEnd =
			insertedLines.length;

		while (
			removedEnd > prefixLines &&
			insertedEnd > prefixLines &&
			removedLines[removedEnd - 1] ===
				insertedLines[insertedEnd - 1]
		) {
			removedEnd--;
			insertedEnd--;
		}

		return {
			removed:
				removedLines
					.slice(
						prefixLines,
						removedEnd
					)
					.join('\n'),
			inserted:
				insertedLines
					.slice(
						prefixLines,
						insertedEnd
					)
					.join('\n'),
			prefixLines
		};
	}


	#canonical(text) {
		return text.replace(/\r\n/g, '\n');
	}

	#occurrences(text, needle) {
		const matches = [];
		let index =
			text.indexOf(needle);

		while (index !== -1) {
			matches.push(index);

			if (matches.length >= 16) {
				break;
			}

			index =
				text.indexOf(
					needle,
					index + 1
				);
		}

		return matches;
	}

	#hunks(before, after) {
		const operations =
			this.#operations(
				this.#lines(before),
				this.#lines(after)
			);
		const hunks = [];
		let current = null;
		let oldLine = 0;
		let newLine = 0;

		const finish = () => {
			if (!current) {
				return;
			}

			current.removedText =
				current.removed.join('\n');
			current.insertedText =
				current.inserted.join('\n');
			hunks.push(current);
			current = null;
		};

		for (const operation of operations) {
			if (operation.type === 'equal') {
				finish();
				oldLine++;
				newLine++;
				continue;
			}

			if (!current) {
				current = {
					oldStart: oldLine,
					newStart: newLine,
					removed: [],
					inserted: []
				};
			}

			if (operation.type === 'delete') {
				current.removed.push(
					operation.line
				);
				oldLine++;
				continue;
			}

			current.inserted.push(
				operation.line
			);
			newLine++;
		}

		finish();

		return hunks;
	}

	#operations(before, after) {
		const maximum =
			before.length + after.length;
		const paths =
			new Map([
				[1, 0]
			]);
		const trace = [];

		for (
			let distance = 0;
			distance <= maximum;
			distance++
		) {
			trace.push(
				new Map(paths)
			);

			for (
				let diagonal = -distance;
				diagonal <= distance;
				diagonal += 2
			) {
				const left =
					paths.get(diagonal - 1) ??
					Number.NEGATIVE_INFINITY;
				const right =
					paths.get(diagonal + 1) ??
					Number.NEGATIVE_INFINITY;
				let oldIndex;

				if (
					diagonal === -distance ||
					(
						diagonal !== distance &&
						left < right
					)
				) {
					oldIndex =
						right;
				} else {
					oldIndex =
						left + 1;
				}

				let newIndex =
					oldIndex - diagonal;

				while (
					oldIndex < before.length &&
					newIndex < after.length &&
					before[oldIndex] ===
						after[newIndex]
				) {
					oldIndex++;
					newIndex++;
				}

				paths.set(
					diagonal,
					oldIndex
				);

				if (
					oldIndex >= before.length &&
					newIndex >= after.length
				) {
					return this.#backtrack(
						trace,
						before,
						after,
						distance
					);
				}
			}
		}

		return [];
	}

	#backtrack(
		trace,
		before,
		after,
		maximumDistance
	) {
		const operations = [];
		let oldIndex =
			before.length;
		let newIndex =
			after.length;

		for (
			let distance = maximumDistance;
			distance >= 0;
			distance--
		) {
			const paths =
				trace[distance];
			const diagonal =
				oldIndex - newIndex;
			const left =
				paths.get(diagonal - 1) ??
				Number.NEGATIVE_INFINITY;
			const right =
				paths.get(diagonal + 1) ??
				Number.NEGATIVE_INFINITY;
			const previousDiagonal =
				diagonal === -distance ||
				(
					diagonal !== distance &&
					left < right
				)
					? diagonal + 1
					: diagonal - 1;
			const previousOld =
				paths.get(previousDiagonal) ?? 0;
			const previousNew =
				previousOld -
				previousDiagonal;

			while (
				oldIndex > previousOld &&
				newIndex > previousNew
			) {
				operations.push({
					type: 'equal',
					line:
						before[oldIndex - 1]
				});
				oldIndex--;
				newIndex--;
			}

			if (distance === 0) {
				break;
			}

			if (oldIndex === previousOld) {
				operations.push({
					type: 'insert',
					line:
						after[newIndex - 1]
				});
				newIndex--;
			} else {
				operations.push({
					type: 'delete',
					line:
						before[oldIndex - 1]
				});
				oldIndex--;
			}
		}

		return operations.reverse();
	}

	#lines(content) {
		if (content === '') {
			return [];
		}

		const result =
			content.split(/\r?\n/);

		if (/\r?\n$/.test(content)) {
			result.pop();
		}

		return result;
	}

	#textLineCount(text) {
		return text === ''
			? 0
			: text.split(/\r?\n/).length;
	}

	#newlineCount(text) {
		return (
			text.match(/\n/g) || []
		).length;
	}

	#key(entry) {
		return (
			entry.session.id +
			'\u0000' +
			entry.edit.id
		);
	}
}
