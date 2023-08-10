import { getBounds } from "@gltf-transform/core";
import { distance, getNodesVertexCount, getNodeVertexCount, isBboxContain } from "./utils.mjs"
import Cell, { Cell3 } from "./Cell.mjs";

const AXIS = {
  X: 0,
  Y: 1,
  Z: 2
}

const noUniformQuadtree = (document, maxVertexCount = 300000, axis) => {
  const divide = (cell, nodeListList, vertexCount) => {
    console.log(`Divide ${cell.level}-${cell.x}-${cell.y}`);
    if (vertexCount > maxVertexCount && nodeListList[0].length > 1) {
      // 顶点没有达到划分条件或者还有超过一个的节点nodeListList 是一个二维数组
      const midIndex0 = findMidIndex(nodeListList[0], vertexCount / 2);
      const nodeList0Left = nodeListList[0].slice(0, midIndex0 + 1);
      const nodeList0Right = nodeListList[0].slice(midIndex0 + 1);
      const nodeList1InList0Left = nodeListList[1].filter(n => nodeList0Left.includes(n));
      const nodeList1InList0Right = nodeListList[1].filter(n => nodeList0Right.includes(n));
      const leftCenterIndex = findMidIndex(nodeList1InList0Left, getNodesVertexCount(nodeList0Left) / 2);
      const rightCenterIndex = findMidIndex(nodeList1InList0Right, getNodesVertexCount(nodeList0Right) / 2);
      // const nodeList1Left = nodeListList[1].filter(n => nodeList0Left.includes(n).slice(0, midIndex1 + 1);
      // const nodeList1Right = nodeListList[1].slice(midIndex1 + 1);
      const cell00NodeList = nodeList1InList0Left.slice(0, leftCenterIndex + 1);
      const cell10NodeList = nodeList1InList0Right.slice(0, rightCenterIndex + 1);
      const cell01NodeList = nodeList1InList0Left.slice(leftCenterIndex + 1);
      const cell11NodeList = nodeList1InList0Right.slice(rightCenterIndex + 1);
      let cell00 = null;
      let cell10 = null;
      let cell01 = null;
      let cell11 = null;

      if (cell00NodeList.length > 0) {
        cell00 = new Cell(
          getNodesBBox(cell00NodeList),
          cell.level + 1,
          cell.x * 2 + 0,
          cell.y * 2 + 0
        );

        divide(
          cell00,
          [
            nodeListList[0].filter(n => cell00NodeList.includes(n)),
            nodeListList[1].filter(n => cell00NodeList.includes(n))
          ],
          getNodesVertexCount(cell00NodeList)
        )
      }

      if (cell10NodeList.length > 0) {
        cell10 = new Cell(
          getNodesBBox(cell10NodeList),
          cell.level + 1,
          cell.x * 2 + 1,
          cell.y * 2 + 0
        );

        divide(
          cell10,
          [
            nodeListList[0].filter(n => cell10NodeList.includes(n)),
            nodeListList[1].filter(n => cell10NodeList.includes(n))
          ],
          getNodesVertexCount(cell10NodeList)
        )
      }
      
      if (cell01NodeList.length > 0) {
        cell01 = new Cell(
          getNodesBBox(cell01NodeList),
          cell.level + 1,
          cell.x * 2 + 0,
          cell.y * 2 + 1
        );

        divide(
          cell01,
          [
            nodeListList[0].filter(n => cell01NodeList.includes(n)),
            nodeListList[1].filter(n => cell01NodeList.includes(n))
          ],
          getNodesVertexCount(cell01NodeList)
        )
      }
      
      if (cell11NodeList.length > 0) {
        cell11 = new Cell(
          getNodesBBox(cell11NodeList),
          cell.level + 1,
          cell.x * 2 + 1,
          cell.y * 2 + 1
        );
        
        divide(
          cell11,
          [
            nodeListList[0].filter(n => cell11NodeList.includes(n)),
            nodeListList[1].filter(n => cell11NodeList.includes(n))
          ],
          getNodesVertexCount(cell11NodeList)
        )
      }

      cell.children = [cell00, cell10, cell01, cell11].filter(c => c);
    } else {
      cell.contents = nodeListList[0];
    }

    return cell;
  }
  const sortAtAxis = (nodes, axis) => nodes.sort((a, b) => {
    const aBbx = getBounds(a);
    const bBbx = getBounds(b);

    return (aBbx.min[axis] + aBbx.max[axis]) / 2 - (bBbx.min[axis] + bBbx.max[axis]) / 2
  })
  
  const getNodesBBox = (nodes) => {
    let bbox = getBounds(nodes[0]);

    for (let i = 1; i < nodes.length; i++) {
      const { min, max } = getBounds(nodes[i]);

      if (bbox.min[0] > min[0]) {
        bbox.min[0] = min[0];
      }
      if (bbox.min[1] > min[1]) {
        bbox.min[1] = min[1];
      }
      if (bbox.min[2] > min[2]) {
        bbox.min[2] = min[2];
      }

      if (bbox.max[0] < max[0]) {
        bbox.max[0] = max[0];
      }
      if (bbox.max[1] < max[1]) {
        bbox.max[1] = max[1];
      }
      if (bbox.max[2] < max[2]) {
        bbox.max[2] = max[2];
      }
    }

    return bbox;
  }
  const findMidIndex = (nodes, midVertexCount) => {
    let index = 0;
    let vertexCount = 0;
    for (; index < nodes.length - 1; index++) {
      vertexCount += getNodeVertexCount(nodes[index]);

      if (vertexCount < midVertexCount) {
        const nextVertexCount = getNodeVertexCount(nodes[index + 1]);

        if (midVertexCount < (vertexCount + nextVertexCount)) {
          return index;
        } else if (midVertexCount === (vertexCount + nextVertexCount)) {
          return index + 1;
        }
      } else if (vertexCount === midVertexCount) {
        return index;
      } else {
        // 第一个就大于一半
        return index;
      }
    }
  }
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  const bbox = getBounds(scene);
  const xRange = bbox.max[0] - bbox.min[0];
  const yRange = bbox.max[1] - bbox.min[1];
  const zRange = bbox.max[2] - bbox.min[2];

  if (typeof axis !== "number") {
    let min = Infinity;
    [xRange, yRange, zRange].forEach((val, index) => {
      if (val <= min) {
        axis = index;
        min = val;
      }
    });
  }

  const nodeListX = [];
  const nodeListY = [];
  const nodeListZ = [];
  let vertexCount = 0;
  scene.traverse((n) => {
    if (n.getMesh()) {
      if (axis !== 0) {
        nodeListX.push(n);
      }
      if (axis !== 1) {
        nodeListY.push(n);
      }
      if (axis !== 2) {
        nodeListZ.push(n);
      }

      vertexCount += getNodeVertexCount(n)
    }
  });
  
  if (axis !== 0) {
    sortAtAxis(nodeListX, 0);
  }
  if (axis !== 1) {
    sortAtAxis(nodeListY, 1);
  }
  if (axis !== 2) {
    sortAtAxis(nodeListZ, 2);
  }
  
  // 这里简单通过数组判空来对应 axis
  return divide(new Cell(bbox), [nodeListX, nodeListY, nodeListZ].filter(l => l.length > 0), vertexCount);
}
const isCellContainsNode = (cell, node) => isBboxContain(cell.bbox, getBounds(node))

