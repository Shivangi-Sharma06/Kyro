import { poseidonHash } from "./poseidon";

export const MOCK_SANCTIONED_ENTITY_HASHES = [
  0xdead0001n,
  0xdead0002n,
  0xdead0003n,
  0xdead0004n,
  0xdead0005n,
  0xdead0006n,
  0xdead0007n,
  0xdead0008n,
  0xdead0009n,
  0xdead000an,
  0xdead000bn,
  0xdead000cn,
  0xdead000dn,
  0xdead000en,
  0xdead000fn,
  0xdead0010n,
];

export type SanctionsMerkleProof = {
  root: bigint;
  leaf: bigint;
  pathValues: bigint[];
  pathIndices: number[];
};

async function buildLevels(leaves: bigint[]) {
  const levels: bigint[][] = [leaves];
  let current = leaves;

  while (current.length > 1) {
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(await poseidonHash([current[i], current[i + 1]]));
    }
    levels.push(next);
    current = next;
  }

  return levels;
}

export async function buildSanctionsMerkleProof(entityHash: bigint): Promise<SanctionsMerkleProof> {
  const leaves = [...MOCK_SANCTIONED_ENTITY_HASHES];
  const insertionIndex = 15;
  leaves[insertionIndex] = entityHash;
  const levels = await buildLevels(leaves);

  const pathValues: bigint[] = [];
  const pathIndices: number[] = [];
  let index = insertionIndex;

  for (let level = 0; level < 4; level += 1) {
    const siblingIndex = index ^ 1;
    pathValues.push(levels[level][siblingIndex]);
    pathIndices.push(index % 2);
    index = Math.floor(index / 2);
  }

  return {
    root: levels[levels.length - 1][0],
    leaf: entityHash,
    pathValues,
    pathIndices,
  };
}

export async function getSanctionsRoot(): Promise<bigint> {
  const levels = await buildLevels(MOCK_SANCTIONED_ENTITY_HASHES);
  return levels[levels.length - 1][0];
}
