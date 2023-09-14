import { NodeIO, Document, Accessor } from "@gltf-transform/core";
import { EXTMeshGPUInstancing } from "@gltf-transform/extensions";
import fse from "fs-extra";
import path from "path";
import { VertexAttributeSemantic } from "./constant.mjs";
import { EXTMeshFeatures, EXTStructuralMetadata } from "./extensions/index.mjs";

const document = new Document();
const instancingExt = document.createExtension(EXTMeshGPUInstancing).setRequired(true);
const meshFeaturesExt = document.createExtension(EXTMeshFeatures);
const metadataExt = document.createExtension(EXTStructuralMetadata);
const metadata = metadataExt.createMeatdata();
const root = document.getRoot();
root.setExtension(EXTStructuralMetadata.EXTENSION_NAME, metadata);
const scene = document.createScene();
const node = document.createNode();
const buffer = document.createBuffer();

node.setMesh(
  document.createMesh()
    .addPrimitive(
      document.createPrimitive()
        .setAttribute(
          VertexAttributeSemantic.POSITION,
          document.createAccessor()
            .setArray(new Float32Array(
              [
                0, 0, 0,
                5, 0, 0,
                5, 5, 0,
                0, 0, 0,
                5, 5, 0,
                0, 5, 0
              ]
            ))
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer)
        )
        .setAttribute(
          VertexAttributeSemantic.NORMAL,
          document.createAccessor()
            .setArray(new Float32Array(
              [
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
              ]
            ))
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer)
        )
        .setAttribute(
          `${VertexAttributeSemantic.COLOR}_0`,
          document.createAccessor()
            .setArray(new Float32Array(
              [
                1, 0, 0, 1,
                1, 0, 0, 1,
                1, 0, 0, 1,
                0, 0, 1, 1,
                0, 0, 1, 1,
                0, 0, 1, 1,
              ]
            ))
            .setType(Accessor.Type.VEC4)
            .setBuffer(buffer)
        )
        .setAttribute(
          `${VertexAttributeSemantic.FEATURE_ID}_0`,
          document.createAccessor()
            .setArray(new Uint16Array(
              [
                0,
                1
              ]
            ))
            .setType(Accessor.Type.SCALAR)
            .setBuffer(buffer)
        )
        .setExtension(EXTMeshFeatures.EXTENSION_NAME, meshFeaturesExt.createFeatures(2, 0))
    )
)
.setExtension(
  EXTMeshGPUInstancing.EXTENSION_NAME,
  instancingExt.createInstancedMesh()
    .setAttribute(
      'TRANSLATION',
      document.createAccessor()
        .setArray(new Float32Array([
          0, 0, 0,
          10, 0, 0,
          20, 0, 0,
          30, 0, 0
        ]))
        .setType(Accessor.Type.VEC3)
        .setBuffer(buffer)
    )
)

metadata.addItem({ iid: "iid-01", primitiveType: 1 });
metadata.addItem({ iid: "iid-02", primitiveType: 2 });

scene.addChild(node);
root.setDefaultScene(scene);

// await fse.ensureDir(filePath);
const filePath = "./public"
metadataExt.writeSchema(filePath);
await (new NodeIO())
  .registerExtensions([EXTMeshGPUInstancing, EXTMeshFeatures, EXTStructuralMetadata])
  .write(path.join(filePath, "test-instance.gltf"), document);