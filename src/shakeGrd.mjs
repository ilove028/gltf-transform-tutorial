import { appendFile, mkdir, open, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from "path"
// import { Cartesian3, GeometryPipeline, BoundingSphere } from 'cesium';

const parse2Lines = async (path = './public/ocean/7-2-cps.grd', INVALID = '0') => {
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
  await new Promise((resolve) => {
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
      resolve()
    });
  })

  return lines;
}

const parseLines = (lines = [], INVALID = '1.70141e+038') => {
  let meta = null;
  let size = null;
  let xMinMax = null;
  let yMinMax = null;
  let zMinMax = null;
  let points = null;
  let pointRow = 0;

  const parseMeta = (line, row) => {
    return {
      meta: line
    }
  }
  const parseSize = (line, row) => {
    const [xStr, yStr] = line.split(/\s+/);

    return {
      x: parseInt(xStr),
      y: parseInt(yStr)
    }
  }
  const parsetMinMax = (line, row) => {
    const [minStr, maxStr] = line.split(/\s+/);

    return {
      min: parseFloat(minStr),
      max: parseFloat(maxStr)
    }
  }
  const parseRowPoints = (line, row, pointRow, size, xMinMax, yMinMax, zMinMax) => {
    return line.split(/\s+/).filter(i => i).map((str, index) => {
      if (str === INVALID) {
        return null;
      } else {
        const z = parseFloat(str);
        
        if (zMinMax && z < zMinMax.min || z > zMinMax.max) {
          console.error(`row: ${row}, column: ${index} exceed`);
        }

        // return {
        //   z,
        //   x: (xMinMax.max - xMinMax.min) / (size.x - 1) * index + xMinMax.min,
        //   y: (yMinMax.max - yMinMax.min) / (size.y - 1) * pointRow + yMinMax.min,
        // }

        return z;
      }
    })
  }

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];

    if (row === 0) {
      meta = parseMeta(line, row);
    } else if (row === 1) {
      size = parseSize(line, row)
    } else if (row === 2) {
      xMinMax = parsetMinMax(line, row);
    } else if (row === 3) {
      yMinMax = parsetMinMax(line, row);
    } else if (row === 4) {
      zMinMax = parsetMinMax(line, row);
    } else {
      if (!points) {
        points = Array.from({ length: size.y })
      }
      if (line) {
        if (pointRow > (size.y - 1)) {
          console.error(`too many lines`);
        }
        const rowPoints = parseRowPoints(line, row, pointRow, size, xMinMax, yMinMax, zMinMax);
        if (rowPoints.length !== size.x) {
          console.error(`row:${row} size invalid`);
        }
        points[pointRow++] = rowPoints;
      }
    }

    lines[row] = null;
  }

  return {
    meta,
    size,
    xMinMax,
    yMinMax,
    zMinMax,
    points
  }
}

/**
 * 
 * @param {{ meta: string; size: { x: number; y: number; }; xMinMax: { min: number; max: number }; yMinMax: { min: number; max: number }; zMinMax: { min: number; max: number }; points: Array<Array<null | number>> }} res 
 * @param {*} splitSize 
 */
const split = async (filepath, res, splitSize = { x: 1000, y: 1000 }, INVALID = '0') => {
  const { meta, size, xMinMax, yMinMax, zMinMax, points } = res;
  // 因为存在重合的一列 多一个切片 实际只会增加 - 1 的数量
  const splitX = Math.ceil((size.x - 1) / (splitSize.x - 1));
  const splitY = Math.ceil((size.y - 1) / (splitSize.y - 1));
  const tilePath = join(filepath, 'tiles');

  await rm(tilePath, { recursive: true })
  await mkdir(tilePath)
  for (let i = 0; i < splitX; i++) {
    for (let j = 0; j < splitY; j++) {
      const start = {
        x: (splitSize.x - 1) * i,
        y: (splitSize.y - 1) * j
      }
      const end = {
        x: start.x + splitSize.x - 1,
        y: start.y + splitSize.y - 1
      }

      if (end.x > (size.x - 1)) {
        end.x = size.x - 1;
      }
      if (end.y > (size.y - 1)) {
        end.y = size.y - 1;
      }
      const minMax = findMinMax(points, start, end);
      if (minMax) {
        await writeGrd(
          join(tilePath, `${i}-${j}.grd`),
          meta.meta,
          {
            min: (xMinMax.max - xMinMax.min) / (size.x - 1) * start.x + xMinMax.min,
            max: (xMinMax.max - xMinMax.min) / (size.x - 1) * end.x + xMinMax.min
          },
          {
            min: (yMinMax.max - yMinMax.min) / (size.y - 1) * start.y + yMinMax.min,
            max: (yMinMax.max - yMinMax.min) / (size.y - 1) * end.y + yMinMax.min
          },
          minMax,
          points,
          start,
          end
        );
        console.log('Write ', i, j);
      }
    }
  }
}

const findMinMax = (points, start, end) => {
  let min = Infinity;
  let max = -Infinity;
  let hasValid = false;
  for (let i = start.x; i <= end.x; i++) {
    for (let j = start.y; j <= end.y; j++) {
      const val = points[j][i];

      if (null !== val) {
        hasValid = true;

        if (val < min) {
          min = val
        }

        if (val > max) {
          max = val;
        }
      }
    }
  }

  return hasValid
    ? { min, max }
    : null
}

const writeGrd = async (fileName, meta, xMinMax, yMinMax, zMinMax, points, start, end, INVALID = '0') => {
  const endline = '\n';
  const split = ' ';

  await appendFile(fileName, `${meta}${endline}`);
  await appendFile(fileName, `${end.x - start.x + 1}${split}${end.y - start.y + 1}${endline}`);
  await appendFile(fileName, `${xMinMax.min}${split}${xMinMax.max}${endline}`);
  await appendFile(fileName, `${yMinMax.min}${split}${yMinMax.max}${endline}`);
  await appendFile(fileName, `${zMinMax.min}${split}${zMinMax.max}${endline}`);

  for (let i = start.y; i <= end.y; i++) {
    await appendFile(fileName, `${points[i].filter((_, index) => index >= start.x && index <= end.x).map((item) => null === item ? INVALID : item).join(split)}${endline}`)
  }
}

const run = async (filepath, INVALID = '0') => {
  const lines = await parse2Lines(filepath, INVALID);
  console.log('Parse to lines done');
  const res = parseLines(lines, INVALID);
  console.log('Parse lines done');
  await split(dirname(filepath), res)
}

run('./public/ocean/7-2-cps.grd');