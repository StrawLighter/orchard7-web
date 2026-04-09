"use client";

import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const sections = [
  { id: "arrival", label: "Home" },
  { id: "lore", label: "Lore" },
  { id: "gardens", label: "Gardens" },
  { id: "rootwork", label: "Rootwork" },
  { id: "community", label: "Community" },
];

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-o7-dark/80 border-b border-o7-green-mid/20">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <a href="#arrival" className="flex items-center gap-2">
          <AssetImg src="/assets/o7-logo.png" w={32} h={32} fallbackColor="#2D6A4F" label="" />
          <span className="font-pixel text-o7-gold text-xs hidden sm:inline">O7</span>
        </a>

        {/* Nav dots */}
        <nav className="hidden md:flex items-center gap-4">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className="text-xs text-o7-cream/60 hover:text-o7-gold transition font-body">
              {s.label}
            </a>
          ))}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-o7-teal border border-o7-teal/30 rounded-full px-2 py-0.5">DEVNET</span>
          <WalletMultiButton style={{
            fontSize: "0.75rem",
            height: "2rem",
            borderRadius: "0.5rem",
            background: "#2D6A4F",
          }} />
        </div>
      </div>
    </header>
  );
}

/** Image with placeholder fallback */
function AssetImg({ src, w, h, fallbackColor, label }: {
  src: string; w: number; h: number; fallbackColor: string; label: string;
}) {
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <img src={src} alt={label} width={w} height={h}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div className="absolute inset-0 rounded" style={{ background: fallbackColor }}
        aria-hidden="true" />
    </div>
  );
}