const getSceneDescendant = (scene, hasMesh = false) => {
  const result = [];

  scene.traverse((node) => {
    if (hasMesh && node.getMesh()) {
      result.push(node);
    } else {
      result.push(node);
    }
  })
  return result;
}

const quadtree = (document, { maxLevel, maxNodeSize, axis } = { maxLevel: Infinity, maxNodeSize: 1, axis: undefined }) =>{
  // TODO https://blog.csdn.net/lj820348789/article/details/72845482 
  // https://zhuanlan.zhihu.com/p/552433124
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  const bbox = getBounds(scene);
  const xRange = bbox.max[0] - bbox.min[0];
  const yRange = bbox.max[1] - bbox.min[1];
  const zRange = bbox.max[2] - bbox.min[2];
  const divideCell = (cell, axis) => {
    const { bbox: { min, max } } = cell;
    const middles = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2
    ];

    let cell00;
    if (axis === 0) {
      cell00 = new Cell(
        {
          min: [min[0], min[1], min[2]],
          max: [max[0], middles[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 0
      )
    } else if (axis === 1) {
      cell00 = new Cell(
        {
          min: [min[0], min[1], min[2]],
          max: [middles[0], max[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 0
      )
    } else {
      cell00 = new Cell(
        {
          min: [min[0], min[1], min[2]],
          max: [middles[0], middles[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 0
      )
    }

    let cell10;
    if (axis === 0) {
      cell10 = new Cell(
        {
          min: [min[0], middles[1], min[2]],
          max: [max[0], max[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 0
      )
    } else if(axis === 1) {
      cell10 = new Cell(
        {
          min: [middles[0], min[1], min[2]],
          max: [max[0], max[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 0
      )
    } else {
      cell10 = new Cell(
        {
          min: [middles[0], min[1], min[2]],
          max: [max[0], middles[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 0
      )
    }

    let cell01;
    if (axis === 0) {
      cell01 = new Cell(
        {
          min: [min[0], min[1], middles[2]],
          max: [max[0], middles[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 1
      )
    } else if (axis === 1) {
      cell01 = new Cell(
        {
          min: [min[0], min[1], middles[2]],
          max: [middles[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 1
      )
    } else {
      cell01 = new Cell(
        {
          min: [min[0], middles[1], min[2]],
          max: [middles[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 1
      )
    }

    let cell11;
    if (axis === 0) {
      cell11 = new Cell(
        {
          min: [min[0], middles[1], middles[2]],
          max: [max[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 1
      )
    } else if (axis === 1) {
      cell11 = new Cell(
        {
          min: [middles[0], min[1], middles[2]],
          max: [max[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 1
      )
    } else {
      cell11 = new Cell(
        {
          min: [middles[0], middles[1], min[2]],
          max: [max[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 1
      )
    }

    return [cell00, cell10, cell01, cell11];
  }
  
  if (typeof axis !== "number") {
    let min = Infinity;
    [xRange, yRange, zRange].forEach((val, index) => {
      if (val <= min) {
        axis = index;
        min = val;
      }
    });
  }

  const divide = (cell, axis, nodes) => {
    console.log(`Divide ${cell.level}-${cell.x}-${cell.y}`);
    if (nodes && nodes.length > maxNodeSize && cell.level < maxLevel) {
      // 可以持续划分
      const childrenCells = divideCell(cell, axis);
      const childrenNodes = [
        [],
        [],
        [],
        []
      ];

      while (nodes.length > 0) {
        let isChildCellContains = false;
        const node = nodes.pop();
        
        // node是否可以划分进下一级
        for (let i = 0; i < childrenCells.length; i++) {
          const cell = childrenCells[i];
          if (isCellContainsNode(cell, node)) {
            isChildCellContains = true;
            childrenNodes[i].push(node);
            break;
          }
        }
        // 不能划分为下一级作为当前节点Contents
        if (!isChildCellContains) {
          (cell.contents || (cell.contents = [])).push(node);
        }
      }

      childrenCells.forEach((cell, i) => {
        divide(cell, axis, childrenNodes[i]);
      });

      cell.children = childrenCells;
    } else if (nodes && nodes.length > 0) {
      cell.contents = nodes;
    }

    return cell;
  }
  
  return divide(new Cell(bbox), axis, getSceneDescendant(scene, true));
}

const octree = (document, { maxLevel, maxNodeSize, maxRadius, maxVertexCount } = { maxLevel: Infinity, maxNodeSize: 1, maxRadius: 0.5, maxVertexCount: 500000 }) => {
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  const bbox = getBounds(scene);
  const divideCell = (cell) => {
    const { bbox: { min, max } } = cell;
    const middles = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2
    ];

    return [
      new Cell3(
        {
          min: [...min],
          max: [...middles]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 0,
        cell.z * 2 + 0
      ),
      new Cell3(
        {
          min: [middles[0], min[1], min[2]],
          max: [max[0], middles[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 0,
        cell.z * 2 + 0
      ),
      new Cell3(
        {
          min: [min[0], middles[1], min[2]],
          max: [middles[0], max[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 1,
        cell.z * 2 + 0
      ),
      new Cell3(
        {
          min: [middles[0], middles[1], min[2]],
          max: [max[0], max[1], middles[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 1,
        cell.z * 2 + 0
      ),
      new Cell3(
        {
          min: [min[0], min[1], middles[2]],
          max: [middles[0], middles[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 0,
        cell.z * 2 + 1
      ),
      new Cell3(
        {
          min: [middles[0], min[1], middles[2]],
          max: [max[0], middles[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 0,
        cell.z * 2 + 1
      ),
      new Cell3(
        {
          min: [min[0], middles[1], middles[2]],
          max: [middles[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 0,
        cell.y * 2 + 1,
        cell.z * 2 + 1
      ),
      new Cell3(
        {
          min: [middles[0], middles[1], middles[2]],
          max: [max[0], max[1], max[2]]
        },
        cell.level + 1,
        cell.x * 2 + 1,
        cell.y * 2 + 1,
        cell.z * 2 + 1
      )
    ]
  }
  const divide = (cell, nodes) => {
    console.log(`Divide ${cell.level}-${cell.x}-${cell.y}-${cell.z}`);
    if (
      nodes
      && nodes.length > maxNodeSize
      && cell.level < maxLevel
      // && distance(cell.bbox.min, cell.bbox.max) > (maxRadius * 2)
      && getNodesVertexCount(nodes) > maxVertexCount
    ) {
      // 可以持续划分
      const childrenCells = divideCell(cell);
      const childrenNodes = [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        []
      ];

      while (nodes.length > 0) {
        let isChildCellContains = false;
        const node = nodes.pop();
        
        // node是否可以划分进下一级
        for (let i = 0; i < childrenCells.length; i++) {
          const cell = childrenCells[i];
          if (isCellContainsNode(cell, node)) {
            isChildCellContains = true;
            childrenNodes[i].push(node);
            break;
          }
        }
        // 不能划分为下一级作为当前节点Contents
        if (!isChildCellContains) {
          (cell.contents || (cell.contents = [])).push(node);
        }
      }

      if (childrenNodes.some(nodes => nodes.length > 0)) {
        childrenCells.forEach((cell, i) => {
          divide(cell, childrenNodes[i]);
        });
  
        cell.children = childrenCells;
      }
    } else if (nodes && nodes.length > 0) {
      cell.contents = nodes;
    }

    return cell;
  }

  return divide(new Cell3(bbox), getSceneDescendant(scene, true));
}

export {
  AXIS,
  noUniformQuadtree,
  quadtree,
  octree
}