import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';
import { mergePrimitives, clear, uniformMaterial } from "./common/index.mjs";
import fse from "fs-extra";
import path from "path";

/**
 * 
 * @param {import("@gltf-transform/core").NodeIO} io 
 * @param {import("@gltf-transform/core").Document} document
 * @returns {import("@gltf-transform/core").Document}
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
    // simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.001 }),
    reorder({encoder: MeshoptEncoder}),
  );
  document.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });

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
export default async function ({ input, output, compressType = 'EXT_meshopt_compression', extension = 'glb', useGzip = true, needRename = true } = {}) {
  await clear(output)

  const io = new NodeIO()
  if (!Array.isArray(input)) {
    input = [input]
  }
  let document = await io.read(input[0])
  for (let i = 1; i < input.length; i++) {
    document = document.merge(await io.read(input[i]))
  }

  document = await optimize(document, io, { output })

  if (compressType === 'EXT_meshopt_compression') {
    document = await meshoptCompression(io, document)
  } else if (compressType === 'KHR_draco_mesh_compression') {
    document = await dracoMeshCompression(io, document)
  }

  await io.write(`${output}/model.${extension}`, document);
}