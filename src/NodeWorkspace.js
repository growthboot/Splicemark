import fs from 'node:fs';
import path from 'node:path';
import FileEditor from './FileEditor.js';

export default class NodeWorkspace {
	#cwd;

	constructor(cwd = process.cwd()) {
		this.#cwd = fs.realpathSync(cwd);
	}

	resolve(file, root) {
		const absolute =
			fs.realpathSync(
				path.resolve(this.#cwd, file)
			);
		const relative =
			path.relative(root, absolute);

		if (
			relative === '..' ||
			relative.startsWith('..' + path.sep) ||
			path.isAbsolute(relative)
		) {
			const error =
				new Error('target must be inside the repository');

			error.code = 'OUTSIDE_REPOSITORY';
			throw error;
		}

		return {
			file: absolute,
			relative
		};
	}

	read(file) {
		return fs.readFileSync(file, 'utf8');
	}

	edit(file, options) {
		return new FileEditor()
			.edit(file, options);
	}

	batch(file, options) {
		return new FileEditor()
			.batch(file, options);
	}
}
