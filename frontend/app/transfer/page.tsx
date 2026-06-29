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
  Badge,
  Alert,
  Switch,
  Container,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useState, useEffect, useRef } from "react";
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

const countries = [
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "DE", label: "Germany (DE)" },
  { value: "IN", label: "India (IN)" },
  { value: "SG", label: "Singapore (SG)" },
  { value: "JP", label: "Japan (JP)" },
  { value: "AE", label: "United Arab Emirates (AE)" },
  { value: "FR", label: "France (FR)" },
  { value: "CH", label: "Switzerland (CH)" },
  { value: "CA", label: "Canada (CA)" },
];

function toHex(value: bigint | string) {
  const asBigInt = typeof value === "bigint" ? value : BigInt(value);
  return `0x${asBigInt.toString(16).padStart(64, "0")}`;
}

function truncate(value: string) {
  return `${value.slice(0, 12)}...${value.slice(-10)}`;
}

export default function TransferPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const clipboard = useClipboard();

  // Load and listen to Demo Mode from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("kyro_demo_mode");
    if (stored !== null) {
      setDemoMode(stored === "true");
    }

    const handleDemoChange = () => {
      const updated = localStorage.getItem("kyro_demo_mode");
      setDemoMode(updated === "true");
    };

    window.addEventListener("kyro_demo_mode_changed", handleDemoChange);
    return () => window.removeEventListener("kyro_demo_mode_changed", handleDemoChange);
  }, []);

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
    validate: {
      originatorName: (val) => (!val ? "Originator Name is required" : null),
      originatorAddress: (val) => (!val ? "Originator Address is required" : null),
      originatorIdValue: (val) => (!val ? "ID Value is required" : null),
      beneficiaryName: (val) => (!val ? "Beneficiary Name is required" : null),
      recipientAddress: (val) => {
        if (!val) return "Recipient Stellar Address is required";
        if (!val.startsWith("G") || val.length !== 56) {
          return "Invalid Stellar Address format (must start with G, 56 characters)";
        }
        return null;
      },
    },
  });

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    setTerminalLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  const autofillData = () => {
    form.setValues({
      originatorName: "Jane Doe",
      originatorAddress: "123 Cyber Way, Mumbai, India",
      originatorIdType: "Passport",
      originatorIdValue: "PPT-9876543",
      beneficiaryName: "Bob Smith",
      beneficiaryCountry: "DE",
      transferAmount: 1250.50,
      recipientAddress: "GCTDFPNEUTZ6W2XJUPJZSB52T63PZ7QWURQJZSM6HHE3K3V5X46IWY2H",
    });
    notifications.show({
      color: "blue",
      title: "Demo Data Loaded",
      message: "Form autofilled with compliant Travel Rule credentials.",
    });
  };

  const submit = form.onSubmit(async (values) => {
    setLoading(true);
    setStatus(null);
    setTerminalLogs([]);
    
    try {
      addLog("Initializing Kyro Groth16 Prover...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      addLog("Hashing private identity parameters with Poseidon...");
      const originatorNameHash = await hashField(values.originatorName);
      const originatorAddressHash = await hashField(values.originatorAddress);
      const originatorIdHash = await hashField(values.originatorIdValue);
      const beneficiaryNameHash = await hashField(values.beneficiaryName);
      
      const identityCommitment = await poseidonHash([originatorNameHash, originatorIdHash]);
      const transferNonce = BigInt(Date.now());
      const nullifier = await poseidonHash([identityCommitment, transferNonce]);
      
      addLog(`Identity Commitment: ${toHex(identityCommitment).slice(0, 16)}...`);
      addLog(`Nullifier: ${toHex(nullifier).slice(0, 16)}...`);
      await new Promise((resolve) => setTimeout(resolve, 500));

      addLog("Building Merkle exclusion proofs against OFAC list...");
      const originatorProof = await buildSanctionsMerkleProof(originatorAddressHash);
      const beneficiaryProof = await buildSanctionsMerkleProof(beneficiaryNameHash);
      const amountCents = Math.round(values.transferAmount * 100);
      const sanctionsRoot = originatorProof.root;
      
      addLog(`Sanctions Tree Root: ${toHex(sanctionsRoot).slice(0, 16)}...`);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const circuitInputs = {
        originator_name_hash: originatorNameHash.toString(),
        originator_address_hash: originatorAddressHash.toString(),
        originator_id_hash: originatorIdHash.toString(),
        beneficiary_name_hash: beneficiaryNameHash.toString(),
        beneficiary_country_code: "276", // ISO 3166-1 numeric for Germany (DE)
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

      addLog("Loading WebAssembly witness calculator & ZKey parameters...");
      addLog("Executing SnarkJS Groth16 Prover (FullProve)...");
      const proofResult = await generateProof(circuitInputs);
      
      addLog(`Groth16 proof successfully generated locally in ${(proofResult.durationMs / 1000).toFixed(2)}s`);
      addLog(`Proof elements (pi_a, pi_b, pi_c) computed.`);
      await new Promise((resolve) => setTimeout(resolve, 600));

      let txHash = "";
      if (demoMode) {
        addLog("[Demo Mode] Simulating transaction verify_and_transfer on Soroban...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // Generate mock transaction hash
        txHash = "f0f5898d9e2cf1eb2ba261df94fca2818a7a8d8e8b8c8d8f8a8b8c8d8e8f8a2b";
        addLog(`[Demo Mode] Transaction verified & submitted. Hash: ${truncate(txHash)}`);
      } else {
        addLog("Connecting to Soroban Testnet RPC...");
        addLog("Requesting Freighter Wallet signature for verify_and_transfer...");
        txHash = await verifyAndTransfer(proofResult.proof, proofResult.publicSignals, {
          from: "",
          to: values.recipientAddress,
          amount: values.transferAmount,
        });
        addLog(`On-chain transaction confirmed! Hash: ${txHash}`);
      }

      addLog("Encrypting compliance payload to Regulator's ECIES Public Key...");
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
      addLog("Payload encrypted. Travel Rule record anchored to on-chain commitment.");
      addLog("Prover sequence completed successfully.");

      notifications.show({
        color: "green",
        title: "Compliance Verified",
        message: demoMode 
          ? `[Demo Mode] Shielded transfer simulated: ${truncate(txHash)}`
          : `Shielded transfer submitted: ${truncate(txHash)}`,
      });

      setStatus({
        identityCommitment: toHex(proofResult.publicSignals[0]),
        nullifier: toHex(proofResult.publicSignals[1]),
        amountThreshold: Number(proofResult.publicSignals[2]) === 1 ? "Above $1,000 ✓" : "Below $1,000",
        duration: `${(proofResult.durationMs / 1000).toFixed(2)}s`,
        txHash,
        encryptedPayload,
      });

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Compilation or network failure";
      addLog(`[Error] Prover failed: ${errMsg}`);
      notifications.show({
        color: "red",
        title: "Submission Error",
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <main style={{ minHeight: "calc(100vh - 73px)", padding: "40px 0" }}>
      <Container size="lg">
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={2} style={{ fontSize: "28px", fontWeight: 700 }}>
                  Shielded Stablecoin Transfer
                </Title>
                <Button 
                  variant="subtle" 
                  color="blue" 
                  size="xs" 
                  onClick={autofillData}
                  disabled={loading}
                >
                  Autofill Demo Data
                </Button>
              </Group>

              {demoMode && (
                <Alert color="blue" variant="light">
                  <Group gap="xs">
                    <span className="pulse-dot blue"></span>
                    <Text size="xs" fw={600}>
                      Demo Mode Active: In-browser ZK proofs are real, but the final Soroban submission is simulated.
                    </Text>
                  </Group>
                </Alert>
              )}

              <Paper className="cyber-card" p="xl">
                <form onSubmit={submit}>
                  <Stack gap="md">
                    <Text fw={600} size="sm" c="blue.4">Sender (Originator) Details</Text>
                    
                    <Grid gutter="sm">
                      <Grid.Col span={6}>
                        <TextInput 
                          label="Full Legal Name" 
                          placeholder="e.g. Jane Doe"
                          {...form.getInputProps("originatorName")} 
                          disabled={loading}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput 
                          label="Physical Address" 
                          placeholder="City, Country"
                          {...form.getInputProps("originatorAddress")} 
                          disabled={loading}
                        />
                      </Grid.Col>
                    </Grid>

                    <Grid gutter="sm">
                      <Grid.Col span={6}>
                        <Select
                          label="ID Document Type"
                          data={["Passport", "National ID", "DOB+POB"]}
                          {...form.getInputProps("originatorIdType")}
                          disabled={loading}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput 
                          label="Document ID Value" 
                          placeholder="e.g. Passport Number"
                          {...form.getInputProps("originatorIdValue")} 
                          disabled={loading}
                        />
                      </Grid.Col>
                    </Grid>

                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", margin: "8px 0" }}></div>
                    <Text fw={600} size="sm" c="blue.4">Receiver (Beneficiary) Details</Text>

                    <Grid gutter="sm">
                      <Grid.Col span={6}>
                        <TextInput 
                          label="Beneficiary Legal Name" 
                          placeholder="e.g. Bob Smith"
                          {...form.getInputProps("beneficiaryName")} 
                          disabled={loading}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Select
                          label="Beneficiary Country"
                          data={countries}
                          {...form.getInputProps("beneficiaryCountry")}
                          disabled={loading}
                        />
                      </Grid.Col>
                    </Grid>

                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", margin: "8px 0" }}></div>
                    <Text fw={600} size="sm" c="blue.4">Payment Details</Text>

                    <Grid gutter="sm">
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Amount (USDC)"
                          min={0.01}
                          step={100}
                          {...form.getInputProps("transferAmount")}
                          disabled={loading}
                        />
                      </Grid.Col>
                      <Grid.Col span={8}>
                        <TextInput 
                          label="Recipient Stellar Address" 
                          placeholder="Starts with G..."
                          {...form.getInputProps("recipientAddress")} 
                          disabled={loading}
                        />
                      </Grid.Col>
                    </Grid>

                    <Button 
                      type="submit" 
                      color="blue" 
                      fullWidth 
                      loading={loading}
                      mt="md"
                      size="md"
                      style={{ boxShadow: "0 0 15px rgba(59, 130, 246, 0.2)" }}
                    >
                      Verify Compliance & Shield Transfer
                    </Button>
                  </Stack>
                </form>
              </Paper>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md" h="100%">
              <Title order={2} style={{ fontSize: "28px", fontWeight: 700 }}>
                ZK Prover Output
              </Title>

              {loading ? (
                <Paper className="cyber-card glow-blue" p="md" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "400px" }}>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600} c="blue.4">Prover Cryptographic Console</Text>
                    <Badge color="blue" variant="outline" className="pulse-dot blue"></Badge>
                  </Group>
                  <div className="terminal-box" style={{ flex: 1, overflowY: "auto", minHeight: "350px", maxHeight: "450px" }}>
                    {terminalLogs.map((log, i) => (
                      <div key={i} style={{ marginBottom: "6px" }}>{log}</div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                </Paper>
              ) : status ? (
                <Stack gap="md" style={{ flex: 1 }}>
                  <Paper className="cyber-card glow-green" p="xl" style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute",
                      top: "20px",
                      right: "20px"
                    }}>
                      <Badge color="green" variant="filled">Shield Active</Badge>
                    </div>

                    <Title order={3} size="md" c="green.4" mb="md" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                      Verification Audit Trail
                    </Title>

                    <Table withTableBorder>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Identity Commitment</Table.Td>
                          <Table.Td className="mono" c="cyan.4">{truncate(status.identityCommitment)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Nullifier (Replay Guard)</Table.Td>
                          <Table.Td className="mono" c="cyan.4">{truncate(status.nullifier)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Amount Threshold</Table.Td>
                          <Table.Td>
                            <Badge color="teal" variant="light">{status.amountThreshold}</Badge>
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Sanctions Merkle Check</Table.Td>
                          <Table.Td c="green.4" style={{ fontWeight: 600 }}>Passed ✓</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Proof Generation Time</Table.Td>
                          <Table.Td>{status.duration}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Estimated Fee</Table.Td>
                          <Table.Td c="dimmed">~0.0012 XLM</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ fontWeight: 600 }}>Stellar Transaction</Table.Td>
                          <Table.Td>
                            {demoMode ? (
                              <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>Simulated (Demo Mode)</Text>
                            ) : (
                              <a 
                                href={`https://stellar.expert/explorer/testnet/tx/${status.txHash}`} 
                                target="_blank"
                                rel="noreferrer"
                                style={{ textDecoration: "underline", fontWeight: 600 }}
                              >
                                view on stellar.expert
                              </a>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Paper>

                  <Accordion defaultValue="payload" variant="separated">
                    <Accordion.Item value="payload" style={{ 
                      background: "rgba(13, 17, 24, 0.7)", 
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "8px"
                    }}>
                      <Accordion.Control style={{ color: "#38bdf8", fontWeight: 600 }}>
                        Encrypted Regulator Compliance Payload
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          <Text size="xs" c="dimmed">
                            This payload contains the full Travel Rule details encrypted using the regulator's view key. Share this securely off-chain.
                          </Text>
                          <Group align="flex-start" wrap="nowrap">
                            <Textarea
                              readOnly
                              autosize
                              minRows={6}
                              maxRows={10}
                              value={status.encryptedPayload}
                              className="mono"
                              styles={{
                                input: {
                                  fontSize: "11px",
                                  lineHeight: "1.4",
                                  color: "#a78bfa !important"
                                }
                              }}
                              style={{ flex: 1 }}
                            />
                            <Button 
                              color="blue" 
                              onClick={() => {
                                clipboard.copy(status.encryptedPayload);
                                notifications.show({ message: "Payload copied to clipboard!" });
                              }}
                              style={{ height: "45px" }}
                            >
                              Copy
                            </Button>
                          </Group>
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                </Stack>
              ) : (
                <Paper className="cyber-card" p="xl" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
                  <Stack align="center" gap="md" style={{ maxWidth: "320px", textAlign: "center" }}>
                    <div style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      border: "2px dashed rgba(255, 255, 255, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      animation: "spin 20s linear infinite"
                    }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        boxShadow: "0 0 10px #3b82f6"
                      }}></div>
                    </div>
                    <Text fw={600} size="sm" c="white">Prover Engine Idle</Text>
                    <Text size="xs" c="dimmed">
                      Submit the form to generate the ZK compliance proof. Proving is done entirely in your browser sandbox.
                    </Text>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </main>
  );
}
