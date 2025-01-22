import { ethers } from "ethers";
import Gun from "gun";
import "gun/sea";

// If you have Gun and SEA type definitions, you can import them here.
// For now, we use `any` to simplify.
const SEA = (Gun as any).SEA;

/**
 * Base interface for stealth key
 */
export interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

/**
 * Wrapper interface used in Gun
 */
export interface StealthKeyPairWrapper {
  stealthKeyPair: StealthKeyPair;
  [key: string]: any;
}

/**
 * Result of stealth address generation
 */
export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}

/**
 * Generic utility callback: (error?: Error, data?: T) => void
 */
type Callback<T> = (error?: Error, data?: T) => void;

/**
 * Converts a private key from base64Url format (Gun) to hex format (Ethereum)
 */
function convertToEthPk(gunPrivateKey: string): string {
  const base64UrlToHex = (base64url: string): string => {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
    const binary = atob(base64);
    const hex = Array.from(binary, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, "0")
    ).join("");

    if (hex.length !== 64) {
      throw new Error(
        "Cannot convert private key: invalid length"
      );
    }
    return hex;
  };

  if (!gunPrivateKey || typeof gunPrivateKey !== "string") {
    throw new Error("Cannot convert private key: invalid input");
  }

  try {
    const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
    return hexPrivateKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(
        `Cannot convert private key: ${error.message}`
      );
    } else {
      throw new Error("Cannot convert private key: unknown error");
    }
  }
}

/**
 * Main class for handling stealth logic using Gun and SEA
 */
export class StealthChain {
  // If you want to properly type Gun, replace `any` with the correct interface
  private gun: any;

  /**
   * Injects Gun instance from outside
   */
  constructor(gun: any) {
    this.gun = gun;
  }

  /**
   * Removes leading tilde (~) from public key if present
   */
  private formatPublicKey(publicKey: string): string {
    if (!publicKey) {
      throw new Error("Invalid public key: missing parameter");
    }
    return publicKey.startsWith("~") ? publicKey.slice(1) : publicKey;
  }

  /**
   * Generates stealth keys if they don't exist, otherwise returns them
   */
  public generateStealthKeys(cb: Callback<StealthKeyPair>): void {
    const user = this.gun.user();
    if (!user?.is) {
      console.error("User not authenticated");
      return cb(new Error("User not authenticated or missing user"));
    }

    console.log("Generating stealth keys for user:", user.is.pub);

    // First check if keys already exist
    user.get("stealthKeys").once((data: any) => {
      console.log("Existing keys data:", data);
      
      if (data?.stealthKeyPair) {
        console.log("Found existing stealth keys");
        return cb(undefined, data.stealthKeyPair);
      }

      console.log("Generating new stealth keys...");
      // Otherwise generate
      SEA.pair((pair: any) => {
        console.log("Keys generated by SEA:", pair);
        
        if (!pair?.pub || !pair?.priv || !pair?.epub || !pair?.epriv) {
          console.error("Generated keys are invalid:", pair);
          return cb(new Error("Generated keys are invalid"));
        }

        const stealthKeyPair: StealthKeyPair = {
          pub: pair.pub,
          priv: pair.priv,
          epub: pair.epub,
          epriv: pair.epriv
        };

        // Save
        this.saveStealthKeys(stealthKeyPair, (error?: Error) => {
          if (error) {
            console.error("Error saving keys:", error);
            return cb(error);
          }
          console.log("Stealth keys saved successfully");
          cb(undefined, stealthKeyPair);
        });
      });
    });
  }

