import CryptoJS from 'crypto-js';

const JsonFormatter = (passSalt:string)=> {
	return {
		stringify: function(cipherParams:CryptoJS.lib.CipherParams) {
			let data = [CryptoJS.enc.Hex.stringify(cipherParams.ciphertext)]
			if (cipherParams.iv) {
				data.push(cipherParams.iv.toString());
			}else{
				data.push("");
			}
			if (cipherParams.salt) {
				data.push(cipherParams.salt.toString());
			}else{
				data.push("");
			}
			data.push(passSalt);

			return Crypto.toHexCode(data);
		},
		parse: function(hexCode:string){
			//console.log("hexCode", hexCode)
			let [ct, iv, salt] = Crypto.parseHexCode(hexCode)

			let cipherParams = CryptoJS.lib.CipherParams.create({
				ciphertext: CryptoJS.enc.Hex.parse(ct)
			});​
			if (iv) {
				cipherParams.iv = CryptoJS.enc.Hex.parse(iv);
			}​
			if (salt) {
				cipherParams.salt = CryptoJS.enc.Hex.parse(salt);
			}​
			return cipherParams;
		}
	}	
};

export class Crypto {
	static async encrypt(passphrase: string, data: string) {
		let {key, salt} = this.createKey(passphrase);
		//console.log("key, salt", {key, salt})
		return CryptoJS.AES.encrypt(data, key, {
			mode: CryptoJS.mode.CFB,
			padding: CryptoJS.pad.AnsiX923,
			format: JsonFormatter(salt)
		}).toString()
	}

	static async decrypt(passphrase: string, data: string) {
		let [ct, iv, salt, passSalt] = this.parseHexCode(data);
		let {key} = this.createKey(passphrase, passSalt);
		return CryptoJS.AES.decrypt(data, key, {
			mode: CryptoJS.mode.CFB,
			padding: CryptoJS.pad.AnsiX923,
			format: JsonFormatter(passSalt)
		}).toString(CryptoJS.enc.Utf8)
	}

	static createKey(passphrase: string, saltStr:string='') {
		let salt = saltStr?CryptoJS.enc.Hex.parse(saltStr):CryptoJS.lib.WordArray.random(128 / 8);
		return {
			key: CryptoJS.PBKDF2(passphrase, salt, {
				keySize: 512 / 32,
				iterations: 1000
			}).toString(CryptoJS.enc.Hex),
			salt:salt.toString(CryptoJS.enc.Hex)
		}
	}

	static parseHexCode(hexCode:string){
		let data = [];
		do{
			let l = parseInt(hexCode.substr(0, 5), 10);
			let c = hexCode.substr(5, l);
			data.push(c);
			hexCode = hexCode.substr(5+l);
		}while(hexCode.length);
		return data;
		/*
		let words = CryptoJS.enc.Hex.parse(hexCode);
		return CryptoJS.enc.Utf8.stringify(words).split(",")
		*/
	}

	static toHexCode(data:string[]){
		return data.map(d=>{
			return (d.length+"").padStart(5, '0')+d;
		}).join('');
		/*
		let words = CryptoJS.enc.Utf8.parse(data.join(","));
		let hex = CryptoJS.enc.Hex.stringify(words);
		//console.log("stringify:", data, "=>", words, "=>", hex)*/
	}
}

/*
const test = async()=>{
	const pass = "#drfgt Sf @33 gfdg dfg dfg";
	const data = "rfasdsdsvfgfgfg dsfsdf sdf sdf sdfsdf sdf sdf sf sdgdfg dfg dfg dfgfdgdf gsfd gdfs gsfd gsfd gdf gfdgfdgsdfrete rgdf dfgdfg";
	let encrypted = await Crypto.encrypt(pass, data)
	.catch((e:any)=>{
		console.log("error", e)
	})
	console.log("encrypted:", encrypted)
	if(!encrypted)
		return
	let decrypted = await Crypto.decrypt(pass, encrypted)
	//.catch((e:any)=>{
	//	console.log("error", e)
	//})
	console.log("decrypted:", decrypted==data, decrypted)
};

test().catch((e:any)=>{
	console.log("error", e)
})
*/



