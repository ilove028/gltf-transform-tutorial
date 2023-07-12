import { Document, Accessor } from "@gltf-transform/core";
import { joinPrimitives, transformPrimitive, simplifyPrimitive } from "@gltf-transform/functions";
import { createCanvas } from "canvas";
import { MeshoptSimplifier } from "meshoptimizer"; 

const VertexAttributeSemantic = {
  /**
   * Per-vertex position.
   *
   * @type {string}
   * @constant
   */
  POSITION: "POSITION",

  /**
   * Per-vertex normal.
   *
   * @type {string}
   * @constant
   */
  NORMAL: "NORMAL",

  /**
   * Per-vertex tangent.
   *
   * @type {string}
   * @constant
   */
  TANGENT: "TANGENT",

  /**
   * Per-vertex texture coordinates.
   *
   * @type {string}
   * @constant
   */
  TEXCOORD: "TEXCOORD",

  /**
   * Per-vertex color.
   *
   * @type {string}
   * @constant
   */
  COLOR: "COLOR",

  /**
   * Per-vertex joint IDs for skinning.
   *
   * @type {string}
   * @constant
   */
  JOINTS: "JOINTS",

  /**
   * Per-vertex joint weights for skinning.
   *
   * @type {string}
   * @constant
   */
  WEIGHTS: "WEIGHTS",

  /**
   * Per-vertex feature ID.
   *
   * @type {string}
   * @constant
   */
  FEATURE_ID: "_FEATURE_ID",
};

/**
 * 根据像素多小计算合适的图片大小
 * @param pixels 
 * @param size 
 */
const computeSize = (pixels, size = 1) => {
  const powSize = Math.pow(size, 2);

  if (pixels < powSize) {
    throw new Error("Can't compute size.")
  } else if (pixels === powSize) {
    return size;
  } else if (powSize < pixels && pixels <= Math.pow(size * 2, 2)) {
    return size * 2;
  } else {
    return computeSize(pixels, size * 2);
  }
}

const createPng = (datas) => {
  // const canvas = document.createElement("canvas");
  const count = datas.length / 4; // 多少个像素
  const size = computeSize(count);
  const canvas = createCanvas(size, size)
  const context = canvas.getContext("2d");

  if (context) {
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < canvas.width; i++) {
      for (let j = 0; j < canvas.height; j++) {
        const base = (j * canvas.width + i) * 4;
        pixels[base] = datas[base];
        pixels[base + 1] = datas[base + 1];
        pixels[base + 2] = datas[base + 2];
        pixels[base + 3] = datas[base + 3];
      }
    }
    context.putImageData(imgData, 0, 0);
    
    // return canvas.toDataURL();
    const buffer = canvas.toBuffer();
    return new Uint8Array(buffer);
  } else {
    throw new Error("Context not exist")
  }
}

const colorFloat2Byte = (color) => {
  return color === 1.0 ? 255.0 : (color * 256.0) | 0;
}

/**
 * 
 * @param document 
 * @param createTextCoord 是否生成纹理坐标用于兼容Cesium GLTF老的架构
 * @returns 
 */
