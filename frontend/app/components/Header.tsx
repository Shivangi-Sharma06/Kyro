"use client";

import { Group, Button, Text, Switch, Container } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Sync demo mode with localStorage
  useEffect(() => {
    const stored = localStorage.getItem("kyro_demo_mode");
    if (stored !== null) {
      setIsDemoMode(stored === "true");
    } else {
      localStorage.setItem("kyro_demo_mode", "true");
    }
  }, []);

  const handleDemoModeChange = (val: boolean) => {
    setIsDemoMode(val);
    localStorage.setItem("kyro_demo_mode", String(val));
    // Trigger custom event so other pages know it changed
    window.dispatchEvent(new Event("kyro_demo_mode_changed"));
  };

  // Check if Freighter is available and retrieve address
  const checkWallet = async () => {
    if (typeof window !== "undefined" && (window as any).freighterApi) {
      try {
        const api = (window as any).freighterApi;
        if (api.isConnected && (await api.isConnected()).isConnected) {
          const access = await api.requestAccess();
          if (access && access.address) {
            setWalletAddress(access.address);
          }
        }
      } catch (err) {
        console.error("Failed to check Freighter wallet:", err);
      }
    }
  };

  useEffect(() => {
    checkWallet();
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined") return;
    const api = (window as any).freighterApi;
    if (!api) {
      alert("Freighter Wallet extension is not installed. Please install it or use Demo Mode.");
      return;
    }
    try {
      const access = await api.requestAccess();
      if (access && access.address) {
        setWalletAddress(access.address);
      }
    } catch (err: any) {
      alert(err.message || "Failed to connect Freighter wallet.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  return (
    <header style={{ 
      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      background: "rgba(8, 10, 15, 0.8)",
      backdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 1000,
      padding: "16px 0"
    }}>
      <Container size="lg">
        <Group justify="space-between" h="100%">
          <Group gap="xs">
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                boxShadow: "0 0 10px rgba(0, 242, 254, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Text size="xs" fw="bold" c="dark.9" style={{ fontSize: "10px" }}>K</Text>
              </div>
              <Text fw={700} size="xl" className="text-gradient-cyan" style={{ letterSpacing: "0.5px" }}>
                Kyro
              </Text>
            </Link>
            <span className="pulse-dot green" style={{ marginLeft: "4px" }}></span>
            <Text size="xs" c="dimmed" style={{ letterSpacing: "1px", textTransform: "uppercase" }}>
              Travel Rule ZK Shield
            </Text>
          </Group>

          <Group gap="md">
            <Button 
              component={Link} 
              href="/transfer" 
              variant={pathname === "/transfer" ? "filled" : "subtle"} 
              color="blue"
              size="sm"
            >
              Send Transfer
            </Button>
            <Button 
              component={Link} 
              href="/regulator" 
              variant={pathname === "/regulator" ? "filled" : "subtle"} 
              color="blue"
              size="sm"
            >
              Regulator View
            </Button>
          </Group>

          <Group gap="lg">
            <Switch
              label="Demo Mode (Mock)"
              size="xs"
              checked={isDemoMode}
              onChange={(event) => handleDemoModeChange(event.currentTarget.checked)}
              styles={{
                label: { color: isDemoMode ? "#38bdf8" : "#94a3b8", fontWeight: 600 }
              }}
            />

            {walletAddress ? (
              <Button 
                variant="outline" 
                color="green" 
                size="xs"
                onClick={disconnectWallet}
                style={{ 
                  borderColor: "rgba(16, 185, 129, 0.3)",
                  background: "rgba(16, 185, 129, 0.05)"
                }}
              >
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </Button>
            ) : (
              <Button 
                variant="outline" 
                color="blue" 
                size="xs"
                onClick={connectWallet}
                style={{ 
                  borderColor: "rgba(59, 130, 246, 0.3)",
                  background: "rgba(59, 130, 246, 0.05)"
                }}
              >
                Connect Wallet
              </Button>
            )}
          </Group>
        </Group>
      </Container>
    </header>
  );
}
