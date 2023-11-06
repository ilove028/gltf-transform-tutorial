const { NodeIO } = require("@gltf-transform/core")
const { reorder, prune } = require("@gltf-transform/functions")
const { EXTMeshoptCompression } = require("@gltf-transform/extensions")
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer")
const fse = require("fs-extra");

async function run() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
  });
  const document = await io.read("./04010100400000000000000000000000.glb")
  await fse.ensureDir('./public/exe');
  // await fse.writeFile("./public/exe/log.txt", `${doc.getRoot().listNodes().length}`)
  await document.transform(
    prune(),
    reorder({encoder: MeshoptEncoder})
  );
  document.createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write('./3dtiles/04010100400000000000000000000000.glb', document);
}

run()