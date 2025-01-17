import Gun from 'gun';
import "gun/sea";
import { ethers } from "ethers";
import { deriveSharedKey, deriveStealthPrivateKey } from './interfaces/Encryption';

const SEA = Gun.SEA;

export interface KeyPair {
    privateKey: string;
    publicKey: string;
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
}

export interface StealthKeys {
    spendingKey: string;
    viewingKeyPair: KeyPair;
}

interface GunKeyPair {
    epub: string;
    epriv: string;
}

export class StealthChain {
    private gun: any;

    constructor(gun: any) {
        this.gun = gun;
    }

    public async generateStealthKeys(gunKeyPair: any): Promise<StealthKeys> {
        try {
            if (!gunKeyPair || !gunKeyPair.pub || !gunKeyPair.priv || !gunKeyPair.epub || !gunKeyPair.epriv) {
                throw new Error("Keypair non valido per la generazione delle chiavi stealth");
            }

            const viewingKeyPair: KeyPair = {
                privateKey: gunKeyPair.priv,
                publicKey: gunKeyPair.pub,
                pub: gunKeyPair.pub,
                priv: gunKeyPair.priv,
                epub: gunKeyPair.epub,
                epriv: gunKeyPair.epriv
            };

            // Genera una nuova chiave di spesa
            const wallet = ethers.Wallet.createRandom();
            const spendingKey = wallet.privateKey;

            return {
                spendingKey,
                viewingKeyPair
            };
        } catch (error) {
            console.error("Errore nella generazione delle chiavi stealth:", error);
            throw error;
        }
    }

