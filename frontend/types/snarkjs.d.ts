declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      inputs: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ) => Promise<{ proof: unknown; publicSignals: string[] }>;
  };
}
