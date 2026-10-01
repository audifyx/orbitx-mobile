/**
 * Solana token launch — SPL mint + Metaplex metadata, signed ON-DEVICE.
 * Product law: the user pays their own gas; the token deploys from their
 * own wallet. We never see the key.
 */
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  MINT_SIZE, TOKEN_PROGRAM_ID, createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction, createMintToInstruction,
  getAssociatedTokenAddress, getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import { getSolanaKeypair } from "./wallets";
import { getConnection } from "./jupiter";

export interface LaunchInput {
  name: string;
  symbol: string;
  description: string;
  imageUri?: string; // local file uri
  supply: string; // human, e.g. "1000000000"
  decimals?: number;
}

export interface LaunchResult {
  mint: string;
  signature: string;
  metadataUri?: string;
}

/** Upload image + metadata JSON to IPFS via pump.fun's public endpoint (no key). */
async function uploadMetadata(input: LaunchInput): Promise<string | undefined> {
  try {
    let imageUrl = "";
    if (input.imageUri) {
      const form = new FormData();
      const resp = await fetch(input.imageUri);
      const blob = await resp.blob();
      form.append("file", blob, "token.png");
      const up = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: form as any });
      if (up.ok) {
        const j = await up.json();
        if (j.ipfs_hash) imageUrl = `https://ipfs.io/ipfs/${j.ipfs_hash}`;
      }
    }
    const meta = {
      name: input.name,
      symbol: input.symbol,
      description: input.description,
      image: imageUrl,
      showName: true,
      createdOn: "https://orbitx.world",
    };
    const mr = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    if (mr.ok) {
      const j = await mr.json();
      if (j.ipfs_hash) return `https://ipfs.io/ipfs/${j.ipfs_hash}`;
    }
  } catch (e) {
    console.warn("metadata upload failed, launching without URI", e);
  }
  return undefined;
}

/** Deploy the token. Throws on failure with a human message. */
export async function launchSolanaToken(input: LaunchInput): Promise<LaunchResult> {
  const payer = await getSolanaKeypair();
  if (!payer) throw new Error("No wallet on this device yet");
  const conn = getConnection();
  const decimals = input.decimals ?? 6;

  const metadataUri = await uploadMetadata(input);
  const mint = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(conn);
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey);

  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
    METADATA_PROGRAM_ID
  );

  const supplyBase = BigInt(Math.floor(Number(input.supply) * 10 ** decimals));

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mint.publicKey, decimals, payer.publicKey, null),
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPda,
        mint: mint.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: input.name.slice(0, 32),
            symbol: input.symbol.slice(0, 10).toUpperCase(),
            uri: metadataUri ?? "",
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      }
    ),
    createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mint.publicKey),
    createMintToInstruction(mint.publicKey, ata, payer.publicKey, supplyBase)
  );

  const sig = await sendAndConfirmTransaction(conn, tx, [payer, mint], {
    commitment: "confirmed",
    maxRetries: 3,
  });

  return { mint: mint.publicKey.toBase58(), signature: sig, metadataUri };
}
