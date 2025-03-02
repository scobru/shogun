// Mock di localStorage per Node.js
class StorageMock implements Storage {
    private store: Map<string, string>;
    
    constructor() {
      this.store = new Map();
    }
  
    getItem(key: string) {
      return this.store.get(key) || null;
    }
  
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
  
    removeItem(key: string) {
      this.store.delete(key);
    }
  
    clear() {
      this.store.clear();
    }

    key(index: number): string | null {
      if (index >= this.store.size) return null;
      return Array.from(this.store.keys())[index] || null;
    }

    get length(): number {
      return this.store.size;
    }
  }
  
  export const localStorage = new StorageMock(); 