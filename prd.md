# Kyro — Product Requirements Document

**Version:** 1.0  
**Status:** Hackathon Build  
**Author:** Solo builder  
**Target:** Stellar Hacks: Real-World ZK Hackathon  
**Stack:** Circom 2.0 · Soroban (Rust) · Next.js 15 · Mantine v7

---

## 1. Problem Statement

### 1.1 The Regulatory Reality

FATF Recommendation 16 (the "Travel Rule") was revised in June 2025 and is now actively enforced:

- **EU:** Transfer of Funds Regulation (TFR 2023/1113) — live since December 30, 2024
- **US:** FinCEN recordkeeping rule with $3,000 threshold — enforced since 2024
- **UK:** FCA amended MLR 2017

**What the Travel Rule requires:** Every stablecoin or virtual asset transfer above $1,000 must carry the originator's verified name, wallet address, physical address (or national ID / date of birth), and the beneficiary's equivalent data — transmitted between institutions in cleartext alongside the payment.

### 1.2 The Paradox on Stellar

Stellar is the preferred settlement layer for institutional cross-border stablecoin flows (USDC, tokenised RWAs). These institutions face an impossible binary:

| Option | Result |
|--------|--------|
| Comply with Travel Rule naively | Full PII exposed on-chain and in transit. Counterparty sees your client data. Data breach surface is enormous. |
| Skip compliance | Regulatory fines. Enforcement actions. License risk. |

**There is no existing system on Stellar that satisfies both simultaneously.** Kyro is that system.

### 1.3 What Kyro Proves

> A sending institution can prove to a verifier contract — and through a view key to a regulator — that a transfer is Travel Rule compliant, without revealing any PII to the public chain, to the counterparty, or to any intermediate actor.

This is **selective disclosure**: prove compliance without revealing the evidence.

---

## 2. Solution Overview

Kyro has three layers:

1. **Off-chain ZK circuit (Circom)** — generates a Groth16 proof that the sender's identity data satisfies Travel Rule fields, the amount crosses or stays under the threshold, and neither party appears on a committed sanctions list.

2. **On-chain Soroban verifier contract (Rust)** — receives the proof and public signals, calls Stellar Protocol 25/26 BN254 host functions to verify the Groth16 proof natively, emits a compliance attestation, stores a nullifier to prevent replay, and gates the transfer.

3. **Selective disclosure / view key** — the sender encrypts full PII to a regulator's public key. The on-chain commitment is the anchor. The encrypted payload lives off-chain. A regulator can reconstruct the complete Travel Rule record on demand, on request, without it ever being on-chain.

---

## 3. Stellar Protocol Context (Why Now)

Understanding why Kyro is only possible today is important for the submission narrative and for your own comprehension.

### Protocol 25 — X-Ray (Mainnet: January 22, 2026)

| Primitive | CAP | What it enables |
|-----------|-----|-----------------|
| BN254 elliptic curve ops | CAP-0074 | `pairing_check` host function — final step of Groth16 verification. Without this, you'd implement pairing math in Wasm at 10× the cost. |
| Poseidon / Poseidon2 hash | CAP-0075 | ZK-native hash function. Used for commitments, Merkle trees, and nullifiers inside circuits. SHA-256 in a ZK circuit costs ~25,000 constraints; Poseidon costs ~240. |

### Protocol 26 — Yardstick (Mainnet: May 6, 2026)

| Primitive | CAP | What it enables |
|-----------|-----|-----------------|
| BN254 multi-scalar multiplication | CAP-0080 | MSM is the expensive inner loop of Groth16 proof verification. Moving it to the host layer makes on-chain verification of Circom/Noir proofs meaningfully cheaper. |
| Scalar-field arithmetic (add, sub, mul, pow, inv) | CAP-0080 | Range proof arithmetic for the $1,000 threshold check without leaving the BN254 scalar field. |
| Curve-membership checks (BN254 + BLS12-381) | CAP-0080 | Validates that proof elements are actually on the curve before the pairing check — prevents malformed-proof attacks. |

**Kyro explicitly uses CAP-0074, CAP-0075, and CAP-0080. State this in your README.**

---

## 4. User Roles

| Role | Description | Interaction |
|------|-------------|-------------|
| **Sender (VASP / institution)** | Initiates a cross-border stablecoin transfer. Has verified KYC data on their client. | Fills transfer form → proof generated in browser → submits to chain |
| **Receiver (VASP / institution)** | Receives the transfer. Needs to know the transfer is compliant but not the underlying PII. | Sees on-chain compliance attestation event |
| **Regulator / Auditor** | Holds a view key. Has legal authority to inspect Travel Rule data. | Decrypts off-chain payload using private key → reconstructs full Travel Rule record |
| **Verifier contract** | Soroban smart contract. Stateless from the user's perspective. | Verifies Groth16 proof → emits attestation → stores nullifier |

