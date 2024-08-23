import { Accessor, Document, NodeIO } from "@gltf-transform/core";
import { center, transformMesh } from "@gltf-transform/functions";
import fse from "fs-extra";
import path from "path";
import fs from "fs";
import { dracoMeshCompression, optimize } from "./runCreateGltf.mjs"
import { createTileSet } from "./common/index.mjs";
import { GLB_RE, GLTF_RE } from "./constant.mjs";
import { writeFile } from "fs/promises";
import { compress, rename } from "./utils.mjs"
import { getBounds } from "./getBounds.mjs";
import glMatrix from "gl-matrix";

const { mat4: { fromTranslation } } = glMatrix;

/**
 * 
 * @param {number} componentsPerAttribute
 * @returns {import("@gltf-transform/core").Accessor.Type}
 */
function componentsPerAttribute2AccessorType(componentsPerAttribute) {
  switch (componentsPerAttribute) {
    case 1: {
      return Accessor.Type.SCALAR
    }
    case 2: {
      return Accessor.Type.VEC2
    }
    case 3: {
      return Accessor.Type.VEC3
    }
    case 4: {
      return Accessor.Type.VEC4
    }
  }
}

const WebGLConstants = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  INT: 5124,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
  DOUBLE: 5130,
}

function componentDatatype2TypeCtr(componentDatatype) {
  switch (componentDatatype) {
    case WebGLConstants.BYTE: {
      return Int8Array;
    }
    case WebGLConstants.UNSIGNED_BYTE: {
      return Uint8Array;
    }
    case WebGLConstants.SHORT: {
      return Int16Array;
    }
    case WebGLConstants.UNSIGNED_SHORT: {
      return Uint16Array;
    }
    case WebGLConstants.INT: {
      return Int32Array;
    }
    case WebGLConstants.UNSIGNED_INT: {
      return Uint32Array;
    }
    // GLTF type AccessorComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126; 不支持 flot64
    default: {
      return Float32Array;
    }
  }
}
/**
 * 
 * @param {Array<number>} values
 * @returns {{ min: number; max: number }}
 */
function findMinAndMax(values = [], min = Infinity, max = Infinity) {
  values.forEach((value) => {
    if (min > value) {
      min = value
    }
    if (max < value) {
      max = value
    }
  })

  return { min, max }
}

/**
 * 
 * @param {string} path
 * @returns {{ res: Array<{indices: Array<number>; attributes: Record<string, { componentDatatype: number; componentsPerAttribute: number; values: Array<number> }> }>, zMinMax: { min: number; max: number } }}
 */
function readData(filePath) {
  let data = {
    res: [],
    zMinMax: {
      min: Infinity,
      max: -Infinity
    }
  };

  if (fs.statSync(filePath).isFile()) {
    data = JSON.parse(fse.readFileSync(filePath, { encoding: "utf-8" }))
  } else {
    const files = fs.readdirSync(filePath);

    for (let i = 0; i < files.length; i++) {
      const { res, zMinMax } = readData(path.join(filePath, files[i]));

      data.res = data.res.concat(res);

      if (zMinMax) {
        if (data.zMinMax.min > zMinMax.min) {
          data.zMinMax.min = zMinMax.min;
        }
        if (data.zMinMax.max < zMinMax.max) {
          data.zMinMax.max = zMinMax.max;
        }
      }
    }
  }

  return data;
}
/**
 * 使用Cesium feature-118 GrdPointCloud2.html
 * 处理Grd处理后的JSON文件生成gltf attributes里面key为标准GLTF attributename
 * config 参照
  {
    "meshBox": [],
    "input": [
      "./public/ocean/tilegrd"
    ],
    "output": "./public/3dtiles/04010102100000000000000000000000",
    "extension": "glb",
    "maxVertexCount": 500000,
    "isCreateGlft": true
  }
 * @param {Array<{indices: Array<number>; attributes: Record<string, { componentDatatype: number; componentsPerAttribute: number; values: Array<number> }> }>} datas 
 */
