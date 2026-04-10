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
  getHarvestConfigPda, getBankConfigPda, getBankGrienTreasuryPda,
  getTreasurySolPda, getFountainSolPda, getBuybackSolPda, getFountainConfigPda,
  LOCK_TIERS, formatGrien, formatBlu, calculateRipenedBlu,
  getWeeklyRatio, getEarlyUnstakeFee,
} from "@/lib/programs";

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

export default function SectionGardens() {
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
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockTier, setLockTier] = useState(0);
  const [harvestAmount, setHarvestAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{ type: "success" | "error"; msg: string; sig?: string } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!publicKey || !programs || !connection) return;
    try {
      const garden = await (programs.orchard.account as any).gardenState.fetch(getGardenPda());
      const grienMint = garden.grienMint as PublicKey;
      setGardenData({
        totalSolDeposited: garden.totalSolDeposited.toNumber(),
        totalGrienMinted: garden.totalGrienMinted.toNumber(),
        stakerCount: garden.stakerCount,
        currentEpoch: garden.currentEpoch.toNumber(),
        grienMint,
        epochStartTs: garden.epochStartTs.toNumber(),
        epochDurationSecs: garden.epochDurationSecs.toNumber(),
        genesisTs: garden.genesisTs.toNumber(),
      });
      setSolBalance(await connection.getBalance(publicKey));
      try {
        const s = await (programs.orchard.account as any).stakerAccount.fetch(getStakerPda(publicKey));
        setStakerData({
          depositedSol: s.depositedSol.toNumber(), lockTier: s.lockTier,
          lockExpiry: s.lockExpiry.toNumber(), lockMultiplierBps: s.lockMultiplierBps,
          nextClaimEpoch: s.nextClaimEpoch.toNumber(),
        });
      } catch { setStakerData(null); }
      try { const b = await (programs.orchard.account as any).bluLedger.fetch(getBluLedgerPda(publicKey)); setBluData({ totalEarned: b.totalEarned.toNumber(), totalHarvested: b.totalHarvested.toNumber(), batchCount: b.batchCount, batches: (b.batches as any[]).map((x: any) => ({ earnedTs: x.earnedTs.toNumber(), totalAmount: x.totalAmount.toNumber(), harvestedAmount: x.harvestedAmount.toNumber() })) }); } catch { setBluData(null); }
      try { const ata = getAssociatedTokenAddressSync(grienMint, publicKey); const acc = await getAccount(connection, ata); setGrienBalance(Number(acc.amount)); } catch { setGrienBalance(0); }
      try { const bk = await (programs.orchard.account as any).bankConfig.fetch(getBankConfigPda()); setBankTwap(bk.grienTwapPrice.toNumber()); } catch { setBankTwap(0); }
      try { const t = await (programs.orchard.account as any).bankUserTracker.fetch(PublicKey.findProgramAddressSync([Buffer.from("bank-tracker"), publicKey.toBuffer()], ORCHARD_ID)[0]); setBankWeekRedemptions(t.weekRedemptionCount); } catch { setBankWeekRedemptions(0); }
      try { const [t, f, b] = await Promise.all([connection.getBalance(getTreasurySolPda()), connection.getBalance(getFountainSolPda()), connection.getBalance(getBuybackSolPda())]); setTreasuryBalances({ treasury: t, fountain: f, buyback: b }); } catch {}
      try { const fc = await (programs.orchard.account as any).fountainConfig.fetch(getFountainConfigPda()); setFountainPulses(fc.totalPulses.toNumber()); } catch { setFountainPulses(0); }
    } catch (e) { console.error("Fetch:", e); }
  }, [publicKey, programs, connection]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const ensureGrienAta = async (): Promise<PublicKey> => {
    const mint = gardenData!.grienMint!;
    const ata = getAssociatedTokenAddressSync(mint, publicKey!);
    try { await getAccount(connection, ata); } catch {
      const ix = createAssociatedTokenAccountInstruction(publicKey!, ata, publicKey!, mint);
      await programs!.provider.sendAndConfirm(new Transaction().add(ix));
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
      const raw = e?.message || e?.toString() || "Transaction failed";
      let msg = raw.slice(0, 200);
      if (raw.includes("InsufficientRipenedBlu")) msg = "Not enough ripened BluApple. Still in seed period (2 weeks).";
      else if (raw.includes("CannotChangeLockTier")) msg = "Cannot change lock tier while lock is active. Use the same tier.";
      else if (raw.includes("EpochNotFinalized")) msg = "Epoch not yet finalized. Wait for next crank.";
      else if (raw.includes("NothingStaked")) msg = "No SOL staked.";
      else if (raw.includes("ZeroAmount")) msg = "Amount must be greater than zero.";
      else if (raw.includes("User rejected")) msg = "Transaction cancelled.";
      setTxStatus({ type: "error", msg });
    } finally { setLoading(false); }
  };

  // ── Derived values ──────────────────────────────────────────────
  const nowTs = Math.floor(Date.now() / 1000);
  const ripenedBlu = bluData ? calculateRipenedBlu(bluData.batches, nowTs) : 0;
  const needsCrank = gardenData ? (nowTs >= gardenData.epochStartTs + gardenData.epochDurationSecs) : false;
  const canClaim = stakerData && gardenData && (stakerData.nextClaimEpoch < gardenData.currentEpoch || needsCrank);
  const lockTimeRemaining = stakerData && stakerData.lockExpiry > nowTs ? stakerData.lockExpiry - nowTs : 0;
  const isLocked = lockTimeRemaining > 0;
  const earlyFee = stakerData ? getEarlyUnstakeFee(stakerData.lockTier, stakerData.lockExpiry, nowTs) : 0;
  const bankFeePct = bankWeekRedemptions === 0 ? 10 : bankWeekRedemptions === 1 ? 15 : 25;
  const ratio = gardenData ? getWeeklyRatio(gardenData.genesisTs, nowTs) : { grienPct: 5, bluPct: 95, weekIndex: 1 };

  // ── Auto-crank helper ─────────────────────────────────────────
  const autoCrankAndClaim = async () => {
    const ata = await ensureGrienAta();
    // Crank if needed
    if (needsCrank) {
      await programs!.orchard.methods.crankEpoch()
        .accounts({ cranker: publicKey, grienMint: gardenData!.grienMint! } as any).rpc();
    }
    // Claim
    return programs!.orchard.methods.claimRewards()
      .accounts({ staker: publicKey, stakerGrienAta: ata } as any).rpc();
  };

  // ── Claim All (batch catch-up) ────────────────────────────────
  const claimAll = async () => {
    const ata = await ensureGrienAta();
    let lastSig = "";
    for (let i = 0; i < 10; i++) {
      const now = Math.floor(Date.now() / 1000);
      const g = await (programs!.orchard.account as any).gardenState.fetch(getGardenPda());
      if (now >= g.epochStartTs.toNumber() + g.epochDurationSecs.toNumber()) {
        await programs!.orchard.methods.crankEpoch()
          .accounts({ cranker: publicKey, grienMint: gardenData!.grienMint! } as any).rpc();
      }
      const s = await (programs!.orchard.account as any).stakerAccount.fetch(getStakerPda(publicKey!));
      const gAfter = await (programs!.orchard.account as any).gardenState.fetch(getGardenPda());
      if (s.nextClaimEpoch.toNumber() < gAfter.currentEpoch.toNumber()) {
        lastSig = await programs!.orchard.methods.claimRewards()
          .accounts({ staker: publicKey, stakerGrienAta: ata } as any).rpc();
      } else { break; }
    }
    return lastSig;
  };

  return (
    <section id="gardens" className="relative min-h-screen py-24 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <img src="/assets/garden-background.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #1A1A2E 0%, rgba(27,67,50,0.8) 20%, rgba(27,67,50,0.8) 80%, #1A1A2E 100%)" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <div className="text-center mb-10">
          <h2 className="font-pixel text-o7-gold text-sm sm:text-base drop-shadow-[0_0_10px_rgba(181,133,27,0.3)]">The Gardens</h2>
          <p className="text-o7-cream/50 text-xs font-body mt-2">Stake SOL. Grow GrienApple. Tend the Garden.</p>
          {/* v0.5 Weekly Ratio Display */}
          <div className="mt-3 inline-flex items-center gap-2 rpg-panel rounded-full px-4 py-1.5">
            <span className="text-[9px] text-o7-cream/40 font-body">Week {ratio.weekIndex}:</span>
            <span className="text-[10px] text-o7-teal font-pixel">{ratio.grienPct}%</span>
            <span className="text-[9px] text-o7-cream/30">/</span>
            <span className="text-[10px] text-blue-400 font-pixel">{ratio.bluPct}%</span>
            <span className="text-[9px] text-o7-cream/30 font-body">Liquid / Locked</span>
          </div>
        </div>

        {!publicKey ? (
          <button onClick={() => setVisible(true)}
            className="rpg-btn rpg-decorated rounded-lg p-10 text-center w-full cursor-pointer hover:scale-[1.01] transition-transform">
            <p className="font-pixel text-o7-gold text-xs mb-2">Connect Wallet</p>
            <p className="text-o7-cream/50 font-body text-sm">Link your wallet to enter the Gardens</p>
          </button>
        ) : !gardenData ? (
          <div className="rpg-panel rounded-lg p-10 text-center">
            <p className="text-o7-cream/70 font-body animate-pulse">Loading Garden state...</p>
          </div>
        ) : (
          <>
            {txStatus && (
              <div className={`rpg-panel rounded-lg p-3 text-sm ${txStatus.type === "success" ? "!border-o7-teal" : "!border-red-500"}`}>
                <p className="font-body text-o7-cream text-xs">{txStatus.msg}</p>
                {txStatus.sig && <a href={`https://explorer.solana.com/tx/${txStatus.sig}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-[10px] text-o7-teal underline font-body">View on Explorer</a>}
              </div>
            )}

            {/* ═══ STAKE ═══ */}
            <div className="rpg-panel rpg-decorated rounded-lg p-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-o7-teal text-lg">{"\u2618"}</span>
                <h3 className="font-pixel text-o7-cream text-[10px]">LST Garden — Stake SOL</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="rpg-stat-label">Amount (SOL)</label>
                  <input type="number" placeholder="0.0" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className="rpg-input w-full" />
                  <p className="text-[10px] text-o7-cream/30 font-body">Available: {(solBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                </div>
                <div className="space-y-2">
                  <label className="rpg-stat-label">Lock Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOCK_TIERS.map((tier, i) => (
                      <button key={i} onClick={() => setLockTier(i)}
                        className={`rpg-slot ${lockTier === i ? "active" : ""}`}>
                        <div className="font-pixel text-[8px] text-o7-cream">{tier.name}</div>
                        <div className="text-[9px] text-o7-gold font-body mt-1">{tier.mult} reward</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0}
                onClick={() => runTx("Stake", () => programs!.orchard.methods.stakeSol(new BN(Math.floor(parseFloat(stakeAmount) * LAMPORTS_PER_SOL)), lockTier).accounts({ staker: publicKey } as any).rpc())}
                className="rpg-btn w-full px-6 py-4 font-pixel text-xs text-o7-gold">
                {loading ? "Processing..." : "Stake SOL"}
              </button>

              {stakerData && stakerData.depositedSol > 0 && (
                <div className="rpg-panel-gold rounded-md p-4 space-y-3">
                  <p className="rpg-stat-label text-o7-gold/60">Your Position</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><p className="rpg-stat-label">Staked</p><p className="rpg-stat-value text-o7-cream">{(stakerData.depositedSol / LAMPORTS_PER_SOL).toFixed(2)} SOL</p></div>
                    <div><p className="rpg-stat-label">Lock</p><p className="rpg-stat-value text-o7-cream">{LOCK_TIERS[stakerData.lockTier]?.name || "?"}</p></div>
                    <div><p className="rpg-stat-label">Multiplier</p><p className="rpg-stat-value text-o7-gold">{(stakerData.lockMultiplierBps / 10000).toFixed(2)}x</p></div>
                  </div>
                  {isLocked && <p className="text-[9px] text-o7-gold font-body">{"\u23F1"} Lock: {fmtDur(lockTimeRemaining)} remaining</p>}
                </div>
              )}
            </div>

            {/* ═══ REWARDS ═══ */}
            <div className="rpg-panel rpg-decorated rounded-lg p-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-o7-gold text-lg">{"\u2605"}</span>
                <h3 className="font-pixel text-o7-cream text-[10px]">Rewards</h3>
                <span className="text-[9px] text-o7-cream/30 font-body ml-auto">{ratio.grienPct}% liquid / {ratio.bluPct}% locked</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="rpg-stat-label">GrienApple</p><p className="rpg-stat-value text-o7-teal">{formatGrien(grienBalance)}</p></div>
                <div><p className="rpg-stat-label">Blu Earned</p><p className="rpg-stat-value text-blue-400">{formatBlu(bluData?.totalEarned || 0)}</p></div>
                <div><p className="rpg-stat-label">Blu Ripened</p><p className="rpg-stat-value text-purple-400">{formatBlu(ripenedBlu)}</p></div>
                <div><p className="rpg-stat-label">Blu Harvested</p><p className="rpg-stat-value text-o7-gold">{formatBlu(bluData?.totalHarvested || 0)}</p></div>
              </div>

              <div className="flex gap-3">
                <button disabled={loading || !canClaim}
                  onClick={() => runTx(needsCrank ? "Crank & Claim" : "Claim", autoCrankAndClaim)}
                  className="rpg-btn flex-1 px-3 py-3 font-pixel text-[9px] text-o7-teal">
                  {canClaim ? (needsCrank ? "Crank & Claim" : "Claim Rewards") : "No Epoch"}
                </button>
                <button disabled={loading || !canClaim}
                  onClick={() => runTx("Claim All", claimAll)}
                  className="rpg-btn px-3 py-3 font-pixel text-[8px] text-o7-cream/60">
                  Claim All
                </button>
                <button disabled={loading || ripenedBlu <= 0 || !harvestAmount}
                  onClick={() => runTx("Harvest", async () => {
                    const ata = await ensureGrienAta();
                    return programs!.orchard.methods.harvestBlu(5, new BN(Math.floor(parseFloat(harvestAmount) * 1e9))).accounts({ user: publicKey, grienMint: gardenData!.grienMint!, userGrienAta: ata } as any).rpc();
                  })}
                  className="rpg-btn px-3 py-3 font-pixel text-[9px] text-purple-400">
                  {ripenedBlu > 0 ? "Harvest" : "Nothing Ripe"}
                </button>
              </div>

              {ripenedBlu > 0 && (
                <input type="number" placeholder={`Max: ${(ripenedBlu / 1e9).toFixed(4)}`} value={harvestAmount} onChange={(e) => setHarvestAmount(e.target.value)} className="rpg-input w-full" />
              )}

              {bluData && bluData.batchCount > 0 && (() => {
                const batch = bluData.batches[0]; if (!batch) return null;
                const weeks = Math.floor((nowTs - batch.earnedTs) / (7 * 86400));
                const pct = weeks < 3 ? 0 : Math.min(100, (weeks - 2) * 2);
                return (
                  <div className="space-y-1">
                    <p className="rpg-stat-label">Ripening Progress</p>
                    <div className="rpg-xp-bar"><div className="rpg-xp-fill" style={{ width: `${pct}%` }} /></div>
                    <p className="text-[9px] text-o7-cream/30 font-body">{pct}% — Week {weeks}/52 {weeks < 3 && " \uD83C\uDF31 Seed period"}</p>
                  </div>
                );
              })()}
            </div>

            {/* ═══ BANK ═══ */}
            <div className="rpg-panel rpg-decorated rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-red-400 text-lg">{"\u26A6"}</span>
                <h3 className="font-pixel text-o7-cream text-[10px]">The Bank</h3>
              </div>
              <p className="text-[10px] text-o7-cream/30 font-body">Emergency exit — 10% of TWAP. Harvest through gameplay for 10x better.</p>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="rpg-stat-label">TWAP</p><p className="rpg-stat-value text-o7-cream/60">{bankTwap > 0 ? bankTwap : "N/A"}</p></div>
                <div><p className="rpg-stat-label">Fee</p><p className={`rpg-stat-value ${bankFeePct > 10 ? "text-red-400" : "text-o7-gold"}`}>{bankFeePct}%</p></div>
                <div><p className="rpg-stat-label">Ripened</p><p className="rpg-stat-value text-purple-400">{formatBlu(ripenedBlu)}</p></div>
              </div>
              <div className="flex gap-3">
                <input type="number" placeholder="Blu to redeem" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} className="rpg-input flex-1" />
                <button disabled={loading || ripenedBlu <= 0 || !redeemAmount}
                  onClick={() => runTx("Redeem", async () => {
                    const ata = await ensureGrienAta();
                    return programs!.orchard.methods.redeemBlu(new BN(Math.floor(parseFloat(redeemAmount) * 1e9))).accounts({ user: publicKey, bankGrienTreasury: getBankGrienTreasuryPda(), userGrienAta: ata } as any).rpc();
                  })}
                  className="rpg-btn px-4 py-2 font-pixel text-[9px] text-red-400">Redeem</button>
              </div>
            </div>

            {/* ═══ STATS ═══ */}
            <div className="rpg-panel rounded-lg p-6 space-y-4">
              <h3 className="font-pixel text-o7-cream text-[10px]">{"\u2630"} Garden Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div><p className="rpg-stat-label">Total SOL</p><p className="rpg-stat-value text-o7-cream">{(gardenData.totalSolDeposited / LAMPORTS_PER_SOL).toFixed(2)}</p></div>
                <div><p className="rpg-stat-label">GrienApple</p><p className="rpg-stat-value text-o7-teal">{formatGrien(gardenData.totalGrienMinted)}</p></div>
                <div><p className="rpg-stat-label">Epoch</p><p className="rpg-stat-value text-o7-cream">{gardenData.currentEpoch}</p></div>
                <div><p className="rpg-stat-label">Stakers</p><p className="rpg-stat-value text-o7-cream">{gardenData.stakerCount}</p></div>
                <div><p className="rpg-stat-label">Fountain</p><p className="rpg-stat-value text-cyan-400">{fountainPulses} pulses</p></div>
                <div><p className="rpg-stat-label">Week</p><p className="rpg-stat-value text-o7-gold">{ratio.weekIndex} ({ratio.grienPct}/{ratio.bluPct})</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Treasury 50%", val: treasuryBalances.treasury, color: "text-o7-cream" },
                  { label: "Fountain 30%", val: treasuryBalances.fountain, color: "text-cyan-400" },
                  { label: "Buyback 20%", val: treasuryBalances.buyback, color: "text-o7-gold" },
                ].map((v) => (
                  <div key={v.label} className="rpg-slot text-center !cursor-default">
                    <p className="rpg-stat-label">{v.label}</p>
                    <p className={`rpg-stat-value ${v.color}`}>{(v.val / LAMPORTS_PER_SOL).toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ UNSTAKE — v0.5: Always allowed, tiered fee ═══ */}
            {stakerData && stakerData.depositedSol > 0 && (
              <div className="rpg-panel rounded-lg p-6 space-y-3">
                <h3 className="font-pixel text-o7-cream text-[10px]">{"\u26A0"} Unstake</h3>
                <p className="text-[10px] text-o7-cream/30 font-body">
                  Staked: {(stakerData.depositedSol / LAMPORTS_PER_SOL).toFixed(2)} SOL
                  {isLocked && ` — Lock: ${fmtDur(lockTimeRemaining)} remaining`}
                </p>

                {/* Early unstake warning */}
                {isLocked && earlyFee > 0 && (
                  <div className="rounded-md border border-amber-700/50 bg-amber-950/20 p-3 space-y-1">
                    <p className="text-[10px] text-amber-300 font-body">Early exit fee: <span className="font-pixel text-amber-400">{earlyFee}%</span></p>
                    <p className="text-[9px] text-amber-300/60 font-body">Multiplier will reset to 1.0x. BluApple earned is kept.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <input type="number" placeholder="0 = full withdrawal" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} className="rpg-input flex-1" />
                  <button disabled={loading}
                    onClick={() => runTx("Unstake", () => programs!.orchard.methods.unstakeSol(
                      unstakeAmount ? new BN(Math.floor(parseFloat(unstakeAmount) * LAMPORTS_PER_SOL)) : new BN(0)
                    ).accounts({ staker: publicKey, treasuryVault: getTreasurySolPda() } as any).rpc())}
                    className="rpg-btn px-4 py-2 font-pixel text-[9px] text-o7-cream/60">
                    {isLocked ? `Unstake (${earlyFee}% fee)` : "Unstake"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="absolute right-8 bottom-20 hidden lg:block" style={{ filter: "drop-shadow(0 0 8px rgba(64,145,108,0.3))" }}>
        <OruBounce />
      </div>
    </section>
  );
}

function OruBounce() {
  const [frame, setFrame] = useState(0);
  useEffect(() => { const iv = setInterval(() => setFrame((f) => (f + 1) % 4), 400); return () => clearInterval(iv); }, []);
  return <img src="/assets/oru-idle.png" alt="Oru" width={80} height={80} style={{ imageRendering: "pixelated", transform: `translateY(${[0, -4, 0, -2][frame]}px)`, transition: "transform 0.2s" }} />;
}

function fmtDur(secs: number): string {
  if (secs <= 0) return "0s";
  const d = Math.floor(secs / 86400); const h = Math.floor((secs % 86400) / 3600); const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}
