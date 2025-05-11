const chains = require('./chains');
const { ethers } = require("ethers");
const service = require('./service');
const readline = require('readline');
const etc = chains.utils.etc;
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function loadWalletsFromEnv() {
  const wallets = [];
  let i = 1;
  
  while (process.env[`PRIVATE_KEY_${i}`]) {
    const privateKey = process.env[`PRIVATE_KEY_${i}`].trim();
    try {
      const wallet = new ethers.Wallet(privateKey);
      wallets.push({
        name: process.env[`WALLET_NAME_${i}`] || `Wallet ${i}`,
        privatekey: privateKey,
        address: wallet.address // Pre-compute address
      });
    } catch (e) {
      console.error(`[!] Invalid private key for WALLET_NAME_${i}`);
    }
    i++;
  }

  if (wallets.length === 0) {
    console.error("[!] No valid wallets found in .env file");
    process.exit(1);
  }

  return wallets;
}

async function selectWalletsInteractive(wallets) {
  console.log("\nAvailable Wallets:");
  console.log(`[0] All wallets (${wallets.length})`);
  wallets.forEach((w, idx) => {
    console.log(`[${idx + 1}] ${w.name} (${w.address})`);
  });

  const input = await askQuestion("Select wallets (comma separated, 0 for all): ");
  const selections = new Set(
    input.split(',')
      .map(x => parseInt(x.trim()))
      .filter(x => !isNaN(x) && x >= 0 && x <= wallets.length)
  );

  if (selections.has(0)) return wallets;
  return wallets.filter((_, index) => selections.has(index + 1));
}

async function askMaxTransactions() {
  const input = await askQuestion('Number of transactions per wallet (default 1): ');
  const value = parseInt(input) || 1;
  return Math.max(1, value);
}

async function selectTransactionType() {
  const TRANSACTION_TYPES = {
    1: { label: "Sepolia → Babylon", method: service.sepoliaBabylon },
    2: { label: "Sepolia → Holesky", method: service.sepoliaHolesky }
  };

  console.log("\nAvailable Transactions:");
  Object.entries(TRANSACTION_TYPES).forEach(([key, val]) => {
    console.log(`[${key}] ${val.label}`);
  });
  console.log(`[0] All transactions`);

  const input = await askQuestion("Select transaction type: ");
  const choice = parseInt(input);

  if (choice === 0) return Object.values(TRANSACTION_TYPES);
  return TRANSACTION_TYPES[choice] ? [TRANSACTION_TYPES[choice]] : [TRANSACTION_TYPES[1]]; // Default to first option
}

async function main() {
  etc.header();
  
  // Load and validate wallets
  const wallets = await loadWalletsFromEnv();
  
  // Interactive selection
  const selectedWallets = await selectWalletsInteractive(wallets);
  global.selectedWallets = selectedWallets;

  console.log("\n✅ Selected Wallets:");
  console.table(selectedWallets.map(w => ({
    Name: w.name,
    Address: w.address,
    'Key Preview': `${w.privatekey.slice(0, 6)}...${w.privatekey.slice(-4)}`
  })));

  // Get transaction parameters
  global.maxTransaction = await askMaxTransactions();
  const transactions = await selectTransactionType();

  rl.close();

  // Execute transactions
  for (const tx of transactions) {
    console.log(`\n🚀 Starting: ${tx.label}`);
    try {
      await tx.method();
    } catch (error) {
      console.error(`[${etc.timelog()}] FAILED: ${error.message}`);
    }
  }
}

main().catch(console.error);
