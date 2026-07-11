import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ARGUS Backend API",
  description: "AI-Powered Multi-Agent Crisis Command Platform — API Server",
};

/**
 * Root layout required by Next.js App Router.
 * This backend is API-only; no UI is rendered.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
