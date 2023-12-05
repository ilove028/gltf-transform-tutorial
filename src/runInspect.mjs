import { NodeIO } from "@gltf-transform/core";
import { getBounds } from "./getBounds.mjs";
import glMatrix from "gl-matrix";

const { vec3: { transformMat4 } } = glMatrix;

(async function() {
  const io = new NodeIO();
  const document = await io.read("public/ship/3-2.gltf");
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  const bbox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  }
  console.log(getBounds(scene));
  document.getRoot().listNodes().forEach((node) => {
    // const { min, max } = getBounds(node);

    // if (min[0] < bbox.min[0]) {
    //   bbox.min[0] = min[0]
    // }
    // if (min[1] < bbox.min[1]) {
    //   bbox.min[1] = min[1]
    // }
    // if (min[2] < bbox.min[2]) {
    //   bbox.min[2] = min[2]
    // }

    // if (max[0] > bbox.max[0]) {
    //   bbox.max[0] = max[0]
    // }
    // if (max[1] > bbox.max[1]) {
    //   bbox.max[1] = max[1]
    // }
    // if (max[2] > bbox.max[2]) {
    //   bbox.max[2] = max[2]
    // }

    const mesh = node.getMesh();
    const matrix = node.getWorldMatrix();
    // console.log(matrix);
    if (mesh) {
      mesh.listPrimitives().forEach((primitive) => {
        const assert = document.getRoot().getAsset();
        const positionAccessor = primitive.getAttribute("POSITION");
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        positionAccessor.getMax(max);
        positionAccessor.getMin(min);

        transformMat4(min, min, matrix);
        transformMat4(max, max, matrix);
        if (min[0] < bbox.min[0]) {
          bbox.min[0] = min[0]
        }
        if (min[1] < bbox.min[1]) {
          bbox.min[1] = min[1]
        }
        if (min[2] < bbox.min[2]) {
          bbox.min[2] = min[2]
        }

        if (max[0] > bbox.max[0]) {
          bbox.max[0] = max[0]
        }
        if (max[1] > bbox.max[1]) {
          bbox.max[1] = max[1]
        }
        if (max[2] > bbox.max[2]) {
          bbox.max[2] = max[2]
        }
      });
    }
  });

  console.log(bbox);
  await io.write("public/ship/model.glb", document)
})();