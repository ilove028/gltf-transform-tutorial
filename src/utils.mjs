import { VertexAttributeSemantic } from "./constant.mjs";

const getNodeVertexCount = (node) => {
  const mesh = node.getMesh();
  
  if (mesh) {
    return mesh.listPrimitives().reduce((pre, cur) => {
      pre += cur.getAttribute(VertexAttributeSemantic.POSITION).getCount();

      return pre;
    }, 0)
  } else {
    return 0;
  }
}

const getNodesVertexCount = (nodes) => {
  return nodes.reduce((count, node) => {
    count += getNodeVertexCount(node);

    return count;
  }, 0)
}

const getTileSetSphere = (cell) => {
  const { bbox: { min, max } } = cell;
  return [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
    Math.sqrt(
      Math.pow(max[0] - min[0], 2),
      Math.pow(max[1] - min[1], 2),
      Math.pow(max[2] - min[2], 2)
    )
  ]
}

const getGeometricError = (cell) => {
  const { bbox: { min, max } } = cell;

  return Math.sqrt(
    Math.pow(max[0] - min[0], 2),
    Math.pow(max[1] - min[1], 2),
    Math.pow(max[2] - min[2], 2)
  )
}

const create3dtiles = (cell) => {
  const tileset = {
    asset: {
      version: "1.1"
    },
    geometricError: getGeometricError(cell),
    root: null
  }

  const run = (cell) => {
    const children = cell.children
      ? cell.children.map(c => run(c))
      : null
    const result = {
      refine: "ADD",
      geometricError: getGeometricError(cell),
      boundingVolume: {
        sphere: getTileSetSphere(cell)
      }
    }

    if (cell.contents) {
      result.content = {
        uri: `${cell.level}-${cell.x}-${cell.y}.glb`
      }
    }

    if (children) {
      result.children = children;
    }

    return result;
  }

  tileset.root = run(cell);

  return tileset;
}

export {
  getNodeVertexCount,
  getNodesVertexCount,
  create3dtiles
}