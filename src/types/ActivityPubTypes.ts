export interface ActivityPubKeys {
  publicKey: string;
  privateKey: string;
  createdAt: number;
} 

export interface ActivityPubActivity {
  "@context": string;
  type: string;
  actor: string;
  object: {
    type: string;
    content: string;
    published: string;
  };
  signature?: string;
}
