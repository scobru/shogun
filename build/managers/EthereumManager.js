import { ethers } from "ethers";
import { AuthenticationError, ValidationError } from "../utils/gun/errors";
import { BaseManager } from "./BaseManager";
/**
 * Gestisce le operazioni Ethereum inclusa la creazione dell'account e il login
 */
export class EthereumManager extends BaseManager {
    constructor(gun, APP_KEY_PAIR) {
        super(gun, APP_KEY_PAIR);
        this.storagePrefix = "ethereum";
        this.customProvider = null;
        this.customWallet = null;
        this.MESSAGE_TO_SIGN = "I Love Shogun!";
    }
    /**
     * Imposta un provider Ethereum personalizzato
     */
    setCustomProvider(rpcUrl, privateKey) {
        try {
            if (!rpcUrl || typeof rpcUrl !== "string") {
                throw new ValidationError("RPC URL non valido");
            }
            if (!privateKey || typeof privateKey !== "string") {
                throw new ValidationError("Chiave privata non valida");
            }
            this.customProvider = new ethers.JsonRpcProvider(rpcUrl);
            this.customWallet = new ethers.Wallet(privateKey, this.customProvider);
        }
        catch (error) {
            throw new ValidationError(`Errore nella configurazione del provider: ${error instanceof Error ? error.message : "Errore sconosciuto"}`);
        }
    }
    /**
     * Ottiene il signer Ethereum
     */
    async getSigner() {
        try {
            if (this.customWallet) {
                return this.customWallet;
            }
            const signer = await this.getEthereumSigner();
            if (!signer) {
                throw new AuthenticationError("Nessun signer Ethereum disponibile");
            }
            return signer;
        }
        catch (error) {
            throw new AuthenticationError(`Impossibile ottenere il signer Ethereum: ${error instanceof Error ? error.message : "Errore sconosciuto"}`);
        }
    }
    /**
     * Crea un nuovo account Ethereum
     */
    async createAccount() {
        try {
            const signer = await this.getSigner();
            const address = await signer.getAddress();
            if (!address || !address.startsWith("0x")) {
                throw new ValidationError("Indirizzo Ethereum non valido");
            }
            const signature = await signer.signMessage(this.MESSAGE_TO_SIGN);
            const password = await this.generatePassword(signature);
            const username = address.toLowerCase();
            return new Promise((resolve, reject) => {
                this.user.create(username, password, async (ack) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                        return;
                    }
                    try {
                        await this.login();
                        const pair = this.user._.sea;
                        await this.savePrivateData(pair, "ethereum");
                        await this.savePublicData({ address }, "ethereum");
                        resolve(pair);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        catch (error) {
            if (error instanceof AuthenticationError || error instanceof ValidationError) {
                throw error;
            }
            throw new AuthenticationError(`Errore durante la creazione dell'account Ethereum: ${error instanceof Error ? error.message : "Errore sconosciuto"}`);
        }
    }
    /**
     * Effettua il login con un account Ethereum
     */
    async login() {
        try {
            const signer = await this.getSigner();
            const address = await signer.getAddress();
            if (!address || !address.startsWith("0x")) {
                throw new ValidationError("Indirizzo Ethereum non valido");
            }
            const signature = await signer.signMessage(this.MESSAGE_TO_SIGN);
            const password = await this.generatePassword(signature);
            const username = address.toLowerCase();
            return new Promise((resolve, reject) => {
                this.user.auth(username, password, (ack) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                        return;
                    }
                    resolve(this.getCurrentPublicKey());
                });
            });
        }
        catch (error) {
            if (error instanceof AuthenticationError || error instanceof ValidationError) {
                throw error;
            }
            throw new AuthenticationError(`Errore durante il login con Ethereum: ${error instanceof Error ? error.message : "Errore sconosciuto"}`);
        }
    }
    /**
     * Genera una password da una firma
     */
    async generatePassword(signature) {
        if (!signature) {
            throw new Error("Firma non valida");
        }
        const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
        return hash.slice(2, 66); // Rimuovi 0x e usa i primi 32 bytes
    }
    /**
     * Verifica una firma Ethereum
     */
    async verifySignature(message, signature) {
        try {
            if (!message || !signature) {
                throw new Error("Messaggio o firma non validi");
            }
            return ethers.verifyMessage(message, signature);
        }
        catch (error) {
            throw new Error("Messaggio o firma non validi");
        }
    }
    /**
     * Ottiene un'istanza del signer Ethereum
     */
    async getEthereumSigner() {
        if (!EthereumManager.isMetaMaskAvailable()) {
            throw new Error("Metamask non trovato. Installa Metamask per continuare.");
        }
        try {
            const ethereum = window.ethereum;
            await ethereum.request({
                method: "eth_requestAccounts",
            });
            const provider = new ethers.BrowserProvider(ethereum);
            return provider.getSigner();
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Errore nell'accesso a MetaMask: ${error.message}`);
            }
            throw new Error("Errore sconosciuto nell'accesso a MetaMask");
        }
    }
    static isMetaMaskAvailable() {
        const ethereum = window.ethereum;
        return (typeof window !== "undefined" &&
            typeof ethereum !== "undefined" &&
            ethereum?.isMetaMask === true);
    }
}
