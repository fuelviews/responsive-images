const { src, dest } = require("gulp");
const sharp = require("sharp");
var fs = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

function defaultTask(done) {
	done();
}

async function getMaxWidth(filePath) {
	const metadata = await sharp(filePath).metadata();
	return metadata.width;
}

function responsiveImages(width, originalFormat) {
	const formats = originalFormat === 'png' ? ['png', 'webp'] : ['jpeg', 'webp'];

	return formats.flatMap(format => [
		{ width: Math.min(320, width), format, rename: { suffix: '-xs' } },
		{ width: Math.min(375, width), format, rename: { suffix: '-sm' } },
		{ width: Math.min(768, width), format, rename: { suffix: '-md' } },
		{ width: Math.min(1024, width), format, rename: { suffix: '-lg' } },
		{ width: Math.min(1500, width), format, rename: { suffix: '-xl' } },
		{ width: Math.min(2000, width), format, rename: { suffix: '-2xl' } },
	]);
}

async function processImages() {
	const imageFiles = await fs.promises.readdir("images");

	for (const file of imageFiles) {
		let fullPath = `images/${file}`;

		// Check if the file has a supported extension
		if (!file.match(/\.(png|jpg|jpeg)$/i)) {
			console.log(`Skipping unsupported file format: ${file}`);
			continue;
		}

		const maxWidth = await getMaxWidth(fullPath);
		const originalFormat = file.endsWith('.png') ? 'png' : 'jpeg';
		const sizes = responsiveImages(maxWidth, originalFormat);

		for (const size of sizes) {
			// Correctly handle file naming for different formats
			let outputFileName;
			const suffix = size.format === originalFormat ? size.rename.suffix : size.rename.suffix + '.' + size.format;

			if (size.format === originalFormat) {
				outputFileName = file.replace(/(\.jpeg|\.jpg|\.png)$/i, suffix) + '.' + originalFormat;
			} else {
				outputFileName = file.replace(/(\.jpeg|\.jpg|\.png)$/i, '') + suffix;
			}

			const outputPath = `public/images/${outputFileName}`;

			await pipeline(
				fs.createReadStream(fullPath),
				sharp().resize({ width: size.width }).toFormat(size.format),
				fs.createWriteStream(outputPath)
			);

			console.log(`Processed ${outputPath}`);
		}

		await renameJpegFiles();

		async function renameJpegFiles() {
			const outputDir = 'public/images';  // Output directory
			const files = await fs.promises.readdir(outputDir);

			for (const file of files) {
				if (file.endsWith('.jpeg')) {
					const oldPath = `${outputDir}/${file}`;
					const newPath = `${outputDir}/${file.replace('.jpeg', '.jpg')}`;

					await fs.promises.rename(oldPath, newPath);
					console.log(`Renamed ${file} to ${file.replace('.jpeg', '.jpg')}`);
				}
			}
		}
	}
}

module.exports = {
	default: defaultTask,
	img: processImages,
};
