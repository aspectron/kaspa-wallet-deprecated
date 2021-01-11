export type StorageType = 'FILE'|'LS';

const IS_NODE = typeof process === 'object' 
	&& typeof process.versions === 'object'
	&& typeof process.versions.node === 'string';

const classes:any = {};

export type StorageOpts = {verbose?:boolean, password?:string};

class Storage{
	type:StorageType = 'LS';
	verbose:boolean = false;

	constructor(opt:StorageOpts={}){
		if(opt.verbose)
			this.initLogs();
	}

	setType(type:StorageType){
		if(type != "LS")
			throw new StorageError("Only localStorage (LS) is supported as StorageType.")
		this.type = type;
	}

	set(key:string, value:string){
		this._setValue(key, value);
	}
	unset(key:string){
		this.remove(key);
	}
	remove(key:string){
		this._removeValue(key);
	}
	clear(){
		this._clearValues();
	}

	get(key:string, defaults:string){
		let value = this._getValue(key);
		if(value === undefined)
			return defaults;
		return value;
	}

	_setValue(key:string, value:string){
		localStorage.setItem("kaspa_wt_"+key, value);
	}

	_getValue(key:string):string|null{
		return localStorage.getItem("kaspa_wt_"+key);
	}
	_removeValue(key:string){
		return localStorage.removeItem("kaspa_wt_"+key);
	}
	_clearValues(){
		Object.keys(localStorage).map(key=>{
			if(key.startsWith("kaspa_wt_"))
				localStorage.removeItem(key);
		})
	}

	setPassword(password:string){
		this.throwNotSupported();
	}

	setFolder(folder:string){
		this.throwNotSupported();
	}

	setFileName(fileName:string){
		this.throwNotSupported();
	}

	throwNotSupported(){
		throw new StorageError("Only supported in NodeJS environment.")
	}

	initLogs(){
		this.log = console.log.bind(console, `[${this.constructor.name}]`);
	}

	log(...args:any){
		//console.log(...args);
	}
}

classes.Storage = Storage;

class StorageError extends Error{}

if(IS_NODE){
	const crypto = require("crypto");
	const fs 	= require("fs");
	const path 	= require("path");

	class NodeStorage extends Storage{
		type:StorageType = 'FILE';
		fileName:string = 'wallet.dat';
		folder:string = '';
		file:string = '';
		password:Buffer|null = null;
		iv:Buffer;
		data:any = {};
		encodedDataStr:string='';

		constructor(opt:StorageOpts={}){
			super(opt);
			this.iv 	= crypto.randomBytes(16);
			//this.setPassword("xyz");
			let folder 	= this.getHomeFolder();
			if(!fs.existsSync(folder)){
				fs.mkdirSync(folder, {recursive:true});
			}
			this.setFolder(folder);
		}

		setType(type:StorageType){
			this.type = type;
		}

		getHomeFolder(){
			let {LOCALAPPDATA, HOME} = process.env;
			if(LOCALAPPDATA)
				return path.join(LOCALAPPDATA, 'Kaspa');
			if(!HOME){
				const os = require("os");
				HOME = os.homedir();
			}

			let folder = "/.local/share";
			if(process.platform=='darwin')
				folder = '/Library/Preferences';

			return path.join(HOME, folder, 'Kaspa');
		}

		setPassword(password:string){
			let {password:oldPassword, data} = this;
			this.password = crypto.createHash('sha256').update(password).digest();
			if(this.encodedDataStr){
				try{
					this.data = JSON.parse(this.decrypt(this.encodedDataStr));
				}catch(error){
					throw new StorageError("Invalid password");
					this.password = oldPassword;
					this.data = data;
				}
			}
		}

		setFolder(folder:string){
			let {folder:oldFolder} = this;
			this.folder = folder;
			if(oldFolder != folder)
				this.onFileFolderChange();
		}

		setFileName(fileName:string){
			let {fileName:oldFileName} = this;
			this.fileName = fileName;
			if(oldFileName != fileName)
				this.onFileFolderChange();
		}

		onFileFolderChange(){
			if(!this.folder || !this.fileName)
				return;
			this.file 	= path.join(this.folder, this.fileName);
			this.log("this.file", this.file)

			if(fs.existsSync(this.file)){
				let content 	= fs.readFileSync(this.file)+"";
				try{
					let {iv, data:encodedDataStr} = JSON.parse(content);
					this.iv = Buffer.from(iv, 'hex');
					this.encodedDataStr = encodedDataStr;
				}catch(error){
					this.log("parse::error", error)
					fs.writeFileSync(this.file+".error."+Date.now(), content);
				}	
			}else{
				this.iv = crypto.randomBytes(16);
				this.encodedDataStr = '';
			}
		}

		encrypt(text:string) {
			let cipher = crypto.createCipheriv('aes-256-cbc', this.password, this.iv);
			let encrypted = cipher.update(text);
			encrypted = Buffer.concat([encrypted, cipher.final()]);
			return encrypted.toString('hex');
		}

		decrypt(encryptedData:string) {
			let decipher = crypto.createDecipheriv('aes-256-cbc', this.password, this.iv);
			let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
			decrypted = Buffer.concat([decrypted, decipher.final()]);
			return decrypted.toString();
		}

		set(key:string, value:string){
			if(this.type == "FILE")
				return this._setFileValue(key, value);
			this._setValue(key, value);
		}

		get(key:string, defaults:string){
			let value;
			if(this.type == "FILE")
				value = this._getFileValue(key);
			else
				value = this._getValue(key);

			if(value === undefined)
				return defaults;
			return value;
		}

		remove(key:string){
			if(this.type == "FILE")
				return this._removeFileValue(key);
			this._removeValue(key);
		}

		clear(){
			if(this.type == "FILE")
				return this._clearFileValues();
			this._clearValues();
		}

		_setFileValue(key:string, value:string){
			this.isPasswordOrThrowError();
			this.data[key] = value;
			this.saveFile();
		}

		_getFileValue(key:string){
			this.isPasswordOrThrowError();
			return this.data[key];
		}

		_removeFileValue(key:string):any{
			this.isPasswordOrThrowError();
			let value = this.data[key];
			delete this.data[key];
			this.saveFile();
			return value;
		}
		_clearFileValues(){
			this.isPasswordOrThrowError();
			this.data = {};
			this.saveFile();
		}

		isPasswordOrThrowError(){
			if(!this.password)
				throw new StorageError("Please set password before using storage.");
		}

		saveFile(){
			if(!this.file)
				return
			let json = {
				version:1,
				iv:this.iv.toString("hex"),
				data:this.encrypt(JSON.stringify(this.data))
			}
			let content = JSON.stringify(json);
			fs.writeFileSync(this.file, content);
			/*
			//TODO
			let content = Buffer.from(Buffer.from(JSON.stringify(json)).toString("hex"), "hex");
			console.log("content", content)
			fs.writeFileSync(this.file, content, {encoding:'binary'});
			*/
		}
	}

	classes.NodeStorage = NodeStorage;
}



export const CreateStorage = ()=>IS_NODE? new classes.NodeStorage() : new Storage();

export {classes};
