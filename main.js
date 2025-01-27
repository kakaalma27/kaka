import { Worker } from 'worker_threads';
import fs from 'fs';
import { ethers } from 'ethers'; // Pastikan Anda sudah mengimpor ethers.js

const accounts = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));

// Fungsi untuk membuat dompet baru dan menyimpan ke file accounts.json
function createNewWalletAndSave(accounts) {
    const wallet = ethers.Wallet.createRandom();
    const privateKey = wallet.privateKey;

    console.log(`Address: ${wallet.address}`);
    console.log(`Private Key: ${privateKey}`);

    accounts.push({ privateKey: privateKey });
    writeAccountsFile(accounts);  // Anda perlu mendefinisikan writeAccountsFile

    return wallet;
}

// Fungsi untuk menulis akun ke file
function writeAccountsFile(accounts) {
    fs.writeFileSync('./accounts.json', JSON.stringify(accounts, null, 2), 'utf8');
}

// Fungsi untuk memulai bot menggunakan worker
async function startBot(account) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./botWorker.js');
        worker.postMessage(account);

        worker.on('message', (msg) => {
            console.log(msg); // Log messages from the worker
            resolve();
        });

        worker.on('error', (error) => {
            console.error(`Worker error: ${error}`);
            reject(error);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

// Fungsi untuk mengecek apakah tugas sudah selesai
function isTaskCompleted(account) {
    // Definisikan logika pengecekan tugas disini
    // Misalnya, Anda bisa memeriksa status atau kondisi lainnya
    return true;  // Contoh: anggap tugas selalu selesai
}

async function main() {
    const walletCount = accounts.length;
    console.log(`Starting bot with ${walletCount} account${walletCount > 1 ? 's' : ''}...\n`);

    // Proses setiap akun dalam daftar
    for (let i = 0; i < walletCount; i++) {
        const currentAccount = accounts[i];
        await startBot(currentAccount);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Delay between starting each worker

        // Periksa tugas setiap 24 jam dan buat dompet baru jika tugas selesai
        setInterval(async () => {
            if (isTaskCompleted(currentAccount)) {
                const newWallet = createNewWalletAndSave(accounts);  // Kirim accounts agar diperbarui
                await startBot(newWallet);
            }
        }, 24 * 60 * 60 * 1000); // Periksa setiap 24 jam
    }
}

main().catch(console.error);
