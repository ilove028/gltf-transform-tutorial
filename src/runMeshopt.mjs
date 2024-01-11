import { NodeIO } from "@gltf-transform/core";
import { reorder, quantize, textureCompress  } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

(async () => {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;

  const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
  });
  const document = await io.read("./public/summary.glb");

  await document.transform(
    reorder({encoder: MeshoptEncoder}),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp'
    })
  );
  document.createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write("./public/meshopt/summary.glb", document);
})()