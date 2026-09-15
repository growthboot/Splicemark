import fs from 'node:fs';

export default class FileEditor {
	edit(file, options) {
		if (options.mode === 'lines') {
			return this.#editLines(file, options);
		}

		if (options.mode === 'chars') {
			return this.#editChars(file, options);
		}

		throw new Error('edit mode must be lines or chars');
	}

	batch(file, options) {
		if (!Array.isArray(options.splices) || options.splices.length === 0) {
			throw new Error('batch requires at least one splice');
		}

		const splices = options.splices.map((splice, index) => {
			this.#validateRange(splice.start, splice.end);

			if (typeof splice.replacement !== 'string') {
				throw new Error('batch splice ' + index + ' replacement must be a string');
			}

			return {
				start: splice.start,
				end: splice.end,
				replacement: splice.replacement
			};
		}).sort((a, b) => b.start - a.start || b.end - a.end);

		for (let i = 0; i < splices.length - 1; i++) {
			if (splices[i + 1].end >= splices[i].start) {
				throw new Error('batch ranges must not overlap');
			}
		}

		if (options.mode === 'lines') {
			return this.#batchLines(file, splices);
		}

		if (options.mode === 'chars') {
			return this.#batchChars(file, splices);
		}

		throw new Error('batch mode must be lines or chars');
	}

	#batchLines(file, splices) {
		const original = fs.readFileSync(file, 'utf8');
		const newline = original.includes('\r\n') ? '\r\n' : '\n';
		const lines = original.split(/\r?\n/);
		const results = [];

		for (const splice of splices) {
			if (splice.end >= lines.length) {
				throw new Error('batch line range is outside the file');
			}
		}

		for (const splice of splices) {
			const removedCount = splice.end - splice.start + 1;
			const removed = lines.slice(splice.start, splice.end + 1).join(newline);
			const insertedLines = splice.replacement === ''
				? []
				: splice.replacement.split(/\r?\n/);

			lines.splice(
				splice.start,
				removedCount,
				...insertedLines
			);

			results.push({
				mode: 'lines',
				requestedStart: splice.start,
				requestedEnd: splice.end,
				appliedStart: splice.start,
				appliedEnd: splice.end,
				shift: 0,
				targetLineStart: splice.start,
				targetLineEnd: splice.end,
				lineStart: splice.start,
				lineEnd: splice.start + Math.max(insertedLines.length, 1) - 1,
				lineDelta: insertedLines.length - removedCount,
				removed,
				inserted: splice.replacement
			});
		}

		fs.writeFileSync(file, lines.join(newline));

