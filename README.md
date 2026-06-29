# Kyro

## The Problem
FATF Recommendation 16 was revised in June 2025 and is now actively enforced for virtual asset transfers that must carry originator and beneficiary information. Stellar institutions face a binary choice between exposing full PII across payment rails or risking non-compliance.

## The Solution
Kyro uses a Groth16 ZK proof to prove Travel Rule compliance, sanctions exclusion, threshold handling, and replay protection without placing PII on-chain. A selective disclosure view key lets a regulator decrypt the full off-chain Travel Rule record on demand while the Stellar transaction only carries commitments and attestations.

## Why Now — Stellar Protocol 26
| CAP | What Kyro Uses It For |
| --- | --- |
| CAP-0074 | Enables the BN254 `pairing_check` host function used for the final Groth16 pairing step. |
| CAP-0075 | Enables Poseidon hash as a host function, used for identity commitments and nullifiers inside the circuit. |
| CAP-0080 | Enables BN254 MSM used to compute `vk_x` during on-chain verification. |

Kyro uses all three: CAP-0074, CAP-0075, and CAP-0080.

## Architecture
```text
Browser
  Circom WASM + snarkjs
  Travel Rule fields -> Groth16 proof
        |
        v
Soroban KyroVerifier contract
  BN254 MSM -> vk_x
  BN254 pairing_check -> proof verified
  SAC transfer gated by compliance
  compliance attestation event on Stellar testnet

Off-chain ECIES payload
  encrypted Travel Rule record
        |
        v
Regulator view key decrypt
```

## ZK Circuit
The circuit enforces six constraints: identity commitment, nullifier derivation, amount threshold check, sanctions root binding, originator non-membership, and beneficiary non-membership. Private inputs include hashed originator fields, beneficiary fields, transfer amount, sanctions Merkle root, and two Merkle paths. Public signals are `identity_commitment`, `nullifier`, `amount_threshold_flag`, `sanctions_root_public`, and `transfer_nonce`.

## Soroban Contract
Testnet contract address: `PASTE_DEPLOYED_CONTRACT_ID_HERE` after deploying with Stellar CLI.

Entry points:

| Entry Point | Purpose |
| --- | --- |
| `init` | Stores the admin address and initial sanctions root. |
| `verify_and_transfer` | Checks the sanctions root, rejects spent nullifiers, verifies the Groth16 proof, stores the nullifier, transfers USDC through SAC, and emits the compliance event. |
| `update_sanctions_root` | Lets the authenticated admin rotate the sanctions Merkle root. |
| `is_nullifier_spent` | Returns whether a nullifier has already been used. |

The contract calls the MSM host function for `vk_x` computation via CAP-0080 and the `pairing_check` host function for final verification via CAP-0074. The current scaffold isolates those call sites so the hardcoded verification key constants from `circuits/scripts/vk_to_rust.js` can replace the placeholders after setup.

## Demo
Video link: `PASTE_VIDEO_LINK_HERE`

Deployed frontend link: `PASTE_FRONTEND_LINK_HERE`

Demo regulator private key for judges:

```text
0000000000000000000000000000000000000000000000000000000000000001
```

## Regulatory Context
FATF Recommendation 16 was revised in June 2025 to strengthen Travel Rule expectations for virtual assets. EU Transfer of Funds Regulation 2023/1113 has been live since December 30, 2024.

## Known Limitations
The sanctions list is mocked and not connected to real OFAC or UN SDN data. KYC data is mocked, the system is testnet only, and the trusted setup uses the public Hermez ptau file rather than a project-specific ceremony.
