import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "EAM • Cold Storage Digital Twin",
  description: "Pusat kendali penyimpanan dingin dan operasional pabrik",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
