import { Accessor, Document, NodeIO } from "@gltf-transform/core";
import fse from "fs-extra";
import path from "path";
import { fileURLToPath } from "url"

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
 * 处理Grd处理后的JSON文件生成gltf attributes里面key为标准GLTF attributename
 * @param {Array<{indices: Array<number>; attributes: Record<string, { componentDatatype: number; componentsPerAttribute: number; values: Array<number> }> }>} datas 
 */
async function parseGrd(datas) {
  const document = new Document();
  const scene = document.createScene();
  const buffer = document.createBuffer();
  const material = document.createMaterial()
    .setBaseColorFactor([1, 1, 1, 1]);

  document.getRoot().setDefaultScene(scene);

  datas.forEach((data) => {
    const primitive = document.createPrimitive()
      .setMaterial(material);

    primitive.setIndices(
      document.createAccessor()
        .setArray(new Uint32Array(data.indices))
        .setType(Accessor.Type.SCALAR)
        .setBuffer(buffer)
    )
    Object.entries(data.attributes).forEach(([key, item]) => {
      const TypeCtr = componentDatatype2TypeCtr(item.componentDatatype)

      primitive.setAttribute(
        key,
        document.createAccessor()
          .setArray(new TypeCtr(item.values))
          .setType(componentsPerAttribute2AccessorType(item.componentsPerAttribute))
          .setBuffer(buffer)
      )
    })

    scene.addChild(
      document.createNode()
        .setMesh(
          document.createMesh()
            .addPrimitive(primitive)
        )
    )
  });

  const io = new NodeIO();

  await io.write('./public/terrain.glb', document);
}

if (process.argv[2]) {
  const __filenameNew = fileURLToPath(import.meta.url);
  const __dirnameNew = path.dirname(__filenameNew)
  const content = fse.readFileSync(path.join(__dirnameNew, '../', process.argv[2]), { encoding: "utf-8" });

  parseGrd(JSON.parse(content));
}