---

## 5. Circom Circuit Specification

This is the technical core of the project. Get this right before touching the contract or frontend.

### 5.1 Circuit Inputs

**Private inputs (never leave the browser):**
```
originator_name_hash        // Poseidon hash of full legal name
originator_address_hash     // Poseidon hash of physical address
originator_id_hash          // Poseidon hash of national ID or DOB+POB
beneficiary_name_hash       // Poseidon hash of beneficiary name
beneficiary_country_code    // numeric country code (ISO 3166-1)
transfer_amount             // in USDC cents (e.g. 150000 = $1,500)
sanctions_merkle_root       // committed Merkle root of OFAC/UN list
originator_merkle_path[]    // exclusion proof: originator NOT in sanctions tree
beneficiary_merkle_path[]   // exclusion proof: beneficiary NOT in sanctions tree
```

**Public inputs (go on-chain as public signals):**
```
identity_commitment         // Poseidon(originator_name_hash, originator_id_hash)
nullifier                   // Poseidon(identity_commitment, transfer_nonce)
amount_threshold_flag       // 1 if amount >= 100000 (i.e. >= $1,000), else 0
sanctions_root              // same as private sanctions_merkle_root (verified by circuit)
transfer_nonce              // random value, prevents replay
```

### 5.2 Circuit Logic (what the circuit enforces)

```
1. IDENTITY COMMITMENT
   Compute identity_commitment = Poseidon(originator_name_hash, originator_id_hash)
   Assert identity_commitment == public identity_commitment signal

2. NULLIFIER
   Compute nullifier = Poseidon(identity_commitment, transfer_nonce)
   Assert nullifier == public nullifier signal

3. THRESHOLD CHECK
   Assert amount_threshold_flag == (transfer_amount >= 100000) ? 1 : 0
   (This is a range proof — use a comparator component from circomlib)

4. SANCTIONS EXCLUSION (originator)
   Compute Merkle path from originator_id_hash to sanctions_merkle_root
   Assert the path DOES NOT INCLUDE originator_id_hash
   (Non-membership proof: include a sibling Merkle path that proves absence)

5. SANCTIONS EXCLUSION (beneficiary)
   Same logic for beneficiary_name_hash
```

### 5.3 Libraries to use

- **circomlib** — provides: `Poseidon`, `MerkleProof`, `LessThan`, `GreaterEqThan`, `Num2Bits`
- **snarkjs** — witness generation, proof generation (Groth16), verification key export
- **circom 2.0** — circuit compiler

### 5.4 Files to produce

```
circuits/
  Kyro.circom          // main circuit
  Kyro.r1cs            // compiled constraint system
  Kyro.wasm            // witness generator (used in browser)
  Kyro_final.zkey      // proving key (after Powers of Tau + phase 2)
  verification_key.json        // used by Soroban contract
```

### 5.5 Trusted Setup

For hackathon purposes use the Hermez Powers of Tau (ptau) ceremony file (`powersOfTau28_hez_final_16.ptau`). This is publicly available and widely used. Note in your README that production would require a project-specific ceremony.

---

## 6. Soroban Contract Specification

### 6.1 Contract: `KyroVerifier`

Written in Rust using the Soroban SDK.

**Storage:**
```rust
// Persistent storage
nullifiers: Map<BytesN<32>, bool>     // spent nullifiers
sanctions_root: BytesN<32>            // current committed sanctions Merkle root
admin: Address                        // can update sanctions root
```

**Entry points:**

```rust
// Initialize contract with sanctions root and admin
fn init(env: Env, admin: Address, sanctions_root: BytesN<32>)

// Core verification + transfer gate
fn verify_and_transfer(
    env: Env,
    proof: KyroProof,         // Groth16 proof (pi_a, pi_b, pi_c)
    public_signals: PublicSignals,    // identity_commitment, nullifier, amount_threshold_flag, sanctions_root, transfer_nonce
    transfer: TransferDetails,        // from, to, amount, asset
) -> Result<(), Error>

// Regulator: update sanctions root after list changes
fn update_sanctions_root(env: Env, new_root: BytesN<32>)

// Read: check if nullifier is spent
fn is_nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool
```

