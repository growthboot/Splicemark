import path from 'node:path';
import Git from './Git.js';
import NodeWorkspace from './NodeWorkspace.js';
import SessionStore from './SessionStore.js';
import SplicemarkCore from './SplicemarkCore.js';

export default class Splicemark extends SplicemarkCore {
	constructor({
		cwd = process.cwd()
	} = {}) {
		const git = new Git(cwd);

		super({
			git,
			storeFactory: () =>
				new SessionStore(
					path.join(
						git.getCommonDir(),
						'splicemark'
					)
				),
			workspace:
				new NodeWorkspace(cwd)
		});
	}
}
