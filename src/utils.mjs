import path from "path";
import { writeFile } from "fs/promises";
import fse from "fs-extra";
import { NodeIO, Document, Accessor, Material, getBounds } from "@gltf-transform/core";
import { createTransform, prune, reorder, quantize, transformPrimitive, joinPrimitives, simplify } from "@gltf-transform/functions";
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { VertexAttributeSemantic } from "./constant.mjs";
import { EXTMeshFeatures, EXTStructuralMetadata, TilesImplicitTiling } from "./extensions/index.mjs";
import { Cell3 } from "./Cell.mjs";

const getNodeVertexCount = (node) => {
  const mesh = node.getMesh();
  
  if (mesh) {
    return mesh.listPrimitives().reduce((pre, cur) => {
      pre += cur.getAttribute(VertexAttributeSemantic.POSITION).getCount();

      return pre;
    }, 0)
  } else {
    return 0;
  }
}

const getNodesVertexCount = (nodes) => {
  return nodes.reduce((count, node) => {
    count += getNodeVertexCount(node);

    return count;
  }, 0)
}

const getBboxSphere = (bbox) => {
  const { min, max } = bbox;
  const center = middle(min, max);
  return [
    ...center,
    distance(center, max)
  ]
}

const getBboxBox = (bbox) => {
  const { min, max } = bbox;
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];

  const cx = min[0] + dx * 0.5;
  const cy = min[1] + dy * 0.5;
  const cz = min[2] + dz * 0.5;

  const hxx = dx * 0.5;
  const hxy = 0.0;
  const hxz = 0.0;

  const hyx = 0.0;
  const hyy = dy * 0.5;
  const hyz = 0.0;

  const hzx = 0.0;
  const hzy = 0.0;
  const hzz = dz * 0.5;

  return [
    cx, cy, cz, 
    hxx, hxy, hxz, 
    hyx, hyy, hyz, 
    hzx, hzy, hzz
  ];
}

/**
 * 计算两点中点
 * @param {*} a 
 * @param {*} b 
 * @returns 
 */
const middle = (a, b) => {
  return [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2
  ]
}

/**
 * 计算两点之间距离
 * @param {*} a 
 * @param {*} b 
 * @returns 
 */
const distance = (a, b) => Math.sqrt(
  (a[0] - b[0]) * (a[0] - b[0])
  + (a[1] - b[1]) * (a[1] - b[1])
  + (a[2] - b[2]) * (a[2] - b[2])
)

const getNodesBounds = (nodes) => {
  let bbox = nodes && nodes.length > 0 ? getBounds(nodes[0]) : null;

  for (let i = 1; nodes && i < nodes.length; i++) {
    const { min, max } = getBounds(nodes[i]);

    if (min[0] < bbox.min[0]) {
      bbox.min[0] = min[0];
    }

    if (min[1] < bbox.min[1]) {
      bbox.min[1] = min[1];
    }

    if (min[2] < bbox.min[2]) {
      bbox.min[2] = min[2];
    }

    if (max[0] > bbox.max[0]) {
      bbox.max[0] = max[0];
    }

    if (max[1] > bbox.max[1]) {
      bbox.max[1] = max[1];
    }

    if (max[2] > bbox.max[2]) {
      bbox.max[2] = max[2];
    }
  }

  return bbox;
}

const getGeometricError = (bbox) => {
  return distance(bbox.min, bbox.max);
}

