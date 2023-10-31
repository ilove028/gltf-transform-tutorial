const { createGzip } = require('zlib');
const { pipeline } = require('stream');
const path = require('path');
const fsExtra = require("fs-extra");
const { promisify } = require('util');
const pipe = promisify(pipeline);
const {
  createReadStream,
  createWriteStream
} = require('fs');

async function do_gzip(input, output, options) {
  const gzip = createGzip(options);
  const source = createReadStream(input);
  const destination = createWriteStream(output);
  await pipe(source, gzip, destination);
}


// const gzip = createGzip();
// const source = createReadStream(path.join(__dirname, "../public/Station_4010101100000000000000000000000_Unity/4010101100000000000000000000000_BigScene.mesh"));
// const destination = createWriteStream(path.join(__dirname, '../public/gzip/Station_4010101100000000000000000000000_Unity/4010101100000000000000000000000_BigScene.mesh'));

// pipeline(source, gzip, destination, (err) => {
//   if (err) {
//     console.error('An error occurred:', err);
//     process.exitCode = 1;
//   }
// });

const compression = async (rootPath, destination, options) => {
  const run = async (rootPath, destination) => {
    const files = await fsExtra.readdir(rootPath)

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(rootPath, file);
      const desPath = path.join(destination, file);
      const stat = fsExtra.statSync(filePath);

      if (stat.isFile()) {
        await fsExtra.ensureFile(desPath);
        await do_gzip(filePath, desPath, options);
      } else if (stat.isDirectory()) {
        await run(filePath, desPath);
      }
    }
  }

  await run(rootPath, destination)
}

// compression(path.join(__dirname, "../public/Station_4010101100000000000000000000000_Unity"), path.join(__dirname, "../public/gzip/Station_4010101100000000000000000000000_Unity"))
compression(path.join(__dirname, "../public/mei-shi"), path.join(__dirname, "../public/gzip/mei-shi"))