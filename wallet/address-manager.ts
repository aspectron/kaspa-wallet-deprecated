// @ts-ignore
import * as kaspacore from '@kaspa/core-lib';
import {Network} from 'custom-types';

// @ts-ignore
const secp256k1 = kaspacore.secp256k1;//require('secp256k1-wasm');
import {EventTargetImpl} from './event-target-impl';
import {dpc} from '../utils/helper';

export class AddressManager extends EventTargetImpl {
	constructor(HDWallet: kaspacore.HDPrivateKey, network: Network) {
		super();
		this.HDWallet = HDWallet;
		this.network = network;
	}

	private HDWallet: kaspacore.HDPrivateKey;

	network: Network;

	get all(): Record < string, kaspacore.PrivateKey > {
		return {
			...this.receiveAddress.keypairs,
			...this.changeAddress.keypairs
		};
	}

	get shouldFetch(): string[] {
		const receive = Object.entries(this.receiveAddress.atIndex)
			.filter(
				(record: [string, string]) => parseInt(record[0], 10) <= this.receiveAddress.counter - 1
			)
			.map((record: [string, string]) => record[1]);
		const change = Object.entries(this.changeAddress.atIndex)
			.filter((record: [string, string]) => parseInt(record[0], 10) <= this.changeAddress.counter)
			.map((record: [string, string]) => record[1]);
		return [...receive, ...change];
	}

	/**
	 * Derives a new receive address. Sets related instance properties.
	 */
	receiveAddress: {
		counter: number;
		current: {
			address: string;
			privateKey: kaspacore.PrivateKey
		};
		keypairs: Record < string, kaspacore.PrivateKey > ;
		atIndex: Record < string, string > ;
		next: () => string;
		advance: (n: number) => void;
	} = {
		counter: 0,
		// @ts-ignore
		current: {},
		keypairs: {},
		atIndex: {},
		next: (): string => {
			const {
				address,
				privateKey
			} = this.deriveAddress('receive', this.receiveAddress.counter);

			this.receiveAddress.current = {
				address,
				privateKey
			};
			this.receiveAddress.keypairs[address] = privateKey;
			this.receiveAddress.atIndex[this.receiveAddress.counter] = address;
			this.receiveAddress.counter += 1;
			return address;
		},
		advance(n: number): void {
			if (n > -1)
				this.counter = n;
			this.next();
		},
	};

	/**
	 * Derives a new change address. Sets related instance properties.
	 */
	changeAddress: {
		counter: number;
		current: {
			address: string;
			privateKey: kaspacore.PrivateKey
		};
		keypairs: Record < string, kaspacore.PrivateKey > ;
		atIndex: Record < string, string > ;
		next: () => string;
		advance: (n: number) => void;
		reverse: () => void;
	} = {
		counter: 0,
		// @ts-ignore
		current: {},
		keypairs: {},
		atIndex: {},
		next: (): string => {
			const {
				address,
				privateKey
			} = this.deriveAddress('change', this.changeAddress.counter);

			this.changeAddress.keypairs[address] = privateKey;
			this.changeAddress.current = {
				address,
				privateKey
			};
			this.changeAddress.atIndex[this.changeAddress.counter] = address;
			this.changeAddress.counter += 1;
			return address;
		},
		advance(n: number): void {
			if (n > -1)
				this.counter = n;
			// no call to next() here; composeTx calls it on demand.
		},
		reverse(): void {
			if (this.counter > 0)
				this.counter -= 1;
		},
	};

	private deriveAddress(
		deriveType: 'receive' | 'change',
		index: number
	): {
		address: string;
		privateKey: kaspacore.PrivateKey
	} {
		//let ts0 = Date.now();
		const dType = deriveType === 'receive' ? 0 : 1;
		const {privateKey} = this.HDWallet.deriveChild(`m/44'/972/0'/${dType}'/${index}'`);
		//let ts1 = Date.now();
		//let publicKeys = secp256k1.export_public_keys(privateKey.toString());
		const xonlyPubKey = secp256k1.export_public_key_xonly(privateKey.toString());
		//let ts2 = Date.now();

		//console.log('durations:',(ts2-ts1)/1000,(ts1-ts0)/1000);
		//let address1 = new kaspacore.PublicKey(publicKeys.pubkey, {network:this.network}).toAddress().toString();
		//let address = privateKey.toAddress(this.network).toString();
		//let pubkey = Buffer.from(publicKeys.pubkey, "hex");
		//let {address:address3} = bitcoin.payments.p2pkh({pubkey});
		let xonly = Buffer.from(xonlyPubKey, "hex");
		//@ts-ignore
		
		let address = kaspacore.Address.fromPublicKeyBuffer(xonly, this.network).toString();

		/*
		console.log("privateKey:xxxx:", {
		  privateKey: privateKey.toString(),
		  address,
		  address1,
		  address2,
		  "address1==address":address1==address,
		  publicKeys
		 });//, publicKeys)
		 */
		//console.log("xonly:address2", "privateKey:"+privateKey.toString(), "address:"+address2)
		//console.log("xonly", publicKeys.xonly)
		dpc(() => {
			this.emit("new-address", {
				type: deriveType,
				address,
				index
			});
		})

		return {
			address,
			privateKey
		};
	}

	/**
	 * Derives n addresses and adds their keypairs to their deriveType-respective address object
	 * @param n How many addresses to derive
	 * @param deriveType receive or change address
	 * @param offset Index to start at in derive path
	 */
	getAddresses(n: number, deriveType: 'receive' | 'change', offset = 0) {
		return [...Array(n).keys()].map((i) => {
			const index = i + offset;
			const {
				address,
				privateKey
			} = this.deriveAddress(deriveType, index);

			if (deriveType === 'receive') {
				this.receiveAddress.atIndex[index] = address;
				this.receiveAddress.keypairs[address] = privateKey;
			} else {
				this.changeAddress.atIndex[index] = address;
				this.changeAddress.keypairs[address] = privateKey;
			}
			return {
				index,
				address,
				privateKey,
			};
		});
	}

	isOur(address:string):boolean{
		return !!(this.changeAddress.keypairs[address] || this.receiveAddress.keypairs[address]);
	}

	isOurChange(address:string):boolean{
		return !!this.changeAddress.keypairs[address];
	}

}