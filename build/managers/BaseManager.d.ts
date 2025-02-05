import { IGunInstance, IGunUserInstance, ISEAPair } from "gun";
/**
 * Classe base astratta per i manager che utilizzano Gun
 */
export declare abstract class BaseManager<T> {
    protected gun: IGunInstance;
    protected user: IGunUserInstance;
    protected abstract storagePrefix: string;
    protected APP_KEY_PAIR: ISEAPair;
    constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair);
    /**
     * Crea un nuovo account/coppia di chiavi
     */
    abstract createAccount(...args: any[]): Promise<T>;
    /**
     * Salva i dati in modo privato
     */
    protected savePrivateData(data: T, path?: string): Promise<void>;
    private compareArrayData;
    private compareData;
    /**
     * Salva i dati in modo pubblico
     */
    protected savePublicData(data: any, path?: string): Promise<void>;
    /**
     * Pulisce i metadati di Gun da un oggetto
     */
    protected cleanGunMetadata<T>(data: any): T;
    /**
     * Recupera i dati privati
     */
    protected getPrivateData(path?: string): Promise<T | null>;
    /**
     * Recupera i dati pubblici
     */
    protected getPublicData(publicKey: string, path?: string): Promise<any>;
    /**
     * Elimina i dati privati
     */
    protected deletePrivateData(path?: string): Promise<void>;
    /**
     * Elimina i dati pubblici
     */
    protected deletePublicData(path?: string): Promise<void>;
    /**
     * Verifica se l'utente è autenticato
     */
    protected isAuthenticated(): boolean;
    /**
     * Ottiene il public key dell'utente corrente
     */
    protected getCurrentPublicKey(): string;
    /**
     * Verifica che l'utente sia autenticato, altrimenti lancia un'eccezione
     */
    protected checkAuthentication(): void;
    /**
     * Pulisce le risorse
     */
    cleanup(): void;
    /**
     * Verifica e assicura che l'utente sia autenticato
     */
    private ensureAuthenticated;
    protected isNullOrEmpty(data: any): boolean;
}
