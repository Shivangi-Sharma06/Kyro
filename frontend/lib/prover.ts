export type ProofResult = {
  proof: unknown;
  publicSignals: string[];
  durationMs: number;
};

export async function generateProof(inputs: Record<string, unknown>): Promise<ProofResult> {
  const snarkjs = await import("snarkjs");
  const startedAt = performance.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    "/Kyro.wasm",
    "/Kyro_final.zkey",
  );
  const durationMs = performance.now() - startedAt;

  return {
    proof,
    publicSignals,
    durationMs,
  };
}
