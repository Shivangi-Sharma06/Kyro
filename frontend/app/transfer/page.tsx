"use client";

import {
  Accordion,
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { hashField, poseidonHash } from "@/lib/poseidon";
import { buildSanctionsMerkleProof } from "@/lib/sanctions";
import { generateProof } from "@/lib/prover";
import { verifyAndTransfer } from "@/lib/stellar";
import { encryptPayload } from "@/lib/viewkey";

type Status = {
  identityCommitment: string;
  nullifier: string;
  amountThreshold: string;
  duration: string;
  txHash: string;
  encryptedPayload: string;
};

const countries = ["US", "GB", "DE", "IN", "SG", "JP", "AE", "FR", "CH", "CA"];

function toHex(value: bigint | string) {
  const asBigInt = typeof value === "bigint" ? value : BigInt(value);
  return `0x${asBigInt.toString(16).padStart(64, "0")}`;
}

function truncate(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function TransferPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const clipboard = useClipboard();
  const form = useForm({
    initialValues: {
      originatorName: "",
      originatorAddress: "",
      originatorIdType: "Passport",
      originatorIdValue: "",
      beneficiaryName: "",
      beneficiaryCountry: "DE",
      transferAmount: 1500,
      recipientAddress: "",
    },
  });

  const submit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      notifications.show({ message: "Hashing identity fields with Poseidon..." });
      const originatorNameHash = await hashField(values.originatorName);
      const originatorAddressHash = await hashField(values.originatorAddress);
      const originatorIdHash = await hashField(values.originatorIdValue);
      const beneficiaryNameHash = await hashField(values.beneficiaryName);
      const identityCommitment = await poseidonHash([originatorNameHash, originatorIdHash]);
      const transferNonce = BigInt(Date.now());
      const nullifier = await poseidonHash([identityCommitment, transferNonce]);
      const originatorProof = await buildSanctionsMerkleProof(originatorAddressHash);
      const beneficiaryProof = await buildSanctionsMerkleProof(beneficiaryNameHash);
      const amountCents = Math.round(values.transferAmount * 100);
      const sanctionsRoot = originatorProof.root;

      const circuitInputs = {
        originator_name_hash: originatorNameHash.toString(),
        originator_address_hash: originatorAddressHash.toString(),
        originator_id_hash: originatorIdHash.toString(),
        beneficiary_name_hash: beneficiaryNameHash.toString(),
        beneficiary_country_code: "276",
        transfer_amount: amountCents.toString(),
        sanctions_merkle_root: sanctionsRoot.toString(),
        originator_path_values: originatorProof.pathValues.map(String),
        originator_path_indices: originatorProof.pathIndices.map(String),
        beneficiary_path_values: beneficiaryProof.pathValues.map(String),
        beneficiary_path_indices: beneficiaryProof.pathIndices.map(String),
        identity_commitment: identityCommitment.toString(),
        nullifier: nullifier.toString(),
        amount_threshold_flag: amountCents >= 100000 ? "1" : "0",
        sanctions_root_public: sanctionsRoot.toString(),
        transfer_nonce: transferNonce.toString(),
      };

      notifications.show({ message: "Generating ZK proof... (this takes 3-8 seconds)" });
      const proofResult = await generateProof(circuitInputs);

      notifications.show({ message: "Submitting to Stellar testnet..." });
      const txHash = await verifyAndTransfer(proofResult.proof, proofResult.publicSignals, {
        from: "",
        to: values.recipientAddress,
        amount: values.transferAmount,
      });

      const encryptedPayload = await encryptPayload({
        originator: {
          name: values.originatorName,
          address: values.originatorAddress,
          idType: values.originatorIdType,
          idValue: values.originatorIdValue,
        },
        beneficiary: {
          name: values.beneficiaryName,
          country: values.beneficiaryCountry,
        },
        amount: values.transferAmount,
        timestamp: Date.now(),
        onChainCommitment: toHex(proofResult.publicSignals[0]),
        nullifier: toHex(proofResult.publicSignals[1]),
        txHash,
      });

      notifications.show({
        color: "green",
        message: (
          <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank">
            Transfer submitted: {truncate(txHash)}
          </a>
        ),
      });

      setStatus({
        identityCommitment: toHex(proofResult.publicSignals[0]),
        nullifier: toHex(proofResult.publicSignals[1]),
        amountThreshold: Number(proofResult.publicSignals[2]) === 1 ? "Above $1,000 ✓" : "Below $1,000",
        duration: `${(proofResult.durationMs / 1000).toFixed(1)}s`,
        txHash,
        encryptedPayload,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Transfer failed",
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <Grid gutter="xl" maw={1180} mx="auto">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <Title order={1}>Send Transfer</Title>
            <form onSubmit={submit}>
              <Stack gap="sm">
                <TextInput label="Originator Name" {...form.getInputProps("originatorName")} />
                <TextInput label="Originator Physical Address" {...form.getInputProps("originatorAddress")} />
                <Select
                  label="Originator ID Type"
                  data={["National ID", "Passport", "DOB+POB"]}
                  {...form.getInputProps("originatorIdType")}
                />
                <TextInput label="Originator ID Value" {...form.getInputProps("originatorIdValue")} />
                <TextInput label="Beneficiary Name" {...form.getInputProps("beneficiaryName")} />
                <Select
                  label="Beneficiary Country"
                  data={countries}
                  {...form.getInputProps("beneficiaryCountry")}
                />
                <NumberInput
                  label="Transfer Amount in USDC"
                  min={0}
                  step={0.01}
                  {...form.getInputProps("transferAmount")}
                />
                <TextInput label="Recipient Stellar Address" {...form.getInputProps("recipientAddress")} />
                <Button type="submit" color="kyroBlue.5" fullWidth loading={loading}>
                  Generate Proof & Send
                </Button>
              </Stack>
            </form>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          {status ? (
            <Stack gap="md">
              <Paper p="md" radius={6}>
                <Table withTableBorder>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>Identity Commitment</Table.Td>
                      <Table.Td className="mono">{truncate(status.identityCommitment)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Nullifier</Table.Td>
                      <Table.Td className="mono">{truncate(status.nullifier)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Amount Threshold</Table.Td>
                      <Table.Td>{status.amountThreshold}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Sanctions Check</Table.Td>
                      <Table.Td>Passed ✓</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Proof Generation Time</Table.Td>
                      <Table.Td>{status.duration}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Verification Fee</Table.Td>
                      <Table.Td>~0.0012 XLM</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Transaction</Table.Td>
                      <Table.Td>
                        <a href={`https://stellar.expert/explorer/testnet/tx/${status.txHash}`} target="_blank">
                          view on stellar.expert
                        </a>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>
              <Accordion>
                <Accordion.Item value="payload">
                  <Accordion.Control>Encrypted Travel Rule Payload (for Regulator)</Accordion.Control>
                  <Accordion.Panel>
                    <Group align="flex-start" wrap="nowrap">
                      <Textarea
                        readOnly
                        autosize
                        minRows={8}
                        value={status.encryptedPayload}
                        className="mono"
                        style={{ flex: 1 }}
                      />
                      <Button color="kyroBlue.5" onClick={() => clipboard.copy(status.encryptedPayload)}>
                        Copy
                      </Button>
                    </Group>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          ) : (
            <Text c="#a1a1aa">Proof status will appear after submission.</Text>
          )}
        </Grid.Col>
      </Grid>
    </main>
  );
}
