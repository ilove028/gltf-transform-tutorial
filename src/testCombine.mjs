import { NodeIO } from '@gltf-transform/core';
import { combineTextures } from './common/combine.mjs';
import { prune, dedup } from '@gltf-transform/functions';

(async function() {
  const io = new NodeIO();
  const document = await io.read('./public/gltf/pingmian2.glb'); // → Document

  await document.transform(
    combineTextures(io, { width: 2048, height: 2048 }),
    prune(),
    dedup()
  )

  await io.write('./public/gltf/combined/pingmian2.gltf', document);
})();