import { buildPoseidon } from "circomlibjs";

type PoseidonInstance = Awaited<ReturnType<typeof buildPoseidon>>;

let poseidonPromise: Promise<PoseidonInstance> | null = null;

async function getPoseidon() {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon();
  }
  return poseidonPromise;
}

export async function poseidonHash(values: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const result = poseidon(values);
  return BigInt(poseidon.F.toString(result));
}

export async function hashField(value: string): Promise<bigint> {
  const bytes = new TextEncoder().encode(value.trim());
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 60);
  const asBigInt = hex.length === 0 ? 0n : BigInt(`0x${hex}`);
  return poseidonHash([asBigInt]);
}
