import { rm } from "fs/promises";
import fse from "fs-extra";
import { Document } from "@gltf-transform/core"
import { joinPrimitives } from "@gltf-transform/functions";
/**
 * 扩展extras
 * @param {import("@gltf-transform/core").Property} property 
 * @param {string | Symbol} key 
 * @param {any} value 
 */
const extendExtras = (property, key, value) => {
  let extras = property.getExtras()

  if (!extras) {
    extras = {}
  }
  extras[key] = value

  property.setExtras(extras)
}

/**
 * 递归清除指定路径文件 并保证文件夹目录存在
 * @param {string} dir 
 */
const clear = async (dir) => {
  await fse.ensureDir(dir);
  await rm(dir, { recursive: true });
  await fse.ensureDir(dir);
}

/**
 * 将node转换到世界坐标系
 * @param {import("@gltf-transform/core").Node} node 
 */
const transformNode = (node) => {
  node.setMatrix(node.getWorldMatrix())
  joinPrimitives
}
/**
 * 将可以合批的primitive按照material -> Primititve[] 分类
 * @param {import("@gltf-transform/core").Node} node 
 */
const collectCanMergePrimitives = (document) => {
  document
}

/**
 * 将在node上加入collectInstancedNode extension
 * @param {*} document 
 * @param {*} node 
 * @param {*} maxDrawCallVertexSize 
 */
const collectInstancedNode = (document, node, maxDrawCallVertexSize) => {}

/**
 * 判断连个primitive能否合批
 * @param {import("@gltf-transform/core").Primitive} primitiveA 
 * @param {import("@gltf-transform/core").Primitive} primitiveB 
 * @returns {boolean}
 */
const canMerge = (primitiveA, primitiveB) => {

}

/**
 * Creates a unique key associated with the structure and draw call characteristics of
 * a {@link Primitive}, independent of its vertex content. Helper method, used to
 * identify candidate Primitives for joining.
 * @param {import("@gltf-transform/core").Primitive} prim
 * @returns {string}
 */
function createPrimGroupKey(prim) {
	const document = Document.fromGraph(prim.getGraph());
	const material = prim.getMaterial();
	const materialIndex = document.getRoot().listMaterials().indexOf(material);
	const mode = prim.getMode();
	const indices = !!prim.getIndices();

	const attributes = prim
		.listSemantics()
		.sort()
		.map((semantic) => {
			const attribute = prim.getAttribute(semantic);
			const elementSize = attribute.getElementSize();
			const componentType = attribute.getComponentType();
			return `${semantic}:${elementSize}:${componentType}`;
		})
		.join('+');

	const targets = prim
		.listTargets()
		.map((target) => {
			return target
				.listSemantics()
				.sort()
				.map((semantic) => {
					const attribute = prim.getAttribute(semantic);
					const elementSize = attribute.getElementSize();
					const componentType = attribute.getComponentType();
					return `${semantic}:${elementSize}:${componentType}`;
				})
				.join('+');
		})
		.join('~');

	return `${materialIndex}|${mode}|${indices}|${attributes}|${targets}`;
}
/**
 * 判断一个节点是否在动画节点path 及会受到动画影响
 * @param {import("@gltf-transform/core").Node | null} node 
 * @param {Array<import("@gltf-transform/core").Node>} animationNodes 
 */
function isInAnimationPath(node, animationNodes) {
	if (node) {
		if (animationNodes.find(n => n === node)) {
			return true
		} else {
			return isInAnimationPath(node.getParentNode(), animationNodes)
		}
	} else {
		return false
	}
}

/**
 * 判断Primitive是否有Skin的相关属性
 * @param {import("@gltf-transform/core").Primitive} primitive 
 * @returns {boolean}
 */
function hasSkinAttribute(primitive) {
	return !!primitive.listSemantics().find((semantic) => /^JOINTS|^WEIGHTS/i.test(semantic))
}

export {
  clear,
  extendExtras,
  collectCanMergePrimitives,
  collectInstancedNode,
  canMerge,
  createPrimGroupKey,
	isInAnimationPath,
	hasSkinAttribute
}