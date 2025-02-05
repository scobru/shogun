import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';
import 'gun/lib/not.js';
interface Admin {
    pubKey: string;
    name: string;
}
interface Contact {
    pubKey: string;
    alias: string;
    name: string;
    notifCount?: number;
}
interface Peer {
    disabled?: boolean;
    joined?: boolean;
    alias: string;
    pubKey?: string;
    name?: string;
}
interface Peers {
    [pubKey: string]: Peer;
}
interface Announcement extends Channel {
    admins: {
        [pubKey: string]: Admin | 'disabled';
    };
    owner: string;
    rssLink?: string;
}
interface Channel {
    key: string;
    name: string;
    userCount: number;
    latestMsg: null | string;
    peers: Peers;
    pair: unknown;
    notifCount?: number;
    isPrivate?: boolean;
    hash?: string;
    owner?: string;
    disabled?: boolean;
    kind?: string;
}
interface Message {
    time?: number;
    msg: any;
    owner?: string;
    userPub?: string;
    peerInfo?: string;
    link?: string;
}
interface Events {
    channels: Channel[];
    channelInvites: Channel[];
    channelMessages: Message[];
    contacts: Contact[];
    contactInvites: Contact[];
    contactMessages: Message[];
    announcements: Announcement[];
    announcementInvites: Announcement[];
    announcementMessages: Message[];
    publicChannels: Channel[];
    publicAnnouncements: Announcement[];
}
export default class UnstoppableChat {
    gun: any;
    publicName: string | null;
    contactsList: Contact[];
    contactInvitesList: Contact[];
    channelsList: Channel[];
    channelInvitesList: Channel[];
    announcementsList: Announcement[];
    announcementInvitesList: Announcement[];
    activeContact: string | null;
    activeChannel: string | null;
    activeAnnouncement: string | null;
    publicChannelsList: Channel[];
    publicAnnouncementsList: Announcement[];
    constructor(superpeers: any);
    validatePubKeyFromUsername(username: string, pubKey: string): Promise<void>;
    join(username: string, password: string, publicName: string): Promise<unknown>;
    reset(): Promise<void>;
    logout(): Promise<void>;
    addContact(username: string, pubKey: string, publicName: string): Promise<unknown>;
    removeContact(pubKey: string): void;
    loadContacts(): Promise<{
        on: (cb: (param: Events["contacts"]) => void) => void;
    } | undefined>;
    loadContactInvites(): Promise<{
        on: (cb: (param: Events["contactInvites"]) => void) => void;
    }>;
    acceptContactInvite(username: string, pubKey: string, publicName: string): Promise<void>;
    denyContactInvite(pubKey: string): Promise<void>;
    sendMessageToContact(pubKey: string, msg: string): Promise<void>;
    loadMessagesOfContact(pubKey: string, publicName: string): Promise<{
        on: (cb: (param: Events["contactMessages"]) => void) => void;
    } | undefined>;
    createChannel(channelName: string, isPrivate: boolean): Promise<unknown>;
    leaveChannel(channel: Channel): void;
    loadChannels(): Promise<{
        on: (cb: (param: Events["channels"]) => void) => void;
    } | undefined>;
    loadPublicChannels(): {
        on: (cb: (param: Events["publicChannels"]) => void) => void;
    };
    joinPublicChannel(publicChannel: Channel): Promise<void>;
    inviteToChannel(channel: Channel, username: string, peerPubKey: string, publicName: string): Promise<void>;
    loadChannelInvites(): Promise<{
        on: (cb: (param: Events["channelInvites"]) => void) => void;
    } | undefined>;
    acceptChannelInvite(invite: Channel & {
        peerPub: string;
        peerAlias: string;
        peerName: string;
    }): Promise<void>;
    denyChannelInvite(invite: {
        peerPub: string;
        key: string;
    }): Promise<void>;
    sendMessageToChannel(channel: Channel, msg: string, peerInfo: any): Promise<void>;
    loadMessagesOfChannel(channel: Channel): Promise<{
        on: (cb: (param: Events["channelMessages"]) => void) => void;
    } | undefined>;
    createAnnouncement(announcementName: string, isPrivate: boolean, rssLink: string): Promise<unknown>;
    leaveAnnouncement(announcement: Announcement): void;
    loadAnnouncements(): Promise<{
        on: (cb: (param: Events["announcements"]) => void) => void;
    } | undefined>;
    loadPublicAnnouncements(): {
        on: (cb: (param: Events["publicAnnouncements"]) => void) => void;
    };
    joinPublicAnnouncement(publicAnnouncement: Channel): Promise<void>;
    inviteToAnnouncement(announcement: Announcement, username: string, peerPubKey: string, publicName: string): Promise<void>;
    loadAnnouncementInvites(): Promise<{
        on: (cb: (param: Events["announcementInvites"]) => void) => void;
    } | undefined>;
    acceptAnnouncementInvite(invite: Announcement & {
        peerPub: string;
        peerAlias: string;
        peerName: string;
    }): Promise<void>;
    denyAnnouncementInvite(invite: Announcement & {
        peerPub: string;
        peerAlias: string;
        peerName: string;
    }): Promise<void>;
    sendMessageToAnnouncement(announcement: Announcement, msg: string, peerInfo: {
        pubKey: string;
        alias?: string;
        name: string;
        action: string;
    }): Promise<void>;
    loadMessagesOfAnnouncement(announcement: Announcement): Promise<{
        on: (cb: (param: Events["announcementMessages"]) => void) => void;
    } | undefined>;
    addAdminToAnnouncement(announcement: Announcement, newAdmin: Admin): Promise<void>;
}
export {};
