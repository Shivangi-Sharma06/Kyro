"use client";

import { Alert, Button, Paper, Stack, Table, Text, Textarea, Title } from "@mantine/core";
import { useState } from "react";
import { decryptPayload, DEMO_REGULATOR_PRIVATE_KEY, TravelRuleRecord } from "@/lib/viewkey";

function truncate(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default function RegulatorPage() {
  const [blob, setBlob] = useState("");
  const [privateKey, setPrivateKey] = useState(DEMO_REGULATOR_PRIVATE_KEY);
  const [record, setRecord] = useState<TravelRuleRecord | null>(null);
  const [failed, setFailed] = useState(false);

  const decrypt = async () => {
    try {
      setFailed(false);
      setRecord(await decryptPayload(blob, privateKey));
    } catch {
      setRecord(null);
      setFailed(true);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Stack maw={680} w="100%" gap="md">
        <Title order={1}>Regulator View</Title>
        <Text c="#a1a1aa">Decrypt a Travel Rule payload using your view key.</Text>
        <Textarea
          label="Encrypted payload"
          minRows={6}
          value={blob}
          onChange={(event) => setBlob(event.currentTarget.value)}
        />
        <Textarea
          label="Regulator private key in hex"
          minRows={3}
          value={privateKey}
          onChange={(event) => setPrivateKey(event.currentTarget.value)}
          className="mono"
        />
        <Button color="kyroBlue.5" onClick={decrypt}>
          Decrypt Record
        </Button>
        <Alert color="blue" variant="light">
          Demo: Use the pre-funded test regulator keypair from the README to decrypt any payload generated on the transfer page.
        </Alert>
        {failed ? (
          <Alert color="red">Decryption failed — check that the payload and private key match.</Alert>
        ) : null}
        {record ? (
          <Stack gap="md">
            <Paper p="md" radius={6}>
              <Table withTableBorder>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Originator Name</Table.Td>
                    <Table.Td>{record.originator.name}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Originator Address</Table.Td>
                    <Table.Td>{record.originator.address}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Originator ID</Table.Td>
                    <Table.Td>
                      {record.originator.idType}: {record.originator.idValue}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Beneficiary Name</Table.Td>
                    <Table.Td>{record.beneficiary.name}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Beneficiary Country</Table.Td>
                    <Table.Td>{record.beneficiary.country}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Transfer Amount</Table.Td>
                    <Table.Td>${record.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Transfer Timestamp</Table.Td>
                    <Table.Td>{formatTimestamp(record.timestamp)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>On-chain Commitment</Table.Td>
                    <Table.Td className="mono">{truncate(record.onChainCommitment)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Nullifier</Table.Td>
                    <Table.Td className="mono">{truncate(record.nullifier)}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>
            <Alert color="green">
              This record was never on-chain. It was reconstructed from an encrypted payload using the regulator's view key. The on-chain commitment anchors it to the Stellar transaction.
            </Alert>
          </Stack>
        ) : null}
      </Stack>
    </main>
  );
}
