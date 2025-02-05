import { ethers } from "ethers";
import { BaseManager } from "./BaseManager";
import { GunKeyPair } from "../interfaces";
import { IGunInstance, ISEAPair } from "gun";
/**
 * Gestisce le operazioni Ethereum inclusa la creazione dell'account e il login
 */
export declare class EthereumManager extends BaseManager<GunKeyPair> {
    protected storagePrefix: string;
    private customProvider;
    private customWallet;
    private MESSAGE_TO_SIGN;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    /**
     * Imposta un provider Ethereum personalizzato
     */
    setCustomProvider(rpcUrl: string, privateKey: string): void;
    /**
     * Ottiene il signer Ethereum
     */
    getSigner(): Promise<ethers.Signer>;
    /**
     * Crea un nuovo account Ethereum
     */
    createAccount(): Promise<GunKeyPair>;
    /**
     * Effettua il login con un account Ethereum
     */
    login(): Promise<string>;
    /**
     * Genera una password da una firma
     */
    generatePassword(signature: string): Promise<string>;
    /**
     * Verifica una firma Ethereum
     */
    verifySignature(message: string, signature: string): Promise<string>;
    /**
     * Ottiene un'istanza del signer Ethereum
     */
    getEthereumSigner(): Promise<ethers.Signer>;
    static isMetaMaskAvailable(): boolean;
}
