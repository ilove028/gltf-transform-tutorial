import { NodeIO } from "@gltf-transform/core";
import { prune, flatten } from "@gltf-transform/functions";
import { noUniformQuadtree, octree, quadtree } from "./spatialDivision.mjs";
import { create3dtiles, pruneMaterial, create3dtilesContent, getNodesVertexCount, compress, writeMeshBox, rename, useGpuInstancing } from "./utils.mjs";
import { GLB_RE, GLTF_RE } from "./constant.mjs";
import { writeFile, rm } from "fs/promises";
import path from "path";
import glMatrix from "gl-matrix";
import fse from "fs-extra";
import { KHRTextureTransform } from '@gltf-transform/extensions';
// import { version } from "../package.json";
// TODO 这里ES6引用json会报错
const version = "1.3.0";
const { mat4: { create, multiply, invert, getTranslation } } = glMatrix;
const getRootExtrasMatrix = (document) => {
  const extras = document.getRoot().getExtras();
  return extras && extras.matrix
    ? extras.matrix
    : create()
}

const run = async ({ input, output, extension = "glb", useTilesImplicitTiling = false, subtreeLevels = 3, useLod, compressType, maxVertexCount = 500000, useGzip, meshBox, needRename }) => {
  if (useLod) {
    // 隐式暂时不支持Lod.
    useTilesImplicitTiling = false
  }
  await fse.ensureDir(output);
  await rm(output, { recursive: true });
  await fse.ensureDir(output);
  
  const io = new NodeIO().registerExtensions([KHRTextureTransform]);
  let document;
  let mainMatrix;
  if (Array.isArray(input)) {
    const docs = [];

    for (let i = 0; i < input.length; i++) {
      docs.push(await io.read(input[i]));
    }

    document = docs[0];
    const tmpMatrix = getRootExtrasMatrix(document);
    // 修正因为矩阵运算精度丢失问题 位移有很大量 变换到相对小的位移进行处理减小误差
    const translation = getTranslation([0, 0, 0], tmpMatrix); // 没有使用vec3 create 因为默认使用 float32会丢失精度
    mainMatrix = tmpMatrix.slice();
    mainMatrix[12] = mainMatrix[13] = mainMatrix[14] = 0;
    for (let i = 1; i < docs.length; i++) {
      // 对除了主document的其它所有doc的node做变换到 主doc坐标系下 基于已经将多个模型放置好
      let tmpMat = getRootExtrasMatrix(docs[i]);
      const curMatrix = tmpMat.slice();
      curMatrix[12] -= translation[0];
      curMatrix[13] -= translation[1];
      curMatrix[14] -= translation[2];
      const mat = multiply(
        create(),
        invert(create(), mainMatrix),
        curMatrix
      );
      console.log("Before merge", getNodesVertexCount(document.getRoot().listNodes()));
      docs[i].getRoot().listNodes().forEach((node) => {
        const originMat = node.getMatrix();

        node.setMatrix(
          multiply(
            create(),
            mat,
            originMat
          )
        );
      })
      document = document.merge(docs[i]);
      console.log("After merge", getNodesVertexCount(document.getRoot().listNodes()));
    }
  } else {
    document = await io.read(input);
    mainMatrix = getRootExtrasMatrix(document);
  }
  
  const scenes = document.getRoot().listScenes();

  if (scenes.length > 1) {
    const scene = scenes[0];

    for (let i = 1; i < scenes.length; i++) {
      const curScene = scenes[i];

      curScene.listChildren().forEach(node => scene.addChild(node));
    }
  }
  useGpuInstancing(document);
  await document.transform(
    // pruneMaterial((existMaterial, material) => {
    //   const a = existMaterial.getBaseColorFactor();
    //   const b = material.getBaseColorFactor();
      
    //   return Math.abs(a[0] - b[0]) < 0.01
    //     && Math.abs(a[1] - b[1]) < 0.01
    //     && Math.abs(a[2] - b[2]) < 0.01
    //     && a[3] === b[3]
    // }),
    flatten(),
    prune()
  );

  // const cell = noUniformQuadtree(document, 300000);
  // const cell = quadtree(document);
  // isNonuniform 非标准划 隐式还不支持 标准才支持隐式 
  const cell = octree(document, { maxLevel: Infinity, maxNodeSize: 1, maxRadius: 0.5, maxVertexCount: maxVertexCount, isNonuniform: true });
  const tileset = await create3dtiles(cell, useGzip ? /gltf/i.test(extension) ? GLTF_RE : GLB_RE : extension, useTilesImplicitTiling, output, subtreeLevels, useLod, useGzip);
  (tileset.extras || (tileset.extras = {})).stationIids = extractFileName(input);
  tileset.extras.matrix = getRootExtrasMatrix(document).reduce((pre, cur) => { pre.push(cur); return pre; }, [])
  await writeFile(path.join(output, "root.json"), JSON.stringify(tileset, null, 2));
  console.log("Tileset done");
  await create3dtilesContent(output, document, cell, extension, useLod, compressType);
  try {
    await writeMeshBox(path.join(output, 'metadata'), meshBox)
  } catch (e) {}
  if (needRename) {
    await rename(output);
  }
  if (useGzip) {
    await compress(output)
  }
  console.log(
    `Level ${cell.getMaxLevel()}\n`,
    `Cell count ${cell.getCount()}\n`,
    `Cell has content count ${cell.getCount(true)}\n`,
    `VertexCount ${cell.getVertexCount()}\n`,
    `MaxVertexCount ${cell.getMaxVertexCount()}\n`,
    `MinVertexCount ${cell.getMinVertexCount()}\n`,
    // JSON.stringify(cell)
  );
}

