/**
 * EVM token launch — deploys the embedded minimal ERC20, signed ON-DEVICE.
 * Product law: the user pays their own gas; the token deploys from their
 * own wallet. We never see the key.
 */
import { ethers } from "ethers";
import { getEvmPrivateKey, type ChainId } from "./wallets";
import artifact from "./contracts/OrbitXToken.json";

export interface EvmChainConfig {
  id: Exclude<ChainId, "solana">;
  label: string;
  rpc: string;
  explorer: string;
}

export const EVM_LAUNCH_CHAINS: EvmChainConfig[] = [
  { id: "base", label: "Base", rpc: "https://mainnet.base.org", explorer: "https://basescan.org" },
  { id: "ethereum", label: "Ethereum", rpc: "https://eth.llamarpc.com", explorer: "https://etherscan.io" },
];

export interface EvmLaunchResult {
  contract: string;
  txHash: string;
  explorer: string;
}

/** Deploy the ERC20. name/symbol/supply human (e.g. "1000000"). */
export async function launchEvmToken(
  chain: EvmChainConfig,
  name: string,
  symbol: string,
  supply: string
): Promise<EvmLaunchResult> {
  const priv = await getEvmPrivateKey(chain.id);
  if (!priv) throw new Error("No wallet on this device yet");

  const provider = new ethers.JsonRpcProvider(chain.rpc);
  const signer = new ethers.Wallet(priv, provider);

  // sanity: enough native balance for gas
  const bal = await provider.getBalance(signer.address);
  if (bal === 0n) throw new Error(`No ${chain.label} gas in your wallet — fund it first`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(
    name.slice(0, 32),
    symbol.slice(0, 10).toUpperCase(),
    ethers.parseUnits(supply, 18)
  );
  const deployTx = contract.deploymentTransaction();
  if (!deployTx) throw new Error("Deploy transaction failed to build");
  const receipt = await deployTx.wait(1);
  const address = await contract.getAddress();
  return {
    contract: address,
    txHash: receipt?.hash ?? deployTx.hash,
    explorer: chain.explorer,
  };
}
