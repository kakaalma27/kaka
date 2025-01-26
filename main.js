import { Worker } from 'worker_threads';
import fs from 'fs';

const accounts = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));

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

async function main() {
    const walletCount = accounts.length;
    console.log(`Starting bot with ${walletCount} account${walletCount > 1 ? 's' : ''}...\n`);

    for (let i = 0; i < walletCount; i++) {
        await startBot(accounts[i]);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Delay between starting each worker
    }
}

main().catch(console.error);