import { NodeIO } from "@gltf-transform/core";
import { prune, flatten } from "@gltf-transform/functions";
import { noUniformQuadtree, octree, quadtree } from "./spatialDivision.mjs";
import { create3dtiles, pruneMaterial, create3dtilesContent } from "./utils.mjs";
import { writeFile } from "fs/promises";
import path from "path";

const run = async (input, output, extension = "glb", useTilesImplicitTiling = false, subtreeLevels = 3) => {
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

  // const cell = noUniformQuadtree(document, 100000);
  // const cell = quadtree(document);
  const cell = octree(document);
  
  await writeFile(path.join(output, "tileset.json"), JSON.stringify(await create3dtiles(cell, extension, useTilesImplicitTiling, output, subtreeLevels), null, 2));
  console.log("Tileset done");
  await create3dtilesContent(output, document, cell, extension);

  console.log(
    `Level ${cell.getMaxLevel()}\n`,
    `Cell count ${cell.getCount()}\n`,
    `Cell has content count ${cell.getCount(true)}\n`,
    `VertexCount ${cell.getVertexCount()}\n`,
    `MaxVertexCount ${cell.getMaxVertexCount()}\n`,
    `MinVertexCount ${cell.getMinVertexCount()}\n`,
    // JSON.stringify(cell)
  );
}

// run("./public/ship-attr.gltf", "./public/3dtiles/ship/", "gltf", true, 3);
run("./public/04010100400000000000000000000000.glb", "./public/3dtiles/04010100400000000000000000000000/", "glb", true, 3);