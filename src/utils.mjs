import path from "path";
import { writeFile } from "fs/promises";
import fse from "fs-extra";
import { NodeIO, Document, Accessor, Material, getBounds, TextureInfo } from "@gltf-transform/core";
import { createTransform, prune, reorder, quantize, transformPrimitive, joinPrimitives, simplify, compressTexture } from "@gltf-transform/functions";
import { EXTMeshoptCompression, KHRDracoMeshCompression, KHRTextureTransform } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { VertexAttributeSemantic, CompressType } from "./constant.mjs";
import { EXTMeshFeatures, EXTStructuralMetadata, TilesImplicitTiling } from "./extensions/index.mjs";
import { Cell3 } from "./Cell.mjs";
import sharp from 'sharp';
import md5 from 'blueimp-md5'

const getNodeVertexCount = (node) => {
  const mesh = node.getMesh();
  
  if (mesh) {
    return mesh.listPrimitives().reduce((pre, cur) => {
      pre += cur.getAttribute(VertexAttributeSemantic.POSITION).getCount();

      return pre;
    }, 0)
  } else {
    return 0;
  }
}

const getNodesVertexCount = (nodes) => {
  return nodes.reduce((count, node) => {
    count += getNodeVertexCount(node);

    return count;
  }, 0)
}

const getBboxSphere = (bbox) => {
  const { min, max } = bbox;
  const center = middle(min, max);
  return [
    ...center,
    distance(center, max)
  ]
}

const getBboxBox = (bbox) => {
  const { min, max } = bbox;
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];

  const cx = min[0] + dx * 0.5;
  const cy = min[1] + dy * 0.5;
  const cz = min[2] + dz * 0.5;

  const hxx = dx * 0.5;
  const hxy = 0.0;
  const hxz = 0.0;

  const hyx = 0.0;
  const hyy = dy * 0.5;
  const hyz = 0.0;

  const hzx = 0.0;
  const hzy = 0.0;
  const hzz = dz * 0.5;

  return [
    cx, cy, cz, 
    hxx, hxy, hxz, 
    hyx, hyy, hyz, 
    hzx, hzy, hzz
  ];
}

/**
 * 计算两点中点
 * @param {*} a 
 * @param {*} b 
 * @returns 
 */
const middle = (a, b) => {
  return [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2
  ]
}

/**
 * 计算两点之间距离
 * @param {*} a 
 * @param {*} b 
 * @returns 
 */
const distance = (a, b) => Math.sqrt(
  (a[0] - b[0]) * (a[0] - b[0])
  + (a[1] - b[1]) * (a[1] - b[1])
  + (a[2] - b[2]) * (a[2] - b[2])
)

const getNodesMaxBound = (nodes) => {
  let bbox = nodes && nodes.length > 0 ? getBounds(nodes[0]) : null;
  let size = distance(bbox.min, bbox.max);

  for (let i = 0; nodes && i < nodes.length; i++) {
    const { min, max } = getBounds(nodes[i]);
    const curSize = distance(min, max);

    if (curSize > size) {
      size = curSize;
      bbox = { min, max };
    }
  }

  return bbox;
}

const getNodesBounds = (nodes) => nodes.map(n => getBounds(n))

const getNodesBound = (nodes) => {
  let bbox = nodes && nodes.length > 0 ? getBounds(nodes[0]) : null;

  for (let i = 1; nodes && i < nodes.length; i++) {
    const { min, max } = getBounds(nodes[i]);

    if (min[0] < bbox.min[0]) {
      bbox.min[0] = min[0];
    }

    if (min[1] < bbox.min[1]) {
      bbox.min[1] = min[1];
    }

    if (min[2] < bbox.min[2]) {
      bbox.min[2] = min[2];
    }

    if (max[0] > bbox.max[0]) {
      bbox.max[0] = max[0];
    }

    if (max[1] > bbox.max[1]) {
      bbox.max[1] = max[1];
    }

    if (max[2] > bbox.max[2]) {
      bbox.max[2] = max[2];
    }
  }

  return bbox;
}

