import { IGunInstance, ISEAPair } from "gun";
import type { WebAuthnResult, WebAuthnVerifyResult, DeviceCredential } from "../interfaces/WebAuthnResult";
import { BaseManager } from "./BaseManager";
import { GunKeyPair } from "../interfaces/GunKeyPair";
import "gun/sea";
export declare class WebAuthnManager extends BaseManager<Record<string, any>> {
    protected storagePrefix: string;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    private validateUsername;
    /**
     * Recupera i dati privati per un utente WebAuthn
     */
    private getWebAuthnPrivateData;
    /**
     * Salva i dati privati per un utente WebAuthn
     */
    private saveWebAuthnPrivateData;
    /**
     * Salva i dati pubblici per un utente WebAuthn
     */
    private saveWebAuthnPublicData;
    /**
     * Ottiene la coppia di chiavi corrente
     */
    getPairFromGun(): GunKeyPair;
    /**
     * Implementazione del metodo createAccount richiesto da BaseManager
     */
    createAccount(username: string, isNewDevice?: boolean, deviceName?: string): Promise<Record<string, any>>;
    private getWebAuthnCredentials;
    private saveCredentials;
    getAuthenticators(): GunKeyPair[];
    generateCredentials(username: string, isNewDevice?: boolean, deviceName?: string): Promise<WebAuthnResult>;
    getRegisteredDevices(username: string): Promise<DeviceCredential[]>;
    removeDevice(username: string, credentialId: string): Promise<boolean>;
    authenticateUser(username: string): Promise<WebAuthnResult>;
    verifyCredential(credentialId: string): Promise<WebAuthnVerifyResult>;
    private getSalt;
    isSupported(): boolean;
}
