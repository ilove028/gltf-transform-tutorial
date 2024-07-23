import { TextureInfo } from "@gltf-transform/core";
import { MaxRectsPacker, MaxRectsBin } from 'maxrects-packer';
import { KHRTextureTransform } from '@gltf-transform/extensions';
import sharp from "sharp";

/**
 * @param {import("@gltf-transform/core").Document} document 
 * @param {import("@gltf-transform/core").Material[]} materials 
 */
async function combine(document, materials, type, transformExtension, options = { width: 1024, height: 1024 }) {
  const textureName = `get${type}`;
  const textureInfoName = `${textureName}Info`;
  const needCombinedMaterials = [];

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    /**
     * @type {import("@gltf-transform/core").Texture}
     */
    const texture = material[textureName]();
    /**
     * @type {import("@gltf-transform/core").TextureInfo}
     */
    const textureInfo = material[textureInfoName]();

    if (texture && textureInfo.getWrapS() === TextureInfo.WrapMode.REPEAT && textureInfo.getWrapS() === TextureInfo.WrapMode.REPEAT) {
      const size = texture.getSize();

      if (size) {
        const [width, height] = size;

        if (width <= options.width && height <= options.height) {
          needCombinedMaterials.push({
            width,
            height,
            material,
            texture,
            textureInfo,
            type
          })
        }
      }
    }
  }

  const packer = new MaxRectsPacker(options.width, options.height);
  packer.addArray(needCombinedMaterials);

  for (let bin of packer.bins) {
    if (bin instanceof MaxRectsBin && bin.rects.length > 1) {
      const images = [];
      for (let rect of bin.rects) {
        images.push({
          top: rect.y,
          left: rect.x,
          input: rect.texture.getImage()
        });
      }
      // const imagePath = `${Math.random().toString(16).slice(2)}.webp`;
      const buffer = await sharp({
        create: {
          width: bin.width,
          height: bin.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .composite(images)
      .webp()
      .toBuffer();

      const texture = document.createTexture()
        .setImage(buffer)
        .setMimeType('image/webp')
      for (let rect of bin.rects) {
        const { material, textureInfo, type, width, height, x, y } = rect;

        // texture.setURI(imagePath);
        textureInfo.setExtension(
          KHRTextureTransform.EXTENSION_NAME,
          transformExtension.createTransform()
            .setScale([width / bin.width, height / bin.height])
            .setOffset([x / bin.width, y / bin.height])
        );

        material[`set${type}`](texture)
      }
    }
  }
}
/**
 * 合并gltf贴图 没有导入 index因为sharp打包不支持
 * @param {import("@gltf-transform/core").NodeIO} io 
 * @param {{ width: number; height: number }} options 
 * @returns 
 */
function combineTextures(io, options = { width: 1024, height: 1024 }) {
  /**
   * @param {import("@gltf-transform/core").Document} document 
   */
  return async (document) => {
    const materials = document.getRoot().listMaterials();
    const transformExtension = document.createExtension(KHRTextureTransform).setRequired(true);

    io.registerExtensions([KHRTextureTransform])
    await combine(document, materials, 'BaseColorTexture', transformExtension, options);
    await combine(document, materials, 'NormalTexture', transformExtension, options)
    await combine(document, materials, 'MetallicRoughnessTexture', transformExtension, options)
    await combine(document, materials, 'EmissiveTexture', transformExtension, options)
    await combine(document, materials, 'OcclusionTexture', transformExtension, options)
  }
}

export {
  combineTextures
}