const getGeometricError = (bbox) => {
  return distance(bbox.min, bbox.max);
}

const getGeometricError2 = (bbox) => {
  // 因为getGeometricError使用包围球直径 无法很好表示长度很长的线性物体 其投影面积实际上很小
  // 采用算3个视图面积 根据面积求取直径
  const { min, max } = bbox;
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];
  const areaXY = dx * dy;
  const areaYZ = dy * dz;
  const areaZX = dz * dx;
  const area = areaXY > areaYZ
    ? areaXY > areaZX
      ? areaXY : areaZX
    : areaYZ > areaZX
      ? areaYZ : areaZX

  return Math.sqrt(area / Math.PI) * 2
}

const getBboxsMaxGeometricError2 = (bboxs) => {
  if (!Array.isArray(bboxs)) {
    bboxs = [bboxs];
  }
  let error = getGeometricError2(bboxs[0]);

  for (let i = 1; i < bboxs.length; i++) {
    const curErr = getGeometricError2(bboxs[i]);

    if (curErr > error) {
      error = curErr;
    }
  }

  return error;
}

const create3dtiles = async (cell, extension, useTilesImplicitTiling, path, subtreeLevels, useLod) => {
  const tileset = {
    asset: {
      version: "1.1"
    },
    geometricError: getBboxsMaxGeometricError2(cell.bbox) * (useLod ? 1 : 1),
    root: null
  }

  const run = (cell) => {
    let children = cell.children
      ? cell.children.map(c => run(c))
      : null;
    const contentBbox = getNodesBound(cell.contents);
    const result = {
      refine: useLod ? "REPLACE" : "ADD",
      // TODO 这里 隐式还没在subtree写入 contentVolume 所以在隐式模式下 直接用 tile Volume
      // geometricError: useTilesImplicitTiling
      //   ? getBboxsMaxGeometricError2(cell.bbox)
      //   : getBboxsMaxGeometricError2(
      //       cell.contents && cell.contents.length > 0
      //         ? getNodesBounds(cell.contents)
      //         : cell.bbox
      //     ) * (useLod ? 1 : 1),
      geometricError: getBboxsMaxGeometricError2(cell.bbox),
      boundingVolume: {
        // sphere: getTileSphere(cell)
        box: getBboxBox(cell.bbox)
      }
    }

    if (cell.contents) {
      if (useLod) {
        const contentChild = {
          refine: "REPLACE",
          geometricError: getBboxsMaxGeometricError2(getNodesBounds(cell.contents)),
          boundingVolume: {
            // sphere: getTileSphere(cell)
            box: getBboxBox(cell.bbox)
          },
          content: {
            boundingVolume: {
              box: getBboxBox(contentBbox)
            },
            uri: `contents/${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-low.${extension}`
          },
          children: [{
            refine: "REPLACE",
            geometricError: 0,
            boundingVolume: {
              // sphere: getTileSphere(cell)
              box: getBboxBox(cell.bbox)
            },
            content: {
              boundingVolume: {
                box: getBboxBox(contentBbox)
              },
              uri: `contents/${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-high.${extension}`
            }
          }]
        }
        if (!children) {
          children = [contentChild];
        } else {
          children.unshift(contentChild)
        }
      } else {
        result.content = {
          uri: `contents/${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}.${extension}`
        }
        result.geometricError = getBboxsMaxGeometricError2(getNodesBounds(cell.contents));
        if (contentBbox && !useTilesImplicitTiling) {
          result.content.boundingVolume = {
            box: getBboxBox(contentBbox)
          }
        }
      }
    }

    if (children) {
      result.children = children;
    }

    return result;
  }

  tileset.root = run(cell);

  return useTilesImplicitTiling
    ? await TilesImplicitTiling.write(tileset, path, cell, subtreeLevels, extension)
    : tileset;
}

