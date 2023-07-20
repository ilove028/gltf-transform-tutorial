import { writeFile } from "fs/promises";
import path from "path";
import { Extension, ExtensionProperty, PropertyType } from "@gltf-transform/core";

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
                type: "string"
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
      rootDef.extensions = rootDef.extensions || {};
      rootDef.extensions[EXTStructuralMetadata.EXTENSION_NAME] = {
        schemaUri: "schema.json",
        // propertyTables: [
        //   {
        //     name: "entity_2023_7_19",
        //     class: "entity",
        //     count: extension.getCount(),
        //     properties: {
        //       iid: {
        //         values: 1
        //       }
        //     }
        //   }
        // ]
      }
    }
  }
}