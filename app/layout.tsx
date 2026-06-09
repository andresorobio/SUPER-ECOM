import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ODM Sourcing Intelligence Agent",
  description:
    "Autonomous dropshipping product validation & ODM factory sourcing agent."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
