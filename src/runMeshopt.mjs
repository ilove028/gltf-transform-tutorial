import { NodeIO } from "@gltf-transform/core";
import { reorder, quantize } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

(async () => {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;

  const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
  });
  const document = await io.read("./public/ship-attr.gltf");

  await document.transform(
    reorder({encoder: MeshoptEncoder}),
    quantize({
      pattern: /^(POSITION|NORMAL)(_\d+)?$/
    })
  );
  document.createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write("./public/meshopt/ship-attr.glb", document);
})()