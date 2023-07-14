import { NodeIO } from "@gltf-transform/core";
import { quadtree } from "./spatialDivision.mjs";
import { create3dtiles } from "./utils.mjs";

(async () => {
  const io = new NodeIO();
  const cell = quadtree(await io.read("./public/ship-attr.gltf"), 10000);

  console.log(
    `Level ${cell.getMaxLevel()}\n`,
    `Cell count ${cell.getCount()}\n`,
    `Cell has content count ${cell.getCount(true)}\n`,
    `VertexCount ${cell.getVertexCount()}\n`,
    `MaxVertexCount ${cell.getMaxVertexCount()}\n`,
    `MinVertexCount ${cell.getMinVertexCount()}\n`,
    // JSON.stringify(cell)
  );
  console.log(JSON.stringify(create3dtiles(cell)))
})()