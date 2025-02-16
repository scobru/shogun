# UnstoppableChat

A decentralized chat system built on GunDB that provides secure, encrypted messaging with support for private chats, channels, and announcements. Features user authentication, contact management, and real-time updates.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Features](#features)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Technical Details](#technical-details)

## Overview

UnstoppableChat provides three main communication modes:
1. Private Chats: Direct encrypted messaging between users
2. Channels: Group chats with multiple participants
3. Announcements: Broadcast channels with admin controls

## Installation

```bash
npm install @hedgehog/blockchain
```

## Features

- End-to-end encryption
- Contact management
- Group channels
- Announcement channels
- Real-time updates
- Offline support
- RSS feed integration
- Invite system

## API Reference

### Constructor

```typescript
constructor(superpeers: any)
```

Creates a new UnstoppableChat instance.

### Authentication Methods

#### join

```typescript
async join(
  username: string,
  password: string,
  publicName: string
): Promise<void>
```

Authenticates a user and sets up their profile.

- **Parameters:**
  - `username`: User's unique identifier
  - `password`: User's password
  - `publicName`: User's display name

#### logout

```typescript
async logout(): Promise<void>
```

Logs out the current user.

### Contact Management

#### addContact

```typescript
async addContact(
  username: string,
  pubKey: string,
  publicName: string
): Promise<Contact>
```

Adds a new contact.

#### removeContact

```typescript
removeContact(pubKey: string): void
```

Removes a contact.

#### loadContacts

```typescript
async loadContacts(): Promise<{
  on: (cb: (contacts: Contact[]) => void) => void
}>
```

Loads and subscribes to contact updates.

### Private Chat Methods

#### sendMessageToContact

```typescript
async sendMessageToContact(
  pubKey: string,
  msg: string
): Promise<void>
```

Sends an encrypted message to a contact.

#### loadMessagesOfContact

```typescript
async loadMessagesOfContact(
  pubKey: string,
  publicName: string
): Promise<{
  on: (cb: (messages: Message[]) => void) => void
}>
```

Loads chat history with a contact.

### Channel Methods

#### createChannel

```typescript
async createChannel(
  channelName: string,
  isPrivate: boolean
): Promise<Channel>
```

Creates a new channel.

#### leaveChannel

```typescript
leaveChannel(channel: Channel): void
```

Leaves a channel.

#### loadChannels

```typescript
async loadChannels(): Promise<{
  on: (cb: (channels: Channel[]) => void) => void
}>
```

Loads and subscribes to channel updates.

#### sendMessageToChannel

```typescript
async sendMessageToChannel(
  channel: Channel,
  msg: string,
  peerInfo: any
): Promise<void>
```

Sends a message to a channel.

### Announcement Methods

#### createAnnouncement

```typescript
async createAnnouncement(
  announcementName: string,
  isPrivate: boolean,
  rssLink?: string
): Promise<Announcement>
```

Creates a new announcement channel.

#### loadAnnouncements

```typescript
async loadAnnouncements(): Promise<{
  on: (cb: (announcements: Announcement[]) => void) => void
}>
```

Loads and subscribes to announcement updates.

#### sendMessageToAnnouncement

```typescript
async sendMessageToAnnouncement(
  announcement: Announcement,
  msg: string,
  peerInfo: any
): Promise<void>
```

Sends a message to an announcement channel.

## Examples

### User Authentication

```typescript
const chat = new UnstoppableChat(['https://your-superpeers.com']);

// Join chat
await chat.join('username', 'password', 'Display Name');

// Monitor contacts
chat.loadContacts().then(subscription => {
  subscription.on(contacts => {
    console.log('Updated contacts:', contacts);
  });
});
```

### Private Messaging

```typescript
// Add contact
await chat.addContact('friend', 'friendPubKey', 'Friend Name');

// Send message
await chat.sendMessageToContact('friendPubKey', 'Hello!');

// Load chat history
const messages = await chat.loadMessagesOfContact('friendPubKey', 'Friend Name');
messages.on(msgs => {
  console.log('New messages:', msgs);
});
```

### Channel Management

```typescript
// Create channel
const channel = await chat.createChannel('My Channel', true);

// Send channel message
await chat.sendMessageToChannel(channel, 'Welcome everyone!', {
  pubKey: chat.gun.user().is.pub,
  name: chat.publicName
});

// Monitor channel messages
const messages = await chat.loadMessagesOfChannel(channel);
messages.on(msgs => {
  console.log('Channel updates:', msgs);
});
```

### Announcement Channels

```typescript
// Create announcement channel
const announcement = await chat.createAnnouncement(
  'News Channel',
  false,
  'https://news-feed.com/rss'
);

// Send announcement
await chat.sendMessageToAnnouncement(announcement, 'Important update!', {
  pubKey: chat.gun.user().is.pub,
  name: chat.publicName,
  action: 'announce'
});
```

## Technical Details

### Security Features

1. **Encryption**
   - End-to-end encryption for private chats
   - Channel-specific encryption
   - Secure key management
   - Public/private key separation

2. **Authentication**
   - Username validation
   - Password hashing
   - Session management
   - Public key verification

3. **Data Protection**
   - Message encryption
   - Metadata protection
   - Key rotation
   - Secure storage

### Real-time Features

1. **Subscriptions**
   - Contact status
   - Message delivery
   - Channel updates
   - Announcement broadcasts

2. **State Management**
   - Local caching
   - Conflict resolution
   - State synchronization
   - Offline support

### Performance Optimization

1. **Data Loading**
   - Lazy loading
   - Pagination support
   - Cache management
   - Batch updates

2. **Network Efficiency**
   - Delta updates
   - Message compression
   - Connection pooling
   - Retry mechanisms

### Best Practices

1. **Error Handling**
   - Connection recovery
   - Message retry
   - State validation
   - Error reporting

2. **Resource Management**
   - Memory optimization
   - Connection pooling
   - Cache cleanup
   - Session management 