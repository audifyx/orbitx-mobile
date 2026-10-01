/**
 * OrbitX Mobile — Solana vanity launch flow, mirroring the OrbitX launchpad.
 *
 *  1. Vanity mint: grind a mint keypair ending in "obx" (budgeted, else random)
 *  2. Metadata: upload name/symbol/description/image to IPFS (pump.fun endpoint)
 *  3. Create: pump.fun program via PumpPortal trade-local (SOL pair) or the
 *     @pump-fun/pump-sdk createV2 instruction (USDC pair)
 *  4. Dev buy: included in the create tx (SOL) or as an immediate follow-up
 *     buy (USDC) — both signed ON-DEVICE, user pays gas. Product law holds:
 *     never a platform wallet.
 */
import { Buffer } from "buffer";
import {
  Connection, Keypair, PublicKey, Transaction,
  ComputeBudgetProgram, sendAndConfirmTransaction,
} from "@solana/web3.js";
import { PUMP_SDK } from "@pump-fun/pump-sdk";
import { getSolanaKeypair } from "./wallets";
import { getConnection } from "./jupiter";

export const VANITY_SUFFIX = "obx";
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const PUMP_LOCAL = "https://pumpportal.fun/api/trade-local";
const VANITY_BUDGET_MS = 10_000;

export type QuotePair = "sol" | "usdc";

export interface PumpLaunchInput {
  name: string;
  symbol: string;
  description: string;
  imageUri?: string;
  pair: QuotePair;
  devBuySol: number; // 0 = no dev buy
}

export interface PumpLaunchResult {
  mint: string;
  signature: string;
  devBuySignature?: string;
  vanity: boolean;
  metadataUri?: string;
  explorer: string;
}

/** Grind a vanity mint ending in "obx" within budget; fall back to random. */
export async function mineVanityMint(
  suffix = VANITY_SUFFIX,
  budgetMs = VANITY_BUDGET_MS,
  onProgress?: (tries: number) => void
): Promise<{ keypair: Keypair; vanity: boolean; tries: number }> {
  const deadline = Date.now() + budgetMs;
  let tries = 0;
  while (Date.now() < deadline) {
    for (let i = 0; i < 50; i++) {
      tries++;
      const kp = Keypair.generate();
      if (kp.publicKey.toBase58().endsWith(suffix)) {
        return { keypair: kp, vanity: true, tries };
      }
      if (Date.now() >= deadline) break;
    }
    onProgress?.(tries);
    await new Promise((r) => setTimeout(r, 0)); // keep UI alive
  }
  return { keypair: Keypair.generate(), vanity: false, tries };
}

/** Upload image + metadata JSON to IPFS via pump.fun's public endpoint. */
export async function uploadPumpMetadata(input: {
  name: string; symbol: string; description: string; imageUri?: string;
}): Promise<string> {
  let imageUrl = "";
  if (input.imageUri) {
    const form = new FormData();
    const resp = await fetch(input.imageUri);
    form.append("file", await resp.blob(), "token.png");
    const up = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: form as any });
    if (!up.ok) throw new Error("Image upload failed");
    const j = await up.json();
    if (!j.ipfs_hash) throw new Error("Image upload failed");
    imageUrl = `https://ipfs.io/ipfs/${j.ipfs_hash}`;
  }
  const meta = {
    name: input.name, symbol: input.symbol, description: input.description,
    image: imageUrl, showName: true, createdOn: "https://orbitx.world",
  };
  const mr = await fetch("https://pump.fun/api/ipfs", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta),
  });
  if (!mr.ok) throw new Error("Metadata upload failed");
  const j = await mr.json();
  if (!j.ipfs_hash) throw new Error("Metadata upload failed");
  return `https://ipfs.io/ipfs/${j.ipfs_hash}`;
}

/** Build the pump.fun create (+dev buy) tx via PumpPortal. Returns base64 unsigned tx. */
async function pumpCreateTx(input: {
  publicKey: string; name: string; symbol: string; metadataUri: string;
  mint: string; devBuySol: number;
}): Promise<string> {
  const res = await fetch(PUMP_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: input.publicKey,
      action: "create",
      tokenMetadata: { name: input.name, symbol: input.symbol, uri: input.metadataUri },
      mint: input.mint,
      denominatedInSol: "true",
      amount: input.devBuySol,
      slippage: 15,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Pump.fun would not build the create tx");
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

/** PumpPortal buy (used for the USDC dev-buy follow-up). */
async function pumpBuyTx(input: {
  publicKey: string; mint: string; amountUsdc: number;
}): Promise<string> {
  const res = await fetch(PUMP_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: input.publicKey,
      action: "buy",
      mint: input.mint,
      denominatedInSol: "false",
      amount: input.amountUsdc,
      slippage: 15,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Pump.fun would not build the buy tx");
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function signAndSend(
  conn: Connection, base64Tx: string, signers: Keypair[]
): Promise<string> {
  const tx = Transaction.from(Buffer.from(base64Tx, "base64"));
  tx.sign(...signers);
  return sendAndConfirmTransaction(conn, tx, signers, { commitment: "confirmed", maxRetries: 3 });
}

/**
 * Full launch. SOL pair: single tx (create + dev buy) via PumpPortal.
 * USDC pair: create via pump-sdk createV2, then dev buy via PumpPortal.
 */
export async function launchPumpToken(
  input: PumpLaunchInput,
  onStatus?: (s: string) => void
): Promise<PumpLaunchResult> {
  const payer = await getSolanaKeypair();
  if (!payer) throw new Error("No wallet on this device yet");
  const conn = getConnection();
  const symbol = input.symbol.toUpperCase();

  onStatus?.("Uploading metadata…");
  const metadataUri = await uploadPumpMetadata(input);

  onStatus?.("Mining vanity mint…");
  const { keypair: mintKp, vanity } = await mineVanityMint();
  const mintStr = mintKp.publicKey.toBase58();

  let signature: string;
  let devBuySignature: string | undefined;

  if (input.pair === "sol") {
    onStatus?.("Building launch transaction…");
    const b64 = await pumpCreateTx({
      publicKey: payer.publicKey.toBase58(),
      name: input.name, symbol, metadataUri,
      mint: mintStr, devBuySol: input.devBuySol,
    });
    onStatus?.("Signing on this device…");
    signature = await signAndSend(conn, b64, [payer, mintKp]);
  } else {
    // USDC pair: build create_v2 directly via the pump SDK
    onStatus?.("Building USDC launch transaction…");
    const ix = await PUMP_SDK.createV2Instruction({
      mint: mintKp.publicKey,
      name: input.name, symbol, uri: metadataUri,
      creator: payer.publicKey, user: payer.publicKey,
      mayhemMode: false, cashback: false,
      quoteMint: USDC_MINT,
    });
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ix
    );
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    onStatus?.("Signing on this device…");
    signature = await sendAndConfirmTransaction(conn, tx, [payer, mintKp], {
      commitment: "confirmed", maxRetries: 3,
    });

    if (input.devBuySol > 0) {
      // dev buy in USDC (treat the SOL figure as USDC for the USDC pair)
      onStatus?.("Executing dev buy…");
      const b64 = await pumpBuyTx({
        publicKey: payer.publicKey.toBase58(), mint: mintStr, amountUsdc: input.devBuySol,
      });
      devBuySignature = await signAndSend(conn, b64, [payer]);
    }
  }

  return {
    mint: mintStr, signature, devBuySignature, vanity, metadataUri,
    explorer: `https://pump.fun/coin/${mintStr}`,
  };
}
