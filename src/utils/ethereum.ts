import { ethers } from "ethers";
import type { EthereumProvider } from "../interfaces/EthereumProvider";

export const MESSAGE_TO_SIGN = "Access Hugo with Ethereum";

/**
 * Verifica se MetaMask è disponibile
 * @returns {boolean} true se MetaMask è disponibile
 */
function isMetaMaskAvailable(): boolean {
  const ethereum = window.ethereum as EthereumProvider | undefined;
  return typeof window !== "undefined" && 
         typeof ethereum !== "undefined" && 
         ethereum?.isMetaMask === true;
}

/**
 * Genera una password da una firma
 * @param signature - La firma da cui generare la password
 * @returns Promise che risolve nella password generata
 * @throws Error se la firma non è valida
 */
export async function generatePassword(signature: string): Promise<string> {
  if (!signature) {
    throw new Error("Firma non valida");
  }
  const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
  return hash.slice(2, 66); // Rimuovi 0x e usa i primi 32 bytes
}

/**
 * Verifica una firma Ethereum
 * @param message - Il messaggio che è stato firmato
 * @param signature - La firma da verificare
 * @returns Promise che risolve nell'indirizzo che ha firmato il messaggio
 * @throws Error se il messaggio o la firma non sono validi
 */
export async function verifySignature(message: string, signature: string): Promise<string> {
  if (!message || !signature) {
    throw new Error("Messaggio o firma non validi");
  }
  return ethers.verifyMessage(message, signature);
}

/**
 * Ottiene un'istanza del signer Ethereum
 * @returns Promise che risolve in un signer ethers.js
 * @throws Error se MetaMask non è installato o l'accesso agli account è negato
 */
export async function getEthereumSigner(): Promise<ethers.Signer> {
  if (!isMetaMaskAvailable()) {
    throw new Error("Metamask non trovato. Installa Metamask per continuare.");
  }

  try {
    const ethereum = window.ethereum as EthereumProvider;
    await ethereum.request({
      method: "eth_requestAccounts",
    });

    const provider = new ethers.BrowserProvider(ethereum);
    return provider.getSigner();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Errore nell'accesso a MetaMask: ${error.message}`);
    }
    throw new Error("Errore sconosciuto nell'accesso a MetaMask");
  }
} 