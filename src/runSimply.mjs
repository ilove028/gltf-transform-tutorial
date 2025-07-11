import { NodeIO } from "@gltf-transform/core";
import { prune, simplify, weld, simplifyPrimitive, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

/**
 * 
 * @param {import("@gltf-transform/core").Document} document 
 */
function getVertexCount(document) {
  let count = 0;
  document.getRoot().listNodes().forEach((node) => {
    const mesh = node.getMesh()
    
    mesh && mesh.listPrimitives().forEach((primitive) => {
      count += getPrimitiveCount(primitive)
    })
  })

  return count;
}

/**
 * 
 * @param {import("@gltf-transform/core").Primitive} primitive 
 */
function getPrimitiveCount(primitive) {
  const accessor = primitive.getAttribute("POSITION")

  return accessor
    ? accessor.getCount()
    : 0
}

/**
 * 
 * @param {{ simplifier: any; ratio?: number; error?: number; throttle?: 10000 }} options 
 * @returns 
 */
function simplifyEachPrimitive(options) {
  /**
   * @param {import("@gltf-transform/core").Document} document 
   */
  return (document) => {
    document.getRoot().listNodes().forEach((node) => {
      const mesh = node.getMesh()

      mesh && mesh.listPrimitives().forEach((primitive) => {
        const count = getPrimitiveCount(primitive);
        const throttle = options.throttle || 10000
        if (count > throttle) {
          simplifyPrimitive(document, primitive, options)
        }
      })
    })
  }
}

const io = new NodeIO()
async function main(input) {
  const document = await io.read(input)
  console.log("loaded", getVertexCount(document));
  await document.transform(
    weld({}),
    // simplify({ simplifier: MeshoptSimplifier, ratio: 0.1 })
    // simplifyEachPrimitive({ simplifier: MeshoptSimplifier, ratio: 0.1, error: 1, throttle: 1000 })
    // prune()
  );
  console.log("Transformed", getVertexCount(document));
  await io.write("./public/simply/04010100400000000000000000000000.glb", document)
  console.log("write");
}

main("./public/nb/04010100400000000000000000000000/04010100400000000000000000000000.glb")