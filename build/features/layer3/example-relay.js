// relay.js
import { MicropaymentAPI } from "./MicropaymentAPI";
import { ethers } from "ethers";
import Gun from "gun";
import "gun/sea"; // Importa il modulo SEA per le firme off-chain
async function main() {
    try {
        // Configurazione degli endpoint
        const relayUrl = 'http://localhost:8080/gun';
        const providerUrl = 'http://localhost:8545';
        // Dati del contratto PaymentChannel (sostituisci con valori reali)
        const contractAddress = '0xYourContractAddress';
        const contractABI = [
        // Inserisci qui l'ABI del contratto PaymentChannel.
        ];
        // Inizializza il provider Ethereum
        const provider = new ethers.JsonRpcProvider(providerUrl);
        // Crea il wallet del relay (sostituisci con una chiave privata valida)
        const relayPrivateKey = '0xYourRelayPrivateKey';
        const relaySigner = new ethers.Wallet(relayPrivateKey, provider);
        // Genera la coppia di chiavi SEA per il relay
        const relaySeaPair = await Gun.SEA.pair();
        // Crea l'istanza API per il relay e imposta signer e key pair SEA
        const relayAPI = new MicropaymentAPI(relayUrl, providerUrl, contractAddress, contractABI);
        relayAPI.setSigner(relaySigner, relaySeaPair);
        // Il relay si sottoscrive agli aggiornamenti del canale del client.
        // Sostituisci con l'indirizzo reale del client.
        const clientChannelId = '0xYourClientAddress';
        relayAPI.subscribeToChannel(clientChannelId, (state) => {
            console.log("Relay: received channel update:", state);
            relaySignState(state);
        });
        async function relaySignState(state) {
            try {
                const relaySignature = await relayAPI.signState(state);
                console.log("Relay: generated on-chain signature for state nonce", state.nonce, ":", relaySignature);
                // Pubblica la firma del relay in un'area dedicata del grafo, ad es. "relaySignatures"
                relayAPI.gun.get('relaySignatures').get(clientChannelId).put({ signature: relaySignature, stateNonce: state.nonce });
            }
            catch (err) {
                console.error("Error signing state on relay:", err);
            }
        }
        console.log("Relay is listening for updates on client channel:", clientChannelId);
    }
    catch (err) {
        console.error("Error in relay.js:", err);
    }
}
main();