async function parseGrd(pt) {
  const content = fse.readFileSync(pt, { encoding: "utf-8" });
  const config = JSON.parse(content);

  const {
    input,
    output,
    compressType = 'EXT_meshopt_compression',
    extension = 'glb',
    useGzip = true,
    needRename = true,
    toTileset = true
  } = config;
  /**
   * @type {Array<{indices: Array<number>; attributes: Record<string, { componentDatatype: number; componentsPerAttribute: number; values: Array<number> }> }>}
   */
  // const datas = JSON.parse(fse.readFileSync(input[0], { encoding: "utf-8" }))
  const { res: datas, zMinMax } = readData(input[0])

  const document = new Document();
  const scene = document.createScene();
  const buffer = document.createBuffer();
  const material = document.createMaterial()
    .setBaseColorFactor([1, 1, 1, 1]);
  let min = zMinMax.min;
  let max = zMinMax.max;

  document.getRoot().setDefaultScene(scene);

  datas.forEach((data, index) => {
    const { zMinMax } = data;
    const primitive = document.createPrimitive()
      .setMaterial(material);

    if (zMinMax) {
      if (min > zMinMax.min) {
        min = zMinMax.min
      }

      if (max < zMinMax.max) {
        max = zMinMax.max
      }
    }

    primitive.setIndices(
      document.createAccessor()
        .setArray(new Uint32Array(data.indices))
        .setType(Accessor.Type.SCALAR)
        .setBuffer(buffer)
    )
    Object.entries(data.attributes).forEach(([key, item]) => {
      const TypeCtr = componentDatatype2TypeCtr(item.componentDatatype)
      // 因为三角化有可能极值点会被去除不从高度计算
      // if (/HEIGHT/i.test(key)) {
      //   const res = findMinAndMax(item.values, min, max);

      //   min = res.min;
      //   max = res.max;
      // }
      primitive.setAttribute(
        key,
        document.createAccessor()
          .setArray(new TypeCtr(item.values))
          .setType(componentsPerAttribute2AccessorType(item.componentsPerAttribute))
          .setBuffer(buffer)
      )
    })

    scene.addChild(
      document.createNode(`${index}`)
        .setMesh(
          document.createMesh()
            .addPrimitive(primitive)
        )
    );

    datas[index] = null;
  });



  const io = new NodeIO();

  fse.ensureDir(output)
  const metadaPath = toTileset ? path.join(output, 'metadata') : output
  fse.ensureDir(metadaPath)
  const bound = getBounds(scene);
  const center = [
    (bound.min[0] + bound.max[0]) / 2,
    (bound.min[1] + bound.max[1]) / 2,
    (bound.min[2] + bound.max[2]) / 2
  ];

  scene.listChildren().forEach((node) => {
    const mesh = node.getMesh();
    if (mesh) {
      // node.setMatrix(fromTranslation([], center))
      transformMesh(mesh, fromTranslation([], center.map(n => -n)));
    }
  });

  await optimize(document, io, { output: metadaPath, disableMerge: true })

  // await document.transform(
  //   center()
  // )

  await dracoMeshCompression(io, document);
  document.getRoot().setExtras({ minHeight: min, maxHeight: max })
  // await io.write('./public/terrain.glb', document);
  if (toTileset) {
    fse.ensureDir(output)
    const tileset = createTileSet(document, needRename ? /gltf/i.test(extension) ? GLTF_RE : GLB_RE : extension)

    tileset.extras = { minHeight: min, maxHeight: max, matrix: fromTranslation([], center) }
    await writeFile(path.join(output, "root.json"), JSON.stringify(tileset, null, 2));
  }
  if (toTileset) {
    fse.ensureDir(path.join(output, "contents"))
  } 
  await io.write(`${output}${toTileset ? `/contents/0-0-0.${extension}` : `/model.${extension}`}`, document);
  if (needRename) {
    await rename(output);
  }
  if (useGzip) {
    await compress(output)
  }
}

parseGrd(process.argv[2] || "./bin/config.json");