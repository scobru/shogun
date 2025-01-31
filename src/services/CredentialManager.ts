/**
 * Gestisce le credenziali WebAuthn in memoria
 */
export class CredentialManager {
  private credentials: Map<string, PublicKeyCredential> = new Map();

  /**
   * Aggiunge una credenziale per un alias
   * @param alias - Username dell'utente
   * @param credential - Credenziale WebAuthn
   */
  public addCredential(alias: string, credential: PublicKeyCredential): void {
    if (!alias || !credential) {
      throw new Error('Alias e credenziale sono richiesti');
    }
    this.credentials.set(alias, credential);
  }

  /**
   * Recupera una credenziale per un alias
   * @param alias - Username dell'utente
   * @returns La credenziale se trovata, undefined altrimenti
   */
  public getCredential(alias: string): PublicKeyCredential | undefined {
    return this.credentials.get(alias);
  }

  /**
   * Rimuove una credenziale
   * @param alias - Username dell'utente
   * @returns true se la credenziale è stata rimossa, false se non esisteva
   */
  public removeCredential(alias: string): boolean {
    return this.credentials.delete(alias);
  }

  /**
   * Verifica se esiste una credenziale per un alias
   * @param alias - Username dell'utente
   * @returns true se la credenziale esiste
   */
  public hasCredential(alias: string): boolean {
    return this.credentials.has(alias);
  }

  /**
   * Rimuove tutte le credenziali
   */
  public clearCredentials(): void {
    this.credentials.clear();
  }

  /**
   * Ottiene il numero di credenziali memorizzate
   */
  public get size(): number {
    return this.credentials.size;
  }
} 