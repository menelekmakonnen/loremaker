import "./globals.css";

export const metadata = {
  title: "Loremaker Universe Vault",
  description:
    "Summon Menelek Makonnen's cinematic mythologies with an interactive archive, battle arena, and AI-powered story tools.",
  metadataBase: new URL("https://loremaker.local"),
  openGraph: {
    title: "Loremaker Universe Vault",
    description:
      "Explore cinematic dossiers, run arena simulations, and tap into Menelek Makonnen's expansive story engine.",
    url: "https://loremaker.local",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased selection:bg-amber-300/30 selection:text-white">{children}</body>
    </html>
  );
}
