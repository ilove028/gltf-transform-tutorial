/**
 * 判断两个材质是否相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isMaterialEqual(materialA, materialB) {
  // 通过材质
  return materialA === materialB
    || isMaterialNameEqual(materialA, materialB)
    || isMaterialFullEqual(materialA, materialB)
}
/**
 * 判断两个材质名称是否相同用于快速判断
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isMaterialNameEqual(materialA, materialB) {
  return materialA.getName() === materialB.getName()
}

/**
 * 完全比较两个材质是否完全相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isMaterialFullEqual(materialA, materialB) {
  if (materialA.getDoubleSided() !== materialB.getDoubleSided()) {
    return false
  } else if (materialA.getAlphaMode() !== materialB.getAlphaMode()) {
    return false
  } else if (materialA.getAlphaCutoff() !== materialB.getAlphaCutoff()) {
    return false
  } else if (materialA.getAlpha() !== materialB.getAlpha()) {
    return false
  } else if (!isBaseColorAndTextureEqual(materialA, materialB)) {
    return false
  } else if (!isEmissiveAndTextureEqual(materialA, materialB)) {
    return false
  } else if (!isMetallicRoughnessAndTextureEqual(materialA, materialB)) {
    return false
  } else if (!isNormalTextureEqual(materialA, materialB)) {
    return false
  } else if (!isOcclusionAndTextureEqual(materialA, materialB)) {
    return false
  }

  return true
}
/**
 * 比较两个材质base是否相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isBaseColorAndTextureEqual(materialA, materialB) {
  if (!isVecEqual(materialA.getBaseColorFactor(), materialB.getBaseColorFactor())) {
    return false
  } else if (materialA.getBaseColorTexture() === null && materialB.getBaseColorTexture() === null) {
    return true
  } else if (!isTextureInfoEqual(materialA.getBaseColorTextureInfo(), materialB.getBaseColorTextureInfo())) {
    return false
  }
}
/**
 * 判断vec是否相同
 * @param {Array<number>} vecA 
 * @param {Array<number>} vecB 
 */
function isVecEqual(vecA, vecB, error = 1 / 256) {
  if (vecA.length !== vecB.length) {
    return false
  } else {
    for (let i = 0; i < vecA.length; i++) {
      if (Math.abs(vecA[i] - vecB[i]) > error) {
        return false
      }
    }
  }

  return true
}
/**
 * 比较两个TextureInfo是否相同
 * @param {import("@gltf-transform/core").TextureInfo} textureInfoA 
 * @param {import("@gltf-transform/core").TextureInfo} textureInfoB 
 * @returns {boolean}
 */
function isTextureInfoEqual(textureInfoA, textureInfoB) {
  if (textureInfoA === textureInfoB) {
    return true
  } else if (textureInfoA.getMinFilter() !== textureInfoB.getMinFilter()) {
    return false
  } else if (textureInfoA.getMagFilter() !== textureInfoB.getMagFilter()) {
    return false
  } else if (textureInfoA.getWrapS() !== textureInfoB.getWrapS()) {
    return false
  } else if (textureInfoA.getWrapT() !== textureInfoB.getWrapT()) {
    return false
  } else if (textureInfoA.getTexCoord() !== textureInfoB.getTexCoord()) {
    return false
  }
}

export {
  isMaterialEqual
}