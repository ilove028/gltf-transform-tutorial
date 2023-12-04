import { Extension, ExtensionProperty, PropertyType } from "@gltf-transform/core";

// https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features
export const EXT_INSTANCE_FEATURES = "EXT_instance_features";

class Features extends ExtensionProperty {
  static EXTENSION_NAME = EXT_INSTANCE_FEATURES;
  /**
   * 
   * @param {*} graph 
   * @param {Array<{ featureCount: number, attribute?: number, nullFeatureId?: number, propertyTable: number, label?: string }>} param1 
   */
  constructor(graph, options) {
    super(graph);
    this.options = options;
  }

  init() {
    this.extensionName = EXT_INSTANCE_FEATURES;
    this.parentTypes = [PropertyType.NODE];
  }
}

export class EXTInstanceFeatures extends Extension {
  static EXTENSION_NAME = EXT_INSTANCE_FEATURES;
  extensionName = EXT_INSTANCE_FEATURES;

  createFeatures(options) {
    return new Features(this.document.getGraph(), options);
  }

  read(context) {
    return this;
  }

  write(context) {
    this.document
      .getRoot()
      .listNodes()
      .forEach((node, nodeIndex) => {
        const feature = node.getExtension(EXTInstanceFeatures.EXTENSION_NAME);

        if (feature) {
          const nodeDef = context.jsonDoc.json.nodes[nodeIndex];

          nodeDef.extensions = nodeDef.extensions || {};
          nodeDef.extensions[EXTInstanceFeatures.EXTENSION_NAME] = {
            featureIds: feature.options.map((opt) => {
              return {
                featureCount: opt.featureCount,
                propertyTable: opt.propertyTable,
                attribute: opt.attribute,
                nullFeatureId: opt.nullFeatureId,
                label: opt.label
              }
            })
          }
        }
      });
    return this;
  }
}