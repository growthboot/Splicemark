import assert from 'node:assert/strict';
import test from 'node:test';
import Diff from '../src/Diff.js';
import MemoryGit from '../src/MemoryGit.js';
import MemorySessionStore from '../src/MemorySessionStore.js';
import MemoryWorkspace from '../src/MemoryWorkspace.js';
import SplicemarkCore from '../src/SplicemarkCore.js';

function runtime(files) {
	const workspace =
		new MemoryWorkspace(files);
	const git =
		new MemoryGit({
			workspace
		});
	const splicemark =
		new SplicemarkCore({
			git,
			store: new MemorySessionStore(),
			workspace
		});

	return {
		git,
		splicemark,
		workspace
	};
}

test('browser-safe runtime surfaces real peer output from memory adapters', () => {
	const {
		splicemark,
		workspace
	} = runtime({
		'source.txt':
			'zero\nold\nlast\n'
	});
	const first =
		splicemark.start('Change source');
	const second =
		splicemark.start('Update same source');

	splicemark.edit(first.id, 'source.txt', {
		mode: 'lines',
		start: 1,
		end: 1,
		expectedStart: 'old',
		expectedEnd: 'old',
		replacement: 'agent-a'
	});

	const result =
		splicemark.edit(second.id, 'source.txt', {
			mode: 'lines',
			start: 1,
			end: 1,
			expectedStart: 'agent-a',
			expectedEnd: 'agent-a',
			replacement: 'agent-b'
		});

	assert.equal(
		workspace.read('/repo/source.txt'),
		'zero\nagent-b\nlast\n'
	);
	assert.equal(result.peers.length, 1);
	assert.equal(
		result.peers[0].session.id,
		first.id
	);

	const output =
		new Diff().format(
			result.session,
			result.file,
			result.edit,
			result.peers
		);

	assert.match(
		output,
		/\[YOU · AGENT · sm-[0-9a-f]{8} · Update same source\]/
	);
	assert.match(
		output,
		/\[PEER · AGENT · sm-[0-9a-f]{8} · Change source\]/
	);
	assert.match(output, /\+agent-a/);
});

test('memory git snapshots drive the production reconciliation path', () => {
	const {
		git,
		splicemark
	} = runtime({
		'source.txt':
			'zero\nold\nlast\n'
	});
	const session =
		splicemark.start('Change source');

	splicemark.edit(session.id, 'source.txt', {
		mode: 'lines',
		start: 1,
		end: 1,
		expectedStart: 'old',
		expectedEnd: 'old',
		replacement: 'new'
	});

	git.commit();

	const state =
		splicemark.diff(session.id);

	assert.equal(state.edits.length, 1);
	assert.equal(state.edits[0].status, 'retired');
	assert.equal(state.session.head, git.getHead());
});

test('memory git can model an unrelated file commit without retiring working edits', () => {
	const {
		git,
		splicemark,
		workspace
	} = runtime({
		'source.txt':
			'zero\nold\nlast\n'
	});
	const session =
		splicemark.start('Change source');

	splicemark.edit(session.id, 'source.txt', {
		mode: 'lines',
		start: 1,
		end: 1,
		expectedStart: 'old',
		expectedEnd: 'old',
		replacement: 'new'
	});

	workspace.write(
		'other.txt',
		'other\n'
	);
	git.commit({
		files: [
			'other.txt'
		]
	});

	const state =
		splicemark.diff(session.id);

	assert.equal(state.edits.length, 1);
	assert.equal(state.edits[0].status, 'active');
});