**verify_and_transfer logic:**
```
1. Assert public_signals.sanctions_root == self.sanctions_root
2. Assert nullifier NOT in nullifiers map (replay protection)
3. Call BN254 pairing_check host function with (proof, public_signals) — this is the Groth16 verification
4. Assert verification returns true
5. Store nullifier as spent
6. Execute the token transfer (SAC / USDC)
7. Emit compliance attestation event:
   { nullifier, identity_commitment, amount_threshold_flag, timestamp }
```

### 6.2 Groth16 verification in Soroban

Start from the existing example: `github.com/stellar/soroban-examples/tree/main/groth16_verifier`

The verification key JSON from snarkjs maps to:
- `vk.alpha1` → G1 point (alpha)
- `vk.beta2` → G2 point (beta)
- `vk.gamma2` → G2 point (gamma)
- `vk.delta2` → G2 point (delta)
- `vk.IC[]` → G1 points for public input combination (this is where MSM from CAP-0080 is used)

The Groth16 pairing check is:
```
e(A, B) == e(alpha, beta) * e(vk_x, gamma) * e(C, delta)
where vk_x = IC[0] + sum(IC[i+1] * public_inputs[i])
```

The `vk_x` computation is a **multi-scalar multiplication** — this is exactly what CAP-0080's MSM host function accelerates. Call it explicitly and mention this in the README.

### 6.3 Contract deployment

- Deploy to Stellar Testnet first, get a contract ID
- Use `stellar contract deploy --wasm target/wasm32-unknown-unknown/release/Kyro.wasm`

---

## 7. Frontend Specification

### 7.1 Stack

- **Next.js 15** (App Router)
- **Mantine v7** dark theme
- **stellar-sdk** (JS) — transaction building, contract invocation
- **snarkjs** — in-browser proof generation
- **Freighter wallet** — browser extension for Stellar, handles signing

### 7.2 Pages / Views

#### `/` — Home / Landing

Single page explaining Kyro in one paragraph. Two CTAs: "Send Transfer" and "Regulator View". No cards, no animations.

#### `/transfer` — Sender Flow

This is the main product view. Mantine form, dark theme, table-heavy layout.

**Form fields:**
```
Originator Name          (text)
Originator Physical Address  (text)
Originator ID Type       (select: National ID / Passport / DOB+POB)
Originator ID Value      (text)
Beneficiary Name         (text)
Beneficiary Country      (select, ISO 3166-1)
Transfer Amount (USDC)   (number)
Recipient Stellar Address (text)
```

**On submit:**
1. Hash all private fields using Poseidon (via circomlibjs in browser)
2. Compute sanctions Merkle proof (client-side, against a bundled mock sanctions list for hackathon)
3. Call `snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)` — show a progress indicator, this takes 2-5 seconds
4. Display: proof generation time, circuit constraints count, public signals
5. Call Soroban `verify_and_transfer` via stellar-sdk
6. Show Mantine notification: success with transaction hash linking to stellar.expert, or error with reason

**Status display (Mantine table, not cards):**

| Field | Value |
|-------|-------|
| Identity commitment | `0x...` (truncated) |
| Nullifier | `0x...` |
| Amount threshold | Above $1,000 ✓ |
| Sanctions check | Passed ✓ |
| Proof generation | 3.2s |
| Verification fee | 0.0012 XLM |
| Transaction | [view on stellar.expert] |

#### `/regulator` — View Key Decrypt

This is the "aha" demo moment for judges.

**Flow:**
1. Input: paste an encrypted Travel Rule payload (JSON blob generated at transfer time)
2. Input: paste or upload a private key (mock RSA or ECIES key for demo)
3. Click "Decrypt Record"
4. Display full Travel Rule record in a Mantine table:

| Travel Rule Field | Value |
|-------------------|-------|
| Originator Name | Jane Smith |
| Originator Address | 123 Main St, Mumbai, India |
| Originator ID | Passport: XXXXXXXXX |
| Beneficiary Name | Acme Corp GmbH |
| Beneficiary Country | Germany |
| Transfer Amount | $1,500.00 USDC |
| Transfer Timestamp | 2026-06-25 14:32 UTC |
| On-chain Commitment | `0x...` |
| Nullifier | `0x...` |

5. Show: "This record was never on-chain. It was reconstructed from an encrypted payload using the regulator's view key. The on-chain commitment anchors it to transaction `[hash]`."

---

## 8. Selective Disclosure / View Key Implementation

For the hackathon this uses a simplified but cryptographically sound approach:

