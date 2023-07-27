import { getNodesVertexCount } from "./utils.mjs"

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
}

export class Cell3 extends Cell {
  constructor(bbox, level = 0, x = 0, y = 0, z = 0, children = null, contents = null) {
    super(bbox, level, x, y, children, contents);
    this.z = z;
  }
}