const pruneMaterial = (compareFn) => {
  const materials = [];
  return createTransform("pruneMaterial", async (document) => {
    document.getRoot().listMeshes().forEach((mesh) => {
      mesh.listPrimitives().forEach((primitive) => {
        const material = primitive.getMaterial();
        const likeMaterial = materials.find(m => compareFn(m, material));
        if (likeMaterial) {
          if (likeMaterial !== material) {
            primitive.setMaterial(likeMaterial);
          }
        } else {
          materials.push(material)
        }
      });
    });
  })
}

const create3dtilesContent = async (filePath, document, cell, extension = "glb", useLod, compressType = CompressType.EXTMeshoptCompression) => {
  const io = new NodeIO()
  .registerExtensions([EXTMeshFeatures, EXTStructuralMetadata, KHRTextureTransform]);

  if (compressType === CompressType.EXTMeshoptCompression) {
    io.registerExtensions([EXTMeshoptCompression])
      .registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
        'meshopt.encoder': MeshoptEncoder,
      });
  } else if (compressType === CompressType.KHRDracoMeshCompression) {
    io.registerExtensions([KHRDracoMeshCompression])
      .registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(), // Optional.
        'draco3d.encoder': await draco3d.createEncoderModule(), // Optional.
      });
  }
  const createDocument =async (nodes) => {
    const materialMap = new Map();
    if (nodes) {
      const newDocument = new Document();
      const buffer = newDocument.createBuffer();
      const scene = newDocument.createScene()
      const meshFeatures = newDocument.createExtension(EXTMeshFeatures);
      const metadataExt = newDocument.createExtension(EXTStructuralMetadata);
      const metadata = metadataExt.createMeatdata();

      newDocument.getRoot().setExtension(EXTStructuralMetadata.EXTENSION_NAME, metadata);
      for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        const node = nodes[nodeIndex];
        const primitives = node.getMesh().listPrimitives();
        const extras = node.getExtras();
        // 第一步导出会保证有IID没有IID也会随机生成一个 16位字符长度的站场IID，再用-拼接一个随机字符串
        metadata.addItem({ iid: extras && extras.iid ? extras.iid : `iid-${guid()}`, primitiveType: extras && typeof extras.primitiveType === "number" ? extras.primitiveType : 4 });
        if (extras && extras.iid) {
          // 获取node bound必须在transformPrimitive之前 因为转化后primitive 坐标会变换
          const pt = path.join(filePath, "metadata");
          fse.ensureDir(pt)
          fse.writeJSONSync(path.join(pt, `${extras.iid}.json`), { box: getBboxBox(getBounds(node)) })
        }
        for (let j = 0; j < primitives.length; j++) {
          const primitive = primitives[j];
          transformPrimitive(primitive, node.getWorldMatrix());
          const newPrimitive = newDocument.createPrimitive();
          const oldMaterial = primitive.getMaterial();
          const indeiceAccessor = primitive.getIndices();

          indeiceAccessor && newPrimitive.setIndices(
            newDocument.createAccessor()
              .setArray(indeiceAccessor.getArray())
              .setType(indeiceAccessor.getType())
          )

          primitive.listSemantics().forEach((semantic) => {
            if (semantic === VertexAttributeSemantic.POSITION || semantic === VertexAttributeSemantic.NORMAL || semantic === VertexAttributeSemantic.TEXCOORD_0) {
              const oldAccessor = primitive.getAttribute(semantic);

              newPrimitive.setAttribute(
                semantic,
                newDocument.createAccessor()
                  .setArray(oldAccessor.getArray())
                  .setType(oldAccessor.getType())
                  .setBuffer(buffer)
                  .setNormalized(semantic === VertexAttributeSemantic.NORMAL)
              )
            } else {
              console.error(`${semantic} attribute not handle.`)
            }
          })

          const count = newPrimitive.getAttribute(VertexAttributeSemantic.POSITION).getCount();
          newPrimitive.setAttribute(
            `${VertexAttributeSemantic.FEATURE_ID}_0`,
            newDocument.createAccessor()
              .setArray(
                // https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features 大小限制
                nodes.length < Math.pow(2, 16)
                ? new Uint16Array(Array(count).fill(nodeIndex))
                : new Float32Array(Array(count).fill(nodeIndex))
              )
              .setType(Accessor.Type.SCALAR)
              .setBuffer(buffer)
          );

          let existMaterial;
          let existMesh;
          materialMap.forEach((mesh, m) => {
            if (!existMaterial && isMaterialLike(m, oldMaterial)) {
              existMaterial = m;
              existMesh = mesh;
            }
          });

          if (!existMesh) {
            const oldTexture = oldMaterial.getBaseColorTexture();
            if(oldTexture){
              const image = oldTexture.getImage();
              const md5Value = md5(image);
              const md5Url = md5Value+'.webp';
              const texture = newDocument.createTexture(oldTexture.getName())
              .setImage(image)
              .setURI(md5Url)

              existMaterial = newDocument.createMaterial(oldMaterial.getName())
                .setBaseColorFactor(oldMaterial.getBaseColorFactor())
                .setBaseColorTexture(texture)
                .setRoughnessFactor(0.02)
                .setMetallicFactor(0.4)
                .setDoubleSided(oldMaterial.getDoubleSided())
                .setAlphaMode(oldMaterial.getAlphaMode());

              await compressTexture(texture, {
                encoder: sharp,
                targetFormat: 'webp'
              });

              const textureInfo = existMaterial.getBaseColorTextureInfo(); // 未生效
              textureInfo.setMagFilter(TextureInfo.MagFilter.LINEAR)
              textureInfo.setMinFilter(TextureInfo.MinFilter.LINEAR)

              //贴图重复值不为1时
              const scale = oldMaterial.getBaseColorTextureInfo().getExtension('KHR_texture_transform');
              if (scale) {
                const transformExtension = newDocument.createExtension(KHRTextureTransform)
                  .setRequired(true);
                const transform = transformExtension.createTransform()
                  .setScale(scale.getScale());
                textureInfo.setExtension('KHR_texture_transform', transform);
              }
            }else{
              existMaterial = newDocument
                .createMaterial(oldMaterial.getName())
                .setBaseColorFactor(oldMaterial.getBaseColorFactor())
                .setRoughnessFactor(0.02)
                .setMetallicFactor(0.4)
                .setAlphaMode(oldMaterial.getAlpha() < 1 ? Material.AlphaMode.BLEND : Material.AlphaMode.OPAQUE)
                // 从自定义公司模型来的模型材质没有双面渲染这个属性，只能写死，
                // 从标准gltf有这个属性直接使用 后期还可以做backfface cull
                .setDoubleSided(oldMaterial.getDoubleSided());
            }
            existMesh = newDocument.createMesh();
            materialMap.set(existMaterial, existMesh);
          }
          newPrimitive.setMaterial(existMaterial);
          existMesh.addPrimitive(newPrimitive);
        }
      };

      materialMap.forEach((mesh) => {
        let primitives = mesh.listPrimitives();
        const mergedPrimitive = joinPrimitives(primitives);

        mergedPrimitive.setExtension(EXTMeshFeatures.EXTENSION_NAME, meshFeatures.createFeatures(primitives.length, 0));
        primitives.forEach(p => p.dispose());
        mesh.addPrimitive(mergedPrimitive);
        scene.addChild(
          newDocument.createNode()
            // .setExtras(node.getExtras())
            // .setMatrix(node.getMatrix())
            .setMesh(mesh)
        )
      });

      metadataExt.writeSchema(filePath);
      return newDocument;
    }
  }

  const write = async (filePath, document, cell) => {
    const doc = await createDocument(cell.contents);

    if (doc) {
      let lowDoc;
      const basePath = path.join(filePath, "contents");
      await fse.ensureDir(basePath);
      await doc.transform(
        pruneMaterial(isMaterialLike),
        prune(),
        reorder({encoder: MeshoptEncoder}),
        // quantize({
        //   pattern: /^(POSITION)(_\d+)?$/ // TODO quantize 有损压缩 POSITION会造成包围球和模型渲染暂时没有问题 GLTF模型展示不匹配 NORMAL会造成渲染不对
        // })
      );
      
      if (compressType === CompressType.EXTMeshoptCompression) {
        doc.createExtension(EXTMeshoptCompression)
          .setRequired(true)
          .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
      } else if (compressType === CompressType.KHRDracoMeshCompression) {
        // Draco虽然压缩相对高些 但 https://zhuanlan.zhihu.com/p/360235743 还有Meshopt Gzip 还有接近一般压缩
        doc.createExtension(KHRDracoMeshCompression)
          .setRequired(true)
          .setEncoderOptions({
              method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
              quantizationBits: {
                NORMAL: 21 // normal quantizationBit 太小例如 10 会造成normal精度丢失太严重 展示不出normal效果
              }
          });
      }
      
      await io.write(path.join(basePath, `${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}${useLod ? "-high" : ""}.${extension}`), doc);
    
      if (useLod) {
        // lowDoc = doc.clone();
        lowDoc = doc;
        console.log("Before simplify", getNodesVertexCount(lowDoc.getRoot().listNodes()));
        try {
          // 解决有时候meshopt压缩会报错问题
          await lowDoc.transform(
            pruneMaterial(isMaterialLike),
            prune(),
            // TODO 修改参数有时MeshoptEncoder会报错
            simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.1 }),
            reorder({encoder: MeshoptEncoder}),
            // quantize({
            //   pattern: /^(POSITION)(_\d+)?$/ // TODO quantize 有损压缩 POSITION会造成包围球和模型渲染暂时没有问题 GLTF模型展示不匹配 NORMAL会造成渲染不对
            // })
          );
          console.log("After simplify", getNodesVertexCount(lowDoc.getRoot().listNodes()));
          // lowDoc.createExtension(EXTMeshoptCompression)
          //   .setRequired(true)
          //   .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
          
          await io.write(path.join(basePath, `${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-low.${extension}`), lowDoc);
        } catch (err) {
          console.error(`${cell.level}-${cell.x}-${cell.y}${cell instanceof Cell3 ? `-${cell.z}` : ""}-low.${extension} compress failed`);
        }
      }
    }
    for (let i = 0; cell.children && i < cell.children.length; i++) {
      await write(filePath, document, cell.children[i]);
    }
  }

  await write(filePath, document, cell);
}

