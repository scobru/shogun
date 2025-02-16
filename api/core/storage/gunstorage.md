# GunStorage API Reference

`GunStorage` fornisce un layer di storage decentralizzato basato su GunDB con supporto per crittografia e gestione dati.

## Costruttore

```typescript
constructor(gun: IGunInstance, APP_KEY_PAIR: ISEAPair)
```

Crea una nuova istanza di GunStorage.

## Metodi di Storage

### put
```typescript
public async put(path: string, data: any): Promise<void>
```
Memorizza dati nel percorso specificato.
- `path`: Percorso dove memorizzare i dati
- `data`: Dati da memorizzare
- **Errori**: Se la memorizzazione fallisce

### get
```typescript
public async get(path: string): Promise<any>
```
Recupera dati dal percorso specificato.
- `path`: Percorso da cui recuperare i dati
- **Ritorna**: Dati recuperati
- **Errori**: Se il recupero fallisce

### remove
```typescript
public async remove(path: string): Promise<void>
```
Rimuove dati dal percorso specificato.
- `path`: Percorso da cui rimuovere i dati
- **Errori**: Se la rimozione fallisce

## Metodi di Crittografia

### encrypt
```typescript
public async encrypt(data: any): Promise<string>
```
Cripta i dati usando la chiave dell'utente.
- `data`: Dati da criptare
- **Ritorna**: Dati criptati
- **Errori**: Se la crittografia fallisce

### decrypt
```typescript
public async decrypt(encryptedData: string): Promise<any>
```
Decripta i dati usando la chiave dell'utente.
- `encryptedData`: Dati criptati
- **Ritorna**: Dati decriptati
- **Errori**: Se la decrittografia fallisce

## Metodi di Sincronizzazione

### sync
```typescript
public async sync(path: string, callback: (data: any) => void): Promise<void>
```
Sincronizza i dati dal percorso specificato.
- `path`: Percorso da sincronizzare
- `callback`: Funzione chiamata quando i dati cambiano
- **Errori**: Se la sincronizzazione fallisce

### unsubscribe
```typescript
public unsubscribe(path: string): void
```
Annulla la sottoscrizione ai cambiamenti del percorso.
- `path`: Percorso da cui disiscriversi

