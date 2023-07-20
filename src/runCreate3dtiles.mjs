import { NodeIO } from "@gltf-transform/core";
import { prune, flatten } from "@gltf-transform/functions";
import { quadtree } from "./spatialDivision.mjs";
import { create3dtiles, pruneMaterial, create3dtilesContent } from "./utils.mjs";
import { writeFile } from "fs/promises";
import path from "path";

const run = async (input, output) => {
  const io = new NodeIO();
  const document = await io.read(input);
  
  await document.transform(
    pruneMaterial((existMaterial, material) => {
      const a = existMaterial.getBaseColorFactor();
      const b = material.getBaseColorFactor();
      
      return Math.abs(a[0] - b[0]) < 0.01
        && Math.abs(a[1] - b[1]) < 0.01
        && Math.abs(a[2] - b[2]) < 0.01
        && a[3] === b[3]
    }),
    flatten(),
    prune()
  );

  const cell = quadtree(document, 300000);

  console.log(
    `Level ${cell.getMaxLevel()}\n`,
    `Cell count ${cell.getCount()}\n`,
    `Cell has content count ${cell.getCount(true)}\n`,
    `VertexCount ${cell.getVertexCount()}\n`,
    `MaxVertexCount ${cell.getMaxVertexCount()}\n`,
    `MinVertexCount ${cell.getMinVertexCount()}\n`,
    // JSON.stringify(cell)
  );
  await writeFile(path.join(output, "tileset.json"), JSON.stringify(create3dtiles(cell), null, 2));

  await create3dtilesContent(output, document, cell, "glb");
}

run("./public/ship-attr.gltf", "./public/3dtiles/ship/");
// run("./public/04010100400000000000000000000000.glb", "./public/3dtiles/04010100400000000000000000000000/");