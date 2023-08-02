import { NodeIO } from "@gltf-transform/core";
import { prune, flatten } from "@gltf-transform/functions";
import { noUniformQuadtree, octree, quadtree } from "./spatialDivision.mjs";
import { create3dtiles, pruneMaterial, create3dtilesContent, getNodesVertexCount } from "./utils.mjs";
import { writeFile, rm } from "fs/promises";
import path from "path";
import glMatrix from "gl-matrix";
import fse from "fs-extra";

const { mat4: { create, multiply, invert } } = glMatrix;
const getRootExtrasMatrix = (document) => {
  const extras = document.getRoot().getExtras();
  return extras && extras.matrix
    ? extras.matrix
    : create()
}

const run = async (input, output, extension = "glb", useTilesImplicitTiling = false, subtreeLevels = 3) => {
  await fse.ensureDir(output);
  await rm(output, { recursive: true });
  await fse.ensureDir(output);
  const io = new NodeIO();
  let document;
  let mainMatrix;
  if (Array.isArray(input)) {
    const docs = [];

    for (let i = 0; i < input.length; i++) {
      docs.push(await io.read(input[i]));
    }

    document = docs[0];
    mainMatrix = getRootExtrasMatrix(document)
    for (let i = 1; i < docs.length; i++) {
      // 对除了主document的其它所有doc的node做变换到 主doc坐标系下 基于已经将多个模型放置好
      const curMatrix = getRootExtrasMatrix(docs[i]);
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

  await document.transform(
    pruneMaterial((existMaterial, material) => {
      const a = existMaterial.getBaseColorFactor();
      const b = material.getBaseColorFactor();
      
      return Math.abs(a[0] - b[0]) < 0.01
        && Math.abs(a[1] - b[1]) < 0.01
        && Math.abs(a[2] - b[2]) < 0.01
        && a[3] === b[3]
    }),
    flatten(),
    prune()
  );

  // const cell = noUniformQuadtree(document, 100000);
  // const cell = quadtree(document);
  const cell = octree(document);
  const tileset = await create3dtiles(cell, extension, useTilesImplicitTiling, output, subtreeLevels);
  (tileset.extras || (tileset.extras = {})).stationIids = extractFileName(input);
  tileset.extras.matrix = mainMatrix.reduce((pre, cur) => { pre.push(cur); return pre; }, [])
  await writeFile(path.join(output, "tileset.json"), JSON.stringify(tileset, null, 2));
  console.log("Tileset done");
  await create3dtilesContent(output, document, cell, extension);

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

// run("./public/ship-attr.gltf", "./public/3dtiles/ship/", "gltf", false, 3);
// run("./public/04010100400000000000000000000000.glb", "./public/3dtiles/04010100400000000000000000000000/", "glb", false, 3);
await run(
  [
    "./public/6-company/01180100100000000000000000000000.glb",
    "./public/6-company/01180100101000000000000000000000.glb",
    "./public/6-company/01180100102000000000000000000000.glb",
    "./public/6-company/01180100103000000000000000000000.glb"
  ],
  "./public/3dtiles/01180100100000000000000000000000/",
  "glb",
  true,
  3
);
