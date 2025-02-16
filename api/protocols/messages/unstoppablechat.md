# UnstoppableChat API Reference

`UnstoppableChat` fornisce un sistema di chat decentralizzato basato su GunDB con supporto per chat private, canali e annunci.

## Costruttore

```typescript
constructor(superpeers: any)
```

Crea una nuova istanza di UnstoppableChat.

## Metodi di Autenticazione

### join
```typescript
async join(
  username: string,
  password: string,
  publicName: string
): Promise<void>
```
Autentica un utente e configura il suo profilo.
- `username`: Identificatore unico dell'utente
- `password`: Password dell'utente
- `publicName`: Nome visualizzato dell'utente

### logout
```typescript
async logout(): Promise<void>
```
Disconnette l'utente corrente.

## Gestione Contatti

### addContact
```typescript
async addContact(
  username: string,
  pubKey: string,
  publicName: string
): Promise<Contact>
```
Aggiunge un nuovo contatto.
- `username`: Nome utente del contatto
- `pubKey`: Chiave pubblica del contatto
- `publicName`: Nome visualizzato del contatto
- **Ritorna**: Oggetto contatto

### removeContact
```typescript
removeContact(pubKey: string): void
```
Rimuove un contatto.
- `pubKey`: Chiave pubblica del contatto da rimuovere

### loadContacts
```typescript
async loadContacts(): Promise<{
  on: (cb: (contacts: Contact[]) => void) => void
}>
```
Carica e sottoscrive agli aggiornamenti dei contatti.
- **Ritorna**: Sottoscrizione agli aggiornamenti dei contatti

## Chat Private

### sendMessageToContact
```typescript
async sendMessageToContact(
  pubKey: string,
  msg: string
): Promise<void>
```
Invia un messaggio criptato a un contatto.
- `pubKey`: Chiave pubblica del destinatario
- `msg`: Messaggio da inviare

### loadMessagesOfContact
```typescript
async loadMessagesOfContact(
  pubKey: string,
  publicName: string
): Promise<{
  on: (cb: (messages: Message[]) => void) => void
}>
```
Carica la cronologia chat con un contatto.
- `pubKey`: Chiave pubblica del contatto
- `publicName`: Nome visualizzato del contatto
- **Ritorna**: Sottoscrizione ai messaggi

## Gestione Canali

### createChannel
```typescript
async createChannel(
  channelName: string,
  isPrivate: boolean
): Promise<Channel>
```
Crea un nuovo canale.
- `channelName`: Nome del canale
- `isPrivate`: Se il canale è privato
- **Ritorna**: Oggetto canale

### leaveChannel
```typescript
leaveChannel(channel: Channel): void
```
Abbandona un canale.
- `channel`: Canale da abbandonare

### loadChannels
```typescript
async loadChannels(): Promise<{
  on: (cb: (channels: Channel[]) => void) => void
}>
```
Carica e sottoscrive agli aggiornamenti dei canali.
- **Ritorna**: Sottoscrizione ai canali

### sendMessageToChannel
```typescript
async sendMessageToChannel(
  channel: Channel,
  msg: string,
  peerInfo: any
): Promise<void>
```
Invia un messaggio a un canale.
- `channel`: Canale destinatario
- `msg`: Messaggio da inviare
- `peerInfo`: Informazioni sul mittente

## Gestione Annunci

### createAnnouncement
```typescript
async createAnnouncement(
  announcementName: string,
  isPrivate: boolean,
  rssLink?: string
): Promise<Announcement>
```
Crea un nuovo canale di annunci.
- `announcementName`: Nome del canale
- `isPrivate`: Se il canale è privato
- `rssLink`: Link RSS opzionale
- **Ritorna**: Oggetto annuncio

### loadAnnouncements
```typescript
async loadAnnouncements(): Promise<{
  on: (cb: (announcements: Announcement[]) => void) => void
}>
```
Carica e sottoscrive agli aggiornamenti degli annunci.
- **Ritorna**: Sottoscrizione agli annunci

### sendMessageToAnnouncement
```typescript
async sendMessageToAnnouncement(
  announcement: Announcement,
  msg: string,
  peerInfo: any
): Promise<void>
```
Invia un messaggio a un canale di annunci.
- `announcement`: Canale destinatario
- `msg`: Messaggio da inviare
- `peerInfo`: Informazioni sul mittente 