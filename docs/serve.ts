const server = Bun.serve({
	port: 4444,
	async fetch(req) {
		const url = new URL(req.url);
		const path = url.pathname === '/' ? '/index.html' : url.pathname;
		const file = Bun.file(`./docs${path}`);
		if (await file.exists())
			return new Response(file, {
				headers: { 'Cache-Control': 'no-store' },
			});
		return new Response('Not found', { status: 404 });
	},
});

console.log(`\n  DataStoria docs: http://localhost:${server.port}\n`);
