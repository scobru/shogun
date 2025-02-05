import { Shogun } from "./Shogun";
import { StealthManager } from "./managers/StealthManager";
import { EthereumManager } from "./managers/EthereumManager";
import { GunAuthManager } from "./managers/GunAuthManager";
import { ActivityPubManager } from "./managers/ActivityPubManager";
import { WebAuthnManager } from "./managers/WebAuthnManager";
import { WalletManager } from "./managers/WalletManager";
import UnstoppableChat from "./features/unstoppable";
import { SEA } from "gun";
export { Shogun };
// export services
// export managers
export { EthereumManager, GunAuthManager, ActivityPubManager, WebAuthnManager, StealthManager, WalletManager, UnstoppableChat, };
// Dev only
export const generatePair = async () => {
    const pair = await SEA.pair();
    return pair;
};
