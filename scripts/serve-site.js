import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const root = path.join(projectRoot, 'docs');
const liveCore = new Map([
	['/runtime/core/TextEditor.js', 'TextEditor.js'],
	['/runtime/core/PeerRegistry.js', 'PeerRegistry.js'],
	['/runtime/core/Reconciler.js', 'Reconciler.js'],
	['/runtime/core/Diff.js', 'Diff.js']
]);
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4213);

const types = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
	let pathname;

	try {
		pathname = decodeURIComponent(
			new URL(request.url, 'http://localhost').pathname
		);
	} catch {
		response.writeHead(400);
		response.end('Bad request');
		return;
	}

	let target;

	if (liveCore.has(pathname)) {
		target = path.join(
			projectRoot,
			'src',
			liveCore.get(pathname)
		);
	} else {
		target = path.resolve(root, '.' + pathname);

		if (
			target !== root &&
			!target.startsWith(root + path.sep)
		) {
			response.writeHead(403);
			response.end('Forbidden');
			return;
		}
	}


	try {
		if (fs.statSync(target).isDirectory()) {
			target = path.join(target, 'index.html');
		}
	} catch {
		response.writeHead(404);
		response.end('Not found');
		return;
	}

	if (!fs.existsSync(target)) {
		response.writeHead(404);
		response.end('Not found');
		return;
	}

	response.writeHead(200, {
		'Content-Type':
			types[path.extname(target)] ||
			'application/octet-stream',
		'Cache-Control': 'no-store'
	});

	fs.createReadStream(target).pipe(response);
});

server.listen(port, host, () => {
	process.stdout.write(
		'Splicemark site: http://' +
		host +
		':' +
		port +
		'\n'
	);
});
