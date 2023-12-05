import glMatrix from "gl-matrix";
import { PropertyType } from "@gltf-transform/core";
import { EXTMeshGPUInstancing } from "@gltf-transform/extensions";
import { InstanceAttributeSemantic } from "./constant.mjs";

const { vec3: { transformMat4 }, mat4: { fromRotationTranslationScale, create, multiply } } = glMatrix;

/**
 * Computes bounding box (AABB) in world space for the given {@link Node} or {@link Scene}.
 *
 * Example:
 *
 * ```ts
 * const {min, max} = getBounds(scene);
 * ```
 */
/**
 * @typedef {import("@gltf-transform/core").Node} Node
 * @typedef {import("@gltf-transform/core").Scene} Scene
 * @param {Node|Scene} node 
 * @returns 
 */
export function getBounds(node) {
	const resultBounds = createBounds();
	const parents = node.propertyType === PropertyType.NODE ? [node] : node.listChildren();

	for (const parent of parents) {
		parent.traverse((node) => {
			const mesh = node.getMesh();
			if (!mesh) return;

			const worldMatrix = node.getWorldMatrix();
			const	ext = node.getExtension(EXTMeshGPUInstancing.EXTENSION_NAME);
			// Compute mesh bounds and update result.
			if (ext) {
				/**
				 * @type {import("@gltf-transform/core").Accessor}
				 */
				const translationAccessor = ext.getAttribute(InstanceAttributeSemantic.TRANSLATION);
				const translationCount = translationAccessor ? translationAccessor.getCount() : 0;
				/**
				 * @type {import("@gltf-transform/core").Accessor}
				 */
				const rotationAccessor = ext.getAttribute(InstanceAttributeSemantic.ROTATION);
				const rotationCount = rotationAccessor ? rotationAccessor.getCount() : 0;
				/**
				 * @type {import("@gltf-transform/core").Accessor}
				 */
				const scaleAccessor = ext.getAttribute(InstanceAttributeSemantic.SCALE);
				const scaleCount = scaleAccessor ? scaleAccessor.getCount() : 0;

				const count = Math.max(translationCount, rotationCount, scaleCount);

				for (let i = 0; i < count; i++) {
					const translation = translationAccessor ? translationAccessor.getElement(i, []) : [0, 0, 0];
					const rotation = rotationAccessor ? rotationAccessor.getElement(i, []) : [0, 0, 0, 1];
					const scale = scaleAccessor ? scaleAccessor.getElement(i, []) : [1, 1, 1];
					const insMat = fromRotationTranslationScale(create(), rotation, translation, scale);
					const meshBounds = getMeshBounds(mesh, multiply(create(), worldMatrix, insMat));
					expandBounds(meshBounds.min, resultBounds);
					expandBounds(meshBounds.max, resultBounds);
				}
			} else {
				const meshBounds = getMeshBounds(mesh, worldMatrix);
				expandBounds(meshBounds.min, resultBounds);
				expandBounds(meshBounds.max, resultBounds);
			}
		});
	}

	return resultBounds;
}

/**
 * @deprecated Renamed to {@link getBounds}.
 * @hidden
 */
export const bounds = getBounds;

/** Computes mesh bounds in local space. */
function getMeshBounds(mesh, worldMatrix) {
	const meshBounds = createBounds();

	// We can't transform a local AABB into world space and still have a tight AABB in world space,
	// so we need to compute the world AABB vertex by vertex here.
	for (const prim of mesh.listPrimitives()) {
		const position = prim.getAttribute('POSITION');
		if (!position) continue;

		let localPos = [0, 0, 0];
		let worldPos = [0, 0, 0];
		for (let i = 0; i < position.getCount(); i++) {
			localPos = position.getElement(i, localPos);
			worldPos = transformMat4(worldPos, localPos, worldMatrix);
			expandBounds(worldPos, meshBounds);
		}
	}

	return meshBounds;
}

/** Expands bounds of target by given source. */
function expandBounds(point, target) {
	for (let i = 0; i < 3; i++) {
		target.min[i] = Math.min(point[i], target.min[i]);
		target.max[i] = Math.max(point[i], target.max[i]);
	}
}

/** Creates new bounds with min=Infinity, max=-Infinity. */
function createBounds() {
	return {
		min: [Infinity, Infinity, Infinity],
		max: [-Infinity, -Infinity, -Infinity],
	};
}
