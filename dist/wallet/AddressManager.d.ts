import bitcore from 'bitcore-lib-cash';
import { Network } from 'custom-types';
export declare class AddressManager {
    constructor(HDWallet: bitcore.HDPrivateKey, network: Network);
    private HDWallet;
    network: Network;
    get all(): Record<string, bitcore.PrivateKey>;
    get shouldFetch(): string[];
    /**
     * Derives a new receive address. Sets related instance properties.
     */
    receiveAddress: {
        counter: number;
        current: {
            address: string;
            privateKey: bitcore.PrivateKey;
        };
        keypairs: Record<string, bitcore.PrivateKey>;
        atIndex: Record<string, string>;
        next: () => string;
        advance: (n: number) => void;
    };
    /**
     * Derives a new change address. Sets related instance properties.
     */
    changeAddress: {
        counter: number;
        current: {
            address: string;
            privateKey: bitcore.PrivateKey;
        };
        keypairs: Record<string, bitcore.PrivateKey>;
        atIndex: Record<string, string>;
        next: () => string;
        advance: (n: number) => void;
        reverse: () => void;
    };
    private deriveAddress;
    /**
     * Derives n addresses and adds their keypairs to their deriveType-respective address object
     * @param n How many addresses to derive
     * @param deriveType receive or change address
     * @param offset Index to start at in derive path
     */
    getAddresses(n: number, deriveType: 'receive' | 'change', offset?: number): {
        index: number;
        address: string;
        privateKey: any;
    }[];
}
//# sourceMappingURL=AddressManager.d.ts.map