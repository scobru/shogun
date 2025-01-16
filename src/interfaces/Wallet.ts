export class Wallet {
  entropy: string | undefined;

  constructor(public publicKey: string, entropy?: string) {
    this.entropy = entropy;
  }
}