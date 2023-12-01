import { EXTMeshoptCompression, KHRDracoMeshCompression } from "@gltf-transform/extensions";

const VertexAttributeSemantic = {
  /**
   * Per-vertex position.
   *
   * @type {string}
   * @constant
   */
  POSITION: "POSITION",

  /**
   * Per-vertex normal.
   *
   * @type {string}
   * @constant
   */
  NORMAL: "NORMAL",

  /**
   * Per-vertex tangent.
   *
   * @type {string}
   * @constant
   */
  TANGENT: "TANGENT",

  /**
   * Per-vertex texture coordinates.
   *
   * @type {string}
   * @constant
   */
   TEXCOORD_0: "TEXCOORD_0",

  /**
   * Per-vertex color.
   *
   * @type {string}
   * @constant
   */
  COLOR: "COLOR",

  /**
   * Per-vertex joint IDs for skinning.
   *
   * @type {string}
   * @constant
   */
  JOINTS: "JOINTS",

  /**
   * Per-vertex joint weights for skinning.
   *
   * @type {string}
   * @constant
   */
  WEIGHTS: "WEIGHTS",

  /**
   * Per-vertex feature ID.
   *
   * @type {string}
   * @constant
   */
  FEATURE_ID: "_FEATURE_ID",
};

/**
 * An enum describing the built-in instance attribute semantics.
 *
 * @enum {string}
 *
 * @private
 */
const InstanceAttributeSemantic = {
  /**
   * Per-instance translation.
   *
   * @type {string}
   * @constant
   */
  TRANSLATION: "TRANSLATION",

  /**
   * Per-instance rotation.
   *
   * @type {string}
   * @constant
   */
  ROTATION: "ROTATION",

  /**
   * Per-instance scale.
   *
   * @type {string}
   * @constant
   */
  SCALE: "SCALE",

  /**
   * Per-instance feature ID.
   *
   * @type {string}
   * @constant
   */
  FEATURE_ID: "_FEATURE_ID",
};

const CompressType = {
  EXTMeshoptCompression: EXTMeshoptCompression.EXTENSION_NAME,
  KHRDracoMeshCompression: KHRDracoMeshCompression.EXTENSION_NAME
};

const GLTF_RE = 'mtf';
const GLB_RE = 'mb';

export {
  VertexAttributeSemantic,
  InstanceAttributeSemantic,
  CompressType,
  GLB_RE,
  GLTF_RE
}