const isMaterialLike = (aMaterial, bMaterial) => {
  return aMaterial.getName() === bMaterial.getName()
  // const aTexture = aMaterial.getBaseColorTexture();
  // const bTexture = bMaterial.getBaseColorTexture();
  // if(!!aTexture || !!bTexture){
  //   if(!!aTexture && !!bTexture&& aTexture.getImage().toString() === bTexture.getImage().toString()){
  //     return true
  //   }else{
  //     return false
  //   }
  // }

  const a = aMaterial.getBaseColorFactor();
  const b = bMaterial.getBaseColorFactor();
  
  return Math.abs(a[0] - b[0]) < 0.01
    && Math.abs(a[1] - b[1]) < 0.01
    && Math.abs(a[2] - b[2]) < 0.01
    && a[3] === b[3]
}

const isBboxContain = (containerBBox, bbox) => {
  return containerBBox.min[0] <= bbox.min[0]
    && containerBBox.min[1] <= bbox.min[1]
    && containerBBox.min[2] <= bbox.min[2]
    && containerBBox.max[0] >= bbox.max[0]
    && containerBBox.max[1] >= bbox.max[1]
    && containerBBox.max[2] >= bbox.max[2]
}

const distanceSquared = (point1, point2) => (point2[0] - point1[0]) * (point2[0] - point1[0])
  + (point2[1] - point1[1]) * (point2[1] - point1[1])
  + (point2[2] - point1[2]) * (point2[2] - point1[2])

