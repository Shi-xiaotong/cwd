import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, 'widget/dist/cwd.js');
const emotionSrcDir = path.resolve(__dirname, '../emotion');
const targetDirs = {
	public: path.resolve(__dirname, 'public'),
	dist: path.resolve(__dirname, '.vitepress/dist'),
};
const targetName = process.argv[2] || 'public';
const destDir = targetDirs[targetName];

if (!destDir) {
	throw new Error(`Unknown build asset target: ${targetName}`);
}

/**
 * 复制构建所需的静态资源到目标目录。
 *
 * @param {string} targetDir - VitePress public 或最终 dist 目录。
 */
function copyBuildAssets(targetDir) {
	const dest = path.resolve(targetDir, 'cwd.js');
	const emotionDestDir = path.resolve(targetDir, 'emotion');

	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	fs.copyFileSync(src, dest);

	if (fs.existsSync(emotionSrcDir)) {
		fs.rmSync(emotionDestDir, { recursive: true, force: true });
		fs.cpSync(emotionSrcDir, emotionDestDir, {
			recursive: true,
			filter: (source) => path.basename(source) !== '.DS_Store',
		});
	}
}

copyBuildAssets(destDir);
