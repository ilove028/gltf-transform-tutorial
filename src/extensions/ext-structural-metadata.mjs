import { writeFile } from "fs/promises";
import fse from "fs-extra";
import path from "path";
import { Extension, ExtensionProperty, PropertyType } from "@gltf-transform/core";
import { paddingBuffer } from "../utils.mjs";

export const EXT_STRUCTURAL_METADATA = "EXT_structural_metadata";

class Metadata extends ExtensionProperty {
  static EXTENSION_NAME = EXT_STRUCTURAL_METADATA;

  constructor(graph) {
    super(graph);
    this.items = [];
  }

  init() {
    this.extensionName = EXT_STRUCTURAL_METADATA;
    this.parentTypes = [PropertyType.ROOT, PropertyType.NODE, PropertyType.PRIMITIVE];
  }

  addItem(item) {
    this.items.push(item);
  }

  getCount() {
    return this.items.length;
  }
}

export class EXTStructuralMetadata extends Extension {
  static EXTENSION_NAME = EXT_STRUCTURAL_METADATA;
  extensionName = EXT_STRUCTURAL_METADATA;

  createMeatdata() {
    return new Metadata(this.document.getGraph())
  }

  async writeSchema(filePath) {
    const basePath = path.join(filePath, "contents");
    await fse.ensureDir(basePath);
    await writeFile(path.join(basePath, "schema.json"), JSON.stringify(
      {
        classes: {
          entity: {
            name: "Entity info.",
            properties: {
              iid: {
                type: "STRING",
                required: true
              },
              primitiveType: {
                // rs-cesium PrimitiveType Enum定义 Transparent = 0  BigScene = 1 SmallScene = 2 Unknown = 4 这个是这里定义的 rs 没有
                type: "SCALAR",
                componentType: "UINT8"
              }
            }
          }
        }
      },
      null,
      2
    ));
  }

  read(context) {
    return this;
  }

  write(context) {
    const extension = this.document.getRoot().getExtension(EXTStructuralMetadata.EXTENSION_NAME);

    if (extension) {
      const rootDef = context.jsonDoc.json;
      const bufferIndex = rootDef.buffers.length;
      const iidBufferViewDefIndex = rootDef.bufferViews.length;
      const stringOffsetsBufferViewDefIndex = rootDef.bufferViews.length + 1;
      const primitiveTypeBufferViewDefIndex = rootDef.bufferViews.length + 2; // 这里简单实现 将 primitiveType 分为另一个buffer
      rootDef.extensions = rootDef.extensions || {};
      rootDef.extensions[EXTStructuralMetadata.EXTENSION_NAME] = {
        schemaUri: "schema.json",
        propertyTables: [
          {
            name: "entity_2023_7_19",
            class: "entity",
            count: extension.getCount(),
            properties: {
              iid: {
                values: iidBufferViewDefIndex,
                stringOffsets: stringOffsetsBufferViewDefIndex
              },
              primitiveType: {
                values: primitiveTypeBufferViewDefIndex
              }
            }
          }
        ]
      }
      // rootDef.meshes && rootDef.meshes.forEach((mesh) => {
      //   mesh.primitives && mesh.primitives.forEach((primitive) => {
      //     if (primitive.extensions && primitive.extensions[EXTMeshFeatures.EXTENSION_NAME])
      //   })
      // })
      const stringBuffers = extension.items.reduce((pre, item) => {
        pre.push(Buffer.from(item.iid === null || item.iid === undefined ? "" : `${item.iid}`));
        return pre;
      }, []);
      const stringOffsets = Buffer.from(
        new Uint32Array(stringBuffers.reduce((pre, buf) => {
          const last = pre[pre.length - 1];

          pre.push(last + buf.byteLength);
          return pre;
        }, [0])).buffer
      );
      const stringBuffer = Buffer.concat(stringBuffers);
      const primitiveTypeBuffer = Buffer.from(new Uint8Array(extension.items.map(item => item.primitiveType)).buffer);
      const stringBufferPadded = paddingBuffer(stringBuffer);
      const stringOffsetsBufferPadded = paddingBuffer(stringOffsets);
      // const primitiveTypeBufferPadded = paddingBuffer(primitiveTypeBuffer);
      const buffer = Buffer.concat([stringBufferPadded, stringOffsetsBufferPadded, primitiveTypeBuffer]);
      rootDef.buffers.push({
        uri: `data:application/gltf-buffer;base64,${buffer.toString('base64')}`,
        byteLength: buffer.byteLength
      })
      rootDef.bufferViews.push({
        buffer: bufferIndex,
        byteOffset: 0,
        byteLength: stringBuffer.byteLength
      });
      rootDef.bufferViews.push({
        buffer: bufferIndex,
        byteOffset: stringBufferPadded.byteLength,
        byteLength: stringOffsets.byteLength
      });
      rootDef.bufferViews.push({
        buffer: bufferIndex,
        byteOffset: stringBufferPadded.byteLength + stringOffsetsBufferPadded.byteLength,
        byteLength: primitiveTypeBuffer.byteLength
      });
    }
  }
}