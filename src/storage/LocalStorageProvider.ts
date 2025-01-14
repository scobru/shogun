import type { StorageProvider, AccountData, AuthData, GunKeyPair } from "../types";
import SEA from "gun/sea";

export class LocalStorageProvider implements StorageProvider {
  private memoryStore: Map<string, string>;
  private isNode: boolean;

  constructor() {
    this.memoryStore = new Map();
    // Verifica se siamo in ambiente Node.js in modo più robusto
    this.isNode = typeof process !== 'undefined' && 
      process.versions != null && 
      process.versions.node != null;
  }


  private getKey(type: 'auth' | 'data', username: string): string {
    return `hedgehog_${type}_${username}`;
  }

  private setItem(key: string, value: any): void {
    if (this.isNode) {
      this.memoryStore.set(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  private getItem(key: string): string | null {
    if (this.isNode) {
      const value = this.memoryStore.get(key);
      return value || null;
    }
    return localStorage.getItem(key);
  }

  private removeItem(key: string): void {
    if (this.isNode) {
      this.memoryStore.delete(key);
    } else {
      localStorage.removeItem(key);
    }
  }

  async getAuth(username: string): Promise<AuthData | null> {
    const key = this.getKey('auth', username);
    const data = this.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async setAuth(username: string, auth: AuthData): Promise<void> {
    const key = this.getKey('auth', username);
    this.setItem(key, auth);
  }

  async createAuth(username: string, password: string): Promise<AuthData> {
    // Usa SEA per generare una coppia di chiavi
    const pair = await SEA.pair() as GunKeyPair;
    
    // Crea l'hash della password usando la chiave pubblica come salt
    const passwordHash = await SEA.work(password, pair.pub);

    return {
      keyPair: pair,
      passwordHash: passwordHash as string
    };
  }

  async getUserData(username: string): Promise<AccountData | null> {
    const key = this.getKey('data', username);
    const data = this.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async setUserData(username: string, data: AccountData): Promise<void> {
    const key = this.getKey('data', username);
    this.setItem(key, data);
  }

  async cleanup(): Promise<void> {
    if (this.isNode) {
      this.memoryStore.clear();
    } else {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('hedgehog_')) {
          this.removeItem(key);
        }
      });
    }
  }
} 