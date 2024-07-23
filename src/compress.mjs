import { compress, uncompress } from "./utils.mjs"
import sharp from "sharp";
import fs from "fs";
import { readdir } from 'node:fs/promises';
import { MaxRectsPacker, MaxRectsBin } from 'maxrects-packer';
import { resolve } from "path";


// compress("./public/3dtiles/GLBFileInfo")

// uncompress("./public/01230100300000000000000000000000");

// (async () => {
//   await sharp({
//     create: {
//       width: 512,
//       height: 512,
//       channels: 4,
//       background: { r: 255, g: 0, b: 0, alpha: 1 }
//     }
//   })
//   .webp()
//   .composite([
//     {
//       input: './public/images/4a1e3870fcdf1799d86d80238cf0627d.webp',
//       top: 0,
//       left: 0
//     },
//     {
//       input: './public/images/4a2dfc88157b1bcab2dd94e2188efbbd.webp',
//       top: 0,
//       left: 256
//     },
//     {
//       input: './public/images/4a3cabd57e7d77037eb87133423441d9.webp',
//       top: 256,
//       left: 0
//     },
//     {
//       input: './public/images/4acf36c79b4ca1371cb47fb01167c5fe.webp',
//       top: 256,
//       left: 256
//     }
//   ])
//   .pipe(
//     fs.createWriteStream("./public/combined.webp")
//   )
// })()

// let input = [ // any object with width & height is OK since v2.1.0
//   {width: 600, height: 25, name: "tree" },
//   {width: 600, height: 20, name: "flower"},
//   {width: 2000, height: 2000, name: "oversized background" },
//   {width: 1000, height: 1000, name: "background" },
//   {width: 1000, height: 1000, name: "overlay" }
// ]

// const packer = new MaxRectsPacker(1024, 1024);
// packer.addArray(input); // Adding to the new bin
// packer.bins.forEach(bin => {
//     console.log(bin.rects);
// });

(async() => {
  const basePath = "./public/01230100300000000000000000000000/contents";
  const files = await readdir(basePath);
  const input = [];

  for (let file of files) {
    if (/\.webp$/.test(file)) {
      const imagePath = resolve(basePath, file)
      const metadata = await sharp(imagePath).metadata();
      input.push({
        width: metadata.width,
        height: metadata.height,
        name: imagePath
      });
    }
  }

  const width = 1024;
  const height = 1024;
  const packer = new MaxRectsPacker(width, height, 0, { allowRotation: false });
  packer.addArray(input);

  for (let bin of packer.bins) {
    if (bin instanceof MaxRectsBin) {
      const images = [];
      for (let rect of bin.rects) {
        images.push({
          top: rect.y,
          left: rect.x,
          input: await sharp(rect.name).toBuffer()
        })
      }

      await sharp({
        create: {
          width: bin.width,
          height: bin.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .composite(images)
      .webp()
      .toFile(`./public/01230100300000000000000000000000/${Math.random().toString(16).slice(2)}.webp`)
    } else {
      for (let rect of bin.rects) {
        await sharp(rect.name).toFile(`./public/01230100300000000000000000000000/${Math.random().toString(16).slice(2)}.webp`)
      }
    }
  }
})();