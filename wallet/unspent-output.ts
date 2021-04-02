import * as kaspacore from '@kaspa/core-lib';
import {UnspentOutputInfo} from '../types/custom-types';
export class UnspentOutput extends kaspacore.Transaction.UnspentOutput {
	blockBlueScore: number;
	scriptPublicKeyVersion: number;
	id:string;
	constructor(o: UnspentOutputInfo) {
		super(o);
		this.blockBlueScore = o.blockBlueScore;
		this.scriptPublicKeyVersion = o.scriptPublicKeyVersion;
		this.id = this.txId + this.outputIndex;
	}
}
