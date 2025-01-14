export function waitUntil(condition: () => boolean) {
  return new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (!condition()) {
        return;
      }

      clearInterval(interval);
      resolve();
    }, 100);
  });
}

export async function convertToEthPk(
  gunPrivateKey: string
): Promise<string> {
  const base64UrlToHex = (base64url: string): string => {
    try {
      const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
      const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
      const binary = atob(base64);
      const hex = Array.from(binary, (char) =>
        char.charCodeAt(0).toString(16).padStart(2, "0")
      ).join("");

      if (hex.length !== 64) {
        throw new Error("Lunghezza chiave privata non valida");
      }
      return hex;
    } catch (error) {
      console.error("Errore nella conversione base64Url to hex:", error);
      throw new Error("Impossibile convertire la chiave privata");
    }
  };

  const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
  return hexPrivateKey;
}