### Encryption (at transfer time, in browser)
```javascript
// 1. Serialize the full Travel Rule record
const record = {
  originator: { name, address, idType, idValue },
  beneficiary: { name, country },
  amount,
  timestamp: Date.now(),
  onChainCommitment: publicSignals.identity_commitment,
  nullifier: publicSignals.nullifier,
  txHash
}

// 2. Encrypt to regulator's public key using ECIES (use eciesjs library)
const encryptedPayload = await encrypt(REGULATOR_PUBLIC_KEY, Buffer.from(JSON.stringify(record)))

// 3. Give sender the JSON blob to hand off-chain (email, secure channel)
// On-chain: only the commitment and nullifier. Nothing else.
```

### Decryption (regulator view, in browser)
```javascript
const decrypted = await decrypt(regulatorPrivateKey, encryptedPayload)
const record = JSON.parse(decrypted.toString())
```

For the hackathon, hardcode a demo regulator keypair so judges can run the decryption themselves.

---

## 9. Sanctions List (Mock Implementation)

For the hackathon, use a mock sanctions Merkle tree:

```javascript
// 20 mock sanctioned entity hashes (Poseidon hashed)
const MOCK_SANCTIONS_LIST = [
  poseidon(["0xDEAD..."]),
  poseidon(["0xBAD1..."]),
  // ... 18 more
]

// Build a Merkle tree using circomlibjs MerkleTree
const tree = new MerkleTree(depth: 4, MOCK_SANCTIONS_LIST)
const SANCTIONS_ROOT = tree.root
```

The circuit takes an exclusion path: it verifies the entity's hash is NOT in the tree by providing a valid sibling path that leads to the root without including the entity. State in the README that production would connect to OFAC/UN SDN list APIs with a daily signed root update from an oracle.

---

## 10. Build Sequence (Step by Step)

Follow this order. Doing it out of order wastes time.

### Phase 0 — Environment Setup (Day 1 morning)

```bash
# Stellar CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --locked stellar-cli

# Generate testnet account and fund it
stellar keys generate --global testnet-key --network testnet
stellar keys fund testnet-key --network testnet

# Circom
npm install -g circom snarkjs
npm install circomlib circomlibjs

# Soroban Rust target
rustup target add wasm32-unknown-unknown

# Next.js project
npx create-next-app@latest Kyro-app --typescript --app
cd Kyro-app
npm install @mantine/core @mantine/hooks @mantine/form @mantine/notifications
npm install @stellar/stellar-sdk snarkjs eciesjs
```

### Phase 1 — Circuit (Day 1, ~6 hours)

1. Write `Kyro.circom` — start with just the identity commitment and nullifier, get those compiling first
2. Add the threshold comparator using `circomlib/comparators`
3. Add the Merkle exclusion proof using `circomlib/merkle` — this is the hardest part
4. Compile: `circom Kyro.circom --r1cs --wasm --sym`
5. Run trusted setup:
   ```bash
   snarkjs powersoftau new bn128 16 pot16_0000.ptau
   # Or download: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
   snarkjs groth16 setup Kyro.r1cs pot_final.ptau Kyro_0000.zkey
   snarkjs zkey contribute Kyro_0000.zkey Kyro_final.zkey
   snarkjs zkey export verificationkey Kyro_final.zkey verification_key.json
   ```
6. Test proof generation:
   ```bash
   snarkjs groth16 fullprove input.json Kyro_js/Kyro.wasm Kyro_final.zkey proof.json public.json
   snarkjs groth16 verify verification_key.json public.json proof.json
   ```

### Phase 2 — Soroban Contract (Day 1-2, ~8 hours)

1. Clone the groth16_verifier example from soroban-examples
2. Extend it with:
   - Nullifier storage (Map in persistent storage)
   - Sanctions root check (compare public signal against stored root)
   - USDC transfer via SAC after successful verification
   - Compliance attestation event emission
3. Convert your `verification_key.json` to Rust constants — write a small script for this
4. Build: `cargo build --target wasm32-unknown-unknown --release`
5. Deploy to testnet: `stellar contract deploy --wasm ... --network testnet --source testnet-key`
6. Test via CLI invocation before touching the frontend

### Phase 3 — Frontend (Day 2-3, ~10 hours)

1. Set up Next.js 15 App Router with Mantine v7 dark theme provider
2. Build `/transfer` form — form state only, no blockchain yet
3. Wire in snarkjs: load wasm + zkey (put them in `/public`), call `fullProve` on submit
4. Wire in stellar-sdk: build and submit `verify_and_transfer` transaction
5. Build `/regulator` view: ECIES decrypt, render table
6. Add Mantine notifications for all states (loading, success, error)
7. Add stellar.expert links to transaction hashes

