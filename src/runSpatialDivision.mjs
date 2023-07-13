import { NodeIO } from "@gltf-transform/core";
import { quadtree } from "./spatialDivision.mjs";

(async () => {
  const io = new NodeIO();
  const cell = quadtree(await io.read("./public/ship-attr.gltf"), 100000);

  console.log(cell);
})()