const createSubtreeBinary = ({ tileAvailability, contentAvailability, childSubtreeAvailability }) => {
  const magic = Buffer.from("subt");
  const version = Buffer.from(new Uint32Array([1]).buffer);
  const tileAvailabilityBuffer = tileAvailability.some(v => v)
    ? tileAvailability.some(v => !v)
      ? boolArray2Bin(tileAvailability)
      : 1
    : 0;
  const contentAvailabilityBuffer = contentAvailability.some(v => v)
    ? contentAvailability.some(v => !v)
      ? boolArray2Bin(contentAvailability)
      : 1
    : 0;
  const childSubtreeAvailabilityBuffer = childSubtreeAvailability.some(v => v)
    ? childSubtreeAvailability.some(v => !v)
      ? boolArray2Bin(childSubtreeAvailability)
      : 1
    : 0;
  const buffer = Buffer.concat([tileAvailabilityBuffer, contentAvailabilityBuffer, childSubtreeAvailabilityBuffer].filter(v => v instanceof Buffer));
  const tileAvailabilityBufferView = tileAvailabilityBuffer instanceof Buffer ? { buffer: 0, byteOffset: 0, byteLength: Math.ceil(tileAvailability.length / 8) } : null;
  const contentAvailabilityBufferView = contentAvailabilityBuffer instanceof Buffer
    ? {
        buffer: 0,
        byteOffset: getBuffersByteLength(tileAvailabilityBuffer),
        byteLength: Math.ceil(contentAvailability.length / 8)
      }
    : null;

  const childSubtreeAvailabilityBufferView = childSubtreeAvailabilityBuffer instanceof Buffer
    ? {
        buffer: 0,
        byteOffset: getBuffersByteLength(tileAvailabilityBuffer, contentAvailabilityBuffer),
        byteLength: Math.ceil(childSubtreeAvailability.length / 8)
      }
    : null;
  const jsonObj = {
    buffers: [{ name: "Availability Buffer", byteLength: buffer.byteLength }],
    bufferViews: [tileAvailabilityBufferView, contentAvailabilityBufferView, childSubtreeAvailabilityBufferView].filter(v => v),
    tileAvailability: tileAvailabilityBufferView
      ? { bitstream: 0, availableCount: tileAvailability.filter(v => v).length }
      : { constant: tileAvailabilityBuffer },
    contentAvailability: contentAvailabilityBufferView
      ? [{ bitstream: tileAvailabilityBufferView ? 1 : 0, availableCount: contentAvailability.filter(v => v).length }]
      : [{ constant: contentAvailabilityBuffer }],
    childSubtreeAvailability: childSubtreeAvailabilityBufferView
        ? { bitstream: [tileAvailabilityBufferView, contentAvailabilityBufferView].filter(v => v).length, availableCount: childSubtreeAvailability.filter(v => v).length }
        : { constant: childSubtreeAvailabilityBuffer }
  };
  const json = Buffer.from(JSON.stringify(jsonObj));
  // The JSON chunk shall be padded with trailing Space chars (0x20)
  const paddingBuffer = Buffer.from(new Uint8Array(Array((8 - (json.byteLength % 8) % 8)).fill(0x20)));
  const jsonBuffer = Buffer.concat([json, paddingBuffer]);
  const jsonByteLen = Buffer.from(new BigUint64Array([BigInt(jsonBuffer.byteLength)]).buffer);
  const binaryBtyeLen = Buffer.from(new BigUint64Array([BigInt(buffer.byteLength)]).buffer);
  return Buffer.concat([magic, version, jsonByteLen, binaryBtyeLen, jsonBuffer, buffer]);
}

