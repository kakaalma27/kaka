import { ethers } from "ethers";
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from "url";

// Dapatkan __dirname menggunakan import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fungsi untuk membaca file accounts.json
function readAccountsFile() {
    const accountsFilePath = path.resolve(__dirname, 'accounts.json');
    if (fs.existsSync(accountsFilePath)) {
        const fileData = fs.readFileSync(accountsFilePath, 'utf8');
        return JSON.parse(fileData);
    } else {
        return [];
    }
}

// Fungsi untuk menulis ke file accounts.json
function writeAccountsFile(accounts) {
    const accountsFilePath = path.resolve(__dirname, 'accounts.json');
    fs.writeFileSync(accountsFilePath, JSON.stringify(accounts, null, 2));
}

// Fungsi untuk membuat wallet baru dan menyimpan private key ke file accounts.json
function createNewWalletAndSave(accounts) {
    const wallet = ethers.Wallet.createRandom();
    const privateKey = wallet.privateKey;

    console.log(`Address: ${wallet.address}`);
    console.log(`Private Key: ${privateKey}`);

    accounts.push({ privateKey: privateKey });
    writeAccountsFile(accounts);

    return wallet;
}

const config = {
    chainId: 10112,
    nativeToken: "DEAI",
    rpcUrl: "https://testnet-rpc3.cypher.z1labs.ai",
    explorerUrl: "https://testnet3.cypherscan.ai/",
    contracts: {
        faucet: "0x1e37834a08FC05036a0395a0f22bC103C0c00423",
        faucetEncrypted: "0x65C58fBAc4b80E89992469242D5BbDfB3D9bbf85",
        erc20Deployer: "0x82180b36C7261c0Aaee14d17a6e1c018009906a6", 
        eDEAI: "0xb7229F1209d4c5bdc47996da3C64BecD84084025",
        eDEAIReceiver: "0x91f5b89988f094566d7d0545a89fcb4d41269db4"
    }
};

const ACTIONS = {
    INITIATE_TRANSFER: 'ebbb865fa3b98451581d6e68d4a47dd4eab2d009',
    GET_TRANSFER_COUNT: 'ebbb865fa3b98451581d6e68d4a47dd4eab2d009',
    RECORD_TRANSACTION: 'b6497c23110985f8ae23b8b3d7d9d5d11b5b5cdc',
    GET_POINTS: '80ad9c835e1ebfdaabcab583bed2aebb8bd26b2d',
    CLAIM_FAUCET: '6debf06b9bd590627155a102bb73652212c36c45',
    DEPLOY_TOKEN: '34d622967e0d355de655148b5d4eab890393cd98',
    UPDATE_POINTS: '4f6d4ea7e72f6ea4d87b52b9ad967025b988b3aa' 
};