  /**
   * Generates a stealth address for recipient's public key (recipientPublicKey)
   */
  public generateStealthAddress(
    recipientPublicKey: string,
    cb: Callback<StealthAddressResult>
  ): void {
    if (!recipientPublicKey) {
      return cb(new Error("Invalid keys: missing or invalid parameters"));
    }

    const formattedPubKey = this.formatPublicKey(recipientPublicKey);

    this.gun
      .get("stealthKeys")
      .get(formattedPubKey)
      .once((recipientEpub: string) => {
        if (!recipientEpub) {
          return cb(new Error("Ephemeral public key not found"));
        }

        SEA.pair((ephemeralKeyPair: any) => {
          if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
            return cb(new Error("Invalid ephemeral keys"));
          }

          SEA.secret(recipientEpub, ephemeralKeyPair, (sharedSecret: string) => {
            if (!sharedSecret) {
              return cb(new Error("Shared secret generation failed"));
            }

            const stealthPrivateKey = ethers.keccak256(
              ethers.toUtf8Bytes(sharedSecret)
            );
            const stealthWallet = new ethers.Wallet(stealthPrivateKey);
            cb(undefined, {
              stealthAddress: stealthWallet.address,
              ephemeralPublicKey: ephemeralKeyPair.epub,
              recipientPublicKey,
            });
          });
        });
      });
  }

  /**
   * Opens a stealth address, deriving the private key from ephemeralPublicKey
   */
  public openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string,
    cb: Callback<ethers.Wallet>
  ): void {
    if (!stealthAddress || !ephemeralPublicKey) {
      return cb(
        new Error("Missing parameters: stealthAddress or ephemeralPublicKey")
      );
    }

    const user = this.gun.user();
    if (!user?.is) {
      return cb(new Error("User not authenticated or missing user"));
    }

    // Retrieve stealth keys
    const node = user.get("stealthKeys");
    node.once((keys: any) => {
      console.log("Keys retrieved for opening:", keys);
      
      if (!keys?.epriv || !keys?.epub) {
        console.error("Missing stealth keys:", keys);
        return cb(new Error("Stealth keys not found or incomplete"));
      }

      const { epriv, epub } = keys;

      // Generate shared secret
      SEA.secret(ephemeralPublicKey, { epriv, epub }, (sharedSecret: string) => {
        if (!sharedSecret) {
          console.error("Unable to generate shared secret");
          return cb(new Error("Unable to generate shared secret"));
        }

        console.log("Shared secret generated");

        try {
          // Derive private key
          const stealthPrivateKey = ethers.keccak256(
            ethers.toUtf8Bytes(sharedSecret)
          );
          const stealthWallet = new ethers.Wallet(stealthPrivateKey);

          // Verify derived address matches
          if (
            stealthWallet.address.toLowerCase() !== stealthAddress.toLowerCase()
          ) {
            console.error("Derived address doesn't match:", {
              derived: stealthWallet.address,
              expected: stealthAddress
            });
            return cb(
              new Error(
                "Derived address doesn't match provided stealth address"
              )
            );
          }

          console.log("Stealth wallet recovered successfully");
          cb(undefined, stealthWallet);
        } catch (error) {
          console.error("Error deriving wallet:", error);
          cb(new Error("Error deriving stealth wallet"));
        }
      });
    });
  }

  /**
   * Retrieves stealth keys (epub) from public registry if present
   */
  public retrieveStealthKeysFromRegistry(
    publicKey: string,
    cb: Callback<string>
  ): void {
    if (!publicKey) {
      return cb(new Error("Invalid public key"));
    }
    const formattedPubKey = this.formatPublicKey(publicKey);

    this.gun
      .get("stealthKeys")
      .get(formattedPubKey)
      .once((data: string | null) => {
        if (!data) {
          return cb(new Error("Keys not found in registry"));
        }
        cb(undefined, data);
      });
  }

  /**
   * Retrieves stealth keys from logged in user session
   */
  public retrieveStealthKeysFromUser(cb: Callback<StealthKeyPair>): void {
    const user = this.gun.user();
    if (!user?.is) {
      return cb(new Error("User not authenticated or missing user"));
    }

    const node = user.get("stealthKeys");
    
    // Retrieve all fields separately
    node.once((data: any) => {
      console.log("Retrieved data:", data);
      
      if (!data?.pub || !data?.priv || !data?.epub || !data?.epriv) {
        return cb(new Error("Stealth keys not found or incomplete"));
      }

      const stealthKeyPair: StealthKeyPair = {
        pub: data.pub,
        priv: data.priv,
        epub: data.epub,
        epriv: data.epriv
      };

      cb(undefined, stealthKeyPair);
    });
  }

  /**
   * Saves stealth keys to logged in user and updates public registry
   */
  public saveStealthKeys(stealthKeyPair: StealthKeyPair, cb: Callback<void>): void {
    if (!stealthKeyPair || !stealthKeyPair.pub || !stealthKeyPair.epub) {
      console.error("Invalid stealth keys:", stealthKeyPair);
      return cb(new Error("Invalid or incomplete stealth keys"));
    }

    const user = this.gun.user();
    if (!user?.is) {
      console.error("User not authenticated");
      return cb(new Error("User not authenticated"));
    }

    console.log("Saving keys for user:", user.is.pub);

    // First save to public registry
    this.gun.get("stealthKeys").get(user.is.pub).put(stealthKeyPair.epub);

    // Then save private keys to user
    const node = user.get("stealthKeys");
    
    // Save each field separately to avoid serialization issues
    node.get("pub").put(stealthKeyPair.pub);
    node.get("priv").put(stealthKeyPair.priv);
    node.get("epub").put(stealthKeyPair.epub);
    node.get("epriv").put(stealthKeyPair.epriv);

    // Verify save
    node.once((data: any) => {
      console.log("Save verification:", data);
      if (data?.pub && data?.priv && data?.epub && data?.epriv) {
        console.log("Keys saved successfully");
        cb();
      } else {
        console.error("Error saving keys");
        cb(new Error("Error saving keys"));
      }
    });
  }

  /**
   * Saves recipient's stealth keys to localStorage
   * @param {string} alias - Recipient's username
   * @param {Object} stealthKeys - Object containing stealth keys
   * @param {string} stealthKeys.spendingKey - Spending key
   * @param {string} stealthKeys.viewingKey - Viewing key
   * @returns {Promise<void>}
   */
  public async saveStealthKeysLocally(
    alias: string,
    stealthKeys: { spendingKey: string; viewingKey: string }
  ): Promise<void> {
    localStorage.setItem(`stealthKeys_${alias}`, JSON.stringify(stealthKeys));
  }

  /**
   * Retrieves recipient's stealth keys from localStorage
   * @param {string} alias - Recipient's username
   * @returns {Promise<{spendingKey: string, viewingKey: string}>} Stealth keys
   */
  public async retrieveStealthKeysLocally(
    alias: string
  ): Promise<{ spendingKey: string; viewingKey: string }> {
    const stealthKeys = localStorage.getItem(`stealthKeys_${alias}`);
    if (!stealthKeys) {
      throw new Error("Stealth keys not found in localStorage");
    }
    const parsed = JSON.parse(stealthKeys);
    if (!parsed || !parsed.spendingKey || !parsed.viewingKey) {
      throw new Error("Invalid stealth keys in localStorage");
    }
    return parsed;
  }
}
