import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
	entryPoints: ['src/extension.ts'],
	bundle: true,
	outfile: 'dist/extension.js',
	external: ['vscode'],
	format: 'cjs',
	platform: 'node',
	target: 'node18',
	sourcemap: !isProduction,
	minify: isProduction,
	metafile: true,
};

if (isWatch) {
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');
} else {
	const result = await esbuild.build(buildOptions);
	if (result.metafile) {
		const analysis = await esbuild.analyzeMetafile(result.metafile);
		console.log(analysis);
	}
}
