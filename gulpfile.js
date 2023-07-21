// Gulpfile.js
const { src, dest } = require("gulp");
const sharp = require("sharp");
const sharpResponsive = require("gulp-sharp-responsive");
var fs = require('fs');
function defaultTask(done) {
	done();
  }

  async function getMaxWidth(filePath) {
	const metadata = await sharp(filePath).metadata();
	return metadata.width;
  }

  function responsiveImages(format) {
	return (width) => [
	  { width: Math.min(320, width), format, rename: { suffix: `-xs` } },
	  { width: Math.min(375, width), format, rename: { suffix: `-sm` } },
	  { width: Math.min(768, width), format, rename: { suffix: `-md` } },
	  { width: Math.min(1024, width), format, rename: { suffix: `-lg` } },
	  { width: Math.min(1500, width), format, rename: { suffix: `-xl` } },
	  { width: Math.min(2000, width), format, rename: { suffix: `-2xl` } },
	];
  }
  
  
  const processImages = async () => {
	const imageFiles = await fs.promises.readdir("images");
	imageFiles.forEach(async (file) => {
	  const fullPath = `images/${file}`;
  
	  // Check if the file has a supported extension
	  if (!file.match(/\.(png|jpg|jpeg)$/i)) {
		console.log(`Skipping unsupported file format: ${file}`);
		return;
	  }
  
	  const maxWidth = await getMaxWidth(fullPath);
  
	  if (file.endsWith(".png")) {
		src(fullPath)
		  .pipe(
			sharpResponsive({
			  formats: [
				...responsiveImages("png")(maxWidth),
				...responsiveImages("webp")(maxWidth),
			  ],
			})
		  )
		  .pipe(dest("public/images/"));
	  } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
		src(fullPath)
		  .pipe(
			sharpResponsive({
			  formats: [
				...responsiveImages("jpeg")(maxWidth),
				...responsiveImages("webp")(maxWidth),
			  ],
			})
		  )
		  .pipe(dest("public/images/"));
	  }
	});
  };

module.exports = {
  default: defaultTask,
  img: processImages,
};