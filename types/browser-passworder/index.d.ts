declare module 'browser-passworder' {
  import { Buffer } from 'safe-buffer';

  export function encrypt(password: string, privateKey: Buffer): Promise<string>;
  export function decrypt(password: string, encrypted: string): Promise<Buffer>;
}
