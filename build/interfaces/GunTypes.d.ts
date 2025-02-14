import { IGunInstance, IGunUserInstance, ISEAPair } from "gun";
import { IGunChain } from "gun/types/chain";
export interface IGunInstanceExtended extends IGunInstance {
    userPut(path: string, data: any, isJson?: boolean, prefix?: string): Promise<any>;
    userGet(path: string, level?: number, prefix?: string): Promise<any>;
    get(path: string): IGunChain<any, any, any, any>;
    put(data: any, cb?: (ack: any) => void): IGunChain<any, any, any, any>;
    user(pub?: string): IGunUserInstanceExtended;
}
export interface IGunUserInstanceExtended extends IGunUserInstance {
    is: {
        pub: string;
        epub: string;
        alias?: string;
    } | null;
    _: {
        sea: ISEAPair;
        [key: string]: any;
    };
    create(alias: string, pass: string, cb?: (ack: any) => void): void;
    auth(alias: string, pass: string, cb?: (ack: any) => void): void;
    leave(): void;
    get(path: string): IGunChain<any, any, any, any>;
    put(data: any, cb?: (ack: any) => void): IGunChain<any, any, any, any>;
}
export interface GunAck {
    err?: Error;
    ok?: boolean | number;
    [key: string]: any;
}
export interface GunOptions {
    peers?: string[];
    localStorage?: boolean;
    radisk?: boolean;
    file?: boolean | string;
    multicast?: boolean | {
        port?: number;
    };
    axe?: boolean;
    [key: string]: any;
}
