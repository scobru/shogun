// client.ts
import { MicropaymentAPI } from "./MicropaymentAPI";
import { ethers } from "ethers";
import Gun from "gun";
import "gun/sea"; // Importa il modulo SEA per le firme off-chain

async function main() {
  try {
    // Configurazione degli endpoint
    const relayUrl: string = "http://localhost:8080/gun";
    const providerUrl: string = "http://localhost:8545";

    // Dati del contratto PaymentChannel (sostituisci con valori reali)
    const contractAddress: string = "0xYourContractAddress";
    const contractABI: any[] = [
      // Inserisci qui l'ABI del contratto PaymentChannel.
    ];

    // Inizializza il provider Ethereum
    const provider = new ethers.JsonRpcProvider(providerUrl);

    // Crea il wallet del client (sostituisci con una chiave privata valida)
    const clientPrivateKey: string = "0xYourClientPrivateKey";
    const clientSigner = new ethers.Wallet(clientPrivateKey, provider);

    // Genera la coppia di chiavi SEA per il client
    const clientSeaPair = await Gun.SEA.pair();

    // Crea l'istanza API per il client e imposta signer e key pair SEA
    const clientAPI = new MicropaymentAPI(
      relayUrl,
      providerUrl,
      contractAddress,
      contractABI
    );
    clientAPI.setSigner(clientSigner, clientSeaPair);

    // Utilizza l'indirizzo del client come channelId
    const channelId: string = clientSigner.address;

    // Stato iniziale off-chain: deve rispecchiare il deposito on-chain (es. 1.0 ETH)
    const deposit: string = ethers.parseEther("1.0").toString();
    const initialState = {
      nonce: 0,
      clientBalance: deposit,
      relayBalance: "0",
      pubKey: clientSeaPair.pub,
    };

    // Verifica che il deposito on-chain sia corretto
    const onChainDeposit = await clientAPI.contract?.deposit();
    console.log("On-chain deposit:", onChainDeposit?.toString());
    if (onChainDeposit?.toString() !== deposit) {
      throw new Error(
        "On-chain deposit does not match expected off-chain channel balance."
      );
    }

    // Apri il canale off-chain su Gun
    await clientAPI.openOffChainChannel(channelId, initialState);
    console.log("Off-chain channel opened with state:", initialState);

    // Funzione helper per inviare un micropayment
    async function sendMicropayment(
      api: MicropaymentAPI,
      channelId: string,
      amountEther: number
    ) {
      const currentState = api.currentState;
      if (!currentState) throw new Error("Current state not available");
      const newNonce = currentState.nonce + 1;
      const clientBalance = ethers.formatEther(currentState.clientBalance);
      const relayBalance = ethers.formatEther(currentState.relayBalance);
      const paymentAmount = ethers.parseEther(amountEther.toString());
      if (Number(clientBalance) < paymentAmount)



        throw new Error("Insufficient balance for micropayment");
      const newClientBalance = Number(clientBalance) - Number(paymentAmount);
      const newRelayBalance = Number(relayBalance) + Number(paymentAmount);

      const newState = {
        nonce: newNonce,
        clientBalance: newClientBalance.toString(),
        relayBalance: newRelayBalance.toString(),
        pubKey: currentState.pubKey,
      };
      const statePackage = await api.updateOffChainChannel(channelId, newState);
      console.log(
        `Micropayment of ${amountEther} ETH sent. Updated state:`,
        newState
      );
      return statePackage;
    }

    // Simula l'invio di un micropayment di 0.1 ETH
    await sendMicropayment(clientAPI, channelId, 0.1);

    // Firma lo stato aggiornato per la riconciliazione on-chain
    const clientSignature = await clientAPI.signState(clientAPI.currentState!);
    console.log("Client's on-chain signature:", clientSignature);

    console.log(
      "Client: waiting for relay's signature to finalize the channel..."
    );
    // In produzione, il client implementerà un meccanismo (es. polling o sottoscrizione) per attendere la firma del relay.
  } catch (err) {
    console.error("Error in client.ts:", err);
  }
}

main();
