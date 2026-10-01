/**
 * Token intelligence — all keyless by default, all real, all updating.
 * Optional upgrades (never hardcoded, never required):
 *   EXPO_PUBLIC_BIRDEYE_KEY — Birdeye OHLC candles + richer holder data
 *   EXPO_PUBLIC_HELIUS_KEY  — Helius DAS / enhanced holder endpoints
 * When absent, everything falls back to keyless sources (Dexscreener,
 * Rugcheck, CoinGecko, pump.fun). Nothing is ever mocked.
 */
import { quoteForCashtag, type TokenQuote } from "./market";

const BIRDEYE_KEY = process.env.EXPO_PUBLIC_BIRDEYE_KEY ?? "";
const HELIUS_KEY = process.env.EXPO_PUBLIC_HELIUS_KEY ?? "";

export interface HolderInfo {
  address: string;
  pct: number;
  uiAmount: number;
  owner?: string;
}

export interface SafetyInfo {
  score: number;
  rugged: boolean;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  lpLockedPct: number | null;
  topHolderPct: number;
  insiderPct: number;
  risks: string[];
}

export interface TokenIntel {
  quote: TokenQuote | null;
  chart: number[] | null;       // line data (keyless)
  candles: Candle[] | null;     // OHLC (Birdeye only)
  ath: number | null;
  holders: HolderInfo[];
  safety: SafetyInfo | null;
  rugcheckRaw: any;
}

export interface Candle { t: number; o: number; h: number; l: number; c: number }

/** Full Rugcheck report (keyless). */
export async function rugcheckReport(mint: string): Promise<any | null> {
  try {
    const r = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** ATH from CoinGecko 30d chart (keyless). */
async function athFromCoingecko(symbol: string): Promise<{ ath: number | null; prices: number[] | null }> {
  try {
    const s = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`);
    if (!s.ok) return { ath: null, prices: null };
    const coin = ((await s.json()).coins ?? []).find((c: any) => c.symbol?.toUpperCase() === symbol.toUpperCase());
    if (!coin?.id) return { ath: null, prices: null };
    const m = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=30`);
    if (!m.ok) return { ath: null, prices: null };
    const prices: number[] = ((await m.json()).prices ?? []).map((p: number[]) => p[1]);
    if (!prices.length) return { ath: null, prices: null };
    return { ath: Math.max(...prices), prices };
  } catch {
    return { ath: null, prices: null };
  }
}

/** Birdeye OHLC (only when the user pastes a key). */
async function birdeyeCandles(mint: string): Promise<Candle[] | null> {
  if (!BIRDEYE_KEY) return null;
  try {
    const now = Math.floor(Date.now() / 1000);
    const r = await fetch(
      `https://public-api.birdeye.so/defi/ohlcv?address=${mint}&type=15m&time_from=${now - 86400}&time_to=${now}`,
      { headers: { "X-API-KEY": BIRDEYE_KEY, "x-chain": "solana" } }
    );
    if (!r.ok) return null;
    const items = (await r.json())?.data?.items ?? [];
    if (!items.length) return null;
    return items.map((c: any) => ({ t: c.unixTime * 1000, o: c.o, h: c.h, l: c.l, c: c.c }));
  } catch {
    return null;
  }
}

/** Assemble everything for the token page. */
export async function getTokenIntel(symbol: string): Promise<TokenIntel> {
  const quote = await quoteForCashtag(symbol);
  const mint = quote?.address;

  const [rc, cg, candles] = await Promise.all([
    mint ? rugcheckReport(mint) : Promise.resolve(null),
    athFromCoingecko(symbol),
    mint ? birdeyeCandles(mint) : Promise.resolve(null),
  ]);

  let holders: HolderInfo[] = [];
  let safety: SafetyInfo | null = null;
  if (rc) {
    holders = (rc.topHolders ?? []).slice(0, 10).map((h: any) => ({
      address: h.address ?? h.owner ?? "",
      pct: h.pct ?? 0,
      uiAmount: h.uiAmount ?? 0,
      owner: h.owner,
    }));
    const risks: string[] = (rc.risks ?? []).map((r: any) => r.name ?? r.description ?? "").filter(Boolean);
    safety = {
      score: rc.score ?? 0,
      rugged: rc.rugged ?? false,
      mintAuthority: rc.mintAuthority ?? null,
      freezeAuthority: rc.freezeAuthority ?? null,
      lpLockedPct: rc.markets?.[0]?.lp?.lpLockedPct ?? null,
      topHolderPct: holders[0]?.pct ?? 0,
      insiderPct: rc.insiderNetworks
        ? rc.insiderNetworks.reduce((a: number, n: any) => a + (n.currentHoldingPct ?? 0), 0)
        : 0,
      risks: risks.slice(0, 6),
    };
  }

  return {
    quote, chart: cg.prices, candles, ath: cg.ath,
    holders, safety, rugcheckRaw: rc,
  };
}

export const hasBirdeye = () => !!BIRDEYE_KEY;
export const hasHelius = () => !!HELIUS_KEY;