const writeSubtrees = async (cell, subtreeLevels, filePath) => {
  const run = async (subtreeRoot, subtreeLevels, filePath) => {
    const { tileAvailability, contentAvailability, childSubtreeAvailability, subtreeRoots } = subtreeRoot.getSubtreeAvailability(subtreeLevels);
    // const tileAvailability = Array(73).fill(false).map((v, i) => i === 6 ? true : false);
    // const contentAvailability = Array(73).fill(false).map((v, i) => i === 6 ? true : false);
    // const childSubtreeAvailability = Array(512).fill(false);
    // const subtreeRoots = null;
    await fse.ensureDir(filePath);
    await writeFile(
      path.join(filePath, `${subtreeRoot.level}-${subtreeRoot.x}-${subtreeRoot.y}${subtreeRoot instanceof Cell3 ? `-${subtreeRoot.z}` : ""}.subtree`),
      createSubtreeBinary({ tileAvailability, contentAvailability, childSubtreeAvailability, subtreeRoots })
    );
    console.log(`Subtree ${subtreeRoot.level}-${subtreeRoot.x}-${subtreeRoot.y}${subtreeRoot instanceof Cell3 ? `-${subtreeRoot.z}` : ""}.subtree done.`);
    for (let i = 0; subtreeRoots && i < subtreeRoots.length; i++) {
      const root = subtreeRoots[i];

      if (root.getTileAvailability()) {
        await run(root, subtreeLevels, filePath);
      }
    }
  }

  await run(cell, subtreeLevels, filePath);
}

