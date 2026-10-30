import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

globalThis.self = globalThis;

const path = process.argv[2];
const buffer = fs.readFileSync(path);
const loader = new GLTFLoader();
loader.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  "",
  (gltf) => {
    console.log("animations", gltf.animations.map((a) => a.name));
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry;
      const normal = geometry.getAttribute("normal");
      const position = geometry.getAttribute("position");
      console.log("MESH", object.name, "verts", position.count, "tris", geometry.index ? geometry.index.count / 3 : position.count / 3);
      console.log("  material", object.material?.type, object.material?.name, "flatShading", object.material?.flatShading, "map", Boolean(object.material?.map));
      console.log("  normal itemSize", normal?.itemSize, "count", normal?.count, "normalized", normal?.normalized);
      if (normal) {
        console.log("  normals0", normal.getX(0), normal.getY(0), normal.getZ(0));
        console.log("  normals1", normal.getX(1), normal.getY(1), normal.getZ(1));
      }
    });
  },
  (error) => {
    console.error("PARSE ERROR", error);
  }
);
