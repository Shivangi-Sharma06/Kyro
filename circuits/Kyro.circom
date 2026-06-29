pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "merkleproof.circom";

template SelectByIndex() {
    signal input left;
    signal input right;
    signal input index;
    signal output out;
    signal diff;
    signal selected_delta;

    index * (index - 1) === 0;
    diff <== right - left;
    selected_delta <== index * diff;
    out <== left + selected_delta;
}

template KyroMerklePath(merkle_depth) {
    signal input leaf;
    signal input root;
    signal input path_values[merkle_depth];
    signal input path_indices[merkle_depth];

    signal current[merkle_depth + 1];
    signal left[merkle_depth];
    signal right[merkle_depth];
    component left_selectors[merkle_depth];
    component right_selectors[merkle_depth];
    component hashers[merkle_depth];

    current[0] <== leaf;

    for (var i = 0; i < merkle_depth; i++) {
        path_indices[i] * (path_indices[i] - 1) === 0;

        left_selectors[i] = SelectByIndex();
        left_selectors[i].left <== current[i];
        left_selectors[i].right <== path_values[i];
        left_selectors[i].index <== path_indices[i];
        left[i] <== left_selectors[i].out;

        right_selectors[i] = SelectByIndex();
        right_selectors[i].left <== path_values[i];
        right_selectors[i].right <== current[i];
        right_selectors[i].index <== path_indices[i];
        right[i] <== right_selectors[i].out;

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        current[i + 1] <== hashers[i].out;
    }

    current[merkle_depth] === root;
}

template KyroCompliance(merkle_depth) {
    signal input originator_name_hash;
    signal input originator_address_hash;
    signal input originator_id_hash;
    signal input beneficiary_name_hash;
    signal input beneficiary_country_code;
    signal input transfer_amount;
    signal input sanctions_merkle_root;
    signal input originator_path_values[merkle_depth];
    signal input originator_path_indices[merkle_depth];
    signal input beneficiary_path_values[merkle_depth];
    signal input beneficiary_path_indices[merkle_depth];

    signal input identity_commitment;
    signal input nullifier;
    signal input amount_threshold_flag;
    signal input sanctions_root_public;
    signal input transfer_nonce;

    component identity_hasher = Poseidon(2);
    identity_hasher.inputs[0] <== originator_name_hash;
    identity_hasher.inputs[1] <== originator_id_hash;
    identity_hasher.out === identity_commitment;

    component nullifier_hasher = Poseidon(2);
    nullifier_hasher.inputs[0] <== identity_commitment;
    nullifier_hasher.inputs[1] <== transfer_nonce;
    nullifier_hasher.out === nullifier;

    component threshold = GreaterEqThan(64);
    threshold.in[0] <== transfer_amount;
    threshold.in[1] <== 100000;
    threshold.out === amount_threshold_flag;
    amount_threshold_flag * (amount_threshold_flag - 1) === 0;

    sanctions_merkle_root === sanctions_root_public;

    component country_code_bound = LessThan(16);
    country_code_bound.in[0] <== beneficiary_country_code;
    country_code_bound.in[1] <== 1000;
    country_code_bound.out === 1;

    component originator_path = KyroMerklePath(merkle_depth);
    originator_path.leaf <== originator_address_hash;
    originator_path.root <== sanctions_merkle_root;
    for (var i = 0; i < merkle_depth; i++) {
        originator_path.path_values[i] <== originator_path_values[i];
        originator_path.path_indices[i] <== originator_path_indices[i];
    }

    component beneficiary_path = KyroMerklePath(merkle_depth);
    beneficiary_path.leaf <== beneficiary_name_hash;
    beneficiary_path.root <== sanctions_merkle_root;
    for (var j = 0; j < merkle_depth; j++) {
        beneficiary_path.path_values[j] <== beneficiary_path_values[j];
        beneficiary_path.path_indices[j] <== beneficiary_path_indices[j];
    }

}

component main { public [identity_commitment, nullifier, amount_threshold_flag, sanctions_root_public, transfer_nonce] } = KyroCompliance(4);
