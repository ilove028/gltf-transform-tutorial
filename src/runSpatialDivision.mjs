import { NodeIO } from "@gltf-transform/core";
import { quadtree } from "./spatialDivision.mjs";

(async () => {
  const io = new NodeIO();
  quadtree(await io.read("./public/ship-attr.gltf"), 10000)
})()