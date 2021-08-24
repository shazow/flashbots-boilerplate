import { BigNumber, providers, Wallet } from "https://esm.sh/ethers";
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from "https://esm.sh/@flashbots/ethers-provider-bundle";

const FLASHBOTS_AUTH_KEY = Deno.env.get('FLASHBOTS_AUTH_KEY');
const WALLET_PRIVATE_KEY = Deno.env.get('WALLET_PRIVATE_KEY');

const GWEI = BigNumber.from(10).pow(9);
const PRIORITY_FEE = GWEI.mul(3);
const LEGACY_GAS_PRICE = GWEI.mul(12);
const BLOCKS_IN_THE_FUTURE = 2;

const CHAIN_ID = 5;
const provider = new providers.InfuraProvider(CHAIN_ID, Deno.env.get('INFURA_API_KEY'));
const FLASHBOTS_EP = 'https://relay-goerli.flashbots.net/';

// Ref: https://github.com/flashbots/ethers-provider-flashbots-bundle/blob/master/src/demo.ts

async function main() {
  const authSigner = FLASHBOTS_AUTH_KEY ? new Wallet(FLASHBOTS_AUTH_KEY) : Wallet.createRandom();
  const wallet = WALLET_PRIVATE_KEY ? new Wallet(WALLET_PRIVATE_KEY, provider) : Wallet.createRandom();

  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, FLASHBOTS_EP);

  const block = await provider.getBlock('latest');
  const baseFee : BigNumber = block.baseFeePerGas || GWEI;
  const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(baseFee, BLOCKS_IN_THE_FUTURE);

  const txn = {
    to: await wallet.getAddress(),
    type: 2, // EIP-1159
    maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
    maxPriorityFeePerGas: PRIORITY_FEE,
    gasLimit: 21000,
    data: '0x',
    chainId: CHAIN_ID,
  };

  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: wallet,
      transaction: txn,
    },
  ]);

  const targetBlock = block.number + BLOCKS_IN_THE_FUTURE;
  const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlock);

  if ('error' in simulation) {
    console.warn(`Simulation Error: ${simulation.error.message}`);
    return;
  } else {
    console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`);
  }

  const bundleSubmission = await flashbotsProvider.sendRawBundle(signedTransactions, targetBlock);
  console.log('bundle submitted, waiting');
  if ('error' in bundleSubmission) {
    throw new Error(bundleSubmission.error.message);
  }

  const waitResponse = await bundleSubmission.wait();
  console.log(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`);
  if (waitResponse === FlashbotsBundleResolution.BundleIncluded || waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
    return;
  } else {
    console.log({
      bundleStats: await flashbotsProvider.getBundleStats(simulation.bundleHash, targetBlock),
      userStats: await flashbotsProvider.getUserStats(),
    });
  }
}

export function bundle(a: string): void {
  console.log("foo");
}

await main();