### Phase 4 — Demo Polish (Day 3, ~3 hours)

1. Record a demo video showing the full flow: fill form → watch proof generate → see on-chain verification → regulator decrypt
2. Highlight proof generation time and verification fee in the video
3. Write README (see Section 12)

---

## 11. Must-Have vs Nice-to-Have

### Must-Have (without these, the submission is incomplete)

- [ ] Working Circom circuit that compiles and produces a valid Groth16 proof
- [ ] Soroban verifier contract deployed on testnet that verifies the proof using BN254 host functions
- [ ] Nullifier storage preventing replay
- [ ] Transfer form with in-browser proof generation
- [ ] Compliance attestation event visible on stellar.expert
- [ ] Regulator view-key decrypt demo
- [ ] README explaining the FATF context and the protocol primitive mapping

### Nice-to-Have (add if time permits)

- [ ] Real USDC transfer execution after verification (vs just the verification step)
- [ ] Animated proof generation progress bar showing constraint count
- [ ] Verification cost comparison table (with CAP-80 vs without)
- [ ] Multiple threshold tiers ($1k, $3k for US compliance)
- [ ] Mobile-responsive layout

### Explicitly Out of Scope

- Real KYC integration (mock data only)
- Real sanctions oracle (mock tree only)
- Multi-asset support (USDC only)
- Production key management
- Recursive proof aggregation

---

## 12. README Structure for Submission

Your README is a judge artifact. Structure it exactly like this:

```markdown
# Kyro

## The Problem
[2 sentences on FATF Travel Rule + the privacy paradox on Stellar]

## The Solution
[2 sentences: ZK proof of Travel Rule compliance, selective disclosure via view key]

## Why Now — Stellar Protocol 26
[Table: primitive → CAP → what Kyro uses it for]
Explicitly name CAP-0074 (BN254 pairing), CAP-0075 (Poseidon), CAP-0080 (MSM)

## Architecture
[3-layer diagram: Circuit → Contract → Frontend]

## ZK Circuit
[What the circuit proves, inputs, public signals]

## Soroban Contract
[Contract address on testnet, entry points, how BN254 host functions are called]

## Demo
[Link to video, link to deployed frontend, test regulator keypair for judges to use]

## Regulatory Context
[Cite: FATF Recommendation 16 (June 2025), EU TFR 2023/1113 (Dec 2024)]

## Known Limitations
[Mock sanctions list, mock KYC, testnet only]
```

---

## 13. Key Repositories and References

| Resource | URL |
|----------|-----|
| Groth16 verifier (Soroban) | `github.com/stellar/soroban-examples/tree/main/groth16_verifier` |
| Circom on Stellar (E2E tutorial) | `jamesbachini.com/circom-on-stellar/` |
| Circom docs | `docs.circom.io` |
| circomlib (Poseidon, MerkleProof, comparators) | `github.com/iden3/circomlib` |
| circomlibjs (JS, for in-browser hashing) | `github.com/iden3/circomlibjs` |
| snarkjs | `github.com/iden3/snarkjs` |
| Stellar ZK docs | `developers.stellar.org/docs/build/apps/zk` |
| CAP-0080 spec | `github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md` |
| Soroban Rust SDK | `docs.rs/soroban-sdk` |
| stellar-sdk (JS) | `github.com/stellar/js-stellar-sdk` |
| eciesjs (view key encryption) | `github.com/ecies/js` |
| Freighter wallet | `freighter.app` |

---

## 14. Technical Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Circom Merkle exclusion proof is complex to write | High | Use circomlib's existing MerkleProof template; non-membership is just membership of a sibling — look at Tornado Cash's circuit for reference |
| snarkjs in browser is slow | Medium | wasm loading + proof generation can take 5-10s on slow machines; show a progress indicator, frame it as "complex ZK computation" |
| Soroban BN254 host function API is unfamiliar | High | Start from the groth16_verifier example exactly as-is; only extend, don't rewrite |
| Trusted setup takes time | Low | Use the Hermez ptau file, don't run a new ceremony |
| Freighter wallet not installed by judges | Medium | Add a fallback: provide a pre-funded testnet keypair in the README so judges can test without the extension |

---

*This document covers every decision you need to make before writing a single line of code. Build in the order specified in Section 10. The circuit is the hardest part — get it working first before touching the contract or frontend.*