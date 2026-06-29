import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Inter, JetBrains_Mono } from "next/font/google";
import Header from "./components/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const theme = createTheme({
  fontFamily: "var(--font-inter)",
  fontFamilyMonospace: "var(--font-mono)",
  primaryColor: "kyroBlue",
  colors: {
    dark: [
      "#ffffff",
      "#f4f4f5",
      "#e4e4e7",
      "#d4d4d8",
      "#a1a1aa",
      "#71717a",
      "#3f3f46",
      "#27272a",
      "#161a1f",
      "#0d0f12",
    ],
    kyroBlue: [
      "#eff6ff",
      "#dbeafe",
      "#bfdbfe",
      "#93c5fd",
      "#60a5fa",
      "#3b82f6",
      "#2563eb",
      "#1d4ed8",
      "#1e40af",
      "#1e3a8a",
    ],
  },
  components: {
    Button: {
      defaultProps: {
        radius: 6,
      },
    },
    Paper: {
      defaultProps: {
        bg: "#161a1f",
        shadow: "none",
      },
    },
  },
});

export const metadata = {
  title: "Kyro - Travel Rule ZK Shield",
  description: "ZK-powered FATF Travel Rule compliance and selective disclosure on Stellar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Notifications position="top-right" />
          {/* <Header /> */}
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
