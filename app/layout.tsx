import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pomebrain — A living app-building brain",
  description: "A governed knowledge graph and agent console for building applications.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

