import { NodeIO, Document } from "@gltf-transform/core";
import { createTransform, prune, reorder, quantize } from "@gltf-transform/functions";
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { VertexAttributeSemantic } from "./constant.mjs";
import path from "path";

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

const getTileSetSphere = (cell) => {
  const { bbox: { min, max } } = cell;
  const center = middle(min, max);
  return [
    ...center,
    distance(center, max)
  ]
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

const getGeometricError = (cell) => {
  const { bbox: { min, max } } = cell;
  const center = middle(min, max);
  
  return distance(center, max);
}

const create3dtiles = (cell) => {
  const tileset = {
    asset: {
      version: "1.1"
    },
    geometricError: getGeometricError(cell),
    root: null
  }

  const run = (cell) => {
    const children = cell.children
      ? cell.children.map(c => run(c))
      : null
    const result = {
      refine: "ADD",
      geometricError: getGeometricError(cell),
      boundingVolume: {
        sphere: getTileSetSphere(cell)
      }
    }

    if (cell.contents) {
      result.content = {
        uri: `${cell.level}-${cell.x}-${cell.y}.glb`
      }
    }

    if (children) {
      result.children = children;
    }

    return result;
  }

  tileset.root = run(cell);

  return tileset;
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

const create3dtilesContent = async (filePath, document, cell, extension = "glb") => {
  const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
  });
  const materialMap = new WeakMap();
  const createDocument = (nodes) => {
    if (nodes) {
      const newDocument = new Document();
      const buffer = newDocument.createBuffer();
      const scene = newDocument.createScene()

      nodes && nodes.forEach((node) => {
        const primitives = node.getMesh().listPrimitives();
        const mesh = newDocument.createMesh();

        primitives.forEach((primitive) => {
          const newPrimitive = newDocument.createPrimitive();
          const oldMaterial = primitive.getMaterial();
          const indeiceAccessor = primitive.getIndices();

          indeiceAccessor && newPrimitive.setIndices(
            newDocument.createAccessor()
              .setArray(indeiceAccessor.getArray())
              .setType(indeiceAccessor.getType())
          )

          primitive.listSemantics().forEach((semantic) => {
            const oldAccessor = primitive.getAttribute(semantic);

            newPrimitive.setAttribute(
              semantic,
              newDocument.createAccessor()
                .setArray(oldAccessor.getArray())
                .setType(oldAccessor.getType())
                .setBuffer(buffer)
                .setNormalized(semantic === VertexAttributeSemantic.NORMAL)
            )
          })

          let existMaterial = materialMap.get(oldMaterial);

          // if (!existMaterial) {
          //   existMaterial = newDocument.createMaterial().setBaseColorFactor(oldMaterial.getBaseColorFactor());
          //   materialMap.set(oldMaterial, existMaterial);
          // }
          newPrimitive.setMaterial(newDocument.createMaterial().setBaseColorFactor(oldMaterial.getBaseColorFactor()))

          mesh.addPrimitive(newPrimitive);

        })
        scene.addChild(
          newDocument.createNode()
            .setExtras(node.getExtras())
            .setMatrix(node.getMatrix())
            .setMesh(mesh)
        )
      });

      return newDocument;
    }
  }

  const write = async (filePath, document, cell) => {
    const doc = createDocument(cell.contents);

    if (doc) {
      await doc.transform(
        pruneMaterial((existMaterial, material) => {
          const a = existMaterial.getBaseColorFactor();
          const b = material.getBaseColorFactor();
          
          return Math.abs(a[0] - b[0]) < 0.01
            && Math.abs(a[1] - b[1]) < 0.01
            && Math.abs(a[2] - b[2]) < 0.01
            && a[3] === b[3]
        }),
        prune(),
        reorder({encoder: MeshoptEncoder}),
        // quantize({
        //   pattern: /^(POSITION)(_\d+)?$/ // TODO quantize 有损压缩 POSITION会造成包围球和模型渲染暂时没有问题 GLTF模型展示不匹配 NORMAL会造成渲染不对
        // })
      );
      doc.createExtension(EXTMeshoptCompression)
        .setRequired(true)
        .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
      await io.write(path.join(filePath, `${cell.level}-${cell.x}-${cell.y}.${extension}`), doc);
    }
    for (let i = 0; cell.children && i < cell.children.length; i++) {
      await write(filePath, document, cell.children[i]);
    }
  }

  await write(filePath, document, cell);
}

export {
  getNodeVertexCount,
  getNodesVertexCount,
  create3dtiles,
  create3dtilesContent,
  pruneMaterial
}