import { Button, Group, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Stack maw={680} align="center" gap="lg" ta="center">
        <Title order={1} style={{ fontSize: 48, fontWeight: 600, letterSpacing: 0 }}>
          Kyro
        </Title>
        <Text c="#ffffff" size="lg">
          Kyro proves a cross-border stablecoin transfer is FATF Travel Rule compliant using a
          Groth16 ZK proof without revealing any PII on-chain.
        </Text>
        <Text c="#ffffff" size="lg">
          Selective disclosure via a view key lets regulators reconstruct the full record on demand.
        </Text>
        <Group>
          <Button component={Link} href="/transfer" color="kyroBlue.5">
            Send Transfer
          </Button>
          <Button component={Link} href="/regulator" variant="outline" color="kyroBlue.5">
            Regulator View
          </Button>
        </Group>
        <Text c="#a1a1aa" size="sm">
          Built for Stellar Hacks: Real-World ZK Hackathon | Uses CAP-0074 · CAP-0075 · CAP-0080
        </Text>
      </Stack>
    </main>
  );
}
