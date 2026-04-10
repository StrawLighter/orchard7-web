import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import orchardIdl from "./orchard.json";

// ── Program ID (devnet deployed) ───────────────────────────────────────
export const ORCHARD_ID = new PublicKey(
  "DvVEq5v26rdDsaehVPL7cjNx54wpbE9f7m11UuitZeGQ"
);

// ── Program Constructor ────────────────────────────────────────────────
export function getOrchardProgram(provider: AnchorProvider) {
  return new Program(orchardIdl as any, provider);
}

// ── PDA Derivations ────────────────────────────────────────────────────
const pda = (seeds: Buffer[]) =>
  PublicKey.findProgramAddressSync(seeds, ORCHARD_ID)[0];

export const getGardenPda = () => pda([Buffer.from("garden")]);
export const getGardenSolPda = () => pda([Buffer.from("garden-sol")]);
export const getGrienMintAuthorityPda = () => pda([Buffer.from("grien-mint-authority")]);
export const getGardenGrienVaultPda = () => pda([Buffer.from("garden-grien-vault")]);
export const getStakerPda = (user: PublicKey) => pda([Buffer.from("staker"), user.toBuffer()]);
export const getBluLedgerPda = (user: PublicKey) => pda([Buffer.from("blu-ledger"), user.toBuffer()]);
export const getEpochStatePda = (epoch: BN) => pda([Buffer.from("epoch"), epoch.toArrayLike(Buffer, "le", 8)]);
export const getHarvestConfigPda = () => pda([Buffer.from("harvest-config")]);
export const getHarvestTrackerPda = (user: PublicKey) => pda([Buffer.from("harvest-tracker"), user.toBuffer()]);
export const getLpGardenPda = () => pda([Buffer.from("lp-garden")]);
export const getLpStakerPda = (user: PublicKey) => pda([Buffer.from("lp-staker"), user.toBuffer()]);
export const getLpVaultPda = () => pda([Buffer.from("lp-vault")]);
export const getLpGrienVaultPda = () => pda([Buffer.from("lp-grien-vault")]);
export const getBankConfigPda = () => pda([Buffer.from("bank-config")]);
export const getBankTrackerPda = (user: PublicKey) => pda([Buffer.from("bank-tracker"), user.toBuffer()]);
export const getBankGrienTreasuryPda = () => pda([Buffer.from("bank-grien-treasury")]);
export const getTreasuryConfigPda = () => pda([Buffer.from("treasury-config")]);
export const getTreasurySolPda = () => pda([Buffer.from("treasury-sol")]);
export const getFountainSolPda = () => pda([Buffer.from("fountain-sol")]);
export const getBuybackSolPda = () => pda([Buffer.from("buyback-sol")]);
export const getFountainConfigPda = () => pda([Buffer.from("fountain-config")]);
export const getFountainPulsePda = (pulseId: BN) => pda([Buffer.from("fountain-pulse"), pulseId.toArrayLike(Buffer, "le", 8)]);
export const getFountainClaimTrackerPda = (user: PublicKey) => pda([Buffer.from("fountain-claim"), user.toBuffer()]);

// ── Lock Tiers ─────────────────────────────────────────────────────────
// v0.5: Single multiplier per lock tier (applies to total reward before split)
export const LOCK_TIERS = [
  { name: "No Lock", days: 0, mult: "1.00x", multBps: 10000 },
  { name: "30 Days", days: 30, mult: "1.25x", multBps: 12500 },
  { name: "90 Days", days: 90, mult: "1.75x", multBps: 17500 },
  { name: "180 Days", days: 180, mult: "2.50x", multBps: 25000 },
] as const;

// v0.5: Weekly ratio calculation
export function getWeeklyRatio(genesisTs: number, nowTs: number): { grienPct: number; bluPct: number; weekIndex: number } {
  const WEEK_SECS = 7 * 86400;
  const weekIndex = Math.floor((nowTs - genesisTs) / WEEK_SECS) + 1;
  const grienBps = Math.min(9000, 500 + 150 * (weekIndex - 1));
  const bluBps = 10000 - grienBps;
  return { grienPct: grienBps / 100, bluPct: bluBps / 100, weekIndex };
}

// Early unstake fee calculation
export function getEarlyUnstakeFee(lockTier: number, lockExpiry: number, nowTs: number): number {
  if (lockTier === 0 || nowTs >= lockExpiry) return 0;
  const LOCK_DURATIONS = [0, 30 * 86400, 90 * 86400, 180 * 86400];
  const duration = LOCK_DURATIONS[lockTier];
  const lockStart = lockExpiry - duration;
  const elapsed = nowTs - lockStart;
  const remainingPct = ((duration - elapsed) / duration) * 100;
  if (remainingPct > 75) return 10;
  if (remainingPct > 50) return 5;
  return 2.5; // floor
}

// ── Formatting ─────────────────────────────────────────────────────────
export function formatGrien(amount: BN | number | bigint): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  return (n / 1e9).toFixed(2);
}

export function formatBlu(amount: BN | number | bigint): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  return (n / 1e9).toFixed(4);
}

export function calculateRipenedBlu(
  batches: Array<{ earnedTs: number; totalAmount: number; harvestedAmount: number }>,
  nowTs: number
): number {
  const WEEK_SECS = 7 * 86400;
  let total = 0;
  for (const batch of batches) {
    if (batch.totalAmount === 0) continue;
    const weeks = Math.floor((nowTs - batch.earnedTs) / WEEK_SECS);
    if (weeks < 3) continue;
    const pct = Math.min(100, (weeks - 2) * 2);
    const ripened = Math.floor((batch.totalAmount * pct) / 100);
    total += ripened - batch.harvestedAmount;
  }
  return Math.max(0, total);
}
