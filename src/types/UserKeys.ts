import { Wallet } from "ethers";
import { ActivityPubKeys } from "./ActivityPubTypes";
import { GunKeyPair } from "./Gun";
import { StealthKeyPair } from "./StealthKeyPair";

export interface UserKeys {
  pair: GunKeyPair;
  wallet: Wallet;
  stealthKey: StealthKeyPair;
  activityPubKey: ActivityPubKeys;
}
