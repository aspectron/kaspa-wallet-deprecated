declare module '@aspectron/flow-key-crypt' {

  export function encrypt(password: string, data: string): Promise<string>;
  export function decrypt(password: string, encrypted: string): Promise<object>;
}
