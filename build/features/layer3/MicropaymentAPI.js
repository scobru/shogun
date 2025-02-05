import Gun from 'gun';
import 'gun/sea';
import { ethers, JsonRpcProvider } from 'ethers';
/**
 * MicropaymentAPI
 *
 * Fornisce metodi per gestire il canale di micropagamenti off-chain (con Gun e SEA) e
 * interagire con il contratto smart on-chain (con Ethers.js).
 */
class MicropaymentAPI {
    /**
     * @param relayUrl - URL del nodo Gun (es. "http://localhost:8080/gun")
     * @param providerUrl - URL del provider Ethereum (es. "http://localhost:8545")
     * @param contractAddress - Indirizzo del contratto PaymentChannel
     * @param contractABI - ABI del contratto PaymentChannel
     */
    constructor(relayUrl, providerUrl, contractAddress, contractABI) {
        this.signer = null;
        this.seaPair = null;
        this.contract = null;
        this.currentState = null;
        this.gun = Gun([relayUrl]);
        this.provider = new JsonRpcProvider(providerUrl);
        this.contractAddress = contractAddress;
        this.contractABI = contractABI;
    }
    /**
     * Imposta il signer per le operazioni on-chain e il key pair SEA per le firme off-chain.
     * @param signer - Un oggetto ethers.Signer (es. un wallet).
     * @param seaPair - Il key pair generato da Gun.SEA.
     */
    setSigner(signer, seaPair) {
        this.contract = new ethers.Contract(this.contractAddress, this.contractABI, signer);
        this.signer = signer;
        this.seaPair = seaPair;
    }
    /**
     * Apre il canale off-chain e registra lo stato iniziale su Gun.
     * @param channelId - Identificatore del canale (es. l'indirizzo del client).
     * @param initialState - Stato iniziale: { nonce, clientBalance, relayBalance, pubKey }.
     * @returns Promise<StatePackage> - Il pacchetto di stato (dati + firma).
     */
    async openOffChainChannel(channelId, initialState) {
        if (!this.seaPair)
            throw new Error('SEA key pair not set');
        try {
            const stateStr = JSON.stringify(initialState);
            const signature = await Gun.SEA.sign(stateStr, this.seaPair);
            const statePackage = { data: initialState, signature };
            await new Promise((resolve, reject) => {
                this.gun.get('channels').get(channelId).put(statePackage, (ack) => {
                    if (ack.err)
                        reject(ack.err);
                    else
                        resolve();
                });
            });
            this.currentState = initialState;
            console.log(`Channel ${channelId} opened off-chain.`);
            return statePackage;
        }
        catch (err) {
            console.error("Error opening off-chain channel:", err);
            throw err;
        }
    }
    async updateOffChainChannel(channelId, newState) {
        try {
            if (this.currentState && newState?.nonce && newState.nonce <= this.currentState.nonce) {
                throw new Error("Nonce too low compared to current state");
            }
            const stateStr = JSON.stringify(newState);
            const signature = await Gun.SEA.sign(stateStr, this.seaPair);
            const statePackage = { data: newState, signature };
            await new Promise((resolve, reject) => {
                this.gun.get('channels').get(channelId).put(statePackage, (ack) => {
                    if (ack.err || !ack.ok)
                        reject(new Error(ack.err || 'Put operation failed'));
                    else
                        resolve();
                });
            });
            this.currentState = newState;
            console.log(`Channel ${channelId} updated off-chain to nonce ${newState?.nonce}`);
            return statePackage;
        }
        catch (err) {
            console.error("Error updating off-chain channel:", err);
            throw err;
        }
    }
    /**
     * Sottoscrive il canale su Gun per ricevere aggiornamenti in tempo reale.
     * Verifica le firme off-chain e aggiorna lo stato solo se il nonce è maggiore.
     * @param {string} channelId - Identificatore del canale.
     * @param {function} callback - Funzione chiamata con il nuovo stato verificato.
     */
    subscribeToChannel(channelId, callback) {
        try {
            this.gun.get('channels').get(channelId).on(async (statePackage) => {
                if (statePackage && statePackage.data && statePackage.signature) {
                    const stateStr = JSON.stringify(statePackage.data);
                    const pubKey = statePackage.data.pubKey;
                    const signature = await Gun.SEA.sign(stateStr, pubKey);
                    try {
                        const verified = await Gun.SEA.verify(signature, pubKey);
                        if (verified) {
                            if (!this.currentState || statePackage.data.nonce > this.currentState.nonce) {
                                this.currentState = statePackage.data;
                                console.log(`Received valid state update for channel ${channelId} with nonce ${statePackage.data.nonce}`);
                                callback(statePackage.data);
                            }
                            else {
                                console.warn("Received state with lower nonce, ignoring");
                            }
                        }
                        else {
                            console.error("Failed to verify off-chain signature");
                        }
                    }
                    catch (err) {
                        console.error("Error during SEA verification:", err);
                    }
                }
            });
        }
        catch (err) {
            console.error("Error subscribing to channel:", err);
        }
    }
    /**
     * Firma lo stato del canale utilizzando il meccanismo di firma standard di Ethereum.
     * @param {object} state - Stato: { nonce, clientBalance, relayBalance }.
     * @returns {Promise<string>} - La firma Ethereum generata.
     */
    async signState(state) {
        try {
            const stateHash = ethers.solidityPackedKeccak256(['address', 'uint256', 'uint256', 'uint256'], [this.contractAddress, state.clientBalance, state.relayBalance, state.nonce]);
            const ethSignature = await this.signer?.signMessage(ethers.toUtf8Bytes(stateHash));
            return ethSignature;
        }
        catch (err) {
            console.error("Error signing state:", err);
            throw err;
        }
    }
    /**
     * Finalizza il canale on-chain invocando la funzione closeChannel del contratto.
     * @param {object} state - Stato finale: { nonce, clientBalance, relayBalance }.
     * @param {string} clientSignature - Firma Ethereum del client.
     * @param {string} relaySignature - Firma Ethereum del relay.
     * @returns {Promise<object>} - La transazione inviata.
     */
    async finalizeChannel(state, clientSignature, relaySignature) {
        try {
            console.log("Finalizing channel on-chain...");
            const tx = await this.contract?.closeChannel(state.clientBalance, state.relayBalance, state.nonce, clientSignature, relaySignature);
            return tx;
        }
        catch (err) {
            console.error("Error finalizing channel on-chain:", err);
            throw err;
        }
    }
    async monitorChannel(channelId, intervalMs = 10000) {
        let lastUpdate = Date.now();
        this.subscribeToChannel(channelId, (state) => {
            lastUpdate = Date.now();
        });
        setInterval(() => {
            if (Date.now() - lastUpdate > intervalMs * 2) {
                console.warn(`No updates for channel ${channelId} in the last ${intervalMs * 2 / 1000} seconds.`);
            }
        }, intervalMs);
    }
}
export { MicropaymentAPI };
