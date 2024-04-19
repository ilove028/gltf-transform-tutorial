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

export {
  extendExtras
}