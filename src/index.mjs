import { NodeIO, Accessor, Mesh, Document, Node } from "@gltf-transform/core";
import { joinPrimitives } from "@gltf-transform/functions";
// import { inspect } from "@gltf-transform/functions";

const io = new NodeIO();
// Read.
const document = await io.read("./public/ship.gltf"); // → Document
const root = document.getRoot();

console.log(`Nodes: ${root.listNodes().length}`);
console.log(`Meshes: ${root.listMeshes().length}`);
// console.log(inspect(document));
const primitiveMap = new Map();

root.listNodes().forEach(((node, i) => {
  console.log(node.listChildren().length);
  node.setExtras({ iid: i });
  // mesh.listPrimitives().forEach((primitive, j) => {
  //   const positionCount = primitive.getAttribute("POSITION").getCount();
  //   const material = primitive.getMaterial();
  //   let hasGroup = false;
  //   for (let [m, v] of primitiveMap.entries()) {
  //     if (m.equals(material)) {
  //       const parents = primitive.listParents()[0].listParents();

  //       // console.log(parents.map(p => p.propertyType));
  //       primitive.setMaterial(m);
  //       v.push(primitive);
  //       hasGroup = true;
  //     }
  //   }

  //   if (!hasGroup) {
  //     primitiveMap.set(material, [primitive])
  //   }
  //   console.log(primitive.getAttribute("POSITION").getMin([0, 0, 0]), primitive.getAttribute("POSITION").getMax([0, 0, 0]));
  //   primitive.setAttribute(
  //     "_FEATURE_ID_0",
  //     document.createAccessor()
  //       .setArray(new Uint16Array(Array.from({ length: positionCount }).fill(i)))
  //       .setType(Accessor.Type.SCALAR)
  //       .setBuffer(root.listBuffers()[0]))
  // })
}));

await io.write("./public/ship-attr.gltf", document);
// const newDocument = new Document();
// const newScene = newDocument.createScene();
// primitiveMap.forEach((primitives, material) => {
//   const first = primitives[0];
//   if (first) {
//     const parents = first.listParents();
//     const mesh = parents.find(p => p instanceof Mesh);

//     // mesh.listPrimitives().forEach((primitive) => {
//     //   mesh.removePrimitive(primitive);
//     // });
//     // primitives.forEach((primitive) => {
//     //   mesh.addPrimitive(primitive);
//     // });

//     const result = joinPrimitives(primitives);
//     console.log(result.getAttribute("POSITION").getCount())
//     // for (const prim of mesh.listPrimitives()) {
//     //   mesh.removePrimitive(prim);
//     //   // prim.dispose();
//     // }
    
//     // mesh.addPrimitive(result);

//     // newScene.addChild(mesh.listParents().find(p => p instanceof Node));
//   }
// })


// await io.write("./public/2701CD-2801C.gltf", document);


// const newDocument = await io.read("./public/2701CD-2801C.gltf"); // → Document
// const newroot = newDocument.getRoot();

// console.log(`New Nodes: ${newroot.listNodes().length}`);
// console.log(`New Meshes: ${newroot.listMeshes().length}`);

// await io.write("./public/2701CD-2801C-merge.gltf", newDocument);