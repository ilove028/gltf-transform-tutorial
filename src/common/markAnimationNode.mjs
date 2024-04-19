import { extendExtras } from './util.mjs'

const KEY = Symbol('AnimationNode')

/**
 * @param {import("@gltf-transform/core").Node} node
 */
const mark = (node) => {
  extendExtras(node, KEY, true)
}
/**
 * @param {import("@gltf-transform/core").Node | null} node
 * @returns {boolean}
 */
const isAnimationNode = (node) => {
  if (node) {
    if (node.getExtras()[KEY]) {
      return true
    } else {
      return isAnimationNode(node.getParentNode())
    }
  } else {
    return false
  }
}

/**
 * 标记直接动画节点 动画节点祖先节点有动画也算是动画节点
 * @param {import("@gltf-transform/core").Document} document 
 * @param {import("@gltf-transform/core").Node} node
 * @returns {import("@gltf-transform/core").Node}
 */
const markAnimationNode = (document, node) => {
  const animations = document.getRoot().listAnimations()

  animations.forEach((animation) => {
    animation.listChannels().forEach((channel) => {
      if (channel.getTargetNode() === node) {
        mark(node)
        return node
      }
    })
  })
}

export {
  isAnimationNode,
  markAnimationNode
}