const create3dtiles = async (cell, extension, useTilesImplicitTiling, path, subtreeLevels, useLod) => {
  const tileset = {
    asset: {
      version: "1.1"
    },
    geometricError: getGeometricError(cell.bbox) * (useLod ? 1 : 1),
    root: null
  }

  const run = (cell) => {
    let children = cell.children
      ? cell.children.map(c => run(c))
      : null;
    const contentBbox = getNodesBounds(cell.contents);
    const result = {
      refine: useLod ? "REPLACE" : "ADD",
      // TODO 这里 隐式还没在subtree写入 contentVolume 所以在隐式模式下 直接用 tile Volume
      geometricError: useTilesImplicitTiling ? getGeometricError(cell.bbox) : getGeometricError(contentBbox || cell.bbox) * (useLod ? 1 : 1),
      boundingVolume: {
        // sphere: getTileSphere(cell)
        box: getBboxBox(cell.bbox)
      }
    }

    if (cell.contents) {
      if (useLod) {
        const contentChild = {
          refine: "REPLACE",
          geometricError: useTilesImplicitTiling ? getGeometricError(cell.bbox) : getGeometricError(contentBbox || cell.bbox) * (useLod ? 0.25 : 1),
          boundingVolume: {
            // sphere: getTileSphere(cell)
            box: getBboxBox(cell.bbox)
          },
          content: {
            uri: `contents/${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-low.${extension}`
          },
          children: [{
            refine: "REPLACE",
            geometricError: 0,
            boundingVolume: {
              // sphere: getTileSphere(cell)
              box: getBboxBox(cell.bbox)
            },
            content: {
              uri: `contents/${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-high.${extension}`
            }
          }]
        }
        if (!children) {
          children = [contentChild];
        } else {
          children.unshift(contentChild)
        }
      } else {
        result.content = {
          uri: `contents/${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}.${extension}`
        }
  
        if (contentBbox && !useTilesImplicitTiling) {
          result.content.boundingVolume = {
            box: getBboxBox(contentBbox)
          }
        }
      }
    }

    if (children) {
      result.children = children;
    }

    return result;
  }

  tileset.root = run(cell);

  return useTilesImplicitTiling
    ? await TilesImplicitTiling.write(tileset, path, cell, subtreeLevels, extension)
    : tileset;
}

const pruneMaterial = (compareFn) => {
  const materials = [];
  return createTransform("pruneMaterial", async (document) => {
    document.getRoot().listMeshes().forEach((mesh) => {
      mesh.listPrimitives().forEach((primitive) => {
        const material = primitive.getMaterial();
        const likeMaterial = materials.find(m => compareFn(m, material));
        if (likeMaterial) {
          if (likeMaterial !== material) {
            primitive.setMaterial(likeMaterial);
          }
        } else {
          materials.push(material)
        }
      });
    });
  })
}

