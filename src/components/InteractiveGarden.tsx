"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddressSync, getAccount, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { usePrograms } from "@/lib/useAnchor";
import {
  ORCHARD_ID, getGardenPda, getStakerPda, getBluLedgerPda,
  getBankConfigPda, getBankGrienTreasuryPda,
  getTreasurySolPda, getFountainSolPda, getBuybackSolPda, getFountainConfigPda,
  LOCK_TIERS, formatGrien, formatBlu, calculateRipenedBlu,
  getWeeklyRatio, getEarlyUnstakeFee,
} from "@/lib/programs";

// ── Types ────────────────────────────────────────────────────────
interface GardenData {
  totalSolDeposited: number; totalGrienMinted: number; stakerCount: number;
  currentEpoch: number; grienMint: PublicKey | null;
  epochStartTs: number; epochDurationSecs: number; genesisTs: number;
}
interface StakerData {
  depositedSol: number; lockTier: number; lockExpiry: number;
  lockMultiplierBps: number; nextClaimEpoch: number;
}
interface BluData {
  totalEarned: number; totalHarvested: number; batchCount: number;
  batches: { earnedTs: number; totalAmount: number; harvestedAmount: number }[];
}

// ── Hotspot definitions (percentage-based for scaling) ───────────
// Hotspots on the wooden signpost boards — verified with green box overlay on image
const HOTSPOTS = [
  { id: "bank", label: "Village Bank", sub: "Emergency Exit", x: 22.7, y: 41.5, w: 6.2, h: 4.2, glowColor: "rgba(181,133,27,0.4)" },
  { id: "harvest", label: "Harvest Tree", sub: "Claim Rewards", x: 51.1, y: 45.4, w: 6.2, h: 4.2, glowColor: "rgba(181,133,27,0.5)" },
  { id: "groves", label: "Apple Orchard", sub: "Stake SOL", x: 82.3, y: 46.1, w: 6.2, h: 4.2, glowColor: "rgba(45,106,79,0.5)" },
  { id: "cellar", label: "Ancient Cellar", sub: "BluApple Vault", x: 23.5, y: 68.2, w: 6.2, h: 4.2, glowColor: "rgba(100,149,237,0.4)" },
  { id: "fountain", label: "Teal Fountain", sub: "Yield Rewards", x: 42.7, y: 72.1, w: 6.2, h: 4.2, glowColor: "rgba(64,145,108,0.5)" },
  { id: "gate", label: "Apple Orchard", sub: "Unstake SOL", x: 79.1, y: 73.4, w: 6.2, h: 4.2, glowColor: "rgba(45,106,79,0.4)" },
];