		return results;
	}

	#batchChars(file, splices) {
		const original = fs.readFileSync(file, 'utf8');
		let content = original;
		const results = [];

		for (const splice of splices) {
			if (splice.end >= original.length) {
				throw new Error('batch character range is outside the file');
			}
		}

		for (const splice of splices) {
			const removed = content.slice(splice.start, splice.end + 1);
			const targetLineStart = this.#lineAt(content, splice.start);
			const targetLineEnd = this.#lineAt(content, splice.end);
			const lineDelta =
				this.#newlineCount(splice.replacement) -
				this.#newlineCount(removed);

			content =
				content.slice(0, splice.start) +
				splice.replacement +
				content.slice(splice.end + 1);

			results.push({
				mode: 'chars',
				requestedStart: splice.start,
				requestedEnd: splice.end,
				appliedStart: splice.start,
				appliedEnd: splice.end,
				shift: 0,
				targetLineStart,
				targetLineEnd,
				lineStart: targetLineStart,
				lineEnd: targetLineStart + this.#newlineCount(splice.replacement),
				lineDelta,
				removed,
				inserted: splice.replacement
			});
		}

		fs.writeFileSync(file, content);

		return results;
	}

	#editLines(file, options) {
		const original = fs.readFileSync(file, 'utf8');
		const newline = original.includes('\r\n') ? '\r\n' : '\n';
		const lines = original.split(/\r?\n/);
		const range = this.#locateLineRange(lines, options);
		const removed = lines.slice(range.start, range.end + 1).join(newline);
		const insertedLines = options.replacement === ''
			? []
			: options.replacement.split(/\r?\n/);
		const removedCount = range.end - range.start + 1;

		lines.splice(
			range.start,
			removedCount,
			...insertedLines
		);

		fs.writeFileSync(file, lines.join(newline));

		return {
			mode: 'lines',
			requestedStart: options.start,
			requestedEnd: options.end,
			appliedStart: range.start,
			appliedEnd: range.end,
			shift: range.start - options.start,
			targetLineStart: range.start,
			targetLineEnd: range.end,
			lineStart: range.start,
			lineEnd: range.start + Math.max(insertedLines.length, 1) - 1,
			lineDelta: insertedLines.length - removedCount,
			removed,
			inserted: options.replacement
		};
	}

	#editChars(file, options) {
		const original = fs.readFileSync(file, 'utf8');
		const range = this.#locateCharRange(original, options);
		const removed = original.slice(range.start, range.end + 1);
		const targetLineStart = this.#lineAt(original, range.start);
		const targetLineEnd = this.#lineAt(original, range.end);
		const lineDelta =
			this.#newlineCount(options.replacement) -
			this.#newlineCount(removed);
		const updated =
			original.slice(0, range.start) +
			options.replacement +
			original.slice(range.end + 1);

		fs.writeFileSync(file, updated);

		return {
			mode: 'chars',
			requestedStart: options.start,
			requestedEnd: options.end,
			appliedStart: range.start,
			appliedEnd: range.end,
			shift: range.start - options.start,
			targetLineStart,
			targetLineEnd,
			lineStart: targetLineStart,
			lineEnd: targetLineStart + this.#newlineCount(options.replacement),
			lineDelta,
			removed,
			inserted: options.replacement
		};
	}

	#locateLineRange(lines, options) {
		this.#validateRange(options.start, options.end);

		const span = options.end - options.start;

		if (
			lines[options.start] === options.expectedStart &&
			lines[options.end] === options.expectedEnd
		) {
			return {
				start: options.start,
				end: options.end
			};
		}

		const matches = [];

		for (let start = 0; start + span < lines.length; start++) {
			if (
				lines[start] === options.expectedStart &&
				lines[start + span] === options.expectedEnd
			) {
				matches.push({
					start,
					end: start + span
				});
			}
		}

		return this.#requireUniqueMatch(matches, 'line');
	}

	#locateCharRange(content, options) {
		this.#validateRange(options.start, options.end);

		if (!options.expectedStart || !options.expectedEnd) {
			throw new Error('character boundaries cannot be empty');
		}

		if (this.#charBoundariesMatch(content, options.start, options.end, options)) {
			return {
				start: options.start,
				end: options.end
			};
		}

		const span = options.end - options.start;
		const matches = [];
		let start = content.indexOf(options.expectedStart);

		while (start !== -1) {
			const end = start + span;

			if (this.#charBoundariesMatch(content, start, end, options)) {
				matches.push({
					start,
					end
				});
			}

			start = content.indexOf(options.expectedStart, start + 1);
		}

		return this.#requireUniqueMatch(matches, 'character');
	}

	#charBoundariesMatch(content, start, end, options) {
		if (start < 0 || end >= content.length) {
			return false;
		}

		return (
			content.startsWith(options.expectedStart, start) &&
			content.slice(
				end - options.expectedEnd.length + 1,
				end + 1
			) === options.expectedEnd
		);
	}

	#requireUniqueMatch(matches, type) {
		if (matches.length === 1) {
			return matches[0];
		}

		if (matches.length === 0) {
			throw new Error(type + ' boundaries no longer match');
		}

		throw new Error(type + ' boundary relocation is ambiguous');
	}

	#lineAt(content, index) {
		return this.#newlineCount(content.slice(0, index));
	}

	#newlineCount(content) {
		return (content.match(/\n/g) || []).length;
	}

	#validateRange(start, end) {
		if (
			!Number.isInteger(start) ||
			!Number.isInteger(end) ||
			start < 0 ||
			end < start
		) {
			throw new Error('range must contain non-negative inclusive indexes');
		}
	}
}
