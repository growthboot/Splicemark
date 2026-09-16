import fs from 'node:fs';
import TextEditor from './TextEditor.js';

export default class FileEditor {
	edit(file, options) {
		const original = fs.readFileSync(file, 'utf8');
		const result = new TextEditor().edit(original, options);

		fs.writeFileSync(file, result.content);

		return result.edit;
	}

	batch(file, options) {
		const original = fs.readFileSync(file, 'utf8');
		const result = new TextEditor().batch(original, options);

		fs.writeFileSync(file, result.content);

		return result.edits;
	}
}
