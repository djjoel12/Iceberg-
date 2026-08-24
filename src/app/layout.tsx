import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iceberg",
  description: "Comparez les prix de transport à Abidjan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
