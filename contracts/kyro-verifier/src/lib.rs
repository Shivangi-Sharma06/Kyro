#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, BytesN,
    Env, IntoVal, Map, String, Symbol, Val, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    SanctionsRoot,
    Nullifier(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    InvalidSanctionsRoot = 2,
    NullifierSpent = 3,
    ProofVerificationFailed = 4,
    Unauthorized = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KyroProof {
    pub pi_a: Vec<BytesN<32>>,
    pub pi_b: Vec<Vec<BytesN<32>>>,
    pub pi_c: Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicSignals {
    pub identity_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub amount_threshold_flag: u32,
    pub sanctions_root: BytesN<32>,
    pub transfer_nonce: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferDetails {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub asset_contract: Address,
}

// REPLACE with output from circuits/scripts/vk_to_rust.js after running setup.sh.
pub const VK_ALPHA_G1: [[u8; 32]; 2] = [[0u8; 32]; 2];

// REPLACE with output from circuits/scripts/vk_to_rust.js after running setup.sh.
pub const VK_BETA_G2: [[[u8; 32]; 2]; 2] = [[[0u8; 32]; 2]; 2];

// REPLACE with output from circuits/scripts/vk_to_rust.js after running setup.sh.
pub const VK_GAMMA_G2: [[[u8; 32]; 2]; 2] = [[[0u8; 32]; 2]; 2];

// REPLACE with output from circuits/scripts/vk_to_rust.js after running setup.sh.
pub const VK_DELTA_G2: [[[u8; 32]; 2]; 2] = [[[0u8; 32]; 2]; 2];

// REPLACE with output from circuits/scripts/vk_to_rust.js after running setup.sh.
pub const VK_IC: [[[u8; 32]; 2]; 6] = [[[0u8; 32]; 2]; 6];

#[contract]
pub struct KyroVerifier;

#[contractimpl]
impl KyroVerifier {
    pub fn init(env: Env, admin: Address, sanctions_root: BytesN<32>) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::SanctionsRoot, &sanctions_root);
        Ok(())
    }

    pub fn verify_and_transfer(
        env: Env,
        proof: KyroProof,
        public_signals: PublicSignals,
        transfer: TransferDetails,
    ) -> Result<(), Error> {
        let stored_root: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::SanctionsRoot)
            .ok_or(Error::InvalidSanctionsRoot)?;
        if stored_root != public_signals.sanctions_root {
            return Err(Error::InvalidSanctionsRoot);
        }

        let nullifier_key = DataKey::Nullifier(public_signals.nullifier.clone());
        if env.storage().persistent().has(&nullifier_key) {
            return Err(Error::NullifierSpent);
        }

        let vk_x = compute_vk_x(&env, &public_signals);
        if !pairing_check(&env, &proof, &vk_x) {
            return Err(Error::ProofVerificationFailed);
        }

        env.storage().persistent().set(&nullifier_key, &true);

        if transfer.amount > 0 {
            let token_client = token::Client::new(&env, &transfer.asset_contract);
            token_client.transfer(&transfer.from, &transfer.to, &transfer.amount);
        }

        publish_attestation(&env, &public_signals);
        Ok(())
    }

    pub fn update_sanctions_root(
        env: Env,
        caller: Address,
        new_root: BytesN<32>,
    ) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(Error::Unauthorized)?;
        if caller != admin {
            return Err(Error::Unauthorized);
        }
        caller.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::SanctionsRoot, &new_root);
        Ok(())
    }

    pub fn is_nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier))
    }
}

fn compute_vk_x(env: &Env, public_signals: &PublicSignals) -> BytesN<32> {
    let _signal_scalars = vec![
        env,
        public_signals.identity_commitment.clone(),
        public_signals.nullifier.clone(),
        u32_to_bytes(env, public_signals.amount_threshold_flag),
        public_signals.sanctions_root.clone(),
        public_signals.transfer_nonce.clone(),
    ];

    // CAP-0080 BN254 MSM goes here:
    // vk_x = IC[0] + sum(IC[i + 1] * public_signal[i]).
    // SDK 22 does not expose a stable high-level Rust binding for this host
    // function, so this demo keeps the call site isolated.
    BytesN::from_array(env, &VK_IC[0][0])
}

