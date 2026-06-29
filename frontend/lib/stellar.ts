import * as StellarSdk from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

declare global {
  interface Window {
    freighterApi?: {
      isConnected?: () => Promise<{ isConnected: boolean; error?: { message: string } }>;
      requestAccess?: () => Promise<{ address: string; error?: { message: string } }>;
      signTransaction?: (
        xdr: string,
        opts: { networkPassphrase: string },
      ) => Promise<{ signedTxXdr: string; error?: { message: string } }>;
    };
  }
}

export function isFreighterAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.freighterApi);
}

export function hexToScVal(hex: string): StellarSdk.xdr.ScVal {
  const clean = hex.replace(/^0x/, "").padStart(64, "0");
  return StellarSdk.xdr.ScVal.scvBytes(Buffer.from(clean, "hex"));
}

function bigintToBytesScVal(value: string | bigint): StellarSdk.xdr.ScVal {
  const bigint = typeof value === "bigint" ? value : BigInt(value);
  return hexToScVal(bigint.toString(16));
}

function proofToScVal(proof: any): StellarSdk.xdr.ScVal {
  const piA = [proof.pi_a?.[0] ?? "0", proof.pi_a?.[1] ?? "0"].map(bigintToBytesScVal);
  const piB = [
    [proof.pi_b?.[0]?.[0] ?? "0", proof.pi_b?.[0]?.[1] ?? "0"].map(bigintToBytesScVal),
    [proof.pi_b?.[1]?.[0] ?? "0", proof.pi_b?.[1]?.[1] ?? "0"].map(bigintToBytesScVal),
  ];
  const piC = [proof.pi_c?.[0] ?? "0", proof.pi_c?.[1] ?? "0"].map(bigintToBytesScVal);

  return StellarSdk.nativeToScVal(
    {
      pi_a: piA,
      pi_b: piB,
      pi_c: piC,
    },
    {
      type: {
        pi_a: ["vec", null],
        pi_b: ["vec", null],
        pi_c: ["vec", null],
      },
    } as any,
  );
}

function publicSignalsToScVal(publicSignals: string[]): StellarSdk.xdr.ScVal {
  return StellarSdk.nativeToScVal(
    {
      identity_commitment: bigintToBytesScVal(publicSignals[0]),
      nullifier: bigintToBytesScVal(publicSignals[1]),
      amount_threshold_flag: Number(publicSignals[2]),
      sanctions_root: bigintToBytesScVal(publicSignals[3]),
      transfer_nonce: bigintToBytesScVal(publicSignals[4]),
    },
    {
      type: {
        identity_commitment: ["bytes", null],
        nullifier: ["bytes", null],
        amount_threshold_flag: ["u32", null],
        sanctions_root: ["bytes", null],
        transfer_nonce: ["bytes", null],
      },
    } as any,
  );
}

function transferToScVal(transfer: {
  from: string;
  to: string;
  amount: number;
  assetContract?: string;
}, sourceAddress: string): StellarSdk.xdr.ScVal {
  const assetContract = transfer.assetContract || process.env.NEXT_PUBLIC_USDC_CONTRACT || "";
  const fromAddress = transfer.from || sourceAddress;
  return StellarSdk.nativeToScVal(
    {
      from: StellarSdk.Address.fromString(fromAddress).toScVal(),
      to: StellarSdk.Address.fromString(transfer.to).toScVal(),
      amount: BigInt(Math.round(transfer.amount * 10_000_000)),
      asset_contract: StellarSdk.Address.fromString(assetContract).toScVal(),
    },
    {
      type: {
        from: ["address", null],
        to: ["address", null],
        amount: ["i128", null],
        asset_contract: ["address", null],
      },
    } as any,
  );
}

async function getSourceAddress(): Promise<string> {
  if (isFreighterAvailable() && window.freighterApi?.requestAccess) {
    const result = await window.freighterApi.requestAccess();
    if (result.error) throw new Error(result.error.message);
    return result.address;
  }

  const secret = process.env.NEXT_PUBLIC_TEST_SECRET_KEY;
  if (!secret) throw new Error("Missing NEXT_PUBLIC_TEST_SECRET_KEY fallback signer.");
  return StellarSdk.Keypair.fromSecret(secret).publicKey();
}

async function signTransaction(transaction: StellarSdk.Transaction): Promise<StellarSdk.Transaction> {
  if (isFreighterAvailable() && window.freighterApi?.signTransaction) {
    const signed = await window.freighterApi.signTransaction(transaction.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (signed.error) throw new Error(signed.error.message);
    return StellarSdk.TransactionBuilder.fromXDR(
      signed.signedTxXdr,
      NETWORK_PASSPHRASE,
    ) as StellarSdk.Transaction;
  }

  const secret = process.env.NEXT_PUBLIC_TEST_SECRET_KEY;
  if (!secret) throw new Error("Missing NEXT_PUBLIC_TEST_SECRET_KEY fallback signer.");
  transaction.sign(StellarSdk.Keypair.fromSecret(secret));
  return transaction;
}

export async function verifyAndTransfer(
  proof: unknown,
  publicSignals: string[],
  transfer: { from: string; to: string; amount: number; assetContract?: string },
): Promise<string> {
  const contractId = process.env.NEXT_PUBLIC_KYRO_CONTRACT_ID;
  if (!contractId) throw new Error("Missing NEXT_PUBLIC_KYRO_CONTRACT_ID.");

  const rpc = new StellarSdk.rpc.Server(RPC_URL);
  const sourceAddress = await getSourceAddress();
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(contractId);

  let transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "verify_and_transfer",
        proofToScVal(proof),
        publicSignalsToScVal(publicSignals),
        transferToScVal(transfer, sourceAddress),
      ),
    )
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(transaction);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  transaction = StellarSdk.rpc.assembleTransaction(transaction, simulation).build();
  const signedTransaction = await signTransaction(transaction);
  const sendResponse = await rpc.sendTransaction(signedTransaction);

  if (sendResponse.status === "ERROR") {
    throw new Error(`Transaction failed: ${sendResponse.errorResult}`);
  }

  return sendResponse.hash;
}
