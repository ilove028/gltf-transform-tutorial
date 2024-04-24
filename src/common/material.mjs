import crypto from 'crypto'

/**
 * 判断两个材质是否相同
 * @param {import("@gltf-transform/core").Material | null} materialA 
 * @param {import("@gltf-transform/core").Material | null} materialB 
 * @returns {boolean}
 */
function isMaterialEqual(materialA, materialB) {
  if (materialA === materialB) {
    return true
  } else if (materialA === null || materialB === null) {
    return false
  } else if (isMaterialNameEqual(materialA, materialB)) {
    return true
  } else {
    return isMaterialFullEqual(materialA, materialB)
  }
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
  } else if (!isTextureEqual(materialA.getBaseColorTexture(), materialB.getBaseColorTexture())) {
    return false
  }
  return true
}
/**
 * 比较两个材质Emissive是否相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isEmissiveAndTextureEqual(materialA, materialB) {
  if (!isVecEqual(materialA.getEmissiveFactor(), materialB.getEmissiveFactor())) {
    return false
  } else if (materialA.getEmissiveTexture() === null && materialB.getEmissiveTexture() === null) {
    return true
  } else if (!isTextureInfoEqual(materialA.getEmissiveTextureInfo(), materialB.getEmissiveTextureInfo())) {
    return false
  } else if (!isTextureEqual(materialA.getEmissiveTexture(), materialB.getEmissiveTexture())) {
    return false
  }

  return true
}
/**
 * 比较两个材质MetallicRoughness是否相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isMetallicRoughnessAndTextureEqual(materialA, materialB) {
  if (materialA.getMetallicFactor() !== materialB.getMetallicFactor() || materialA.getRoughnessFactor() !== materialB.getRoughnessFactor()) {
    return false
  } else if (materialA.getMetallicRoughnessTexture() === null && materialB.getMetallicRoughnessTexture() === null) {
    return true
  } else if (!isTextureInfoEqual(materialA.getMetallicRoughnessTextureInfo(), materialB.getMetallicRoughnessTextureInfo())) {
    return false
  } else if (!isTextureEqual(materialA.getMetallicRoughnessTexture(), materialB.getMetallicRoughnessTexture())) {
    return false
  }

  return true
}
/**
 * 比较两个材质Normal是否相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isNormalTextureEqual(materialA, materialB) {
  if (materialA.getNormalScale() !== materialB.getNormalScale()) {
    return false
  } else if (materialA.getNormalTexture() === null && materialB.getNormalTexture() === null) {
    return true
  } else if (!isTextureInfoEqual(materialA.getNormalTextureInfo(), materialB.getNormalTextureInfo())) {
    return false
  } else if (!isTextureEqual(materialA.getNormalTexture(), materialB.getNormalTexture())) {
    return false
  }

  return true
}
/**
 * 比较两个材质Occlusion是否相同
 * @param {import("@gltf-transform/core").Material} materialA 
 * @param {import("@gltf-transform/core").Material} materialB 
 * @returns {boolean}
 */
function isOcclusionAndTextureEqual(materialA, materialB) {
  if (materialA.getOcclusionStrength() !== materialB.getOcclusionStrength()) {
    return false
  } else if (materialA.getOcclusionTexture() === null && materialB.getOcclusionTexture() === null) {
    return true
  } else if (!isTextureInfoEqual(materialA.getOcclusionTextureInfo(), materialB.getOcclusionTextureInfo())) {
    return false
  } else if (!isTextureEqual(materialA.getOcclusionTexture(), materialB.getOcclusionTexture())) {
    return false
  }

  return true
}
/**
 * 判断vec是否相同
 * @param {Array<number> | null} vecA 
 * @param {Array<number> | null} vecB 
 */
function isVecEqual(vecA, vecB, error = 1 / 256) {
  if (vecA === vecB) {
    return true
  } else if (vecA === null || vecB === null) {
    return false
  } else if (vecA.length !== vecB.length) {
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
 * @param {import("@gltf-transform/core").TextureInfo | null} textureInfoA 
 * @param {import("@gltf-transform/core").TextureInfo | null} textureInfoB 
 * @returns {boolean}
 */
function isTextureInfoEqual(textureInfoA, textureInfoB) {
  if (textureInfoA === textureInfoB) {
    return true
  } else if (textureInfoA === null || textureInfoB === null) {
    return false
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

  return true
}

/**
 * 判断两个Texture是否相同
 * @param {import("@gltf-transform/core").Texture | null} textureA 
 * @param {import("@gltf-transform/core").Texture | null} textureB 
 */
function isTextureEqual(textureA, textureB) {
  if (textureA === textureB) {
    return true
  } else if (textureA === null || textureB === null) {
    return false
  } else if (textureA.getURI() === textureB.getURI()) {
    return true
  } else if (!isVecEqual(textureA.getSize(), textureB.getSize())) {
    return false
  } else if (textureA.getMimeType() !== textureB.getMimeType()) {
    return false
  } else if (getTextureMd5(textureA) !== getTextureMd5(textureB)) {
    return false
  }

  return true
}

/**
 * 
 * @param {import("@gltf-transform/core").Texture} texture 
 * @returns {string | null}
 */
function getTextureMd5(texture) {
  const symbol = Symbol.for('TextureMd5')
  let md5 = texture.getExtras()[symbol]

  if (symbol in texture.getExtras()) {
    return texture.getExtras()[symbol]
  } else {
    const image = texture.getImage()

    if (image === null) {
      texture.getExtras()[symbol] = null
    } else {
      const hash = crypto.createHash("md5")

      hash.update(image)
      texture.getExtras()[symbol] = hash.digest('hex')
    }

    return texture.getExtras()[symbol]
  }
}
/**
 * 将相同材质修改为统一引用材质
 * @param {*} options 
 * @returns 
 */
const uniformMaterial = (options) => {
  /**
   * @param {import("@gltf-transform/core").Document} document 
   */
  return (document) => {
    const materials = []
    document.getRoot().listMeshes().forEach((mesh) => {
      mesh.listPrimitives().forEach((primitive) => {
        const mtl = primitive.getMaterial()
        const index = materials.findIndex(m => isMaterialEqual(m, mtl))

        if (index === -1) {
          materials.push(mtl)
        } else {
          primitive.setMaterial(materials[index])
        }
      })
    })
  }
}

export {
  isMaterialEqual,
  uniformMaterial
}