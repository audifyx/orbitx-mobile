/**
 * Live coin data — Dexscreener (price/change) + CoinGecko (sparkline).
 * No API keys. Never mock: every function returns null on failure and the
 * UI renders an honest loading/error state.
 */

export interface TokenQuote {
  symbol: string;
  name: string;
  address: string;
  chainId: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  liquidityUsd: number;
  fdv: number;
  pairAddress: string;
  iconUrl?: string;
}

interface DexPair {
  chainId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  info?: { imageUrl?: string };
}

/** Best-match pair for a cashtag like "BONK". Prefers Solana, highest liquidity. */
export async function quoteForCashtag(cashtag: string): Promise<TokenQuote | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(cashtag)}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const pairs: DexPair[] = (d.pairs ?? []).filter(
      (p: DexPair) =>
        p.baseToken?.symbol?.toUpperCase() === cashtag.toUpperCase() && p.priceUsd
    );
    if (!pairs.length) return null;
    // prefer solana, then highest liquidity
    pairs.sort((a, b) => {
      const ac = a.chainId === "solana" ? 1 : 0;
      const bc = b.chainId === "solana" ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
    });
    const p = pairs[0];
    return {
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      address: p.baseToken.address,
      chainId: p.chainId,
      priceUsd: parseFloat(p.priceUsd!),
      change24h: p.priceChange?.h24 ?? 0,
      volume24h: p.volume?.h24 ?? 0,
      liquidityUsd: p.liquidity?.usd ?? 0,
      fdv: p.fdv ?? 0,
      pairAddress: p.pairAddress,
      iconUrl: p.info?.imageUrl,
    };
  } catch {
    return null;
  }
}

/** 24h sparkline points via CoinGecko free market_chart (symbol -> id lookup). */
export async function sparklineForSymbol(symbol: string): Promise<number[] | null> {
  try {
    const s = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`
    );
    if (!s.ok) return null;
    const sd = await s.json();
    const coin = (sd.coins ?? []).find(
      (c: any) => c.symbol?.toUpperCase() === symbol.toUpperCase()
    );
    if (!coin?.id) return null;
    const m = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=1`
    );
    if (!m.ok) return null;
    const md = await m.json();
    const prices: number[][] = md.prices ?? [];
    if (prices.length < 2) return null;
    return prices.map((p) => p[1]);
  } catch {
    return null;
  }
}

/** Extract $CASHTAGs from post text. */
export function extractCashtags(text: string): string[] {
  const out: string[] = [];
  const re = /\$([A-Za-z0-9]{2,12})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tag = m[1].toUpperCase();
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 3); // max 3 mini-cards per post
}

export function formatUsd(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  // small prices: show meaningful precision
  const s = n.toFixed(10);
  const trimmed = s.replace(/0+$/, "");
  return "$" + trimmed;
}

export function formatCompact(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}
