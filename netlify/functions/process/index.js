const archiver = require('archiver');
const sharp = require('sharp');
const mimetics = require('mimetics')
const {parseMultipartForm} = require('./processMultipartForm.js');

exports.handler = async (event) => {
    try {
        const file = await parseMultipartForm(event); // Assuming the image file is sent in the request body
        // Process the image
        if(!('image' in file)){
            return {
                statusCode: 422,
                body: JSON.stringify({
                    data: {
                        errors: {
                            image: "The property is missing."
                        }
                    }
                })
            }
        }
        const processedImages = await processImage(file.image);

        // Create a zip file containing the processed images
        const zipData = await createZip(processedImages);

        // Return the zip file data
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="processed-images.zip"',
            },
            body: zipData.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Error processing images:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error processing images' }),
        };
    }
};

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

async function processImage(file) {
    // Check if the file has a supported extension
    const fileExtension = mimetics(file.content).ext;
    if (fileExtension.match(/^(png|jpg|jpeg)$/i) === null) {
        throw Error(`Skipping unsupported file format: ${fileExtension}`);
    }
    
    const maxWidth = await getMaxWidth(file.content);
    const originalFormat = fileExtension === "png" ? 'png' : 'jpeg';
    const sizes = responsiveImages(maxWidth, originalFormat);
    let outputData = {};

    for (const size of sizes) {
        // Correctly handle file naming for different formats
        let outputFileName;
        const suffix = size.format.endsWith(originalFormat) ? size.rename.suffix : size.rename.suffix + '.' + size.format;

        if (size.format.endsWith(originalFormat)) {
            outputFileName = file.filename.replace(/(\.jpeg|\.jpg|\.png)$/i, suffix) + '.' + originalFormat;
        } else {
            outputFileName = file.filename.replace(/(\.jpeg|\.jpg|\.png)$/i, '') + suffix;
        }
        if(outputFileName.endsWith('.jpeg')){
            outputFileName = outputFileName.replace('.jpeg', '.jpg');
        }

        const resizedFile = await sharp(file.content).resize({ width: size.width }).toFormat(size.format).toBuffer();
        outputData[outputFileName] = resizedFile;
    }
    

    return outputData;
}

async function createZip(processedImages) {
    return new Promise((resolve, reject) => {
        const zipData = [];
        const archive = archiver('zip', {
            zlib: { level: 9 } // Set compression level to maximum
        });

        archive.on('error', (err) => {
            console.error('Error creating zip file:', err);
            reject(err);
        });

        archive.on('data', (chunk) => {
            zipData.push(chunk);
        });

        archive.on('end', () => {
            const zipBuffer = Buffer.concat(zipData);
            resolve(zipBuffer);
        });

        // Add each processed image to the zip file
        for (const fileName in processedImages) {
            archive.append(processedImages[fileName], { name: fileName });
        };

        archive.finalize();
    });
}
