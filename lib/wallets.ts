/**
 * OrbitX Mobile — self-custody wallets.
 *
 * ONE BIP39 mnemonic (12 words, ethers.js) is generated on-device on first
 * X sign-in and stored ONLY in Expo SecureStore (iOS Keychain / Android
 * Keystore, hardware-backed). From it we derive:
 *   - 4 EVM wallets (ETH, Base, Robinhood Chain, Arc) at m/44'/60'/0'/0/{0..3}
 *   - 1 Solana keypair via SLIP-0010 ed25519 at m/44'/501'/0'/0'
 *
 * The mnemonic / private keys NEVER leave the device: never logged, never
 * sent to Supabase or any server. The backend stores public addresses only
 * (see supabase/migrations/20261001000000_wallets.sql).
 *
 * Export (Profile -> Wallets) is the ONLY time key material is shown, after
 * explicit user confirmation.
 */
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import { Mnemonic, HDNodeWallet, randomBytes } from "ethers";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import type { SupabaseClient } from "@supabase/supabase-js";

const MNEMONIC_KEY = "orbitx_mnemonic_v1";

export type ChainId = "ethereum" | "base" | "robinhood" | "arc" | "solana";

export interface ChainInfo {
  id: ChainId;
  label: string;
  symbol: string;
  evmIndex: number | null; // null = solana
}

export const CHAINS: ChainInfo[] = [
  { id: "ethereum", label: "Ethereum", symbol: "ETH", evmIndex: 0 },
  { id: "base", label: "Base", symbol: "ETH", evmIndex: 1 },
  { id: "robinhood", label: "Robinhood Chain", symbol: "ETH", evmIndex: 2 },
  { id: "arc", label: "Arc", symbol: "USDC", evmIndex: 3 },
  { id: "solana", label: "Solana", symbol: "SOL", evmIndex: null },
];

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

/** Generate (first run) or load the device mnemonic, then derive all 5 addresses. */
export async function ensureWallets(): Promise<Record<ChainId, string>> {
  let phrase: string | null = await SecureStore.getItemAsync(MNEMONIC_KEY);
  if (!phrase) {
    phrase = Mnemonic.fromEntropy(randomBytes(16)).phrase; // 12 words
    await SecureStore.setItemAsync(MNEMONIC_KEY, phrase, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return deriveAddresses(phrase);
}

export function deriveAddresses(phrase: string): Record<ChainId, string> {
  const out = {} as Record<ChainId, string>;
  const mnemonic = Mnemonic.fromPhrase(phrase);
  for (const c of CHAINS) {
    if (c.evmIndex !== null) {
      const w = HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${c.evmIndex}`);
      out[c.id] = w.address;
    } else {
      const seed = mnemonic.computeSeed(); // 64-byte seed
      const { key } = derivePath(SOLANA_DERIVATION_PATH, Buffer.from(seed).toString("hex"));
      out[c.id] = Keypair.fromSeed(key).publicKey.toBase58();
    }
  }
  return out;
}

/** Does this device already hold a mnemonic? */
export async function hasWallets(): Promise<boolean> {
  return (await SecureStore.getItemAsync(MNEMONIC_KEY)) !== null;
}

/**
 * Push public addresses to Supabase (addresses only — no key material).
 * Call once after X sign-in. Idempotent (upsert on user_id+chain).
 */
export async function syncWalletAddresses(
  supabase: SupabaseClient,
  addresses: Record<ChainId, string>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No signed-in user");
  const rows = CHAINS.map((c) => ({
    user_id: user.id,
    chain: c.id,
    address: addresses[c.id],
  }));
  const { error } = await supabase.from("om_wallets").upsert(rows, { onConflict: "user_id,chain" });
  if (error) throw error;
}

/**
 * Convenience: call right after signInWithOAuth session is established.
 * Generates wallets on-device (if first run) and syncs addresses.
 */
export async function onSignedIn(supabase: SupabaseClient): Promise<Record<ChainId, string>> {
  const addresses = await ensureWallets();
  await syncWalletAddresses(supabase, addresses);
  return addresses;
}

// ── Export (the ONLY path that surfaces key material) ──

/** Full seed phrase (restores all 5 wallets). Shown only after user confirmation. */
export async function exportSeedPhrase(): Promise<string | null> {
  return SecureStore.getItemAsync(MNEMONIC_KEY);
}

/**
 * Individual private key for one chain.
 * EVM -> 0x-hex private key. Solana -> base58 64-byte secret key (Phantom-compatible).
 */
export async function exportPrivateKey(chain: ChainId): Promise<string | null> {
  const phrase = await SecureStore.getItemAsync(MNEMONIC_KEY);
  if (!phrase) return null;
  const mnemonic = Mnemonic.fromPhrase(phrase);
  if (chain === "solana") {
    const seed = mnemonic.computeSeed();
    const { key } = derivePath(SOLANA_DERIVATION_PATH, Buffer.from(seed).toString("hex"));
    return bs58.encode(Keypair.fromSeed(key).secretKey);
  }
  const idx = CHAINS.find((c) => c.id === chain)?.evmIndex;
  if (idx === null || idx === undefined) return null;
  return HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`).privateKey;
}

/** Solana Keypair for device-side transaction signing. Never leaves the device. */
export async function getSolanaKeypair(): Promise<InstanceType<typeof Keypair> | null> {
  const phrase = await SecureStore.getItemAsync(MNEMONIC_KEY);
  if (!phrase) return null;
  const seed = Mnemonic.fromPhrase(phrase).computeSeed();
  const { key } = derivePath(SOLANA_DERIVATION_PATH, Buffer.from(seed).toString("hex"));
  return Keypair.fromSeed(key);
}

/** EVM private key (0x-hex) for device-side signing on the given chain. */
export async function getEvmPrivateKey(chain: Exclude<ChainId, "solana">): Promise<string | null> {
  return exportPrivateKey(chain);
}

/** Permanently remove the device mnemonic (user-initiated wipe). */
export async function wipeWallets(): Promise<void> {
  await SecureStore.deleteItemAsync(MNEMONIC_KEY);
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
