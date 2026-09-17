import TextEditor from './TextEditor.js';

export default class MemoryWorkspace {
	#files = new Map();
	#root;

	constructor(
		files = {},
		{
			root = '/repo'
		} = {}
	) {
		this.#root =
			this.#normalizeAbsolute(root);

		for (
			const [file, content] of Object.entries(files)
		) {
			this.write(file, content);
		}
	}

	getRoot() {
		return this.#root;
	}

	resolve(file, root = this.#root) {
		const repositoryRoot =
			this.#normalizeAbsolute(root);
		const absolute =
			this.#absolute(file, repositoryRoot);

		if (
			absolute !== repositoryRoot &&
			!absolute.startsWith(repositoryRoot + '/')
		) {
			const error =
				new Error('target must be inside the repository');

			error.code = 'OUTSIDE_REPOSITORY';
			throw error;
		}

		if (!this.#files.has(absolute)) {
			throw new Error('file not found: ' + file);
		}

		return {
			file: absolute,
			relative:
				absolute === repositoryRoot
					? ''
					: absolute.slice(repositoryRoot.length + 1)
		};
	}

	read(file) {
		const absolute =
			this.#absolute(file);

		if (!this.#files.has(absolute)) {
			throw new Error('file not found: ' + file);
		}

		return this.#files.get(absolute);
	}

	write(file, content) {
		this.#files.set(
			this.#absolute(file),
			String(content)
		);
	}

	edit(file, options) {
		const original =
			this.read(file);
		const result =
			new TextEditor()
				.edit(original, options);

		this.write(file, result.content);

		return result.edit;
	}

	batch(file, options) {
		const original =
			this.read(file);
		const result =
			new TextEditor()
				.batch(original, options);

		this.write(file, result.content);

		return result.edits;
	}

	snapshot() {
		const snapshot = {};

		for (const [file, content] of this.#files) {
			snapshot[
				file.slice(this.#root.length + 1)
			] = content;
		}

		return snapshot;
	}

	#absolute(file, root = this.#root) {
		const value =
			String(file).replace(/\\/g, '/');

		if (value.startsWith('/')) {
			return this.#normalizeAbsolute(value);
		}

		return this.#normalizeAbsolute(
			root + '/' + value
		);
	}

	#normalizeAbsolute(file) {
		const parts = [];
		const value =
			String(file).replace(/\\/g, '/');

		for (const part of value.split('/')) {
			if (!part || part === '.') {
				continue;
			}

			if (part === '..') {
				parts.pop();
				continue;
			}

			parts.push(part);
		}

		return '/' + parts.join('/');
	}
}
