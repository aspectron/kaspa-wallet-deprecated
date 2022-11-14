import {CreateLogger, Logger} from '../utils/logger';
import {UID} from '../utils/helper';
import { WalletCache } from '../types/custom-types';

export type StorageType = 'FILE'|'LS';
const IS_NODE = typeof process === 'object' 
	&& typeof process.versions === 'object'
	&& typeof process.versions.node === 'string';

export type StorageOpts = {
	logLevel?:string,
	password?:string,
	fileDbOptions?:{
		fileName?:string,
		folder?:string
	}
};
export interface TXStoreItem{
	in:boolean;
	ts:number;
	id:string;
	amount:number;
	address:string;
	note?:string;
	tx?:any
}
export interface WalletMeta{
	version?:string;
	generator?:string;
	encryption?:string;
	wallet?:{mnemonic?:string}
}
export interface WalletContent{
	type:string;
	version:string;
	generator:string;
	encryption:string;
	wallet:{mnemonic:string}
}

interface DBOptions{
	fileName?:string,
	folder?:string
}

abstract class DBInterface{
	abstract backup():void;
	abstract saveWallet(data:string):void;
	abstract getWallet():string|false;
	abstract getCache():string|undefined;
	abstract saveCache(cache:string):void
}

interface DBConstructor {
    new (opt?:DBOptions): DBInterface;
}


const classes:{[key:string]:DBConstructor} = {};

class LSDB extends DBInterface{
	LS: any;
	constructor(opt:DBOptions={}){
		super();
		this.LS = window.localStorage;
	}

	backup():void{
		let data = this.getWallet();
		if(!data)
			return
		let ts = Date.now();
		this.LS.setItem("kaspa-wallet-"+ts, data);
		let cache = this.getCache();
		if(cache)
			this.LS.setItem("kaspa-cache-"+ts, cache);
	}
	saveWallet(data:string):void{
		this.LS.setItem("kaspa-wallet", data);
	}

	getWallet():string|false{
		return this.LS.getItem("kaspa-wallet");
	}

	saveCache(cache:string){
		return this.LS.setItem("kaspa-cache", cache);
	}

	getCache():string|undefined{
		return this.LS.getItem("kaspa-cache");
	}
}

classes.LSDB = LSDB;

if(IS_NODE){
	const path = require("path");
	const os = require("os");
	const fs = require("fs");

	class FileDB extends DBInterface{
		walletFile:string;
		txFile:string;
		fileName:string;
		folder:string;
		cacheFile:string;

		constructor(opt:DBOptions={}){
			super();
			let {fileName="kaspa", folder} = opt;
			this.fileName = fileName;
			this.folder = folder||this.getHomeFolder();
			if(!fs.existsSync(this.folder))
				fs.mkdirSync(this.folder, {recursive:true})
			this.walletFile = this.createFilePath('kpk');
			this.txFile = this.createFilePath('ktx');
			this.cacheFile = this.createFilePath('cache');
		}

		createFilePath(ext='kpk', suffix=''){
			return path.join(this.folder, `${this.fileName}${suffix}.${ext}`);
		}

		getHomeFolder(){
			let {APPDATA, HOME} = process.env;
			if(!HOME)
				HOME = os.homedir();

			if(APPDATA) // windows
				return path.join(APPDATA, 'Kaspa');

			if(process.platform == 'darwin')
				return path.join(HOME,'/Library/Application Support/Kaspa/');

			return path.join(HOME, '.kaspa');
		}

		backup(){
			let bk = '-backup-'+UID("-");

			if(fs.existsSync(this.walletFile)){
				let newPath = this.createFilePath('kpk', bk)
				fs.renameSync(this.walletFile, newPath);
			}
			if(fs.existsSync(this.txFile)){
				let newPath = this.createFilePath('ktx', bk)
				fs.renameSync(this.txFile, newPath);
			}
			if(fs.existsSync(this.cacheFile)){
				let newPath = this.createFilePath('cache', bk)
				fs.renameSync(this.cacheFile, newPath);
			}
		}

		saveWallet(data:string):void{
			fs.writeFileSync(this.walletFile, data);
		}

		getWallet():string|false{
			if(fs.existsSync(this.walletFile))
				return fs.readFileSync(this.walletFile)+"";
			return false;
		}

		saveCache(cache:string){
			return fs.writeFileSync(this.cacheFile, cache);
		}
	
		getCache():string|undefined{
			if(fs.existsSync(this.cacheFile))
				return fs.readFileSync(this.cacheFile)+"";
			return undefined;
		}
	}

	classes.FileDB = FileDB;
}

export class Storage{

	logger:any;
	db:DBInterface;
	constructor(opt:StorageOpts={}){
		this.logger = CreateLogger("KaspaStorage");
		const {fileDbOptions={}} = opt;

		if(opt.logLevel)
			this.setLogLevel(opt.logLevel)

		if(IS_NODE){
			this.db = new classes.FileDB(fileDbOptions);
		}else{
			this.db = new classes.LSDB();
		}
	}

	/*
	* @return {String|Buffer} wallet
	*/
	getWallet():WalletContent|false{
		let content = this.db.getWallet();
		if(!content)
			return false;
		try{
			return JSON.parse(content);
		}catch(e){
			return false;
		}
	}

	_buildWalletContent(mnemonic:string, meta:WalletMeta={}){
		return Object.assign({
			type: "kaspa-wallet",
			encryption: "default",
			version: 1,
			generator: "cli",
			wallet: {
				mnemonic
			}
		}, meta||{})
	}

	createWallet(mnemonic:string, meta:WalletMeta={}){
		//this.logger.debug("createWallet:", wallet)
		this.db.backup();
		this.db.saveCache('')
		return this.saveWallet(mnemonic, meta);
	}
	saveWallet(mnemonic:string, meta:WalletMeta={}){
		//this.logger.debug("saveWallet:", wallet)
		let wallet = this._buildWalletContent(mnemonic, meta);
		let json = JSON.stringify(wallet)
		return this.db.saveWallet(json);
	}

	/*
	* @return {WalletCache|undefined} cache
	*/
	getCache():WalletCache|false{
		let cache = this.db.getCache();
		if(!cache)
			return false;
		
		try{
			return JSON.parse(cache);
		}catch(e){
			return false;
		}
	}

	saveCache(cache:WalletCache){
		let data = JSON.stringify(cache);
		this.db.saveCache(data);
	}

	setLogLevel(level:string){
		this.logger.setLevel(level)
	}

	addTransaction(tx:TXStoreItem){

	}
}


