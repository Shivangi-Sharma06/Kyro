#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
PTAU="$BUILD_DIR/powersOfTau28_hez_final_16.ptau"
FRONTEND_PUBLIC_DIR="$(cd "$ROOT_DIR/../frontend" && pwd)/public"
CIRCOM_BIN="${CIRCOM_BIN:-}"
SNARKJS_BIN="${SNARKJS_BIN:-$ROOT_DIR/node_modules/.bin/snarkjs}"

mkdir -p "$BUILD_DIR"

if [ -z "$CIRCOM_BIN" ]; then
  if command -v circom >/dev/null 2>&1; then
    CIRCOM_BIN="circom"
  elif [ -x "$HOME/.cargo/bin/circom" ]; then
    CIRCOM_BIN="$HOME/.cargo/bin/circom"
  else
    echo "circom compiler not found. Install Circom 2 or set CIRCOM_BIN=/path/to/circom." >&2
    exit 1
  fi
fi

"$CIRCOM_BIN" "$ROOT_DIR/Kyro.circom" \
  --r1cs \
  --wasm \
  --sym \
  -o "$BUILD_DIR"

if [ ! -f "$PTAU" ]; then
  curl -L \
    "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau" \
    -o "$PTAU"
fi

if [ ! -s "$PTAU" ] || [ "$(wc -c < "$PTAU")" -lt 1000000 ]; then
  rm -f "$PTAU"
  "$SNARKJS_BIN" powersoftau new bn128 16 "$BUILD_DIR/pot16_0000.ptau" -v
  "$SNARKJS_BIN" powersoftau contribute "$BUILD_DIR/pot16_0000.ptau" "$BUILD_DIR/pot16_0001.ptau" \
    --name="Kyro Hackathon" \
    -e="kyro-hackathon-entropy-2026"
  "$SNARKJS_BIN" powersoftau prepare phase2 "$BUILD_DIR/pot16_0001.ptau" "$PTAU" -v
fi

"$SNARKJS_BIN" groth16 setup "$BUILD_DIR/Kyro.r1cs" "$PTAU" "$BUILD_DIR/Kyro_0000.zkey"
"$SNARKJS_BIN" zkey contribute "$BUILD_DIR/Kyro_0000.zkey" "$BUILD_DIR/Kyro_final.zkey" \
  --name="Kyro Hackathon" \
  -e="kyro-hackathon-entropy-2026"
"$SNARKJS_BIN" zkey export verificationkey "$BUILD_DIR/Kyro_final.zkey" "$BUILD_DIR/verification_key.json"

"$SNARKJS_BIN" groth16 fullprove "$ROOT_DIR/input.json" "$BUILD_DIR/Kyro_js/Kyro.wasm" "$BUILD_DIR/Kyro_final.zkey" "$BUILD_DIR/proof.json" "$BUILD_DIR/public.json"
"$SNARKJS_BIN" groth16 verify "$BUILD_DIR/verification_key.json" "$BUILD_DIR/public.json" "$BUILD_DIR/proof.json"

mkdir -p "$FRONTEND_PUBLIC_DIR"
cp "$BUILD_DIR/Kyro_js/Kyro.wasm" "$FRONTEND_PUBLIC_DIR/Kyro.wasm"
cp "$BUILD_DIR/Kyro_final.zkey" "$FRONTEND_PUBLIC_DIR/Kyro_final.zkey"
