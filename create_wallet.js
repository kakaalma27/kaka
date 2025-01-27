import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

// Mendapatkan __dirname secara manual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentukan path untuk file accounts.json
const accountsFilePath = path.resolve(__dirname, "accounts.json");

// Fungsi untuk membaca file accounts.json
function readAccountsFile() {
  if (fs.existsSync(accountsFilePath)) {
    const fileData = fs.readFileSync(accountsFilePath, "utf8");
    return JSON.parse(fileData);
  } else {
    return [];
  }
}

// Fungsi untuk menulis data ke file accounts.json
function writeAccountsFile(accounts) {
  fs.writeFileSync(accountsFilePath, JSON.stringify(accounts, null, 2));
}

// Fungsi untuk membuat wallet baru
function createWallets(number) {
  const accounts = readAccountsFile();

  for (let i = 0; i < number; i++) {
    const wallet = ethers.Wallet.createRandom(); // Buat wallet baru
    const privateKey = wallet.privateKey; // Ambil private key

    console.log(`Wallet ${i + 1}`);
    console.log(`- Address: ${wallet.address}`);
    console.log(`- Private Key: ${privateKey}`);
    console.log("");

    // Tambahkan private key ke daftar
    accounts.push({ privateKey });
  }

  // Tulis kembali ke file accounts.json
  writeAccountsFile(accounts);
  console.log(`${number} wallet(s) berhasil dibuat dan disimpan ke accounts.json.`);
}

// Menggunakan readline untuk meminta input dari pengguna
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Masukkan jumlah wallet yang ingin dibuat: ", (answer) => {
  const number = parseInt(answer, 10);
  if (isNaN(number) || number <= 0) {
    console.log("Harap masukkan angka yang valid!");
  } else {
    createWallets(number);
  }
  rl.close();
});
