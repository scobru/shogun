import { Eip1193Provider } from "ethers";
export interface EthereumProvider extends Eip1193Provider {
    request: (args: {
        method: string;
        params?: any[];
    }) => Promise<any>;
    on: (eventName: string, handler: (...args: any[]) => void) => void;
    removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
    isMetaMask?: boolean;
}
declare global {
    interface Window {
        ethereum?: EthereumProvider;
    }
}
export {};