const create3dtilesContent = async (filePath, document, cell, extension = "glb", useLod) => {
  const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, EXTMeshFeatures, EXTStructuralMetadata])
  .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
  });
  const createDocument = (nodes) => {
    const materialMap = new Map();
    if (nodes) {
      const newDocument = new Document();
      const buffer = newDocument.createBuffer();
      const scene = newDocument.createScene()
      const meshFeatures = newDocument.createExtension(EXTMeshFeatures);
      const metadataExt = newDocument.createExtension(EXTStructuralMetadata);
      const metadata = metadataExt.createMeatdata();

      newDocument.getRoot().setExtension(EXTStructuralMetadata.EXTENSION_NAME, metadata);
      nodes && nodes.forEach((node, nodeIndex) => {
        const primitives = node.getMesh().listPrimitives();
        const extras = node.getExtras();
        metadata.addItem({ iid: extras && extras.iid ? extras.iid : `iid-${guid()}`, primitiveType: extras && typeof extras.primitiveType === "number" ? extras.primitiveType : 4 });
        if (extras && extras.iid) {
          // 获取node bound必须在transformPrimitive之前 因为转化后primitive 坐标会变换
          const pt = path.join(filePath, "metadata");
          fse.ensureDir(pt)
          fse.writeJSONSync(path.join(pt, `${extras.iid}.json`), { box: getBboxBox(getBounds(node)) })
        }
        primitives.forEach((primitive) => {
          transformPrimitive(primitive, node.getWorldMatrix());
          const newPrimitive = newDocument.createPrimitive();
          const oldMaterial = primitive.getMaterial();
          const indeiceAccessor = primitive.getIndices();

          indeiceAccessor && newPrimitive.setIndices(
            newDocument.createAccessor()
              .setArray(indeiceAccessor.getArray())
              .setType(indeiceAccessor.getType())
          )

          primitive.listSemantics().forEach((semantic) => {
            if (semantic === VertexAttributeSemantic.POSITION || semantic === VertexAttributeSemantic.NORMAL) {
              const oldAccessor = primitive.getAttribute(semantic);

              newPrimitive.setAttribute(
                semantic,
                newDocument.createAccessor()
                  .setArray(oldAccessor.getArray())
                  .setType(oldAccessor.getType())
                  .setBuffer(buffer)
                  .setNormalized(semantic === VertexAttributeSemantic.NORMAL)
              )
            } else {
              console.error(`${semantic} attribute not handle.`)
            }
          })

          const count = newPrimitive.getAttribute(VertexAttributeSemantic.POSITION).getCount();
          newPrimitive.setAttribute(
            `${VertexAttributeSemantic.FEATURE_ID}_0`,
            newDocument.createAccessor()
              .setArray(
                // https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features 大小限制
                nodes.length < Math.pow(2, 16)
                ? new Uint16Array(Array(count).fill(nodeIndex))
                : new Float32Array(Array(count).fill(nodeIndex))
              )
              .setType(Accessor.Type.SCALAR)
              .setBuffer(buffer)
          );

          let existMaterial;
          let existMesh;
          materialMap.forEach((mesh, m) => {
            if (!existMaterial && isMaterialLike(m, oldMaterial)) {
              existMaterial = m;
              existMesh = mesh;
            }
          });

          if (!existMesh) {
            existMaterial = newDocument
              .createMaterial()
              .setBaseColorFactor(oldMaterial.getBaseColorFactor())
              .setRoughnessFactor(0.02)
              .setMetallicFactor(0.4)
              .setAlphaMode(oldMaterial.getAlpha() < 1 ? Material.AlphaMode.BLEND : Material.AlphaMode.OPAQUE);
            existMesh = newDocument.createMesh();
            materialMap.set(existMaterial, existMesh);
          }
          newPrimitive.setMaterial(existMaterial);
          existMesh.addPrimitive(newPrimitive);
        })
      });

      materialMap.forEach((mesh) => {
        const primitives = mesh.listPrimitives();
        const mergedPrimitive = joinPrimitives(primitives);

        mergedPrimitive.setExtension(EXTMeshFeatures.EXTENSION_NAME, meshFeatures.createFeatures(primitives.length, 0));
        primitives.forEach(p => p.dispose());
        mesh.addPrimitive(mergedPrimitive);
        scene.addChild(
          newDocument.createNode()
            // .setExtras(node.getExtras())
            // .setMatrix(node.getMatrix())
            .setMesh(mesh)
        )
      });

      metadataExt.writeSchema(filePath);
      return newDocument;
    }
  }

  const write = async (filePath, document, cell) => {
    const doc = createDocument(cell.contents);

    if (doc) {
      let lowDoc;
      const basePath = path.join(filePath, "contents");
      await fse.ensureDir(basePath);
      await doc.transform(
        pruneMaterial(isMaterialLike),
        prune(),
        reorder({encoder: MeshoptEncoder}),
        // quantize({
        //   pattern: /^(POSITION)(_\d+)?$/ // TODO quantize 有损压缩 POSITION会造成包围球和模型渲染暂时没有问题 GLTF模型展示不匹配 NORMAL会造成渲染不对
        // })
      );
      doc.createExtension(EXTMeshoptCompression)
        .setRequired(true)
        .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
      
      await io.write(path.join(basePath, `${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}${useLod ? "-high" : ""}.${extension}`), doc);
    
      if (useLod) {
        // lowDoc = doc.clone();
        lowDoc = doc;
        await lowDoc.transform(
          pruneMaterial(isMaterialLike),
          prune(),
          simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.1 }),
          reorder({encoder: MeshoptEncoder}),
          // quantize({
          //   pattern: /^(POSITION)(_\d+)?$/ // TODO quantize 有损压缩 POSITION会造成包围球和模型渲染暂时没有问题 GLTF模型展示不匹配 NORMAL会造成渲染不对
          // })
        );
        lowDoc.createExtension(EXTMeshoptCompression)
          .setRequired(true)
          .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
        
        await io.write(path.join(basePath, `${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-low.${extension}`), lowDoc);
      }
    }
    for (let i = 0; cell.children && i < cell.children.length; i++) {
      await write(filePath, document, cell.children[i]);
    }
  }

  await write(filePath, document, cell);
}

