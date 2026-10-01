/**
 * Solana swaps via Jupiter Lite (keyless public API) — signed ON-DEVICE
 * with the user's self-custody Solana keypair. We never see the key.
 */
import { Buffer } from "buffer";
import { Connection, VersionedTransaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getSolanaKeypair } from "./wallets";

const JUP = "https://lite-api.jup.ag";
const RPC = "https://api.mainnet-beta.solana.com";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface JupToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface QuoteResult {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC, "confirmed");
  return connection;
}

/** Search Jupiter's token list. */
export async function searchTokens(query: string): Promise<JupToken[]> {
  const r = await fetch(`${JUP}/tokens/v2/search?query=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error("Token search failed");
  const d = await r.json();
  return (Array.isArray(d) ? d : []).slice(0, 20).map((t: any) => ({
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: t.logoURI,
  }));
}

/** Well-known defaults for the picker. */
export async function defaultTokens(): Promise<JupToken[]> {
  const cached: JupToken[] = [
    { address: SOL_MINT, symbol: "SOL", name: "Solana", decimals: 9 },
    { address: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6 },
  ];
  try {
    const r = await fetch(`${JUP}/tokens/v2/tag?query=verified`);
    if (r.ok) {
      const d = await r.json();
      const list: JupToken[] = (Array.isArray(d) ? d : []).slice(0, 12).map((t: any) => ({
        address: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI,
      }));
      const seen = new Set(cached.map((c) => c.address));
      for (const t of list) if (!seen.has(t.address)) cached.push(t);
    }
  } catch { /* defaults stand */ }
  return cached;
}

/** Get a swap quote. amount is in the input token's base units (string). */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountBaseUnits: string,
  slippageBps = 100
): Promise<QuoteResult> {
  const r = await fetch(
    `${JUP}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBaseUnits}&slippageBps=${slippageBps}`
  );
  if (!r.ok) throw new Error("No route found for this pair");
  return r.json();
}

/** Build, device-sign, and broadcast the swap. Returns the tx signature. */
export async function executeSwap(quote: QuoteResult): Promise<string> {
  const keypair = await getSolanaKeypair();
  if (!keypair) throw new Error("No wallet on this device yet");
  const conn = getConnection();

  const r = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!r.ok) throw new Error("Failed to build swap transaction");
  const { swapTransaction } = await r.json();

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  tx.sign([keypair]);
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  return sig;
}

/** SOL balance of the device wallet. */
export async function getSolBalance(): Promise<number> {
  const kp = await getSolanaKeypair();
  if (!kp) return 0;
  return (await getConnection().getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
}

/** SPL token balance (base units) for a mint. */
export async function getTokenBalance(mint: string): Promise<string> {
  const kp = await getSolanaKeypair();
  if (!kp) return "0";
  try {
    const accounts = await getConnection().getParsedTokenAccountsByOwner(kp.publicKey, {
      mint: new PublicKey(mint),
    });
    if (!accounts.value.length) return "0";
    return accounts.value[0].account.data.parsed.info.tokenAmount.amount as string;
  } catch {
    return "0";
  }
}

/** Convert a human amount to base units. */
export function toBaseUnits(human: string, decimals: number): string {
  const [whole = "0", frac = ""] = human.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole || "0") * BigInt(10 ** decimals) + BigInt(fracPadded || "0")).toString();
}

/** Convert base units to a human string. */
export function fromBaseUnits(base: string, decimals: number): string {
  const b = BigInt(base);
  const d = BigInt(10 ** decimals);
  const w = b / d;
  const f = (b % d).toString().padStart(decimals, "0").replace(/0+$/, "");
  return f ? `${w}.${f}` : w.toString();
}
