import { getNodesVertexCount, tileCoordinate2MortonIndex } from "./utils.mjs"

export default class Cell {
  constructor(bbox, level = 0, x = 0, y = 0, children = null, contents = null) {
    this.level = level;
    this.x = x;
    this.y = y;
    this.bbox = bbox;
    this.children = children;
    this.contents = contents;
  }

  getMaxLevel() {
    return this.children
      ? Math.max(...this.children.map(c => c.getMaxLevel()))
      : this.level;
  }

  getCount(hasContent = false) {
    return (this.children || [])
      .reduce((pre, c) => {
        pre += c.getCount(hasContent);

        return pre;
      }, hasContent ? (this.contents ? 1 : 0) : 1)
  }

  /**
   * 得到该节点下最大的顶点数
   */
  getMaxVertexCount() {
    return this.children
      ? Math.max(...this.children.map(c => c.getMaxVertexCount()))
      : this.contents 
        ? getNodesVertexCount(this.contents)
        : 0
  }

  /**
   * 得到该节点下最大的顶点数
   */
  getMinVertexCount() {
    return this.children
      ? Math.min(...this.children.map(c => c.getMaxVertexCount()))
      : this.contents 
        ? getNodesVertexCount(this.contents)
        : 0
  }

  /**
   * 得到该Cell下(包含该Cell)全部的顶点数
   * @returns 
   */
  getVertexCount() {
    return (this.children || [])
      .reduce((pre, c) => {
        pre += c.getVertexCount();

        return pre;
      }, this.contents ? getNodesVertexCount(this.contents) : 0)
  }

  /**
   * 内容可用性用于 implicit tiling 写subtree
   * @returns 
   */
  getContentAvailability() {
    return !!(this.contents && this.contents.length > 0);
  }

  /**
   * Tile 可用性
   * @returns 
   */
  getTileAvailability() {
    return !!(this.getContentAvailability() || this.children)
    // return !!(this.getContentAvailability()
    //   || this.children && this.children.some(c => c.getTileAvailability()))
  }

  /**
   * 取得该节点下 subtreeLevels 层子树可用性, 子树内容 和孩子子树可用性
   * @param {number} subtreeLevels 
   */
  getSubtreeAvailability(subtreeLevels) {
    const subtreeRoot = this;
    const n = this instanceof Cell3 ? 8 : 4;
    const tileAvailability = new Array((Math.pow(n, subtreeLevels) - 1) / (n -1)).fill(false);
    const contentAvailability = new Array((Math.pow(n, subtreeLevels) - 1) / (n -1)).fill(false);
    const childSubtreeAvailability = new Array(Math.pow(n, subtreeLevels)).fill(false);
    const subtreeRoots = [];
    const run = (cell) => {
      if (Array.isArray(cell)) {
        cell.forEach(c => run(c))
      } else if (cell) {
        if (cell.getLocalLevel(subtreeRoot) < subtreeLevels) {
          const localMortonIndex = cell.getLocalMortonIndex(subtreeRoot);
          const levelOffset = (Math.pow(n, cell.getLocalLevel(subtreeRoot)) - 1) / (n - 1);

          tileAvailability[levelOffset + localMortonIndex] = cell.getTileAvailability();
          contentAvailability[levelOffset + localMortonIndex] = cell.getContentAvailability();

          cell.children && run(cell.children);
        } else if (cell.getLocalLevel(subtreeRoot) === subtreeLevels) {
          const localMortonIndex = cell.getLocalMortonIndex(subtreeRoot);

          childSubtreeAvailability[localMortonIndex] = cell.getTileAvailability();
          subtreeRoots.push(cell);
        }
      }
    }

    run(this);

    return {
      tileAvailability,
      contentAvailability,
      childSubtreeAvailability,
      subtreeRoots
    };
  }

  /**
   * 得到全局莫顿编码
   * @returns 
   */
  getGlobalMortonIndex() {
    return tileCoordinate2MortonIndex([this.x, this.y], this.level + 1)
  }

  /**
   * 得到局部莫顿编码
   */
  getLocalMortonIndex(relativeCell) {
    return this.getGlobalMortonIndex() - relativeCell.getGlobalMortonIndex() * Math.pow(2, (this.level - relativeCell.level) * 2);
    // const local tileCoordinate2MortonIndex([this.x, this.y], this.level + 1, false).substring(tileCoordinate2MortonIndex([relativeCell.x, relativeCell.y], relativeCell.level + 1, false).length)

  }

  getLocalLevel(relativeCell) {
    return this.level - relativeCell.level;
  }

  getLocalLevelX(relativeCell) {
    return this.x - relativeCell.x;
  }

  getLocalLevelY(relativeCell) {
    return this.y - relativeCell.y;
  }
}

export class Cell3 extends Cell {
  constructor(bbox, level = 0, x = 0, y = 0, z = 0, children = null, contents = null) {
    super(bbox, level, x, y, children, contents);
    this.z = z;
  }

  /**
   * 得到局部莫顿编码
   */
  getLocalMortonIndex(relativeCell) {
    return this.getGlobalMortonIndex() - relativeCell.getGlobalMortonIndex() * Math.pow(2, (this.level - relativeCell.level) * 3);
    // const local tileCoordinate2MortonIndex([this.x, this.y], this.level + 1, false).substring(tileCoordinate2MortonIndex([relativeCell.x, relativeCell.y], relativeCell.level + 1, false).length)

  }

  getGlobalMortonIndex() {
    return tileCoordinate2MortonIndex([this.x, this.y, this.z], this.level + 1)
  }

  getLocalLevelZ(relativeCell) {
    return this.z - relativeCell.z;
  }
}