const extractFileName = (filePaths) => {
  if (typeof filePaths === "string") {
    filePaths = [filePaths];
  }

  return filePaths.map((filePath) => {
    const matchs = /([_-\w\d]+)(\.([\w\d]+))?$/.exec(filePath);

    return matchs ? matchs[1] : null;
  })
}

// isNonuniform 非标准划 隐式还不支持 标准才支持隐式 lod不支持隐式 同时为true 隐式会被默认设置为false 因为隐式必须是标准四叉树或者八叉树 使用lod 会把父节点高精度和子节点同级 就不是标准四叉树或者八叉树了
// run("./public/ship-attr.gltf", "./public/3dtiles/ship/", "glb", false, 3, false, CompressType.EXTMeshoptCompression);
// run("./public/04010100400000000000000000000000.glb", "./public/3dtiles/04010100400000000000000000000000/", "glb", false, 3, true, CompressType.EXTMeshoptCompression);
// run(["./public/mei-shi-gltf/01150100101000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100102000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100103000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100104000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100105000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100106000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100107000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100108000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100109000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100110000000000000000000000.gltf",
// "./public/mei-shi-gltf/01150100111000000000000000000000.gltf"],
// "./public/3dtiles/01150100100000000000000000000000/", "gltf", false, 3, false, CompressType.EXTMeshoptCompression);
// run(["./public/mei-shi/01150100101000000000000000000000.glb",
// "./public/mei-shi/01150100102000000000000000000000.glb",
// "./public/mei-shi/01150100103000000000000000000000.glb",
// "./public/mei-shi/01150100104000000000000000000000.glb",
// "./public/mei-shi/01150100105000000000000000000000.glb",
// "./public/mei-shi/01150100106000000000000000000000.glb",
// "./public/mei-shi/01150100107000000000000000000000.glb",
// "./public/mei-shi/01150100108000000000000000000000.glb",
// "./public/mei-shi/01150100109000000000000000000000.glb",
// "./public/mei-shi/01150100110000000000000000000000.glb",
// "./public/mei-shi/01150100111000000000000000000000.glb"],
// "./public/3dtiles/01150100100000000000000000000000/", "glb", true, 3, false, CompressType.EXTMeshoptCompression);
// run("./public/mei-shi-gltf/01150100111000000000000000000000/01150100111000000000000000000000.gltf",
// "./public/3dtiles/01150100111000000000000000000000/", "gltf", true, 3, false, CompressType.EXTMeshoptCompression);
// await run(
//   [
//     "./public/6-company/01180100100000000000000000000000.glb",
//     "./public/6-company/01180100101000000000000000000000.glb",
//     "./public/6-company/01180100102000000000000000000000.glb",
//     "./public/6-company/01180100103000000000000000000000.glb"
//   ],
//   "./public/3dtiles/01180100100000000000000000000000/",
//   "glb",
//   false,
//   3,
//   true,
//   CompressType.EXTMeshoptCompression
// );
// await run(
//   [
//     "./public/nb/terminal/04010101100000000000000000000000.glb",
//     "./public/nb/terminal/04010107100000000000000000000000.glb",
//     "./public/nb/terminal/04010107200000000000000000000000.glb",
//     "./public/nb/terminal/04010101101000000000000000000000.glb",
//   ],
//   "./public/3dtiles/04010101100000000000000000000000",
//   "glb",
//   true,
//   3,
//   true
// );

// await run(
//   [
//     "./public/jy/01060103600000000000000000000000/01060103600000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060103500000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060103400000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060103300000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060103200000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060103100000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060103000000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102900000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102800000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102700000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102600000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102500000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102400000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102300000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102200000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102100000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060102000000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101900000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101800000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101700000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101600000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101500000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101400000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101300000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101200000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101100000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060101000000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100900000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100800000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100700000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100600000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100500000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100400000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100300000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100200000000000000000000000.glb",
//     "./public/jy/01060103600000000000000000000000/01060100100000000000000000000000.glb"
//   ],
//   "./public/3dtiles/01060103600000000000000000000000",
//   "glb",
//   true,
//   3,
//   true
// );

if (process.argv[2]) {
  const logPath = path.join(process.cwd(), "./log");
  let content;
  if (/-c/i.test(process.argv[2]) && process.argv[3]) {
    content = process.argv[3];
  } else {
    content = fse.readFileSync(process.argv[2], { encoding: "utf-8" }); 
  }
  fse.writeFileSync(
    logPath,
    `version:
${version}
content:
${content}`
  )
  const config = JSON.parse(content);
  const {
    input,
    output,
    extension = 'glb',
    useTilesImplicitTiling = false,
    maxVertexCount = 500000,
    subtreeLevels = 3,
    useLod = false,
    compressType = 'EXT_meshopt_compression',
    useGzip = true,
    meshBox = null,
    needRename = true
  } = config;
  run({ input, output, extension, useTilesImplicitTiling, subtreeLevels, useLod, compressType, maxVertexCount, useGzip, meshBox, needRename }).catch((e) => {
    fse.appendFileSync(logPath, e.stack);
  })
} else {
  throw new Error("需要指定一个JSON配置文件")
}
