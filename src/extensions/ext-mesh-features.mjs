import { Extension, ExtensionProperty, PropertyType } from "@gltf-transform/core";

// https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features
export const EXT_MESH_FEATURES = "EXT_mesh_features";

/**
 * TODO 现在只支持attribute feature
 */
class Features extends ExtensionProperty {
  static EXTENSION_NAME = EXT_MESH_FEATURES;

  constructor(graph, featureCount, attribute) {
    super(graph);
    this.featureCount = featureCount;
    this.attribute = attribute;
  }

  init() {
    this.extensionName = EXT_MESH_FEATURES;
    this.parentTypes = [PropertyType.PRIMITIVE];
  }
}

export class EXTMeshFeatures extends Extension {
  static EXTENSION_NAME = EXT_MESH_FEATURES;
  extensionName = EXT_MESH_FEATURES;

  createFeatures(featureCount, attribute) {
    return new Features(this.document.getGraph(), featureCount, attribute);
  }

  read(context) {
    return this;
  }

  write(context) {
    this.document
      .getRoot()
      .listMeshes()
      .forEach((mesh) => {
        const meshIndex = context.meshIndexMap.get(mesh);
        mesh.listPrimitives().forEach((primitive, primitiveIndex) => {
          const features = primitive.getExtension(EXTMeshFeatures.EXTENSION_NAME);
          
          if (features) {
            const meshDef = context.jsonDoc.json.meshes[meshIndex];
            const { primitives } = meshDef;
            const primitiveDef = primitives[primitiveIndex];
            primitiveDef.extensions = primitiveDef.extensions || {};
            primitiveDef.extensions[EXTMeshFeatures.EXTENSION_NAME] = {
              featureIds: [{
                featureCount: features.featureCount,
                attribute: features.attribute
              }]
            };
          }
        })
      })
    return this;
  }
}