fn pairing_check(_env: &Env, proof: &KyroProof, _vk_x: &BytesN<32>) -> bool {
    let proof_shape_is_valid =
        proof.pi_a.len() == 2 && proof.pi_b.len() == 2 && proof.pi_c.len() == 2;

    // CAP-0074 BN254 pairing_check goes here with:
    // (A, B), (neg_alpha, beta), (neg_vk_x, gamma), (neg_C, delta).
    proof_shape_is_valid
}

fn u32_to_bytes(env: &Env, value: u32) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[28] = ((value >> 24) & 0xff) as u8;
    bytes[29] = ((value >> 16) & 0xff) as u8;
    bytes[30] = ((value >> 8) & 0xff) as u8;
    bytes[31] = (value & 0xff) as u8;
    BytesN::from_array(env, &bytes)
}

fn publish_attestation(env: &Env, public_signals: &PublicSignals) {
    let mut data: Map<Symbol, Val> = Map::new(env);
    data.set(
        symbol_short!("nullifier"),
        public_signals.nullifier.clone().into_val(env),
    );
    data.set(
        symbol_short!("identity"),
        public_signals.identity_commitment.clone().into_val(env),
    );
    data.set(
        symbol_short!("threshold"),
        public_signals.amount_threshold_flag.into_val(env),
    );
    data.set(
        symbol_short!("timestamp"),
        env.ledger().timestamp().into_val(env),
    );

    env.events().publish(
        (symbol_short!("kyro"), String::from_str(env, "compliance")),
        data,
    );
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn bytes(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
    }

    fn proof(env: &Env) -> KyroProof {
        KyroProof {
            pi_a: vec![env, bytes(env, 1), bytes(env, 2)],
            pi_b: vec![
                env,
                vec![env, bytes(env, 3), bytes(env, 4)],
                vec![env, bytes(env, 5), bytes(env, 6)],
            ],
            pi_c: vec![env, bytes(env, 7), bytes(env, 8)],
        }
    }

    fn public_signals(env: &Env, root: BytesN<32>, nullifier: BytesN<32>) -> PublicSignals {
        PublicSignals {
            identity_commitment: bytes(env, 9),
            nullifier,
            amount_threshold_flag: 1,
            sanctions_root: root,
            transfer_nonce: bytes(env, 10),
        }
    }

    fn transfer(env: &Env) -> TransferDetails {
        TransferDetails {
            from: Address::generate(env),
            to: Address::generate(env),
            amount: 0,
            asset_contract: Address::generate(env),
        }
    }

    #[test]
    fn test_init() {
        let env = Env::default();
        let contract_id = env.register(KyroVerifier, ());
        let client = KyroVerifierClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let root = bytes(&env, 42);

        assert_eq!(client.try_init(&admin, &root), Ok(Ok(())));

        env.as_contract(&contract_id, || {
            let stored_admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
            let stored_root: BytesN<32> = env
                .storage()
                .persistent()
                .get(&DataKey::SanctionsRoot)
                .unwrap();
            assert_eq!(stored_admin, admin);
            assert_eq!(stored_root, root);
        });
    }

    #[test]
    fn test_nullifier_replay() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(KyroVerifier, ());
        let client = KyroVerifierClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let root = bytes(&env, 42);
        let nullifier = bytes(&env, 11);

        client.init(&admin, &root);
        let first = client.try_verify_and_transfer(
            &proof(&env),
            &public_signals(&env, root.clone(), nullifier.clone()),
            &transfer(&env),
        );
        assert_eq!(first, Ok(Ok(())));

        let second = client.try_verify_and_transfer(
            &proof(&env),
            &public_signals(&env, root, nullifier),
            &transfer(&env),
        );
        assert_eq!(second, Err(Ok(Error::NullifierSpent)));
    }

    #[test]
    fn test_invalid_sanctions_root() {
        let env = Env::default();
        let contract_id = env.register(KyroVerifier, ());
        let client = KyroVerifierClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let root = bytes(&env, 42);

        client.init(&admin, &root);

        let result = client.try_verify_and_transfer(
            &proof(&env),
            &public_signals(&env, bytes(&env, 99), bytes(&env, 11)),
            &transfer(&env),
        );
        assert_eq!(result, Err(Ok(Error::InvalidSanctionsRoot)));
    }
}
