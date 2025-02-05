import { IGunInstance } from 'gun';
import 'gun/sea';
import { ethers, Signer, Contract } from 'ethers';
interface State {
    nonce: number;
    clientBalance: string;
    relayBalance: string;
    pubKey?: string;
}
interface StatePackage {
    data: State;
    signature: string;
}
interface SEAKeyPair {
    pub: string;
    priv: string;
    epub?: string;
    epriv?: string;
}
/**
 * MicropaymentAPI
 *
 * Fornisce metodi per gestire il canale di micropagamenti off-chain (con Gun e SEA) e
 * interagire con il contratto smart on-chain (con Ethers.js).
 */
declare class MicropaymentAPI {
    private provider;
    private contractABI;
    private signer;
    private seaPair;
    contract: Contract | null;
    currentState: State | null;
    contractAddress: string;
    gun: IGunInstance;
    /**
     * @param relayUrl - URL del nodo Gun (es. "http://localhost:8080/gun")
     * @param providerUrl - URL del provider Ethereum (es. "http://localhost:8545")
     * @param contractAddress - Indirizzo del contratto PaymentChannel
     * @param contractABI - ABI del contratto PaymentChannel
     */
    constructor(relayUrl: string, providerUrl: string, contractAddress: string, contractABI: any[]);
    /**
     * Imposta il signer per le operazioni on-chain e il key pair SEA per le firme off-chain.
     * @param signer - Un oggetto ethers.Signer (es. un wallet).
     * @param seaPair - Il key pair generato da Gun.SEA.
     */
    setSigner(signer: Signer, seaPair: SEAKeyPair): void;
    /**
     * Apre il canale off-chain e registra lo stato iniziale su Gun.
     * @param channelId - Identificatore del canale (es. l'indirizzo del client).
     * @param initialState - Stato iniziale: { nonce, clientBalance, relayBalance, pubKey }.
     * @returns Promise<StatePackage> - Il pacchetto di stato (dati + firma).
     */
    openOffChainChannel(channelId: string, initialState: State): Promise<StatePackage>;
    updateOffChainChannel(channelId: string, newState: State | null): Promise<{
        data: State | null;
        signature: string;
    }>;
    /**
     * Sottoscrive il canale su Gun per ricevere aggiornamenti in tempo reale.
     * Verifica le firme off-chain e aggiorna lo stato solo se il nonce è maggiore.
     * @param {string} channelId - Identificatore del canale.
     * @param {function} callback - Funzione chiamata con il nuovo stato verificato.
     */
    subscribeToChannel(channelId: any, callback: {
        (state: any): void;
        (arg0: any): void;
    }): void;
    /**
     * Firma lo stato del canale utilizzando il meccanismo di firma standard di Ethereum.
     * @param {object} state - Stato: { nonce, clientBalance, relayBalance }.
     * @returns {Promise<string>} - La firma Ethereum generata.
     */
    signState(state: State): Promise<string | undefined>;
    /**
     * Finalizza il canale on-chain invocando la funzione closeChannel del contratto.
     * @param {object} state - Stato finale: { nonce, clientBalance, relayBalance }.
     * @param {string} clientSignature - Firma Ethereum del client.
     * @param {string} relaySignature - Firma Ethereum del relay.
     * @returns {Promise<object>} - La transazione inviata.
     */
    finalizeChannel(state: {
        clientBalance: any | ethers.Overrides;
        relayBalance: any | ethers.Overrides;
        nonce: any | ethers.Overrides;
    }, clientSignature: any | ethers.Overrides, relaySignature: any | ethers.Overrides): Promise<any>;
    monitorChannel(channelId: any, intervalMs?: number): Promise<void>;
}
export { MicropaymentAPI };
