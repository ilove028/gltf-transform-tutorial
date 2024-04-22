import { PropertyType } from '@gltf-transform/core'
import { EXTMeshGPUInstancing } from "@gltf-transform/extensions"
import { joinPrimitives, transformPrimitive } from '@gltf-transform/functions';
import { createPrimGroupKey, isInAnimationPath } from './util.mjs'

function mergePrimitives(options) {
  /**
   * @param {import("@gltf-transform/core").Document} document 
   */
  return (document) => {
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
        } else if (!isInAnimationPath(nodes[nodes.length - 1], animationNodes)) {
          const key = createPrimGroupKey(primitive)
          const primitives = mergeMap.get(key)
          if (primitives) {
            primitives.push(primitive)
          } else {
            mergeMap.set(key, [primitive])
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