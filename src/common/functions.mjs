import { PropertyType, Accessor } from '@gltf-transform/core'
import { EXTMeshGPUInstancing } from "@gltf-transform/extensions"
import { joinPrimitives, transformPrimitive } from '@gltf-transform/functions';
import { createPrimGroupKey, isInAnimationPath, hasSkinAttribute } from './util.mjs'
import { EXTMeshFeatures, EXTStructuralMetadata } from "../extensions/index.mjs";
import { VertexAttributeSemantic } from "../constant.mjs";
/**
 * 
 * @param {import("@gltf-transform/core").NodeIO} io 
 * @returns 
 */
function mergePrimitives(io) {
  /**
   * @param {import("@gltf-transform/core").Document} document 
   */
  return (document) => {
    io.registerExtensions([EXTMeshFeatures, EXTStructuralMetadata])
    const meshFeatures = document.createExtension(EXTMeshFeatures);
    /**
     * @type {EXTStructuralMetadata}
     */
    const metadataExt = document.createExtension(EXTStructuralMetadata);
    metadataExt.setInline(true)
    const metadata = metadataExt.createMeatdata();
    document.getRoot().setExtension(EXTStructuralMetadata.EXTENSION_NAME, metadata);
    const animationNodes = document.getRoot().listAnimations().map((a) => a.listChannels()).flat().map((c) => c.getTargetNode()).filter(n => n)
    /**
     * @type {Map<string, Array<import("@gltf-transform/core").Primitive>>}
     */
    const mergeMap = new Map()

    document.getRoot().listMeshes().forEach((mesh, index) => {
      mesh.listPrimitives().forEach((primitive) => {
        /**
         * @type {Array<import("@gltf-transform/core").Node>}
         */
        const nodes = mesh.listParents()

        if (nodes.filter(n => n.propertyType === PropertyType.NODE || n.getExtension(EXTMeshGPUInstancing.EXTENSION_NAME)).length > 1) {
          // 该mesh被实例化节点引用
        } else if (nodes.length === 0) {
          throw new Error(`Mesh ${index} doesn't have a node parent`)
        } else {
          const featureLen = metadata.addItem({ iid: nodes[nodes.length - 1].getName(), primitiveType: 4 });
          const count = primitive.getAttribute(VertexAttributeSemantic.POSITION).getCount();
          primitive.setAttribute(
            `${VertexAttributeSemantic.FEATURE_ID}_0`,
            document.createAccessor()
              .setArray(
                // https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features 大小限制
                // nodes.length < Math.pow(2, 16)
                // ? new Uint16Array(Array(count).fill(nodeIndex))
                new Float32Array(Array(count).fill(featureLen - 1))
              )
              .setType(Accessor.Type.SCALAR)
              .setBuffer(document.getRoot().listBuffers() ? document.getRoot().listBuffers()[0] : document.createBuffer())
          );
          if (!isInAnimationPath(nodes[nodes.length - 1], animationNodes) && !hasSkinAttribute(primitive)) {
            // 非动画节点
            const key = createPrimGroupKey(primitive)
            const primitives = mergeMap.get(key)
            if (primitives) {
              primitives.push(primitive)
            } else {
              mergeMap.set(key, [primitive])
            }
          } else {
            // 动画节点
            primitive.setExtension(EXTMeshFeatures.EXTENSION_NAME, meshFeatures.createFeatures(1, 0));
          }
        }
      })
    })

    mergeMap.forEach((primitives) => {
      primitives.forEach((primitive) => {
        /**
         * @type {import("@gltf-transform/core").Node}
         */
        const parents = primitive.listParents()[0].listParents()

        transformPrimitive(primitive, parents[parents.length - 1].getWorldMatrix())
      })

      const mergedPrimitive = joinPrimitives(primitives)
      mergedPrimitive.setExtension(EXTMeshFeatures.EXTENSION_NAME, meshFeatures.createFeatures(primitives.length, 0));
      primitives.forEach((primitive) => {
        const parents = primitive.listParents()
        primitive.dispose()

        for (let i = parents.length - 1; i > -1; i--) {
          const property = parents[i]

          if (property.propertyType === PropertyType.MESH) {
            if (property.listPrimitives().length === 0) {
              property.dispose()
            }
          } else if (property.propertyType === PropertyType.NODE) {
            if (!property.getMesh() && property.listChildren().length === 0) {
              property.dispose()
            }
          }
        }
      })
      document.getRoot().getDefaultScene().addChild(
        document.createNode().setMesh(
          document.createMesh().addPrimitive(mergedPrimitive)
        )
      )
    })
  }
}

export {
  mergePrimitives
}