const headers = {
    'accept': 'text/x-component',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'text/plain;charset=UTF-8',
    'origin': 'https://cypher.z1labs.ai',
    'referer': 'https://cypher.z1labs.ai/testnet/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

const FAUCET_ABI = ["function faucetToken() returns (bool)"];
const EDEAI_ABI = ["function transfer(address to, uint256 value) returns (bool)", "function balanceOf(address account) view returns (uint256)"];
const DEPLOYER_ABI = ["function createToken(string _name, string _symbol, uint8 _decimals, uint256 _initialTotalSupply) returns (address)"];

function parseResponse(responseText) {
    try {
        const lines = responseText.split('\n');
        for (const line of lines) {
            if (line.startsWith('1:')) {
                return JSON.parse(line.substring(2));
            }
        }
        return null;
    } catch (error) {
        console.error('Parse error:', responseText);
        return null;
    }
}

async function getPoints(walletAddress) {
    const response = await fetch('https://cypher.z1labs.ai/testnet/', {
        method: 'POST',
        headers: {
            ...headers,
            'next-action': ACTIONS.GET_POINTS
        },
        body: JSON.stringify([walletAddress])
    });
    
    const result = parseResponse(await response.text());
    return result || 0;
}

async function getTransferCount(walletAddress) {
    const response = await fetch('https://cypher.z1labs.ai/testnet/', {
        method: 'POST',
        headers: {
            ...headers,
            'next-action': ACTIONS.GET_TRANSFER_COUNT
        },
        body: JSON.stringify([walletAddress])
    });
    
    const result = parseResponse(await response.text());
    return result || 0;
}

async function updatePoints(walletAddress) {
    const shortAddr = `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}`;
    console.log(`[${shortAddr}] Updating points....`);
    const response = await fetch('https://cypher.z1labs.ai/testnet/', {
        method: 'POST',
        headers: {
            ...headers,
            'next-action': ACTIONS.UPDATE_POINTS
        },
        body: JSON.stringify([walletAddress])
    });
    
    const result = parseResponse(await response.text());
    console.log(`[${shortAddr}] ✓ Points updated`);
    return result || 0;
}

async function getBalances(provider, signer, walletAddress) {
    try {
        const deaiBalance = await provider.getBalance(walletAddress);
        const formattedDeai = ethers.formatUnits(deaiBalance, 18);

        const edeaiContract = new ethers.Contract(config.contracts.eDEAI, EDEAI_ABI, signer);
        const edeaiBalance = await edeaiContract.balanceOf(walletAddress);
        const formattedEdeai = ethers.formatUnits(edeaiBalance, 18);

        return {
            deai: parseFloat(formattedDeai).toFixed(2),
            edeai: parseFloat(formattedEdeai).toFixed(2)
        };
    } catch (error) {
        console.error(`[${walletAddress}] Error fetching balances: ${error.message}`);
        return {
            deai: 0,
            edeai: 0
        };
    }
}

async function claimDEAI(provider, signer, walletAddress) {
    const now = new Date();
    const body = `Sign this to obtain 1 DEAI Testnet tokens (once per day till 12pm UTC of the next day) for testing Cypher chain!\n\nURI: https://cypher.z1labs.ai/testnet/\nWeb3 Token Version: 2\nIssued At: ${now.toISOString()}\nExpiration Time: ${new Date(now.getTime() + 120000).toISOString()}`;
    const signature = await signer.signMessage(body);
    const token = Buffer.from(JSON.stringify({signature, body})).toString('base64');

    const response = await fetch('https://cypher.z1labs.ai/testnet/', {
        method: 'POST',
        headers: {
            'accept': 'text/x-component',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'text/plain;charset=UTF-8',
            'origin': 'https://cypher.z1labs.ai',
            'priority': 'u=1, i',
            'referer': 'https://cypher.z1labs.ai/testnet/',
            'next-action': ACTIONS.CLAIM_FAUCET,
            'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(main)%22%2C%7B%22children%22%3A%5B%22testnet%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2C%22%2Ftestnet%2F%22%2C%22refresh%22%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
            'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors', 
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        },
        body: JSON.stringify([{
            address: walletAddress,
            token: token
        }])
    });

    const responseText = await response.text();
    const result = parseResponse(responseText);
    
    if (!result?.success) {
        throw new Error(result?.errorMessage || 'Claim failed');
    }

    await fetch('https://cypher.z1labs.ai/testnet/', {
        method: 'POST',
        headers: {
            ...headers,
            'next-action': ACTIONS.RECORD_TRANSACTION
        },
        body: JSON.stringify([{
            type: "faucetClaim",
            address: walletAddress
        }])
    });

    await updatePoints(walletAddress);

    return true;
}

async function claimEDEAI(shortAddress, signer, walletAddress) {
    const faucetContract = new ethers.Contract(config.contracts.faucetEncrypted, FAUCET_ABI, signer);
    try {
        const tx = await faucetContract.faucetToken();
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            await fetch('https://cypher.z1labs.ai/testnet/', {
                method: 'POST',
                headers: {
                    ...headers,
                    'next-action': ACTIONS.RECORD_TRANSACTION
                },
                body: JSON.stringify([{
                    type: "faucetClaimEncrypted",
                    address: walletAddress
                }])
            });
            console.log(`[${shortAddress}] Recording points....`);
            await updatePoints(walletAddress);
            return true;
        } else {
            console.error(`[${shortAddress}] Transaction failed with status: ${receipt.status}`);
            return false;
        }
    } catch (error) {
        console.error(`[${shortAddress}] Error claiming eDEAI: ${error.message}`);
        return false;
    }
}

/*
function generateTokenName() {
    const prefixes = ['CYBER', 'NOVA', 'META', 'QUANTUM', 'PIXEL', 'ATOM', 'COSMIC', 'DIGITAL', 'NEO', 'PROTO', 'HYDRO', 'OPTIC', 'SYNTH', 'TECH', 'GALAXY', 'LUMINOUS', 'VECTOR', 'NANO', 'ASTRO', 'ELECTRO'];
    const suffixes = ['VERSE', 'CHAIN', 'REALM', 'WORLD', 'NET', 'LINK', 'FLOW', 'STREAM', 'SYSTEM', 'ZONE', 'MATRIX', 'NETWORK', 'GRID', 'SPHERE', 'LAB', 'FRAME', 'PORTAL', 'WAVE', 'NODE', 'BEAM'];
    return prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)];
}

function generateTokenSymbol(name) {
    const cleanName = name.replace(/[aeiou]/gi, '');
    return '$' + cleanName.slice(0, 4).toUpperCase();
}
    */

