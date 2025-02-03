import { Wallet } from "ethers";
import { ActivityPubKeys } from "./ActivityPubKeys";
import { GunKeyPair } from "./GunKeyPair";
import { StealthKeyPair } from "./StealthKeyPair";

export interface UserKeys {
  pair: GunKeyPair;
  wallet: Wallet;
  stealthKey: StealthKeyPair;
  activityPubKey: ActivityPubKeys;
}
