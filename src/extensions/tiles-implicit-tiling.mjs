// https://github.com/CesiumGS/3d-tiles/tree/main/specification#core-implicit-tiling
// https://github.com/CesiumGS/3d-tiles/blob/main/specification/ImplicitTiling/README.adoc#implicittiling-implicit-tiling
import path from "path";
import { Cell3 } from "../Cell.mjs";
import { writeSubtrees } from "../utils.mjs";

// 该extensi 不用于GLTF-Transform 只用于处理 Tileset JSON文件
export const TILES_implicit_tiling = "3DTILES_implicit_tiling";

export const OCTREE = "OCTREE";
export const QUADTREE = "QUADTREE";

export class TilesImplicitTiling {
  static EXTENSION_NAME = TILES_implicit_tiling;
  extensionName = TILES_implicit_tiling;

  static async write(tileset, filePath, cell, subtreeLevels = 3, extension = "glb") {
    const { root } = tileset;
    const subpath = "";
    await writeSubtrees(cell, subtreeLevels, path.join(filePath, subpath))

    root.content = {
      uri: `{level}-{x}-{y}${cell instanceof Cell3 ? `-{z}` : ""}.${extension}`
    }

    root.implicitTiling = {
      subtreeLevels,
      subdivisionScheme: cell instanceof Cell3 ? OCTREE : QUADTREE,
      availableLevels: cell.getMaxLevel() + 1,
      subtrees: {
        uri: `${subpath ? `${subpath}/` : ""}{level}-{x}-{y}${cell instanceof Cell3 ? "-{z}" : ""}.subtree`
      }
    }

    delete root.children;

    return tileset;
  }
}