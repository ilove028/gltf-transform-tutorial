import { NodeIO } from "@gltf-transform/core";
import { merge } from "./merge.mjs";

const run = async () => {
  const io = new NodeIO();
  const doc = await merge(await io.read("./public/04010100400000000000000000000000.glb"), true);
  await io.write("./public/04010100400000000000000000000000.gltf", doc);
}

run();
