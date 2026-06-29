import { decrypt, encrypt } from "eciesjs";

export const DEMO_REGULATOR_PRIVATE_KEY =
  "0000000000000000000000000000000000000000000000000000000000000001";
export const DEMO_REGULATOR_PUBLIC_KEY =
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

export interface TravelRuleRecord {
  originator: {
    name: string;
    address: string;
    idType: string;
    idValue: string;
  };
  beneficiary: {
    name: string;
    country: string;
  };
  amount: number;
  timestamp: number;
  onChainCommitment: string;
  nullifier: string;
  txHash: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.trim());
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function encryptPayload(record: TravelRuleRecord): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(record));
  const encrypted = await encrypt(DEMO_REGULATOR_PUBLIC_KEY, encoded);
  return bytesToBase64(encrypted);
}

export async function decryptPayload(blob: string, privateKeyHex: string): Promise<TravelRuleRecord> {
  const encrypted = base64ToBytes(blob);
  const decrypted = await decrypt(privateKeyHex.trim(), encrypted);
  return JSON.parse(new TextDecoder().decode(decrypted)) as TravelRuleRecord;
}
