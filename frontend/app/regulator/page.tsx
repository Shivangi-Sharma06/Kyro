"use client";

import { Alert, Button, Paper, Stack, Table, Text, Textarea, Title, Group, Badge, Container } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { decryptPayload, encryptPayload, DEMO_REGULATOR_PRIVATE_KEY, TravelRuleRecord } from "@/lib/viewkey";

function truncate(value: string) {
  return `${value.slice(0, 16)}...${value.slice(-12)}`;
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

export default function RegulatorPage() {
  const [blob, setBlob] = useState("");
  const [privateKey, setPrivateKey] = useState(DEMO_REGULATOR_PRIVATE_KEY);
  const [record, setRecord] = useState<TravelRuleRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const decrypt = async () => {
    if (!blob.trim()) {
      notifications.show({
        color: "yellow",
        message: "Please enter an encrypted compliance payload.",
      });
      return;
    }
    
    setDecrypting(true);
    try {
      setFailed(false);
      // Brief artificial delay to show decrypting animation
      await new Promise((resolve) => setTimeout(resolve, 800));
      const decrypted = await decryptPayload(blob, privateKey);
      setRecord(decrypted);
      notifications.show({
        color: "green",
        title: "Decryption Successful",
        message: "Travel Rule record reconstructed successfully.",
      });
    } catch (err: any) {
      setRecord(null);
      setFailed(true);
      notifications.show({
        color: "red",
        title: "Decryption Failed",
        message: err?.message || "Invalid payload or private key.",
      });
    } finally {
      setDecrypting(false);
    }
  };

  const autofillDemoPayload = async () => {
    try {
      const demoRecord: TravelRuleRecord = {
        originator: {
          name: "Jane Doe",
          address: "123 Cyber Way, Mumbai, India",
          idType: "Passport",
          idValue: "PPT-9876543",
        },
        beneficiary: {
          name: "Bob Smith",
          country: "Germany (DE)",
        },
        amount: 1250.50,
        timestamp: Date.now() - 3600000, // 1 hour ago
        onChainCommitment: "0x24a7223c336df07ac2379bfdf7d8916a409660c94f8dd87e90cfe174dab4f21b",
        nullifier: "0x14a5b3146731668a9358bb48b739bac630ce47344f716156c330bd6435e8b999",
        txHash: "f0f5898d9e2cf1eb2ba261df94fca2818a7a8d8e8b8c8d8f8a8b8c8d8e8f8a2b",
      };

      const encrypted = await encryptPayload(demoRecord);
      setBlob(encrypted);
      setPrivateKey(DEMO_REGULATOR_PRIVATE_KEY);
      setRecord(null);
      setFailed(false);
      
      notifications.show({
        color: "blue",
        title: "Demo Payload Loaded",
        message: "Autofilled with a dynamically encrypted Travel Rule payload.",
      });
    } catch (err) {
      console.error(err);
      notifications.show({
        color: "red",
        message: "Failed to generate demo payload.",
      });
    }
  };

  return (
    <main style={{ minHeight: "calc(100vh - 73px)", padding: "40px 0" }}>
      <Container size="md" style={{ maxWidth: "780px" }}>
        <Stack gap="xl">
          <Group justify="space-between" align="center">
            <Stack gap={4}>
              <Title order={2} style={{ fontSize: "32px", fontWeight: 700 }}>
                Regulator Decryption Portal
              </Title>
              <Text c="dimmed" size="sm">
                Inspect and audit Travel Rule data using your private view key.
              </Text>
            </Stack>
            <Button 
              variant="subtle" 
              color="blue" 
              size="xs" 
              onClick={autofillDemoPayload}
            >
              Autofill Demo Payload
            </Button>
          </Group>

          <Paper className="cyber-card" p="xl">
            <Stack gap="md">
              <Textarea
                label="Encrypted Travel Rule Payload"
                placeholder="Paste the Base64 encrypted compliance payload blob here..."
                minRows={6}
                value={blob}
                onChange={(event) => setBlob(event.currentTarget.value)}
                styles={{
                  input: {
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "12px",
                    color: "#a78bfa"
                  }
                }}
              />
              <Textarea
                label="Regulator Private View Key (Hex)"
                placeholder="Enter regulator private key in hex format..."
                minRows={2}
                value={privateKey}
                onChange={(event) => setPrivateKey(event.currentTarget.value)}
                styles={{
                  input: {
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "13px",
                    color: "#f59e0b"
                  }
                }}
              />
              
              <Button 
                color="blue" 
                onClick={decrypt} 
                loading={decrypting}
                size="md"
                style={{ boxShadow: "0 0 15px rgba(59, 130, 246, 0.2)" }}
              >
                Decrypt Compliance Record
              </Button>
            </Stack>
          </Paper>

          {failed && (
            <Alert color="red" variant="light" title="Decryption Failed">
              The payload could not be decrypted. Please verify that the payload is correct and matches the regulator private view key.
            </Alert>
          )}

          {record && (
            <Stack gap="md">
              <Paper className="cyber-card glow-green" p="xl" style={{ position: "relative" }}>
                <div style={{ position: "absolute", top: "20px", right: "20px" }}>
                  <Badge color="green" variant="filled">Compliance Reconstructed</Badge>
                </div>

                <Title order={3} size="md" c="green.4" mb="md" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                  Decrypted Travel Rule Record
                </Title>

                <Table withTableBorder>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600, width: "220px" }}>Originator Name</Table.Td>
                      <Table.Td>{record.originator.name}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Originator Address</Table.Td>
                      <Table.Td>{record.originator.address}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Originator Identification</Table.Td>
                      <Table.Td>
                        <Badge color="blue" variant="light" mr="xs">{record.originator.idType}</Badge>
                        <Text span className="mono">{record.originator.idValue}</Text>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Beneficiary Name</Table.Td>
                      <Table.Td>{record.beneficiary.name}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Beneficiary Country</Table.Td>
                      <Table.Td>{record.beneficiary.country}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Transfer Amount</Table.Td>
                      <Table.Td fw={700} c="green.4">
                        ${record.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Timestamp</Table.Td>
                      <Table.Td>{formatTimestamp(record.timestamp)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>On-Chain Commitment</Table.Td>
                      <Table.Td className="mono" c="cyan.4">{truncate(record.onChainCommitment)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Nullifier</Table.Td>
                      <Table.Td className="mono" c="cyan.4">{truncate(record.nullifier)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td style={{ fontWeight: 600 }}>Stellar Transaction Hash</Table.Td>
                      <Table.Td className="mono">
                        {record.txHash.startsWith("f0f589") ? (
                          <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>
                            {truncate(record.txHash)} (Simulated Transfer)
                          </Text>
                        ) : (
                          <a 
                            href={`https://stellar.expert/explorer/testnet/tx/${record.txHash}`} 
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: "underline" }}
                          >
                            {truncate(record.txHash)}
                          </a>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>

              <Alert color="green" variant="light">
                <Text size="xs" style={{ lineHeight: "1.5" }}>
                  <strong>Selective Disclosure Verified:</strong> This personal identification record was never written to the public ledger. 
                  It exists off-chain, encrypted specifically to your view key. The on-chain cryptographic commitment 
                  anchors and verifies that this record represents the transaction hash listed above.
                </Text>
              </Alert>
            </Stack>
          )}
        </Stack>
      </Container>
    </main>
  );
}


