// const { createGzip } = require('zlib');
// const { pipeline } = require('stream');
// const {
//   createReadStream,
//   createWriteStream
// } = require('fs');

// const gzip = createGzip();
// const source = createReadStream("./public/SmallScene-1-0-6-5-7-5.mesh");
// const destination = createWriteStream("./public/SmallScene-1-0-6-5-7-5.mesh.gz");

// pipeline(source, createGzip(), destination, (err) => {
//   if (err) {
//     console.error('An error occurred:', err);
//     process.exitCode = 1;
//   }
// });

const express = require('express')
const compression = require('compression')
const app = express()
const port = 7001

// app.use(compression({
//   filter() {
//     console.log("Run");

//     return true;
//   }
// }))

app.all('*', function(req, res, next) {
  res.setHeader('Content-Encoding', 'gzip');
  next();
})
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Content-Type', 'application/json;charset=utf-8');
  next();
});

app.use(express.static('./public'))

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})