const merge = async (document, createTextCoord = false) => {
  const nodes = document.getRoot().listNodes();
  const primitives = document.getRoot().listNodes().map(node => node.getMesh()).filter(m => m).map(m => m.listPrimitives()).flat()
  const size = computeSize(primitives.length);
  const canMergePrimitives = [];

  if (nodes.length > Math.pow(2, 24) - 1) {
    // https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features 大小限制
    throw new Error("Node length exceeded.")
  }

  let primitiveIndex = 0;
  document.getRoot().listNodes().forEach((node, nodeIndex) => {
    const mesh = node.getMesh();

    if (mesh) {
      const matrix = node.getWorldMatrix();

      mesh.listPrimitives().forEach((primitive) => {
        const material = primitive.getMaterial();
        if (material && !material.getBaseColorTexture()?.getImage()) {
          const vertexCount = primitive.getAttribute(VertexAttributeSemantic.POSITION).getCount();
          const featureArray = new Array(vertexCount).fill(nodeIndex);

          transformPrimitive(primitive, matrix);
          primitive.setAttribute(
            `${VertexAttributeSemantic.FEATURE_ID}_0`,
            document.createAccessor()
              .setArray(
                nodes.length <= (Math.pow(2, 16) - 1)
                  ? new Uint16Array(featureArray)
                  : new Float32Array(featureArray)
              )
              .setType(Accessor.Type.SCALAR)
              .setBuffer(document.getRoot().listBuffers()[0])
          );

          if (createTextCoord) {
            const rowIndex = Math.floor(primitiveIndex / size);
            const colunmIndex = primitiveIndex - rowIndex * size
            const step = 1 / size;

            primitive.setAttribute(
              `${VertexAttributeSemantic.TEXCOORD}_0`,
              document.createAccessor()
                .setArray(new Float32Array(
                  new Array(2 * vertexCount)
                    .fill(0)
                    .map((_, index) => {
                      return index % 2 === 1 ? (rowIndex + 0.5) * step : (colunmIndex + 0.5) * step
                    })
                ))
                .setType(Accessor.Type.VEC2)
                .setBuffer(document.getRoot().listBuffers()[0])
            )
          }

          canMergePrimitives.push(primitive);
        }
        primitiveIndex++;
      });
    }
  });

  // 开始处理合批
  const newDocument = new Document();
  newDocument.createScene();
  newDocument.createBuffer();
  
  const material = newDocument.createMaterial()
    .setBaseColorTexture(
      newDocument.createTexture()
        .setImage(
          createPng(new Uint8Array(
            new Array(primitiveIndex * 4)
              .fill(0)
              .map((_, index) => {
                const primitive = primitives[Math.floor(index / 4)];
                const baseColorFactor = primitive.getMaterial()?.getBaseColorFactor();
                
                if (baseColorFactor) {
                  if (index % 4 === 0) {
                    return colorFloat2Byte(baseColorFactor[0]);
                    // return 255;
                  } else if (index % 4 === 1) {
                    // return 0;
                    return colorFloat2Byte(baseColorFactor[1]);
                  } else if (index % 4 === 2) {
                    // return 0;
                    return colorFloat2Byte(baseColorFactor[2]);
                  } else {
                    // return 255;
                    return colorFloat2Byte(baseColorFactor[3]);
                  }
                } else {
                  return 0;
                }
              })
          ))
        )
        .setMimeType("'image/png")
    )
    // .getBaseColorTextureInfo()
    // .setMagFilter(TextureInfo.MagFilter.NEAREST)
    // .setMinFilter(TextureInfo.MinFilter.NEAREST)
  const cache = [];
  const mergedPrimitive = joinPrimitives(canMergePrimitives.map((p) => {
    const primitive = newDocument.createPrimitive();

    // weldPrimitive(document, p, {tolerance: 0.01});
    p = simplifyPrimitive(document, p, { simplifier: MeshoptSimplifier, ratio: 0.1, error: 0.01 })
    p.listSemantics().forEach((semantic) => {
      const accessor = p.getAttribute(semantic);

      primitive.setAttribute(
        semantic,
        newDocument.createAccessor()
          .setArray(accessor.getArray())
          .setType(accessor.getType())
          .setBuffer(newDocument.getRoot().listBuffers()[0])
      );
    });

    const indicesAccessor = p.getIndices();

    primitive.setIndices(
      newDocument.createAccessor()
        .setArray(indicesAccessor.getArray())
        .setType(indicesAccessor.getType())
        .setBuffer(newDocument.getRoot().listBuffers()[0])
    )

    cache.push(primitive);
    return primitive;
  }));
  cache.forEach((p) => {
    p.listAttributes().forEach(a => a.dispose());
    p.getIndices().dispose();
    p.dispose();
  });
  mergedPrimitive.setMaterial(material);
  newDocument.getRoot()
    .listScenes()[0]
    .addChild(
      newDocument.createNode()
        .setMesh(
          newDocument.createMesh()
            .addPrimitive(mergedPrimitive)
        )
    )
  return newDocument
}

export {
  merge
}