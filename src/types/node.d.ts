declare module "crypto" {
  export interface Buffer extends Uint8Array {
    toString(encoding: string): string;
    from(data: string, encoding?: string): Buffer;
  }
} 