import { NodeIO } from "@gltf-transform/core";
import { merge } from "./merge.mjs";

const run = async () => {
  const io = new NodeIO();
  const doc = await merge(await io.read("./public/ship-attr.gltf"), true);
  await io.write("./public/merge/ship-attr.gltf", doc);
}

run();
