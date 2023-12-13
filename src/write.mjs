import { Format } from "@gltf-transform/core";
import { BufferUtils } from "@gltf-transform/core";
import fse from "fs-extra";
import path from "path";
/**
 * @param {import("@gltf-transform/core").PlatformIO} io
 * @param {import("@gltf-transform/core").Document} doc
 * @returns {Promise<Uint8Array>}
 */
const writeBinary = async (io, doc, uri) => {
  const { json, resources } = await io.writeJSON(doc, { format: Format.GLTF });

  const header = new Uint32Array([0x46546c67, 2, 12]);

  json.buffers && json.buffers.forEach((buf) => {
    if (/\.bin$/i.test(buf.uri)) {
      delete buf.uri
    }
  });

  const jsonText = JSON.stringify(json);
  const jsonChunkData = BufferUtils.pad(BufferUtils.encodeText(jsonText), 0x20);
  const jsonChunkHeader = BufferUtils.toView(new Uint32Array([jsonChunkData.byteLength, 0x4e4f534a]));
  const jsonChunk = BufferUtils.concat([jsonChunkHeader, jsonChunkData]);
  header[header.length - 1] += jsonChunk.byteLength;
  const chunks = [jsonChunk];

  Object.entries(resources).forEach(([key, binBuffer]) => {
    if (/\.bin$/.test(key)) {
      // bin二进制
      const binChunkData = BufferUtils.pad(binBuffer, 0x00);
      const binChunkHeader = BufferUtils.toView(new Uint32Array([binChunkData.byteLength, 0x004e4942]));
      const binChunk = BufferUtils.concat([binChunkHeader, binChunkData]);
      header[header.length - 1] += binChunk.byteLength;

      chunks.push(binChunk);
    } else {
      fse.writeFileSync(path.resolve(path.parse(uri).dir, key), binBuffer);
    }
  });

  return BufferUtils.concat([BufferUtils.toView(header), ...chunks]);
}
/**
 * 
 * @param {import("@gltf-transform/core").PlatformIO} io
 * @param {import("@gltf-transform/core").Document} doc
 * @param {string} uri 
 */
const writeGLB = async (io, doc, uri) => {
  const buffer = Buffer.from(await writeBinary(io, doc, uri));
  await fse.writeFile(uri, buffer);
}
/**
 * 
 * @param {import("@gltf-transform/core").PlatformIO} io
 * @param {import("@gltf-transform/core").Document} doc
 * @param {string} uri 
 */
const write = async (io, doc, uri) => {
  const isGLB = /\.glb$/.test(uri);
  
  if (isGLB) {
    await writeGLB(io, doc, uri);
  } else {
    await io.write(uri, doc);
  }
}

export {
  write,
  writeGLB,
  writeBinary
}