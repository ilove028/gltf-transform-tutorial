import { writeFile } from "fs/promises";
import path from "path";
import { Extension, ExtensionProperty, PropertyType } from "@gltf-transform/core";
import { EXTMeshFeatures } from "./ext-mesh-features.mjs";

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
    await writeFile(path.join(filePath, "schema.json"), JSON.stringify(
      {
        classes: {
          entity: {
            name: "Entity info.",
            properties: {
              iid: {
                type: "STRING",
                required: true
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
      const bufferViewDefIndex = rootDef.bufferViews.length;
      const bufferIndex = rootDef.buffers.length;
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
                values: bufferViewDefIndex,
                stringOffsets: bufferViewDefIndex + 1
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
      const buffer = Buffer.concat(stringBuffers.concat(stringOffsets));
      rootDef.buffers.push({
        uri: `data:application/gltf-buffer;base64,${buffer.toString('base64')}`,
        byteLength: buffer.byteLength
      })
      rootDef.bufferViews.push({
        buffer: bufferIndex,
        byteOffset: 0,
        byteLength: buffer.byteLength - stringOffsets.byteLength
      });
      rootDef.bufferViews.push({
        buffer: bufferIndex,
        byteOffset: buffer.byteLength - stringOffsets.byteLength,
        byteLength: stringOffsets.byteLength
      })
    }
  }
}