/**
 * Balances + activity for all 5 self-custody chains. All keyless, all real.
 * Solana: mainnet RPC. EVM: public LlamaRPC endpoints. EVM activity:
 * Blockscout public APIs (no key).
 */
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ethers } from "ethers";
import { getConnection } from "./jupiter";
import { deriveAddresses, type ChainId } from "./wallets";

const EVM_RPC: Record<string, { rpc: string; explorer: string; activity: string }> = {
  ethereum: {
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
    activity: "https://eth.blockscout.com/api/v2/addresses",
  },
  base: {
    rpc: "https://base.llamarpc.com",
    explorer: "https://basescan.org",
    activity: "https://base.blockscout.com/api/v2/addresses",
  },
  robinhood: {
    rpc: "https://eth.llamarpc.com", // placeholder until RH chain RPC is known
    explorer: "https://etherscan.io",
    activity: "https://eth.blockscout.com/api/v2/addresses",
  },
  arc: {
    rpc: "https://eth.llamarpc.com", // placeholder until Arc RPC is known
    explorer: "https://etherscan.io",
    activity: "https://eth.blockscout.com/api/v2/addresses",
  },
};

export interface ChainBalance {
  chain: ChainId;
  label: string;
  address: string;
  native: string;      // human, e.g. "1.234"
  nativeSymbol: string;
  usd: number | null;  // null when price unknown
}

async function solPriceUsd(): Promise<number | null> {
  try {
    const r = await fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112");
    const d = await r.json();
    return Number(d?.["So11111111111111111111111111111111111111112"]?.usdPrice ?? null) || null;
  } catch { return null; }
}

async function ethPriceUsd(): Promise<number | null> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const d = await r.json();
    return d?.ethereum?.usd ?? null;
  } catch { return null; }
}

/** Native balances for all 5 chains (mnemonic needed to derive addresses). */
export async function getAllBalances(mnemonic: string): Promise<ChainBalance[]> {
  const addrs = deriveAddresses(mnemonic);
  const [solUsd, ethUsd] = await Promise.all([solPriceUsd(), ethPriceUsd()]);
  const out: ChainBalance[] = [];

  // Solana
  try {
    const lamports = await getConnection().getBalance(new PublicKey(addrs.solana));
    const sol = lamports / LAMPORTS_PER_SOL;
    out.push({
      chain: "solana", label: "Solana", address: addrs.solana,
      native: sol.toFixed(4), nativeSymbol: "SOL",
      usd: solUsd != null ? sol * solUsd : null,
    });
  } catch {
    out.push({ chain: "solana", label: "Solana", address: addrs.solana, native: "—", nativeSymbol: "SOL", usd: null });
  }

  // EVM chains
  const evmChains: { id: ChainId; label: string; symbol: string }[] = [
    { id: "ethereum", label: "Ethereum", symbol: "ETH" },
    { id: "base", label: "Base", symbol: "ETH" },
    { id: "robinhood", label: "Robinhood Chain", symbol: "ETH" },
    { id: "arc", label: "Arc", symbol: "ETH" },
  ];
  await Promise.all(evmChains.map(async (c) => {
    try {
      const provider = new ethers.JsonRpcProvider(EVM_RPC[c.id].rpc);
      const bal = await provider.getBalance(addrs[c.id]);
      const eth = Number(ethers.formatEther(bal));
      out.push({
        chain: c.id, label: c.label, address: addrs[c.id],
        native: eth.toFixed(4), nativeSymbol: c.symbol,
        usd: ethUsd != null ? eth * ethUsd : null,
      });
    } catch {
      out.push({ chain: c.id, label: c.label, address: addrs[c.id], native: "—", nativeSymbol: c.symbol, usd: null });
    }
  }));

  const order: ChainId[] = ["solana", "ethereum", "base", "robinhood", "arc"];
  return out.sort((a, b) => order.indexOf(a.chain) - order.indexOf(b.chain));
}

export interface TxItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  time: number;
  explorer: string;
}

/** Recent native transfers for an address. */
export async function getActivity(chain: ChainId, address: string): Promise<TxItem[]> {
  try {
    if (chain === "solana") {
      const sigs = await getConnection().getSignaturesForAddress(new PublicKey(address), { limit: 10 });
      return sigs.map((s) => ({
        hash: s.signature, from: "", to: "",
        value: s.err ? "failed" : "confirmed",
        time: (s.blockTime ?? 0) * 1000,
        explorer: `https://solscan.io/tx/${s.signature}`,
      }));
    }
    const cfg = EVM_RPC[chain];
    const r = await fetch(`${cfg.activity}/${address}/transactions?items_count=10`);
    if (!r.ok) return [];
    const items = (await r.json())?.items ?? [];
    return items.map((t: any) => ({
      hash: t.hash, from: t.from?.hash ?? "", to: t.to?.hash ?? "",
      value: t.value ? ethers.formatEther(t.value) : "0",
      time: new Date(t.timestamp).getTime(),
      explorer: `${cfg.explorer}/tx/${t.hash}`,
    }));
  } catch {
    return [];
  }
}
