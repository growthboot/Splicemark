import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default class Git {
	#cwd;

	constructor(cwd = process.cwd()) {
		this.#cwd = fs.realpathSync(cwd);
	}

	getCommonDir() {
		const result = this.#run(['rev-parse', '--git-common-dir']);
		return path.resolve(this.#cwd, result);
	}

	getRoot() {
		return fs.realpathSync(this.#run(['rev-parse', '--show-toplevel']));
	}

	getHead() {
		return this.#run(['rev-parse', 'HEAD'], true);
	}

	getHeadContent(file) {
		return this.#runRaw([
			'show',
			'HEAD:' + file
		], true);
	}


	getWorkingDiff(file) {
		return this.#run([
			'diff',
			'--no-color',
			'--unified=0',
			'HEAD',
			'--',
			file
		], true);
	}

	getCommittedDiff(fromHead, toHead, file) {
		if (!fromHead || !toHead || fromHead === toHead) {
			return '';
		}

		return this.#run([
			'diff',
			'--no-color',
			'--unified=0',
			fromHead,
			toHead,
			'--',
			file
		], true);
	}

	#run(args, allowFailure = false) {
		const result =
			this.#runRaw(
				args,
				allowFailure
			);

		return result === null
			? null
			: result.trim();
	}

	#runRaw(args, allowFailure = false) {
		try {
			return execFileSync('git', args, {
				cwd: this.#cwd,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe']
			});
		} catch (error) {
			if (allowFailure) {
				return null;
			}

			throw error;
		}
	}
}