    public async generateStealthAddress(recipientViewingKey: string, spendingKey: string): Promise<{ stealthAddress: string, ephemeralPublicKey: string }> {
        try {
            if (!recipientViewingKey || !spendingKey) {
                throw new Error("Chiavi non valide");
            }

            // Verifica il formato delle chiavi
            if (typeof recipientViewingKey !== 'string' || typeof spendingKey !== 'string') {
                throw new Error("Chiavi non valide");
            }

            // Verifica che la chiave di spesa sia in formato hex
            if (!spendingKey.match(/^0x[0-9a-fA-F]{64}$/)) {
                throw new Error("Chiavi non valide");
            }

            // Genera una coppia di chiavi effimere
            const ephemeralPair = await SEA.pair();
            
            // Calcola il segreto condiviso usando la chiave di visualizzazione del destinatario
            const sharedKey = await deriveSharedKey(recipientViewingKey, {
                epub: ephemeralPair.epub,
                epriv: ephemeralPair.epriv
            });

            // Deriva la chiave privata stealth
            const stealthPrivateKey = deriveStealthPrivateKey(sharedKey.epriv, spendingKey);
            const stealthWallet = new ethers.Wallet(stealthPrivateKey);

            return {
                stealthAddress: stealthWallet.address,
                ephemeralPublicKey: ephemeralPair.epub
            };
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("invalid BytesLike value") ||
                    error.message.includes("Impossibile generare la chiave condivisa")) {
                    throw new Error("Chiavi non valide");
                }
            }
            console.error("Errore nella generazione dell'indirizzo stealth:", error);
            throw error;
        }
    }

    public async openStealthAddress(
        stealthAddress: string,
        ephemeralPublicKey: string,
        viewingKeyPair: KeyPair,
        spendingKey: string
    ): Promise<ethers.Wallet> {
        try {
            if (!ephemeralPublicKey || !viewingKeyPair || !spendingKey) {
                throw new Error("Parametri non validi per il recupero dell'indirizzo stealth");
            }

            // Usa le chiavi di visualizzazione per derivare la chiave stealth
            const sharedKey = await deriveSharedKey(ephemeralPublicKey, {
                epub: viewingKeyPair.epub,
                epriv: viewingKeyPair.epriv
            });

            // Deriva la chiave privata stealth usando lo stesso metodo di generazione
            const stealthPrivateKey = deriveStealthPrivateKey(sharedKey.epriv, spendingKey);
            const wallet = new ethers.Wallet(stealthPrivateKey);

            // Verifica che l'indirizzo corrisponda
            if (wallet.address.toLowerCase() !== stealthAddress.toLowerCase()) {
                console.error("Indirizzo atteso:", stealthAddress);
                console.error("Indirizzo ottenuto:", wallet.address);
                console.error("Chiavi usate:", {
                    ephemeralPublicKey,
                    viewingKeyPair: {
                        epub: viewingKeyPair.epub,
                        epriv: viewingKeyPair.epriv
                    },
                    spendingKey
                });
                throw new Error("L'indirizzo stealth recuperato non corrisponde");
            }

            return wallet;
        } catch (error) {
            console.error("Errore nel recupero dell'indirizzo stealth:", error);
            throw error;
        }
    }

    public async saveStealthKeys(stealthKeys: StealthKeys, alias: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                console.log("💾 Salvando chiavi stealth per:", alias);
                
                // Salva il pair completo nel nodo utente (criptato)
                const privateNode = this.gun.user();
                await new Promise<void>((res, rej) => {
                    privateNode.get('stealthKeys').get(alias).put(stealthKeys.viewingKeyPair, (ack: { err?: string }) => {
                        if (ack.err) rej(new Error(ack.err));
                        else res();
                    });
                });

                // Salva le chiavi pubbliche nel nodo pubblico
                const path = `stealth/${alias}`;
                const publicNode = this.gun.get(path);

                // Prepara i dati pubblici
                const publicData = {
                    spendingKey: stealthKeys.spendingKey,
                    viewingKeyPair: {
                        pub: stealthKeys.viewingKeyPair.pub,
                        epub: stealthKeys.viewingKeyPair.epub
                    }
                };

                // Salva i dati pubblici
                await new Promise<void>((res, rej) => {
                    publicNode.put(publicData, (ack: { err?: string }) => {
                        if (ack.err) rej(new Error(ack.err));
                        else {
                            console.log("✅ Salvataggio completato");
                            res();
                        }
                    });
                });

                // Aspetta un po' per la sincronizzazione
                await new Promise(res => setTimeout(res, 1000));

                // Verifica il salvataggio con retry
                let retryCount = 0;
                const maxRetries = 30;
                const retryInterval = 500;

                const verifyData = () => {
                    return new Promise<void>((res, rej) => {
                        const timeout = setTimeout(() => {
                            rej(new Error("Timeout verifica"));
                        }, 2000);

                        publicNode.once((data: any) => {
                            clearTimeout(timeout);
                            console.log("📥 Dati verificati:", data);
                            
                            if (data && 
                                data.spendingKey === stealthKeys.spendingKey &&
                                data.viewingKeyPair
                            ) {
                                console.log("✅ Dati verificati");
                                res();
                            } else {
                                console.log("⚠️ Dati non corrispondenti");
                                rej(new Error("Dati non corrispondenti"));
                            }
                        });
                    });
                };

                while (retryCount < maxRetries) {
                    try {
                        console.log(`🔄 Tentativo ${retryCount + 1} di ${maxRetries}...`);
                        await verifyData();
                        console.log("✅ Verifica completata con successo");
                        resolve();
                        return;
                    } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.log(`⚠️ Tentativo ${retryCount + 1} fallito:`, errorMessage);
                        retryCount++;
                        if (retryCount < maxRetries) {
                            await new Promise(res => setTimeout(res, retryInterval));
                        }
                    }
                }

                throw new Error(`Impossibile verificare il salvataggio dopo ${maxRetries} tentativi`);
            } catch (error) {
                console.error("❌ Errore nel salvataggio delle chiavi stealth:", error);
                reject(error);
            }
        });
    }

    public async retrieveStealthKeys(alias: string): Promise<StealthKeys | null> {
        return new Promise((resolve, reject) => {
            let hasResolved = false;
            let retryCount = 0;
            const maxRetries = 30;
            const retryInterval = 500;

            const path = `stealth/${alias}`;
            console.log("🔍 Cercando chiavi stealth in:", path);

            const tryRetrieve = () => {
                console.log(`🔄 Tentativo ${retryCount + 1} di ${maxRetries} di recupero chiavi...`);
                
                // Recupera le chiavi pubbliche
                this.gun.get(path).once(async (publicData: any) => {
                    console.log("📥 Dati pubblici ricevuti:", publicData);
                    

                    if (publicData && publicData.spendingKey && publicData.viewingKeyPair) {
                        try {
                            // Recupera il pair completo dal nodo utente
                            const privateNode = this.gun.user();
                            const viewingKeyPair = await new Promise<KeyPair>((res, rej) => {
                                privateNode.get('stealthKeys').get(alias).once((data: any) => {
                                    if (!data) rej(new Error("KeyPair non trovato"));
                                    else {
                                        // Rimuovi i metadati di Gun
                                        const cleanKeyPair = {
                                            privateKey: data.privateKey,
                                            publicKey: data.publicKey,
                                            pub: data.pub,
                                            priv: data.priv,
                                            epub: data.epub,
                                            epriv: data.epriv
                                        };
                                        res(cleanKeyPair as KeyPair);
                                    }
                                });
                            });

                            const result: StealthKeys = {
                                spendingKey: publicData.spendingKey,
                                viewingKeyPair
                            };

                            console.log("✅ Chiavi recuperate con successo:", result);
                            hasResolved = true;
                            resolve(result);
                            return;
                        } catch (error) {
                            console.error("❌ Errore nella ricostruzione del viewingKeyPair:", error);
                            if (!hasResolved && retryCount < maxRetries) {
                                retryCount++;
                                setTimeout(tryRetrieve, retryInterval);
                                return;
                            }
                        }
                    }

                    if (!hasResolved && retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryRetrieve, retryInterval);
                    } else if (!hasResolved) {
                        console.log("❌ Impossibile recuperare le chiavi dopo", maxRetries, "tentativi");
                        resolve(null);
                    }
                });
            };

            tryRetrieve();

            // Timeout globale
            setTimeout(() => {
                if (!hasResolved) {
                    console.log("⏰ Timeout globale raggiunto");
                    resolve(null);
                }
            }, 30000);
        });
    }
}
