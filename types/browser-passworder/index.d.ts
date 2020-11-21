declare module 'browser-passworder' {

  export function encrypt(password: string, data: string): Promise<string>;
  export function decrypt(password: string, encrypted: string): Promise<string>;
}