const isMaterialLike = (aMaterial, bMaterial) => {
  const a = aMaterial.getBaseColorFactor();
  const b = bMaterial.getBaseColorFactor();
  
  return Math.abs(a[0] - b[0]) < 0.01
    && Math.abs(a[1] - b[1]) < 0.01
    && Math.abs(a[2] - b[2]) < 0.01
    && a[3] === b[3]
}

const isBboxContain = (containerBBox, bbox) => {
  return containerBBox.min[0] <= bbox.min[0]
    && containerBBox.min[1] <= bbox.min[1]
    && containerBBox.min[2] <= bbox.min[2]
    && containerBBox.max[0] >= bbox.max[0]
    && containerBBox.max[1] >= bbox.max[1]
    && containerBBox.max[2] >= bbox.max[2]
}

const createSubtreeBinary = ({ tileAvailability, contentAvailability, childSubtreeAvailability }) => {
  const magic = Buffer.from("subt");
  const version = Buffer.from(new Uint32Array([1]).buffer);
  const tileAvailabilityBuffer = tileAvailability.some(v => v)
    ? tileAvailability.some(v => !v)
      ? boolArray2Bin(tileAvailability)
      : 1
    : 0;
  const contentAvailabilityBuffer = contentAvailability.some(v => v)
    ? contentAvailability.some(v => !v)
      ? boolArray2Bin(contentAvailability)
      : 1
    : 0;
  const childSubtreeAvailabilityBuffer = childSubtreeAvailability.some(v => v)
    ? childSubtreeAvailability.some(v => !v)
      ? boolArray2Bin(childSubtreeAvailability)
      : 1
    : 0;
  const buffer = Buffer.concat([tileAvailabilityBuffer, contentAvailabilityBuffer, childSubtreeAvailabilityBuffer].filter(v => v instanceof Buffer));
  const tileAvailabilityBufferView = tileAvailabilityBuffer instanceof Buffer ? { buffer: 0, byteOffset: 0, byteLength: Math.ceil(tileAvailability.length / 8) } : null;
  const contentAvailabilityBufferView = contentAvailabilityBuffer instanceof Buffer
    ? {
        buffer: 0,
        byteOffset: getBuffersByteLength(tileAvailabilityBuffer),
        byteLength: Math.ceil(contentAvailability.length / 8)
      }
    : null;

  const childSubtreeAvailabilityBufferView = childSubtreeAvailabilityBuffer instanceof Buffer
    ? {
        buffer: 0,
        byteOffset: getBuffersByteLength(tileAvailabilityBuffer, contentAvailabilityBuffer),
        byteLength: Math.ceil(childSubtreeAvailability.length / 8)
      }
    : null;
  const jsonObj = {
    buffers: [{ name: "Availability Buffer", byteLength: buffer.byteLength }],
    bufferViews: [tileAvailabilityBufferView, contentAvailabilityBufferView, childSubtreeAvailabilityBufferView].filter(v => v),
    tileAvailability: tileAvailabilityBufferView
      ? { bitstream: 0, availableCount: tileAvailability.filter(v => v).length }
      : { constant: tileAvailabilityBuffer },
    contentAvailability: contentAvailabilityBufferView
      ? [{ bitstream: tileAvailabilityBufferView ? 1 : 0, availableCount: contentAvailability.filter(v => v).length }]
      : [{ constant: contentAvailabilityBuffer }],
    childSubtreeAvailability: childSubtreeAvailabilityBufferView
        ? { bitstream: [tileAvailabilityBufferView, contentAvailabilityBufferView].filter(v => v).length, availableCount: childSubtreeAvailability.filter(v => v).length }
        : { constant: childSubtreeAvailabilityBuffer }
  };
  const json = Buffer.from(JSON.stringify(jsonObj));
  // The JSON chunk shall be padded with trailing Space chars (0x20)
  const paddingBuffer = Buffer.from(new Uint8Array(Array((8 - (json.byteLength % 8) % 8)).fill(0x20)));
  const jsonBuffer = Buffer.concat([json, paddingBuffer]);
  const jsonByteLen = Buffer.from(new BigUint64Array([BigInt(jsonBuffer.byteLength)]).buffer);
  const binaryBtyeLen = Buffer.from(new BigUint64Array([BigInt(buffer.byteLength)]).buffer);
  return Buffer.concat([magic, version, jsonByteLen, binaryBtyeLen, jsonBuffer, buffer]);
}

