/**
 * Gestisce le credenziali WebAuthn in memoria
 */
export class CredentialManager {
  private credentials: Map<string, PublicKeyCredential[]> = new Map();

  /**
   * Aggiunge una credenziale per un alias
   * @param alias - Username dell'utente
   * @param credential - Credenziale WebAuthn
   */
  public addCredential(userId: string, credential: PublicKeyCredential): void {
    const userCredentials = this.credentials.get(userId) || [];
    userCredentials.push(credential);
    this.credentials.set(userId, userCredentials);
  }

  /**
   * Recupera una credenziale per un alias
   * @param alias - Username dell'utente
   * @returns La credenziale se trovata, undefined altrimenti
   */
  public getCredentials(userId: string): PublicKeyCredential[] | undefined {
    return this.credentials.get(userId);
  }

  /**
   * Rimuove una credenziale
   * @param alias - Username dell'utente
   * @returns true se la credenziale è stata rimossa, false se non esisteva
   */
  public removeCredential(userId: string, credentialId: string): boolean {
    const userCredentials = this.credentials.get(userId);
    if (!userCredentials) return false;

    const updatedCredentials = userCredentials.filter(
      (cred) => cred.id !== credentialId
    );
    this.credentials.set(userId, updatedCredentials);
    return true;
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