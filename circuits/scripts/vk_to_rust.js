#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const vkPath = path.join(__dirname, "..", "build", "verification_key.json");
const vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));

function fieldToBytes(value) {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return hex.match(/../g).map((byte) => `0x${byte}`).join(", ");
}

function printG1(name, point) {
  console.log(`pub const ${name}: [[u8; 32]; 2] = [`);
  console.log(`    [${fieldToBytes(point[0])}],`);
  console.log(`    [${fieldToBytes(point[1])}],`);
  console.log("];\n");
}

function printG2(name, point) {
  console.log(`pub const ${name}: [[[u8; 32]; 2]; 2] = [`);
  for (const pair of point) {
    console.log("    [");
    console.log(`        [${fieldToBytes(pair[0])}],`);
    console.log(`        [${fieldToBytes(pair[1])}],`);
    console.log("    ],");
  }
  console.log("];\n");
}

printG1("VK_ALPHA_G1", vk.vk_alpha_1);
printG2("VK_BETA_G2", vk.vk_beta_2);
printG2("VK_GAMMA_G2", vk.vk_gamma_2);
printG2("VK_DELTA_G2", vk.vk_delta_2);
console.log(`pub const VK_IC: [[[u8; 32]; 2]; ${vk.IC.length}] = [`);
for (const point of vk.IC) {
  console.log("    [");
  console.log(`        [${fieldToBytes(point[0])}],`);
  console.log(`        [${fieldToBytes(point[1])}],`);
  console.log("    ],");
}
console.log("];");
