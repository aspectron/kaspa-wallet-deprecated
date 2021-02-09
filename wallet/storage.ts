import {CreateLogger, Logger} from '../utils/logger';
import {UID} from '../utils/helper';

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
	abstract createWallet(data:string):void;
	abstract saveWallet(data:string):void;
	abstract getWallet():WalletContent|false;
}

interface DBConstructor {
    new (opt?:DBOptions): DBInterface;
}


const classes:{[key:string]:DBConstructor} = {};

class LSDB extends DBInterface{
	constructor(opt:DBOptions={}){
		super();
	}

	createWallet(data:string):void{

	}
	saveWallet(data:string):void{

	}

	getWallet():WalletContent|false{
		return false;
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

		constructor(opt:DBOptions={}){
			super();
			let {fileName="kaspa", folder} = opt;
			this.fileName = fileName;
			this.folder = folder||this.getHomeFolder();
			if(!fs.existsSync(this.folder))
				fs.mkdirSync(this.folder, {recursive:true})
			this.walletFile = this.createFilePath('kpk');
			this.txFile = this.createFilePath('ktx');
		}

		createFilePath(ext='kpk', suffix=''){
			return path.join(this.folder, `${this.fileName}${suffix}.${ext}`);
		}

		getHomeFolder(){
			let {LOCALAPPDATA, HOME} = process.env;
			if(LOCALAPPDATA)
				return path.join(LOCALAPPDATA, 'Kaspa');
			if(!HOME){
				HOME = os.homedir();
			}

			let folder = "/.local/share";
			if(process.platform=='darwin')
				folder = '/Library/Preferences';

			return path.join(HOME, folder, 'Kaspa');
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
		}

		createWallet(data:string, meta:WalletMeta={}):void{
			this.backup();
			return this.saveWallet(data, meta);
		}
		saveWallet(data:string, meta:WalletMeta={}):void{
			let content = Object.assign({
				type: "kaspa-wallet",
				encryption: "default",
				version: 1,
				generator: "cli",
				wallet: {
					mnemonic : data
				}
			}, meta||{})

			fs.writeFileSync(this.walletFile, JSON.stringify(content));
		}

		getWallet():WalletContent|false{
			if(fs.existsSync(this.walletFile)){
				let content = fs.readFileSync(this.walletFile)+"";
				try{
					return JSON.parse(content);
				}catch(e){
					return false;
				}
			}
			return false;
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
		return this.db.getWallet();
	}

	createWallet(wallet:string){
		//this.logger.debug("createWallet:", wallet)
		return this.db.createWallet(wallet);
	}
	saveWallet(wallet:string){
		//this.logger.debug("saveWallet:", wallet)
		return this.db.saveWallet(wallet);
	}

	setLogLevel(level:string){
		this.logger.setLevel(level)
	}

	addTransaction(tx:TXStoreItem){

	}
}


