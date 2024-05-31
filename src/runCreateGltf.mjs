import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';
import { mergePrimitives, clear, uniformMaterial, createTileSet } from "./common/index.mjs";
import fse from "fs-extra";
import path from "path";
import { writeFile } from "fs/promises";
import { compress, rename } from "./utils.mjs"
import { GLB_RE, GLTF_RE } from "./constant.mjs";

/**
 * 
 * @param {import("@gltf-transform/core").NodeIO} io 
 * @param {import("@gltf-transform/core").Document} document
 * @returns {Promise<import("@gltf-transform/core").Document>}
 */
const dracoMeshCompression = async (io, document) => {
  io.registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      // 'draco3d.decoder': await draco3d.createDecoderModule(), // Optional.
      'draco3d.encoder': await draco3d.createEncoderModule(), // Optional.
    });
  
  document.createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
        method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
        encodeSpeed: 5,
        decodeSpeed: 5,
    }); 
    
  return document
}

/**
 * 
 * @param {import("@gltf-transform/core").NodeIO} io 
 * @param {import("@gltf-transform/core").Document} document
 * @returns {import("@gltf-transform/core").Document}
 */
const meshoptCompression = async (io, document) => {
  io.registerExtensions([EXTMeshoptCompression])
    .registerDependencies({
      // 'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });

  await document.transform(
    reorder({encoder: MeshoptEncoder}),
  );
  document.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    // TOTO 使用filter会让动画节点显示不对
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  return document
}

/**
 * 对Gltf进行优化 合批 裁剪
 * @param {import("@gltf-transform/core").Document} document 
 * @param {import("@gltf-transform/core").NodeIO} io 
 * @param {{ output: string }} options
 * @returns {import("@gltf-transform/core").Document}
 */
const optimize = async (document, io, options = {}) => {
  // const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0]
  // const nodes = document.getRoot().listNodes()

  // nodes.forEach((node) => {
  //   markAnimationNode(document, node)
  //   uniformMaterial(document, node)
  //   collectInstancedNode(document, node)
  //   collectCanMergePrimitives(document, node)
  // })

  await document.transform(
    uniformMaterial(),
    mergePrimitives(io, (metadata) => {
      if (options.output) {
        fse.writeJSONSync(path.join(options.output, "metadata.json"), metadata)
      }
    }),
    prune()
  );

  return document
}

/**
 * 
 * @param {{
 *  input: string | Array<string>;
 *  output: string;
 *  compressType?: string;
 *  extension?: string;
 *  useGzip?: boolean;
 *  needRename?: boolean;
 * }} config 
 */
export default async function ({
  input,
  output,
  compressType = 'EXT_meshopt_compression',
  extension = 'glb',
  useGzip = true,
  needRename = true,
  toTileset = true
} = {}) {
  await clear(output)

  const io = new NodeIO()
  if (!Array.isArray(input)) {
    input = [input]
  }
  let document = await io.read(input[0])
  for (let i = 1; i < input.length; i++) {
    document = document.merge(await io.read(input[i]))
  }

  const metadaPath = toTileset ? path.join(output, 'metadata') : output
  fse.ensureDir(metadaPath)
  document = await optimize(document, io, { output: metadaPath })

  if (compressType === 'EXT_meshopt_compression') {
    document = await meshoptCompression(io, document)
  } else if (compressType === 'KHR_draco_mesh_compression') {
    document = await dracoMeshCompression(io, document)
  }
  if (toTileset) {
    const tileset = createTileSet(document, needRename ? /gltf/i.test(extension) ? GLTF_RE : GLB_RE : extension)
    await writeFile(path.join(output, "root.json"), JSON.stringify(tileset, null, 2));
  }
  if (toTileset) {
    fse.ensureDir(path.join(output, "contents"))
  } 
  await io.write(`${output}${toTileset ? `/contents/0-0-0.${extension}` : `/model.${extension}`}`, document);
  if (needRename) {
    await rename(output);
  }
  if (useGzip) {
    await compress(output)
  }
}

export {
  dracoMeshCompression,
  optimize
}