/**
 * tile坐标数组 [x, y] | [x, y, z]
 * @param {Array<number>} coordinate
 * @param {number} len
 * @returns 
 */
const tileCoordinate2MortonIndex = (coordinate, len, toNumber = true) => {
  const strArr = coordinate.map((v) => {
    const str = `${"0".repeat(len)}${v.toString(2)}`;

    return str.substring(str.length - len, str.length);
  });
  const motronIndexStr = Array(len)
    .fill(0)
    .reduce((pre, _, i) => {
      pre += strArr.map(s => s[i]).reverse().join("");

      return pre;
    }, "");
  
  return toNumber ? parseInt(motronIndexStr, 2) : motronIndexStr;
}

/**
 * 将boolean数组转换成bit数组 true为1 8位0补齐
 * @param {*} arr 
 */
const boolArray2Bin = (arr) => {
  const len = Math.ceil(arr.length / 8);
  const buffer = Buffer.from(new Uint8Array(len + ((8 - len % 8) % 8)));

  for (let i = 0; i < len; i++) {
    // reverse 0-0-0-0 在高位00000001
    const datas = arr.slice(i * 8, i * 8 + 8).concat(Array(8).fill(false)).slice(0, 8).reverse();
    
    buffer[i] = datas.reduce((p, v, i) => {
      p += (v ? Math.pow(2, datas.length - i - 1) : 0);

      return p;
    }, 0)
  }

  return buffer;
}

/**
 * 取得Buffer数组总的字节长度 Buffer可为空
 * @param {Buffer} buffers 
 */
const getBuffersByteLength = (...buffers) => {
  return buffers.reduce((pre, buf) => {
    pre += (buf instanceof Buffer ? buf.byteLength : 0);

    return pre;
  }, 0);
}

const paddingBuffer = (buffer) => {
  const byteLength = buffer.byteLength;
  const modLength = byteLength % 8;
  if (modLength === 0) {
    return buffer;
  } else {
    const res = Buffer.alloc(byteLength + 8 - modLength);

    buffer.copy(res);

    return res;
  }
}

const guid = () => Math.random().toString(16).slice(2)

const combineBbox = (bbox1, bbox2) => {
  const { min: min1, max: max1 } = bbox1;
  const { min: min2, max: max2 } = bbox2;

  return {
    min: [
      min1[0] < min2[0] ? min1[0] : min2[0],
      min1[1] < min2[1] ? min1[1] : min2[1],
      min1[2] < min2[2] ? min1[2] : min2[2]
    ],
    max: [
      max1[0] > max2[0] ? max1[0] : max2[0],
      max1[1] > max2[1] ? max1[1] : max2[1],
      max1[2] > max2[2] ? max1[2] : max2[2]
    ]
  }
}

export {
  getNodeVertexCount,
  getNodesVertexCount,
  create3dtiles,
  create3dtilesContent,
  pruneMaterial,
  isMaterialLike,
  isBboxContain,
  writeSubtrees,
  tileCoordinate2MortonIndex,
  boolArray2Bin,
  getBuffersByteLength,
  distance,
  paddingBuffer,
  guid,
  distanceSquared,
  combineBbox
}