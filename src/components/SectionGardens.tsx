"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { usePrograms } from "@/lib/useAnchor";
import {
  ORCHARD_ID,
  getGardenPda,
  getStakerPda,
  getBluLedgerPda,
  getHarvestConfigPda,
  getBankConfigPda,
  getBankGrienTreasuryPda,
  getTreasurySolPda,
  getFountainSolPda,
  getBuybackSolPda,
  getFountainConfigPda,
  LOCK_TIERS,
  formatGrien,
  formatBlu,
  calculateRipenedBlu,
} from "@/lib/programs";

// ── Types ────────────────────────────────────────────────────────────
interface GardenData {
  totalSolDeposited: number; totalGrienMinted: number; stakerCount: number;
  currentEpoch: number; grienMint: PublicKey | null;
}
interface StakerData {
  depositedSol: number; lockTier: number; lockExpiry: number;
  grienMultiplierBps: number; bluMultiplierBps: number; nextClaimEpoch: number;
}
interface BluData {
  totalEarned: number; totalHarvested: number; batchCount: number;
  batches: { earnedTs: number; totalAmount: number; harvestedAmount: number }[];
}

export default function SectionGardens() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
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
      setGardenData({ totalSolDeposited: garden.totalSolDeposited.toNumber(), totalGrienMinted: garden.totalGrienMinted.toNumber(), stakerCount: garden.stakerCount, currentEpoch: garden.currentEpoch.toNumber(), grienMint });
      setSolBalance(await connection.getBalance(publicKey));
      try { const s = await (programs.orchard.account as any).stakerAccount.fetch(getStakerPda(publicKey)); setStakerData({ depositedSol: s.depositedSol.toNumber(), lockTier: s.lockTier, lockExpiry: s.lockExpiry.toNumber(), grienMultiplierBps: s.grienMultiplierBps, bluMultiplierBps: s.bluMultiplierBps, nextClaimEpoch: s.nextClaimEpoch.toNumber() }); } catch { setStakerData(null); }
      try { const b = await (programs.orchard.account as any).bluLedger.fetch(getBluLedgerPda(publicKey)); setBluData({ totalEarned: b.totalEarned.toNumber(), totalHarvested: b.totalHarvested.toNumber(), batchCount: b.batchCount, batches: (b.batches as any[]).map((x: any) => ({ earnedTs: x.earnedTs.toNumber(), totalAmount: x.totalAmount.toNumber(), harvestedAmount: x.harvestedAmount.toNumber() })) }); } catch { setBluData(null); }
      try { const ata = getAssociatedTokenAddressSync(grienMint, publicKey); const acc = await getAccount(connection, ata); setGrienBalance(Number(acc.amount)); } catch { setGrienBalance(0); }
      try { const bk = await (programs.orchard.account as any).bankConfig.fetch(getBankConfigPda()); setBankTwap(bk.grienTwapPrice.toNumber()); } catch { setBankTwap(0); }
      try { const t = await (programs.orchard.account as any).bankUserTracker.fetch(PublicKey.findProgramAddressSync([Buffer.from("bank-tracker"), publicKey.toBuffer()], ORCHARD_ID)[0]); setBankWeekRedemptions(t.weekRedemptionCount); } catch { setBankWeekRedemptions(0); }
      try { const [t, f, b] = await Promise.all([connection.getBalance(getTreasurySolPda()), connection.getBalance(getFountainSolPda()), connection.getBalance(getBuybackSolPda())]); setTreasuryBalances({ treasury: t, fountain: f, buyback: b }); } catch {}
      try { const fc = await (programs.orchard.account as any).fountainConfig.fetch(getFountainConfigPda()); setFountainPulses(fc.totalPulses.toNumber()); } catch { setFountainPulses(0); }
    } catch (e) { console.error("Fetch:", e); }
  }, [publicKey, programs, connection]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runTx = async (label: string, fn: () => Promise<string>) => {
    setLoading(true); setTxStatus(null);
    try { const sig = await fn(); setTxStatus({ type: "success", msg: `${label} confirmed!`, sig }); await fetchAll(); }
    catch (e: any) { setTxStatus({ type: "error", msg: e?.message?.slice(0, 150) || "Transaction failed" }); }
    finally { setLoading(false); }
  };

  const nowTs = Math.floor(Date.now() / 1000);
  const ripenedBlu = bluData ? calculateRipenedBlu(bluData.batches, nowTs) : 0;
  const canClaim = stakerData && gardenData && stakerData.nextClaimEpoch < gardenData.currentEpoch;
  const lockTimeRemaining = stakerData && stakerData.lockExpiry > nowTs ? stakerData.lockExpiry - nowTs : 0;
  const isLocked = lockTimeRemaining > 0;
  const bankFeePct = bankWeekRedemptions === 0 ? 10 : bankWeekRedemptions === 1 ? 15 : 25;

  return (
    <section id="gardens" className="relative min-h-screen py-20 px-4" style={{ background: "linear-gradient(180deg, #1A1A2E 0%, #1B4332 30%, #1B4332 70%, #1A1A2E 100%)" }}>
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <img src="/assets/garden-background.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <h2 className="font-pixel text-o7-gold text-sm sm:text-base text-center mb-8">The Gardens</h2>

        {!publicKey ? (
          <div className="rpg-panel rounded-lg p-8 text-center">
            <p className="text-o7-cream/70 font-body">Connect your wallet to enter the Gardens</p>
          </div>
        ) : !gardenData ? (
          <div className="rpg-panel rounded-lg p-8 text-center">
            <p className="text-o7-cream/70 font-body animate-pulse">Loading Garden state...</p>
          </div>
        ) : (
          <>
            {/* TX Status */}
            {txStatus && (
              <div className={`rpg-panel rounded-lg p-3 text-sm ${txStatus.type === "success" ? "border-o7-teal" : "border-red-600"}`}>
                <p className="font-body text-o7-cream">{txStatus.msg}</p>
                {txStatus.sig && <a href={`https://explorer.solana.com/tx/${txStatus.sig}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-xs text-o7-teal underline">View on Explorer</a>}
              </div>
            )}

            {/* ═══ STAKE PANEL ═══ */}
            <div className="rpg-panel rounded-lg p-6 space-y-4">
              <h3 className="font-pixel text-o7-cream text-xs">LST Garden — Stake SOL</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-o7-cream/50 font-body">Amount (SOL)</label>
                  <input type="number" placeholder="0.0" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
                    className="w-full rounded-md border border-o7-teal/30 bg-o7-dark/60 px-3 py-2 text-o7-cream font-body" />
                  <p className="text-[10px] text-o7-cream/40 font-body">Available: {(solBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-o7-cream/50 font-body">Lock Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOCK_TIERS.map((tier, i) => (
                      <button key={i} onClick={() => setLockTier(i)}
                        className={`rounded-md border px-2 py-2 text-[10px] transition font-body ${lockTier === i ? "border-o7-gold bg-o7-gold/10 text-o7-gold" : "border-o7-teal/20 bg-o7-dark/40 text-o7-cream/60 hover:border-o7-teal/40"}`}>
                        <div className="font-semibold">{tier.name}</div>
                        <div className="opacity-60">{tier.grienMult} / {tier.bluMult}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0}
                onClick={() => runTx("Stake", () => programs!.orchard.methods.stakeSol(new BN(Math.floor(parseFloat(stakeAmount) * LAMPORTS_PER_SOL)), lockTier).accounts({ staker: publicKey } as any).rpc())}
                className="w-full rpg-panel rounded-md px-4 py-3 font-pixel text-xs text-o7-gold hover:text-o7-cream disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed">
                {loading ? "Processing..." : "Stake SOL"}
              </button>

              {/* Position */}
              {stakerData && stakerData.depositedSol > 0 && (
                <div className="border border-o7-teal/20 rounded-md p-3 space-y-2">
                  <p className="text-[10px] text-o7-cream/50 font-body uppercase tracking-wider">Your Position</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-body">
                    <Stat label="Staked" value={`${(stakerData.depositedSol / LAMPORTS_PER_SOL).toFixed(2)} SOL`} color="text-o7-cream" />
                    <Stat label="Lock" value={LOCK_TIERS[stakerData.lockTier]?.name || "?"} color="text-o7-cream" />
                    <Stat label="Grien Mult" value={`${(stakerData.grienMultiplierBps / 10000).toFixed(2)}x`} color="text-o7-teal" />
                    <Stat label="Blu Mult" value={`${(stakerData.bluMultiplierBps / 10000).toFixed(2)}x`} color="text-blue-400" />
                  </div>
                  {isLocked && <p className="text-[10px] text-o7-gold font-body">Lock: {formatDuration(lockTimeRemaining)} remaining</p>}
                </div>
              )}
            </div>

            {/* ═══ REWARDS ═══ */}
            <div className="rpg-panel rounded-lg p-6 space-y-4">
              <h3 className="font-pixel text-o7-cream text-xs">Rewards</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="GrienApple" value={formatGrien(grienBalance)} color="text-o7-teal" />
                <Stat label="Blu Earned" value={formatBlu(bluData?.totalEarned || 0)} color="text-blue-400" />
                <Stat label="Blu Ripened" value={formatBlu(ripenedBlu)} color="text-purple-400" />
                <Stat label="Blu Harvested" value={formatBlu(bluData?.totalHarvested || 0)} color="text-o7-gold" />
              </div>
              <div className="flex gap-3">
                <button disabled={loading || !canClaim}
                  onClick={() => runTx("Claim", () => programs!.orchard.methods.claimRewards().accounts({ staker: publicKey, stakerGrienAta: getAssociatedTokenAddressSync(gardenData!.grienMint!, publicKey) } as any).rpc())}
                  className="flex-1 rpg-panel rounded-md px-3 py-2 font-pixel text-[10px] text-o7-teal hover:text-o7-cream disabled:opacity-40 transition">
                  {canClaim ? "Claim Rewards" : "No Epoch"}
                </button>
                <button disabled={loading || ripenedBlu <= 0}
                  onClick={() => { if (!harvestAmount) return; runTx("Harvest", () => programs!.orchard.methods.harvestBlu(5, new BN(Math.floor(parseFloat(harvestAmount) * 1e9))).accounts({ user: publicKey, grienMint: gardenData!.grienMint!, userGrienAta: getAssociatedTokenAddressSync(gardenData!.grienMint!, publicKey) } as any).rpc()); }}
                  className="flex-1 rpg-panel rounded-md px-3 py-2 font-pixel text-[10px] text-purple-400 hover:text-o7-cream disabled:opacity-40 transition">
                  {ripenedBlu > 0 ? "Harvest Blu" : "Nothing Ripe"}
                </button>
              </div>
              {ripenedBlu > 0 && (
                <input type="number" placeholder={`Max: ${(ripenedBlu / 1e9).toFixed(4)}`} value={harvestAmount} onChange={(e) => setHarvestAmount(e.target.value)}
                  className="w-full rounded-md border border-o7-teal/20 bg-o7-dark/40 px-3 py-2 text-o7-cream text-sm font-body" />
              )}
              {/* Ripening bar */}
              {bluData && bluData.batchCount > 0 && (() => {
                const batch = bluData.batches[0]; if (!batch) return null;
                const weeks = Math.floor((nowTs - batch.earnedTs) / (7 * 86400));
                const pct = weeks < 3 ? 0 : Math.min(100, (weeks - 2) * 2);
                return (
                  <div className="space-y-1">
                    <div className="h-2 w-full rounded-full bg-o7-dark/60">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-o7-cream/40 font-body">{pct}% ripened (Week {weeks}/52){weeks < 3 && " — Seed period"}</p>
                  </div>
                );
              })()}
            </div>

            {/* ═══ BANK ═══ */}
            <div className="rpg-panel rounded-lg p-6 space-y-4">
              <h3 className="font-pixel text-o7-cream text-xs">The Bank</h3>
              <p className="text-[10px] text-o7-cream/40 font-body">Emergency exit — 10% of TWAP. Harvest through gameplay for 10x better.</p>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="TWAP" value={bankTwap > 0 ? `${bankTwap}` : "N/A"} color="text-o7-cream/70" />
                <Stat label="Fee" value={`${bankFeePct}%`} color={bankFeePct > 10 ? "text-red-400" : "text-o7-gold"} />
                <Stat label="Ripened" value={formatBlu(ripenedBlu)} color="text-purple-400" />
              </div>
              <div className="flex gap-3">
                <input type="number" placeholder="Blu to redeem" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)}
                  className="flex-1 rounded-md border border-o7-teal/20 bg-o7-dark/40 px-3 py-2 text-o7-cream text-sm font-body" />
                <button disabled={loading || ripenedBlu <= 0 || !redeemAmount}
                  onClick={() => runTx("Redeem", () => programs!.orchard.methods.redeemBlu(new BN(Math.floor(parseFloat(redeemAmount) * 1e9))).accounts({ user: publicKey, bankGrienTreasury: getBankGrienTreasuryPda(), userGrienAta: getAssociatedTokenAddressSync(gardenData!.grienMint!, publicKey) } as any).rpc())}
                  className="rpg-panel rounded-md px-4 py-2 font-pixel text-[10px] text-red-400 hover:text-o7-cream disabled:opacity-40 transition">
                  Redeem
                </button>
              </div>
            </div>

            {/* ═══ GARDEN STATS ═══ */}
            <div className="rpg-panel rounded-lg p-6 space-y-4">
              <h3 className="font-pixel text-o7-cream text-xs">Garden Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Total SOL" value={`${(gardenData.totalSolDeposited / LAMPORTS_PER_SOL).toFixed(2)}`} color="text-o7-cream" />
                <Stat label="GrienApple" value={formatGrien(gardenData.totalGrienMinted)} color="text-o7-teal" />
                <Stat label="Epoch" value={gardenData.currentEpoch.toString()} color="text-o7-cream" />
                <Stat label="Stakers" value={gardenData.stakerCount.toString()} color="text-o7-cream" />
                <Stat label="Fountain" value={`${fountainPulses} pulses`} color="text-cyan-400" />
                <Stat label="Blu Earned" value={formatBlu(bluData?.totalEarned || 0)} color="text-blue-400" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Treasury (50%)", val: treasuryBalances.treasury, color: "text-o7-cream" },
                  { label: "Fountain (30%)", val: treasuryBalances.fountain, color: "text-cyan-400" },
                  { label: "Buyback (20%)", val: treasuryBalances.buyback, color: "text-o7-gold" },
                ].map((v) => (
                  <div key={v.label} className="rounded-md bg-o7-dark/40 p-2 text-center">
                    <p className="text-[9px] text-o7-cream/40 font-body">{v.label}</p>
                    <p className={`text-xs font-semibold font-body ${v.color}`}>{(v.val / LAMPORTS_PER_SOL).toFixed(4)} SOL</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ UNSTAKE ═══ */}
            {stakerData && stakerData.depositedSol > 0 && (
              <div className="rpg-panel rounded-lg p-6 space-y-3">
                <h3 className="font-pixel text-o7-cream text-xs">Unstake</h3>
                <p className="text-[10px] text-o7-cream/40 font-body">
                  Staked: {(stakerData.depositedSol / LAMPORTS_PER_SOL).toFixed(2)} SOL
                  {isLocked && ` — Locked: ${formatDuration(lockTimeRemaining)}`}
                </p>
                <div className="flex gap-3">
                  <input type="number" placeholder="0 = full" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)}
                    className="flex-1 rounded-md border border-o7-teal/20 bg-o7-dark/40 px-3 py-2 text-o7-cream text-sm font-body" />
                  <button disabled={loading || isLocked}
                    onClick={() => runTx("Unstake", () => programs!.orchard.methods.unstakeSol(unstakeAmount ? new BN(Math.floor(parseFloat(unstakeAmount) * LAMPORTS_PER_SOL)) : new BN(0)).accounts({ staker: publicKey } as any).rpc())}
                    className="rpg-panel rounded-md px-4 py-2 font-pixel text-[10px] text-o7-cream/60 hover:text-o7-cream disabled:opacity-40 transition">
                    {isLocked ? `Locked` : "Unstake"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Oru sprite */}
        <div className="absolute right-4 bottom-4 w-24 h-24 hidden lg:block">
          <img src="/assets/oru-idle.png" alt="Oru" className="w-full h-full object-contain pixelated"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] text-o7-cream/40 uppercase tracking-wider font-body">{label}</p>
      <p className={`text-sm font-bold font-body ${color}`}>{value}</p>
    </div>
  );
}

function formatDuration(secs: number): string {
  if (secs <= 0) return "0s";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