const writeSubtrees = async (cell, subtreeLevels, filePath) => {
  const run = async (subtreeRoot, subtreeLevels, filePath) => {
    const { tileAvailability, contentAvailability, childSubtreeAvailability, subtreeRoots } = subtreeRoot.getSubtreeAvailability(subtreeLevels);
    // const tileAvailability = Array(73).fill(false).map((v, i) => i === 6 ? true : false);
    // const contentAvailability = Array(73).fill(false).map((v, i) => i === 6 ? true : false);
    // const childSubtreeAvailability = Array(512).fill(false);
    // const subtreeRoots = null;
    await fse.ensureDir(filePath);
    await writeFile(
      path.join(filePath, `${subtreeRoot.level}-${subtreeRoot.x}-${subtreeRoot.y}${subtreeRoot instanceof Cell3 ? `-${subtreeRoot.z}` : ""}.subtree`),
      createSubtreeBinary({ tileAvailability, contentAvailability, childSubtreeAvailability, subtreeRoots })
    );
    console.log(`Subtree ${subtreeRoot.level}-${subtreeRoot.x}-${subtreeRoot.y}${subtreeRoot instanceof Cell3 ? `-${subtreeRoot.z}` : ""}.subtree done.`);
    for (let i = 0; subtreeRoots && i < subtreeRoots.length; i++) {
      const root = subtreeRoots[i];

      if (root.getTileAvailability()) {
        await run(root, subtreeLevels, filePath);
      }
    }
  }

  await run(cell, subtreeLevels, filePath);
}

/**
 * tile坐标数组 [x, y] | [x, y, z]
 * @param {Array<number>} coordinate
 * @param {number} len
 * @returns 
 */
const tileCoordinate2MortonIndex = (coordinate, len, toNumber = true) => {
  const strArr = coordinate.map((v) => {
    const str = `${"0".repeat(len)}${v.toString(2)}`;

    return str.substring(str.length - len, str.length);
  });
  const motronIndexStr = Array(len)
    .fill(0)
    .reduce((pre, _, i) => {
      pre += strArr.map(s => s[i]).reverse().join("");

      return pre;
    }, "");
  
  return toNumber ? parseInt(motronIndexStr, 2) : motronIndexStr;
}

/**
 * 将boolean数组转换成bit数组 true为1 8位0补齐
 * @param {*} arr 
 */
const boolArray2Bin = (arr) => {
  const len = Math.ceil(arr.length / 8);
  const buffer = Buffer.from(new Uint8Array(len + ((8 - len % 8) % 8)));

  for (let i = 0; i < len; i++) {
    // reverse 0-0-0-0 在高位00000001
    const datas = arr.slice(i * 8, i * 8 + 8).concat(Array(8).fill(false)).slice(0, 8).reverse();
    
    buffer[i] = datas.reduce((p, v, i) => {
      p += (v ? Math.pow(2, datas.length - i - 1) : 0);

      return p;
    }, 0)
  }

  return buffer;
}

/**
 * 取得Buffer数组总的字节长度 Buffer可为空
 * @param {Buffer} buffers 
 */
const getBuffersByteLength = (...buffers) => {
  return buffers.reduce((pre, buf) => {
    pre += (buf instanceof Buffer ? buf.byteLength : 0);

    return pre;
  }, 0);
}

const paddingBuffer = (buffer) => {
  const byteLength = buffer.byteLength;
  const modLength = byteLength % 8;
  if (modLength === 0) {
    return buffer;
  } else {
    const res = Buffer.alloc(byteLength + 8 - modLength);

    buffer.copy(res);

    return res;
  }
}

const guid = () => Math.random().toString(16).slice(2)

export {
  getNodeVertexCount,
  getNodesVertexCount,
  create3dtiles,
  create3dtilesContent,
  pruneMaterial,
  isMaterialLike,
  isBboxContain,
  writeSubtrees,
  tileCoordinate2MortonIndex,
  boolArray2Bin,
  getBuffersByteLength,
  distance,
  paddingBuffer,
  guid
}