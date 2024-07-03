import { open } from 'node:fs/promises';
// import { Cartesian3, GeometryPipeline, BoundingSphere } from 'cesium';

const shake = async (path = './public/ocean/7-2-cps.grd', INVALID = '0') => {
  const fd = await open(path);
  const stream = fd.createReadStream();
  let content = ''
  let invalidLines = 0;
  const REG = /(\r\n)|(\n)/;
  const lines = [];
  const parseLine = (content, lineIndex) => {
    const line = content.substring(0, lineIndex);
    const items = line.split(/\s+/);

    lines.push(line);
    if (items.every(item => INVALID === item.trim())) {
      invalidLines++;
    }
    const matchs = REG.exec(content);
    return content.substring(
      lineIndex + (matchs
        ? matchs[1]
          ? 2 : 1
        : content.length)
    )
  }
  // stream.on('readable', () => {
  //   let chunk;
  //   console.log('Stream is readable (new data received in buffer)');
  //   // Use a loop to make sure we read all currently available data
  //   while (null !== (chunk = stream.read(1024))) {
  //     console.log(chunk.toString());
  //   }
  // });
  stream.on('data', (chunk) => {
    let lineIndex = -1;

    content += chunk.toString();
    stream.pause();
    while ((lineIndex = content.search(REG)) > -1) {
      content = parseLine(content, lineIndex)
    }
    stream.resume();
  });
  stream.on('end', () => {
    if (content.length > 0) {
      parseLine(content, content.length);
    }
  });
}

shake();