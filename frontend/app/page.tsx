import { Button, Container, Grid, Group, Paper, Stack, Text, Title, ThemeIcon } from "@mantine/core";
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "calc(100vh - 73px)", display: "flex", alignItems: "center", padding: "64px 0" }}>
      <Container size="lg">
        <Grid gutter={48} align="center">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="xl">
              <Group gap="xs">
                <span className="pulse-dot blue"></span>
                <Text size="xs" fw={700} c="blue.4" style={{ letterSpacing: "2px", textTransform: "uppercase" }}>
                  Stellar Hacks: Real-World ZK Hackathon
                </Text>
              </Group>

              <Stack gap="xs">
                <Title order={1} style={{ fontSize: "56px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-1px" }}>
                  Selective Disclosure for the{" "}
                  <span className="text-gradient-cyan">FATF Travel Rule</span>
                </Title>
              </Stack>

              <Text size="lg" c="zinc.3" style={{ lineHeight: 1.6, fontSize: "19px", maxWidth: "600px" }}>
                Kyro bridges the gap between institutional compliance and user privacy. 
                Prove compliance to verifiers and regulators using in-browser ZK proofs, 
                without exposing any personally identifiable information (PII) on the public Stellar chain.
              </Text>

              <Group gap="md">
                <Button 
                  component={Link} 
                  href="/transfer" 
                  size="lg" 
                  color="blue"
                  style={{
                    boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
                    height: "50px",
                    padding: "0 30px"
                  }}
                >
                  Send Shielded Transfer
                </Button>
                <Button 
                  component={Link} 
                  href="/regulator" 
                  variant="outline" 
                  color="blue" 
                  size="lg"
                  style={{
                    height: "50px",
                    padding: "0 30px",
                    borderColor: "rgba(59, 130, 246, 0.4)"
                  }}
                >
                  Regulator Portal
                </Button>
              </Group>

              <Group gap="xl" mt="xl">
                <div>
                  <Text size="xl" fw={800} c="white">3.2s</Text>
                  <Text size="xs" c="dimmed">Proof Gen Time</Text>
                </div>
                <div style={{ width: "1px", height: "40px", backgroundColor: "rgba(255, 255, 255, 0.1)" }}></div>
                <div>
                  <Text size="xl" fw={800} c="white">~0.0012 XLM</Text>
                  <Text size="xs" c="dimmed">On-Chain Gas Cost</Text>
                </div>
                <div style={{ width: "1px", height: "40px", backgroundColor: "rgba(255, 255, 255, 0.1)" }}></div>
                <div>
                  <Text size="xl" fw={800} c="white">100%</Text>
                  <Text size="xs" c="dimmed">PII Off-Chain</Text>
                </div>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper className="cyber-card glow-blue" p="xl" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute",
                top: "-150px",
                right: "-150px",
                width: "300px",
                height: "300px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
                filter: "blur(40px)"
              }}></div>

              <Stack gap="lg">
                <Text fw={700} size="md" c="blue.4" style={{ letterSpacing: "1px", textTransform: "uppercase" }}>
                  How It Works
                </Text>

                <div style={{ position: "relative", paddingLeft: "32px" }}>
                  <div style={{ position: "absolute", left: "0", top: "4px", width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #00f2fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00f2fe" }}></div>
                  </div>
                  {/* Vertical connector line */}
                  <div style={{ position: "absolute", left: "7px", top: "24px", width: "2px", height: "calc(100% - 10px)", background: "dashed rgba(0, 242, 254, 0.3)", borderLeft: "2px dashed rgba(0, 242, 254, 0.3)" }}></div>
                  <Text fw={600} c="white" size="sm">1. Off-Chain Proving</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    VASP hashes the sender/receiver KYC data using Poseidon. It generates a Groth16 ZK proof proving the fields meet criteria & parties are not sanctioned.
                  </Text>
                </div>

                <div style={{ position: "relative", paddingLeft: "32px" }}>
                  <div style={{ position: "absolute", left: "0", top: "4px", width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1" }}></div>
                  </div>
                  <div style={{ position: "absolute", left: "7px", top: "24px", width: "2px", height: "calc(100% - 10px)", background: "dashed rgba(99, 102, 241, 0.3)", borderLeft: "2px dashed rgba(99, 102, 241, 0.3)" }}></div>
                  <Text fw={600} c="white" size="sm">2. On-Chain Verification</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    The Soroban contract receives the proof & public signals. It calls CAP-0074 & CAP-0080 host functions natively to execute the pairing check & MSM.
                  </Text>
                </div>

                <div style={{ position: "relative", paddingLeft: "32px" }}>
                  <div style={{ position: "absolute", left: "0", top: "4px", width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }}></div>
                  </div>
                  <Text fw={600} c="white" size="sm">3. Selective Audit</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    The originator encrypts PII to the regulator's ECIES public key. Under legal subpoena, the regulator decrypts the off-chain payload to rebuild the compliance record.
                  </Text>
                </div>

                <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "12px" }}>
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    Built with Circom 2.0 · Soroban (Rust) · Protocol 26 Primitives (BN254 elliptic curves, Poseidon hash, MSM verification)
                  </Text>
                </div>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Container>
    </main>
  );
}