export default function InteractiveGarden() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const programs = usePrograms();

  const [gardenData, setGardenData] = useState<GardenData | null>(null);
  const [stakerData, setStakerData] = useState<StakerData | null>(null);
  const [bluData, setBluData] = useState<BluData | null>(null);
  const [grienBalance, setGrienBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [bankTwap, setBankTwap] = useState(0);
  const [bankWeekRedemptions, setBankWeekRedemptions] = useState(0);
  const [treasuryBalances, setTreasuryBalances] = useState({ treasury: 0, fountain: 0, buyback: 0 });
  const [fountainPulses, setFountainPulses] = useState(0);
  const [fountainAccumulated, setFountainAccumulated] = useState(0);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{ type: "success" | "error"; msg: string; sig?: string } | null>(null);

  // Form state
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockTier, setLockTier] = useState(0);
  const [harvestAmount, setHarvestAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!publicKey || !programs || !connection) return;
    try {
      const g = await (programs.orchard.account as any).gardenState.fetch(getGardenPda());
      const grienMint = g.grienMint as PublicKey;
      setGardenData({ totalSolDeposited: g.totalSolDeposited.toNumber(), totalGrienMinted: g.totalGrienMinted.toNumber(), stakerCount: g.stakerCount, currentEpoch: g.currentEpoch.toNumber(), grienMint, epochStartTs: g.epochStartTs.toNumber(), epochDurationSecs: g.epochDurationSecs.toNumber(), genesisTs: g.genesisTs.toNumber() });
      setSolBalance(await connection.getBalance(publicKey));
      try { const s = await (programs.orchard.account as any).stakerAccount.fetch(getStakerPda(publicKey)); setStakerData({ depositedSol: s.depositedSol.toNumber(), lockTier: s.lockTier, lockExpiry: s.lockExpiry.toNumber(), lockMultiplierBps: s.lockMultiplierBps, nextClaimEpoch: s.nextClaimEpoch.toNumber() }); } catch { setStakerData(null); }
      try { const b = await (programs.orchard.account as any).bluLedger.fetch(getBluLedgerPda(publicKey)); setBluData({ totalEarned: b.totalEarned.toNumber(), totalHarvested: b.totalHarvested.toNumber(), batchCount: b.batchCount, batches: (b.batches as any[]).map((x: any) => ({ earnedTs: x.earnedTs.toNumber(), totalAmount: x.totalAmount.toNumber(), harvestedAmount: x.harvestedAmount.toNumber() })) }); } catch { setBluData(null); }
      try { const ata = getAssociatedTokenAddressSync(grienMint, publicKey); const acc = await getAccount(connection, ata); setGrienBalance(Number(acc.amount)); } catch { setGrienBalance(0); }
      try { const bk = await (programs.orchard.account as any).bankConfig.fetch(getBankConfigPda()); setBankTwap(bk.grienTwapPrice.toNumber()); } catch {}
      try { const t = await (programs.orchard.account as any).bankUserTracker.fetch(PublicKey.findProgramAddressSync([Buffer.from("bank-tracker"), publicKey.toBuffer()], ORCHARD_ID)[0]); setBankWeekRedemptions(t.weekRedemptionCount); } catch {}
      try { const [t, f, b] = await Promise.all([connection.getBalance(getTreasurySolPda()), connection.getBalance(getFountainSolPda()), connection.getBalance(getBuybackSolPda())]); setTreasuryBalances({ treasury: t, fountain: f, buyback: b }); } catch {}
      try { const fc = await (programs.orchard.account as any).fountainConfig.fetch(getFountainConfigPda()); setFountainPulses(fc.totalPulses.toNumber()); setFountainAccumulated(fc.accumulated.toNumber()); } catch {}
    } catch (e) { console.error("Fetch:", e); }
  }, [publicKey, programs, connection]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── TX helper ──────────────────────────────────────────────────
  const ensureAta = async () => {
    const mint = gardenData!.grienMint!;
    const ata = getAssociatedTokenAddressSync(mint, publicKey!);
    try { await getAccount(connection, ata); } catch {
      await programs!.provider.sendAndConfirm(new Transaction().add(createAssociatedTokenAccountInstruction(publicKey!, ata, publicKey!, mint)));
    }
    return ata;
  };

  const runTx = async (label: string, fn: () => Promise<string>) => {
    setLoading(true); setTxStatus(null);
    try {
      const sig = await fn();
      setTxStatus({ type: "success", msg: `${label} confirmed!`, sig });
      setStakeAmount(""); setHarvestAmount(""); setRedeemAmount(""); setUnstakeAmount("");
      await fetchAll();
    } catch (e: any) {
      const raw = e?.message || e?.toString() || "Failed";
      let msg = raw.slice(0, 200);
      if (raw.includes("InsufficientRipenedBlu")) msg = "BluApple still in seed period (2 weeks).";
      else if (raw.includes("CannotChangeLockTier")) msg = "Cannot change lock tier while active.";
      else if (raw.includes("User rejected")) msg = "Transaction cancelled.";
      else if (raw.includes("ZeroAmount")) msg = "Amount must be > 0.";
      setTxStatus({ type: "error", msg });
    } finally { setLoading(false); }
  };

  // ── Derived ────────────────────────────────────────────────────
  const nowTs = Math.floor(Date.now() / 1000);
  const ripenedBlu = bluData ? calculateRipenedBlu(bluData.batches, nowTs) : 0;
  const needsCrank = gardenData ? nowTs >= gardenData.epochStartTs + gardenData.epochDurationSecs : false;
  const canClaim = stakerData && gardenData && (stakerData.nextClaimEpoch < gardenData.currentEpoch || needsCrank);
  const isLocked = stakerData ? stakerData.lockExpiry > nowTs : false;
  const earlyFee = stakerData ? getEarlyUnstakeFee(stakerData.lockTier, stakerData.lockExpiry, nowTs) : 0;
  const ratio = gardenData ? getWeeklyRatio(gardenData.genesisTs, nowTs) : { grienPct: 5, bluPct: 95, weekIndex: 1 };
  const lockRemaining = stakerData && isLocked ? stakerData.lockExpiry - nowTs : 0;

  // ── Auto-crank ─────────────────────────────────────────────────
  const autoCrankAndClaim = async () => {
    const ata = await ensureAta();
    if (needsCrank) await programs!.orchard.methods.crankEpoch().accounts({ cranker: publicKey, grienMint: gardenData!.grienMint! } as any).rpc();
    return programs!.orchard.methods.claimRewards().accounts({ staker: publicKey, stakerGrienAta: ata } as any).rpc();
  };

  const claimAll = async () => {
    const ata = await ensureAta();
    let lastSig = "";
    for (let i = 0; i < 10; i++) {
      const now = Math.floor(Date.now() / 1000);
      const g = await (programs!.orchard.account as any).gardenState.fetch(getGardenPda());
      if (now >= g.epochStartTs.toNumber() + g.epochDurationSecs.toNumber())
        await programs!.orchard.methods.crankEpoch().accounts({ cranker: publicKey, grienMint: gardenData!.grienMint! } as any).rpc();
      const s = await (programs!.orchard.account as any).stakerAccount.fetch(getStakerPda(publicKey!));
      const ga = await (programs!.orchard.account as any).gardenState.fetch(getGardenPda());
      if (s.nextClaimEpoch.toNumber() < ga.currentEpoch.toNumber())
        lastSig = await programs!.orchard.methods.claimRewards().accounts({ staker: publicKey, stakerGrienAta: ata } as any).rpc();
      else break;
    }
    return lastSig;
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <section id="gardens" className="relative py-16 px-4">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #1A1A2E 0%, rgba(27,67,50,0.6) 20%, rgba(27,67,50,0.6) 80%, #1A1A2E 100%)" }} />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="font-pixel text-o7-gold text-sm sm:text-base drop-shadow-[0_0_10px_rgba(181,133,27,0.3)]">The Gardens</h2>
          <div className="mt-2 inline-flex items-center gap-2 rpg-panel rounded-full px-4 py-1.5">
            <span className="text-[9px] text-o7-cream/40 font-body">Week {ratio.weekIndex}:</span>
            <span className="text-[10px] text-o7-teal font-pixel">{ratio.grienPct}%</span>
            <span className="text-[9px] text-o7-cream/30">/</span>
            <span className="text-[10px] text-blue-400 font-pixel">{ratio.bluPct}%</span>
            <span className="text-[9px] text-o7-cream/30 font-body">Liquid / Locked</span>
          </div>
        </div>

        {/* ═══ INTERACTIVE GARDEN SCENE ═══ */}
        <div className="relative w-full rounded-lg overflow-hidden border-2 border-o7-green-mid/30" style={{ aspectRatio: "16/9" }}>
          {/* Base image */}
          <img src="/assets/garden-scene.png" alt="The Gardens" className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: "auto" }} />

          {/* ── CSS Animations Layer ── */}
          {/* Fountain — pixel droplet style */}
          {/* Tiny teal droplets rising from spout positions */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
            // Spread across 3 spout points on the fountain
            const spoutX = 43 + (i % 3) * 1.2;
            return (
              <div key={`drop-${i}`} style={{
                position: "absolute", left: `${spoutX}%`, top: "55%",
                width: i < 4 ? 3 : 2, height: i < 4 ? 3 : 2, borderRadius: "50%",
                background: i < 3 ? "rgba(100,230,190,0.9)" : "rgba(64,185,140,0.7)",
                animation: `droplet-rise ${1.8 + (i % 3) * 0.3}s ease-out infinite`,
                animationDelay: `${i * 0.5}s`, pointerEvents: "none",
              }} />
            );
          })}
          {/* Subtle water surface ripples (thin rings, not glow blobs) */}
          {[0, 1, 2].map(i => (
            <div key={`ripple-${i}`} style={{
              position: "absolute", left: "44%", top: "59%",
              width: "3%", height: "1.5%", transform: "translate(-50%, -50%)",
              border: "1px solid rgba(100,220,180,0.25)", borderRadius: "50%",
              animation: `fountain-ripple 3s ease-out infinite`,
              animationDelay: `${i * 1}s`, pointerEvents: "none",
            }} />
          ))}

          {/* Lantern flickers — along the paths */}
          {[[30, 48], [50, 48], [30, 68], [55, 68]].map(([lx, ly], i) => (
            <div key={`lantern-${i}`} className="absolute" style={{ left: `${lx}%`, top: `${ly}%`, width: "3%", height: "4%" }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,200,80,0.6) 0%, transparent 70%)",
                animation: `lantern-flicker ${1.4 + i * 0.2}s ease-in-out infinite`,
              }} />
            </div>
          ))}

          {/* Mushroom glows — bottom edges */}
          {[[25, 82], [60, 82], [82, 75]].map(([mx, my], i) => (
            <div key={`mush-${i}`} className="absolute" style={{ left: `${mx}%`, top: `${my}%`, width: "4%", height: "5%" }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(64,145,108,0.4) 0%, transparent 70%)",
                animation: `mushroom-glow ${3 + i * 0.5}s ease-in-out infinite`,
              }} />
            </div>
          ))}

          {/* Golden harvest particles — from the big tree */}
          {[0, 1, 2, 3, 4].map(i => (
            <div key={`gold-${i}`} style={{
              position: "absolute", left: `${38 + i * 4}%`, top: "5%",
              width: 5, height: 5, borderRadius: "50%", background: "rgba(181,133,27,0.7)",
              animation: `gold-fall ${4 + i * 0.5}s ease-in infinite`, animationDelay: `${i * 0.9}s`,
            }} />
          ))}

          {/* Fireflies */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`fly-${i}`} className="absolute" style={{
              left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 80}%`,
              width: 3, height: 3, borderRadius: "50%", background: "rgba(200,255,220,0.6)",
              animation: `firefly-drift ${15 + i * 2}s linear infinite`, animationDelay: `${i * 2}s`,
              opacity: 0,
            }} />
          ))}

          {/* ── Clickable Hotspot Zones ── */}
          {HOTSPOTS.map(zone => (
            <div
              key={zone.id}
              className="absolute cursor-pointer transition-all duration-300 group"
              style={{
                left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%`,
                border: hoveredZone === zone.id ? `2px solid ${zone.glowColor.replace('0.5', '0.8')}` : "2px solid transparent",
                borderRadius: 8,
                boxShadow: hoveredZone === zone.id ? `0 0 20px ${zone.glowColor}, inset 0 0 20px ${zone.glowColor.replace('0.5', '0.15')}` : "none",
              }}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              onClick={() => publicKey ? setActiveModal(zone.id) : setVisible(true)}
            >
              {/* Label on hover */}
              <div className={`absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rpg-panel px-3 py-1 rounded transition-opacity duration-200 ${hoveredZone === zone.id ? "opacity-100" : "opacity-0"}`}>
                <span className="font-pixel text-o7-gold text-[8px]">{zone.label}</span>
                <span className="text-[8px] text-o7-cream/50 font-body ml-2">{zone.sub}</span>
              </div>
              {/* Mobile: always-visible badge */}
              <div className="sm:hidden absolute top-1 left-1 rpg-panel px-2 py-0.5 rounded text-[7px] font-pixel text-o7-gold opacity-80">
                {zone.label.split(" ").pop()}
              </div>
            </div>
          ))}

          {/* Dim overlay when modal open */}
          {activeModal && <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={() => setActiveModal(null)} />}
        </div>

        {/* ═══ STATS BAR ═══ */}
        <div className="rpg-panel rounded-lg px-4 py-3">
          <div className="flex flex-wrap justify-between gap-3 text-center">
            {[
              { label: "SOL Staked", value: gardenData ? `${(gardenData.totalSolDeposited / LAMPORTS_PER_SOL).toFixed(2)}` : "—", color: "text-o7-cream" },
              { label: "Epoch", value: gardenData ? `${gardenData.currentEpoch}` : "—", color: "text-o7-cream" },
              { label: "Ratio", value: `${ratio.grienPct}/${ratio.bluPct}`, color: "text-o7-gold" },
              { label: "Fountain", value: `${fountainPulses}`, color: "text-cyan-400" },
              { label: "Stakers", value: gardenData ? `${gardenData.stakerCount}` : "—", color: "text-o7-cream" },
              { label: "GrienApple", value: formatGrien(grienBalance), color: "text-o7-teal" },
              { label: "BluApple", value: formatBlu(bluData?.totalEarned || 0), color: "text-blue-400" },
            ].map(s => (
              <div key={s.label} className="flex-1 min-w-[70px]">
                <p className="text-[8px] text-o7-cream/40 font-body uppercase">{s.label}</p>
                <p className={`text-xs font-pixel ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ TX STATUS ═══ */}
        {txStatus && (
          <div className={`rpg-panel rounded-lg p-3 text-sm ${txStatus.type === "success" ? "!border-o7-teal" : "!border-red-500"}`}>
            <p className="font-body text-o7-cream text-xs">{txStatus.msg}</p>
            {txStatus.sig && <a href={`https://explorer.solana.com/tx/${txStatus.sig}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-[10px] text-o7-teal underline font-body">Explorer</a>}
          </div>
        )}

        {/* ═══ MODAL PANELS ═══ */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-end" onClick={() => setActiveModal(null)}>
            <div className="w-full max-w-md h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto rpg-panel rpg-decorated rounded-l-lg sm:rounded-lg p-6 space-y-4 m-0 sm:mr-8 animate-slide-in"
              onClick={e => e.stopPropagation()}>

              {/* Close */}
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-o7-gold text-xs">{HOTSPOTS.find(h => h.id === activeModal)?.label}</h3>
                <button onClick={() => setActiveModal(null)} className="text-o7-cream/40 hover:text-o7-cream text-lg">{"\u2715"}</button>
              </div>

              {/* ── GROVES: Stake Panel ── */}
              {activeModal === "groves" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="rpg-stat-label">Amount (SOL)</label>
                    <input type="number" placeholder="0.0" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} className="rpg-input w-full" />
                    <p className="text-[10px] text-o7-cream/30 font-body">Available: {(solBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                  </div>
                  <div className="space-y-2">
                    <label className="rpg-stat-label">Lock Period</label>
                    <div className="grid grid-cols-2 gap-2">
                      {LOCK_TIERS.map((tier, i) => (
                        <button key={i} onClick={() => setLockTier(i)} className={`rpg-slot ${lockTier === i ? "active" : ""}`}>
                          <div className="font-pixel text-[8px] text-o7-cream">{tier.name}</div>
                          <div className="text-[9px] text-o7-gold font-body mt-1">{tier.mult} reward</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0}
                    onClick={() => runTx("Stake", () => programs!.orchard.methods.stakeSol(new BN(Math.floor(parseFloat(stakeAmount) * LAMPORTS_PER_SOL)), lockTier).accounts({ staker: publicKey } as any).rpc())}
                    className="rpg-btn w-full py-3 font-pixel text-xs text-o7-gold">
                    {loading ? "Processing..." : "Stake SOL"}
                  </button>
                  {stakerData && stakerData.depositedSol > 0 && (
                    <div className="rpg-panel-gold rounded-md p-3 space-y-2">
                      <p className="rpg-stat-label text-o7-gold/60">Your Position</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><p className="rpg-stat-label">Staked</p><p className="rpg-stat-value text-o7-cream">{(stakerData.depositedSol / LAMPORTS_PER_SOL).toFixed(2)}</p></div>
                        <div><p className="rpg-stat-label">Lock</p><p className="rpg-stat-value text-o7-cream">{LOCK_TIERS[stakerData.lockTier]?.name}</p></div>
                        <div><p className="rpg-stat-label">Mult</p><p className="rpg-stat-value text-o7-gold">{(stakerData.lockMultiplierBps / 10000).toFixed(2)}x</p></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── HARVEST: Claim Panel ── */}
              {activeModal === "harvest" && (
                <div className="space-y-4">
                  <div className="rpg-panel rounded-md p-3 text-center">
                    <p className="text-[9px] text-o7-cream/40 font-body">This week&apos;s split</p>
                    <p className="font-pixel text-sm"><span className="text-o7-teal">{ratio.grienPct}%</span> <span className="text-o7-cream/30">liquid</span> / <span className="text-blue-400">{ratio.bluPct}%</span> <span className="text-o7-cream/30">locked</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="rpg-stat-label">GrienApple</p><p className="rpg-stat-value text-o7-teal">{formatGrien(grienBalance)}</p></div>
                    <div><p className="rpg-stat-label">BluApple</p><p className="rpg-stat-value text-blue-400">{formatBlu(bluData?.totalEarned || 0)}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={loading || !canClaim} onClick={() => runTx(needsCrank ? "Crank & Claim" : "Claim", autoCrankAndClaim)}
                      className="rpg-btn flex-1 py-3 font-pixel text-[9px] text-o7-teal">
                      {canClaim ? (needsCrank ? "Crank & Claim" : "Claim") : "No Epoch"}
                    </button>
                    <button disabled={loading || !canClaim} onClick={() => runTx("Claim All", claimAll)}
                      className="rpg-btn px-3 py-3 font-pixel text-[8px] text-o7-cream/50">All</button>
                  </div>
                  {ripenedBlu > 0 && (
                    <>
                      <div><p className="rpg-stat-label">Harvestable</p><p className="rpg-stat-value text-purple-400">{formatBlu(ripenedBlu)}</p></div>
                      <input type="number" placeholder={`Max: ${(ripenedBlu / 1e9).toFixed(4)}`} value={harvestAmount} onChange={e => setHarvestAmount(e.target.value)} className="rpg-input w-full" />
                      <button disabled={loading || !harvestAmount}
                        onClick={() => runTx("Harvest", async () => { const ata = await ensureAta(); return programs!.orchard.methods.harvestBlu(5, new BN(Math.floor(parseFloat(harvestAmount) * 1e9))).accounts({ user: publicKey, grienMint: gardenData!.grienMint!, userGrienAta: ata } as any).rpc(); })}
                        className="rpg-btn w-full py-3 font-pixel text-[9px] text-purple-400">Harvest BluApple</button>
                    </>
                  )}
                  {bluData && bluData.batchCount > 0 && (() => {
                    const b = bluData.batches[0]; if (!b) return null;
                    const w = Math.floor((nowTs - b.earnedTs) / (7 * 86400));
                    const p = w < 3 ? 0 : Math.min(100, (w - 2) * 2);
                    return (<div className="space-y-1"><p className="rpg-stat-label">Ripening</p><div className="rpg-xp-bar"><div className="rpg-xp-fill" style={{ width: `${p}%` }} /></div><p className="text-[9px] text-o7-cream/30 font-body">{p}% — Week {w}/52</p></div>);
                  })()}
                </div>
              )}

              {/* ── FOUNTAIN ── */}
              {activeModal === "fountain" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="rpg-stat-label">Pulses Fired</p><p className="rpg-stat-value text-cyan-400">{fountainPulses}</p></div>
                    <div><p className="rpg-stat-label">Accumulated</p><p className="rpg-stat-value text-o7-cream">{(fountainAccumulated / LAMPORTS_PER_SOL).toFixed(4)} SOL</p></div>
                  </div>
                  <div className="rpg-panel rounded-md p-3">
                    <p className="rpg-stat-label">Loot Table</p>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-[9px] font-body text-o7-cream/60">
                      {["Seed Pack (30%)", "Oru Material (25%)", "Cosmetic (20%)", "Pollen (12%)", "Key Shard (10%)", "Ancient Dew (3%)"].map(r => <p key={r}>{r}</p>)}
                    </div>
                  </div>
                  <p className="text-[10px] text-o7-cream/30 font-body text-center">Fountain rewards are distributed when yield threshold is crossed.</p>
                </div>
              )}

              {/* ── BANK ── */}
              {activeModal === "bank" && (
                <div className="space-y-4">
                  <p className="text-[10px] text-o7-cream/30 font-body">Emergency exit. 10% of TWAP value. Harvest through gameplay for 10x better.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="rpg-stat-label">TWAP</p><p className="rpg-stat-value text-o7-cream/60">{bankTwap || "N/A"}</p></div>
                    <div><p className="rpg-stat-label">Fee</p><p className={`rpg-stat-value ${bankWeekRedemptions > 0 ? "text-red-400" : "text-o7-gold"}`}>{bankWeekRedemptions === 0 ? 10 : bankWeekRedemptions === 1 ? 15 : 25}%</p></div>
                    <div><p className="rpg-stat-label">Ripened</p><p className="rpg-stat-value text-purple-400">{formatBlu(ripenedBlu)}</p></div>
                  </div>
                  <input type="number" placeholder="BluApple to redeem" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} className="rpg-input w-full" />
                  <button disabled={loading || ripenedBlu <= 0 || !redeemAmount}
                    onClick={() => runTx("Redeem", async () => { const ata = await ensureAta(); return programs!.orchard.methods.redeemBlu(new BN(Math.floor(parseFloat(redeemAmount) * 1e9))).accounts({ user: publicKey, bankGrienTreasury: getBankGrienTreasuryPda(), userGrienAta: ata } as any).rpc(); })}
                    className="rpg-btn w-full py-3 font-pixel text-[9px] text-red-400">Redeem at Bank</button>
                </div>
              )}

              {/* ── CELLAR: BluApple Vault ── */}
              {activeModal === "cellar" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="rpg-stat-label">Earned</p><p className="rpg-stat-value text-blue-400">{formatBlu(bluData?.totalEarned || 0)}</p></div>
                    <div><p className="rpg-stat-label">Ripened</p><p className="rpg-stat-value text-purple-400">{formatBlu(ripenedBlu)}</p></div>
                    <div><p className="rpg-stat-label">Harvested</p><p className="rpg-stat-value text-o7-gold">{formatBlu(bluData?.totalHarvested || 0)}</p></div>
                  </div>
                  {bluData && bluData.batches.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      <p className="rpg-stat-label">Batches ({bluData.batchCount})</p>
                      {bluData.batches.map((b, i) => {
                        const w = Math.floor((nowTs - b.earnedTs) / (7 * 86400));
                        const pct = w < 3 ? 0 : Math.min(100, (w - 2) * 2);
                        const state = w < 3 ? "Seeded" : pct >= 100 ? "Ripened" : `${pct}%`;
                        return (
                          <div key={i} className="rpg-panel rounded-md p-2 flex items-center justify-between text-[9px]">
                            <span className="text-o7-cream/60 font-body">Batch {i + 1}</span>
                            <span className="text-blue-400 font-pixel">{(b.totalAmount / 1e9).toFixed(2)}</span>
                            <span className={`font-pixel ${w < 3 ? "text-amber-400" : pct >= 100 ? "text-o7-teal" : "text-purple-400"}`}>{state}</span>
                            <span className="text-o7-cream/30 font-body">Wk {w}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-o7-cream/30 font-body text-center">No BluApple batches yet. Stake and claim to start earning.</p>
                  )}
                </div>
              )}

              {/* ── GATE: Unstake ── */}
              {activeModal === "gate" && (
                <div className="space-y-4">
                  {stakerData && stakerData.depositedSol > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div><p className="rpg-stat-label">Staked</p><p className="rpg-stat-value text-o7-cream">{(stakerData.depositedSol / LAMPORTS_PER_SOL).toFixed(2)}</p></div>
                        <div><p className="rpg-stat-label">Lock</p><p className="rpg-stat-value text-o7-cream">{LOCK_TIERS[stakerData.lockTier]?.name}</p></div>
                        <div><p className="rpg-stat-label">Mult</p><p className="rpg-stat-value text-o7-gold">{(stakerData.lockMultiplierBps / 10000).toFixed(2)}x</p></div>
                      </div>
                      {isLocked && earlyFee > 0 && (
                        <div className="rounded-md border border-amber-700/50 bg-amber-950/20 p-3 space-y-1">
                          <p className="text-[10px] text-amber-300 font-body">Early exit fee: <span className="font-pixel text-amber-400">{earlyFee}%</span></p>
                          <p className="text-[9px] text-amber-300/60 font-body">Lock: {fmtDur(lockRemaining)}. Multiplier resets to 1.0x.</p>
                        </div>
                      )}
                      <input type="number" placeholder="0 = full withdrawal" value={unstakeAmount} onChange={e => setUnstakeAmount(e.target.value)} className="rpg-input w-full" />
                      <button disabled={loading}
                        onClick={() => runTx("Unstake", () => programs!.orchard.methods.unstakeSol(unstakeAmount ? new BN(Math.floor(parseFloat(unstakeAmount) * LAMPORTS_PER_SOL)) : new BN(0)).accounts({ staker: publicKey, treasuryVault: getTreasurySolPda() } as any).rpc())}
                        className="rpg-btn w-full py-3 font-pixel text-[9px] text-o7-cream/60">
                        {isLocked ? `Unstake (${earlyFee}% fee)` : "Unstake"}
                      </button>
                    </>
                  ) : (
                    <p className="text-[10px] text-o7-cream/30 font-body text-center">No active stake. Visit The Groves to stake SOL.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Keyframe Animations ── */}
      <style jsx>{`
        @keyframes droplet-rise {
          0% { transform: translateY(0); opacity: 0.9; }
          60% { opacity: 0.5; }
          100% { transform: translateY(-25px); opacity: 0; }
        }
        @keyframes fountain-ripple {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes lantern-flicker {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes mushroom-glow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
        @keyframes gold-fall {
          0% { transform: translateY(0) translateX(0); opacity: 0.7; }
          50% { transform: translateY(100px) translateX(10px); opacity: 0.5; }
          100% { transform: translateY(200px) translateX(-5px); opacity: 0; }
        }
        @keyframes firefly-drift {
          0% { transform: translate(0, 0); opacity: 0; }
          10% { opacity: 0.6; }
          50% { transform: translate(100px, -50px); opacity: 0.3; }
          90% { opacity: 0.5; }
          100% { transform: translate(-80px, 30px); opacity: 0; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </section>
  );
}

function fmtDur(secs: number): string {
  if (secs <= 0) return "0s";
  const d = Math.floor(secs / 86400); const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}
