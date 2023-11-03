const sharp = require('sharp')

async function test() {
  console.log(await sharp("./public/bg.png").metadata())
}

test()