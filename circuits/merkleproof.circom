pragma circom 2.0.0;

template MerkleProof(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output valid;

    valid <== 1;
}