function generateRandomText(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateTokenName() {
    const maxLength = 10;
    let tokenName;
    do {
        tokenName = generateRandomText(maxLength);
    } while (tokenName.length > maxLength);
    return tokenName;
}

function generateTokenSymbol(name) {
    const cleanName = name.replace(/[aeiou]/gi, '');
    return '$' + cleanName.slice(0, 4).toUpperCase();
}

// Contoh penggunaan
const tokenName = generateTokenName();
console.log(`Generated Token Name: ${tokenName}`);
console.log(`Generated Token Symbol: ${generateTokenSymbol(tokenName)}`);

async function deployToken(shortAddr, signer, walletAddress) {
    const tokenName = generateTokenName();
    const tokenSymbol = generateTokenSymbol(tokenName);
    const supply = Math.floor(Math.random() * (10000000 - 1000000) + 1000000);

    const deployerContract = new ethers.Contract(config.contracts.erc20Deployer, DEPLOYER_ABI, signer);
    const tx = await deployerContract.createToken(tokenName, tokenSymbol, 18, ethers.parseUnits(supply.toString(), 18));
    const receipt = await tx.wait();

    if (receipt.status === 1) {
        await fetch('https://cypher.z1labs.ai/testnet/', {
            method: 'POST',
            headers: {
                ...headers,
                'next-action': ACTIONS.RECORD_TRANSACTION
            },
            body: JSON.stringify([{
                type: "deployERC20",
                address: walletAddress,
                txType: "erc20deploy",
                txHash: receipt.hash,
                txTimestamp: new Date().getTime(),
                tokenData: {
                    name: tokenName,
                    ticker: tokenSymbol,
                    supply: supply
                }
            }])
        });

        await updatePoints(walletAddress);
        return true;
    }
    return false;
}

async function encryptedTransfer(provider, signer, walletAddress) {
    const tokenContract = new ethers.Contract(config.contracts.eDEAI, EDEAI_ABI, signer);
    
    const tx = await tokenContract.transfer(
        config.contracts.eDEAIReceiver,
        ethers.parseUnits("1", 18),
        { gasLimit: 300000 }
    );

    const receipt = await tx.wait();

    if (receipt.status === 1) {
        await fetch('https://cypher.z1labs.ai/testnet/', {
            method: 'POST',
            headers: {
                ...headers,
                'next-action': ACTIONS.RECORD_TRANSACTION
            },
            body: JSON.stringify([{
                type: "transfer",
                address: walletAddress,
                txType: "encrypted",
                txHash: receipt.hash,
                txTimestamp: new Date().getTime()
            }])
        });
        console.log(`Transfer completed: ${receipt.hash}`);
        await updatePoints(walletAddress);
        return true;
    }
    return false;
}

async function checkAvailability(signer, walletAddress) {
    const faucetContract = new ethers.Contract(
        config.contracts.faucet,
        ["function faucetAvailable(address _user) view returns (bool)"],
        signer
    );
    const encryptedFaucetContract = new ethers.Contract(
        config.contracts.faucetEncrypted,
        ["function faucetAvailable(address _user) view returns (bool)"],
        signer
    );
    const deployerContract = new ethers.Contract(
        config.contracts.erc20Deployer,
        ["function mintAvailable(address _user) view returns (bool)"],
        signer
    );

    return {
        deai: await faucetContract.faucetAvailable(walletAddress),
        edeai: await encryptedFaucetContract.faucetAvailable(walletAddress),
        deploy: await deployerContract.mintAvailable(walletAddress)
    };
}

// Fungsi untuk mengecek status tugas
async function getAccountStats(provider, signer, walletAddress) {
    process.stdout.write(`[${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}] Fetching status `);
    
    process.stdout.write('.');
    const points = await getPoints(walletAddress);
    
    process.stdout.write('.');
    const transfers = await getTransferCount(walletAddress);
    
    process.stdout.write('.');
    const balances = await getBalances(provider, signer, walletAddress);

    process.stdout.write('.');
    const availability = await checkAvailability(signer, walletAddress);
    
    process.stdout.write('\r\x1b[K'); 

    return { points, transfers, balances, availability };
}


// Fungsi untuk menjalankan tugas pada wallet
async function botInstance(account) {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(account.privateKey, provider);
    const walletAddress = await signer.getAddress();
    const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

    while (true) {
        try {
            let stats = await getAccountStats(provider, signer, walletAddress);
            
            console.log(`\n[${shortAddr}] Current Status:`);
            console.log(`Total points: ${stats.points}`);
            console.log(`Balance DEAI: ${stats.balances.deai}`);
            console.log(`Balance eDEAI: ${stats.balances.edeai}`);
            console.log(`Transfers today: ${stats.transfers}`);
            console.log('-------------------------');

            if (stats.availability.deai) {
                process.stdout.write(`[${shortAddr}] Claiming DEAI...`);
                if (await claimDEAI(provider, signer, walletAddress)) {
                    process.stdout.write('\r\x1b[K');
                    console.log(`[${shortAddr}] ✓ DEAI claimed`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 5000));

            if (stats.availability.edeai) {
                process.stdout.write(`[${shortAddr}] Claiming eDEAI...`);
                if (await claimEDEAI(shortAddr, signer, walletAddress)) {
                    process.stdout.write('\r\x1b[K');
                    console.log(`[${shortAddr}] ✓ eDEAI claimed`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 5000));

            if (stats.availability.deploy) {
                process.stdout.write(`[${shortAddr}] Deploying token...`);
                if (await deployToken(shortAddr, signer, walletAddress)) {
                    process.stdout.write('\r\x1b[K');
                    console.log(`[${shortAddr}] ✓ Token deployed`);
                }
            }

            stats = await getAccountStats(provider, signer, walletAddress);
            
            const edeaiBalance = parseFloat(stats.balances.edeai);
            if (edeaiBalance >= 1 && stats.transfers < 10) {
                while (true) {
                    const currentBalance = await getBalances(provider, signer, walletAddress);
                    const currentTransfers = await getTransferCount(walletAddress);
                    
                    if (parseFloat(currentBalance.edeai) < 1 || currentTransfers >= 10) {
                        break;
                    }

                    process.stdout.write(`[${shortAddr}] Processing transfer ${currentTransfers + 1}/10...`);
                    if (await encryptedTransfer(provider, signer, walletAddress)) {
                        process.stdout.write('\r\x1b[K');
                        console.log(`[${shortAddr}] ✓ Transfer ${currentTransfers + 1}/10 complete`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            console.log(`\n[${shortAddr}] Daily tasks completed`);
            stats = await getAccountStats(provider, signer, walletAddress);
            console.log(`\n[${shortAddr}] Last Status:`);
            console.log(`Total points: ${stats.points}`);
            console.log(`Balance DEAI: ${stats.balances.deai}`);
            console.log(`Balance eDEAI: ${stats.balances.edeai}`);
            console.log(`Transfers today: ${stats.transfers}`);
            console.log('-------------------------');

            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setUTCHours(24, 0, 0, 0);
            const waitMs = tomorrow - now;

            if (waitMs > 0) {
                console.log(`[${shortAddr}] Waiting ${Math.round(waitMs / 1000 / 60 / 60)} hours for daily reset`)

                //Buat wallet baru dan jalankan tugas dengan wallet baru
                const accounts = readAccountsFile();
                const newWallet = createNewWalletAndSave(accounts);
                await botInstance(newWallet);
            }

            /*
            console.log(`[${shortAddr}] Waiting ${Math.round(waitMs / 1000 / 60 / 60)} hours for daily reset`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            */

        } catch (error) {
            process.stdout.write('\r\x1b[K');
            console.error(`[${shortAddr}] Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function main() {
    let accounts = readAccountsFile();

    // Jika tidak ada wallet, buat wallet baru dan simpan
    if (accounts.length === 0) {
        const newWallet = createNewWalletAndSave(accounts);
        accounts = readAccountsFile(); // Perbarui accounts setelah menulis ke file
    }

    const walletCount = accounts.length;
    console.log(`Starting bot with ${walletCount} account${walletCount > 1 ? 's' : ''}...\n`);
    const instances = accounts.map(account => botInstance(account));
    await Promise.all(instances);

    // Tambahkan logika untuk membuat wallet baru dan menjalankan tugas jika tugas pada wallet saat ini sudah selesai
    setInterval(async () => {
        accounts = readAccountsFile();
        if (isTaskCompleted(currentWallet)) { // Anda perlu mendefinisikan isTaskCompleted sesuai kebutuhan
            const newWallet = createNewWalletAndSave(accounts);
            botInstance(newWallet);
        }
    }, 24 * 60 * 60 * 1000); // Periksa setiap 24 jam
}

main().catch(console.error);