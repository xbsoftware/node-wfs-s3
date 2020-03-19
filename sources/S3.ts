import * as AWS from "aws-sdk";
import * as filepath from "path";
import * as stream from "stream";

import getFileType from "./filetypes";
import {CombinedPolicy, ForceRootPolicy} from "./policy";
import {IDriveConfig, IFsObject, IListConfig, IOperationConfig, IPolicy, Operation} from "./types";

const fs:any = {};

export default class S3 {
	private policy: IPolicy;
	private _root: string;
	private _bucket: string;
	private _config: IDriveConfig;
	private aws: any;

	constructor(root: string, policy?: IPolicy, config?:IDriveConfig){
		if (!root || root.substr(0,5) !== "s3://") {
			throw new Error("Invalid root folder");
		}

		this.aws = new AWS.S3({
			accessKeyId: config.accessKey,
			secretAccessKey: config.secretKey
		});

		const nameIndex = root.indexOf("/", 5);
		this._bucket = root.substr(5, nameIndex-5);
		root = root.substr(nameIndex);

		// /some/path/ => /some/path
		if (root[root.length-1] === "/") {
			root = root.substr(0, root.length-1);
		}
		// /root/some/../../other => /root/other
		root = filepath.normalize(root);
		if (root === "."){
			root = "/";
		}

		this._root = root;

		if (!policy) {
			this.policy = new ForceRootPolicy(this._root);
		}else {
			this.policy = new CombinedPolicy(
				new ForceRootPolicy(this._root),
				policy
			);
		}

		this._config = config || {};
	}

	async list(path: string, config?: IListConfig) : Promise<IFsObject[]> {
		config = config || {};

		if (this._config.verbose){
			console.log("List %s", path);
			console.log("with config ", config);
		}

		const fullpath = this.idToPath(path);

		if (this.policy.comply(fullpath, Operation.Read)) {
			return this._listFolder(fullpath, path, config, null);
		}
		throw new Error("Access Denied");
	}

	async search(path: string, search: string, config?: IListConfig){
		return this.list(path, config)
	}

	async remove(path: string): Promise<void>{
		if (this._config.verbose){
			console.log("Delete %s", path);
		}

		const fullpath = this.idToPath(path);
		if (this.policy.comply(fullpath, Operation.Write)) {
			const files = await this._files(path);

			let result;
			if (files.length){
				result = await this.aws.deleteObjects({
					Bucket: this._bucket,
					Delete:{
						Objects : files.map(a => ({ Key: a }))
					}
				}).promise();
			} else {
				result = await this.aws.deleteObject({
					Bucket: this._bucket,
					Key: fullpath.substr(1)
				}).promise();
			}

			return result;
		}

		throw new Error("Access Denied");
	}

	async _files(path: string, count?: number) : Promise<string[]> {
		if (path[path.length-1] !== "/"){
			path = path + "/";
		}

		const search:any = {
			Bucket : this._bucket,
			Prefix : path.substr(1)
		};
		if (count){
			search.MaxKeys = count;
		}

		const data = await this.aws.listObjectsV2(search).promise();

		const keys = data.Contents.map(a => a.Key);
		return keys;
	}

	async read(path: string): Promise<any> {
		if (this._config.verbose){
			console.log("Get content of %s", path);
		}

		const fullpath = this.idToPath(path);
		if (this.policy.comply(fullpath, Operation.Read)) {
			return this.aws.getObject({
				Bucket: this._bucket,
				Key: fullpath.substr(1)
			}).createReadStream();
		}

		throw new Error("Access Denied");
	}

	async write(path: string, data: any, config?: IOperationConfig): Promise<string> {
		if (this._config.verbose){
			console.log("Save content to %s", path);
		}

		let fullpath = this.idToPath(path);
		if (this.policy.comply(fullpath, Operation.Write)) {
			await this.aws.upload({
				Bucket: this._bucket,
				Key: fullpath.substr(1),
				Body: data
			}).promise();

			return Promise.resolve(this.pathToId(fullpath));
		}
		throw new Error("Access Denied");
	}

	async info(id) : Promise<IFsObject> {
		const fullpath = this.idToPath(id);
		if (!this.policy.comply(fullpath, Operation.Read)) {
			throw new Error("Access Denied");
		}

		const name = filepath.basename(fullpath);
		let content;
		try {
			content = await this.aws.headObject({
				Bucket: this._bucket,
				Key: fullpath.substr(1)
			}).promise();
		} catch(e){
			// we can't get info about dirs in case of aws
			const info = await this.info(filepath.join(id, ".wfs_placeholder"))
			return {
				id,
				value:name,
				size:0,
				date: info.date,
				type:"folder"
			}
		}

		const type = content.ContentType === "application/x-directory" ? "folder" : getFileType(name);
		const obj : IFsObject = {
			id,
			value:name,
			size:content.ContentLength,
			date:new Date(content.LastModified).valueOf()/1000,
			type
		};

		return obj;
	}

	async stats(path:string){
		return { free:0, used:0 };
	}

	async make(path: string, name: string, isFolder: boolean, config?: IOperationConfig) : Promise<string> {
		if (this._config.verbose){
			console.log("Make entity %s %s", path, name);
		}

		let fullpath = this.idToPath(path);
		if (!this.policy.comply(fullpath, Operation.Write)) {
			throw new Error("Access Denied");
		}

		if(config && config.preventNameCollision){
			name = await this.checkName(fullpath, name, isFolder);
		}

		fullpath = filepath.join(fullpath, name)
		let truepath = fullpath;
		if (isFolder){
			truepath = filepath.join(truepath, ".wfs_placeholder")
		}

		await this.aws.upload({
			Bucket: this._bucket,
			Key: truepath.substr(1),
			Body: ""
		}).promise();

		return this.pathToId(fullpath);
	}

	async copy(sourceId: string, targetId: string, name: string, config?: IOperationConfig): Promise<string> {
		if (this._config.verbose){
			console.log("Copy %s to %s as %s", sourceId, targetId, name);
		}

		const source = this.idToPath(sourceId);
		let target = this.idToPath(targetId);

		if (!this.policy.comply(source, Operation.Read) || !this.policy.comply(target, Operation.Write)) {
			throw new Error("Access Denied");
		}

		if (!name) name = filepath.basename(source);
		if(config && config.preventNameCollision){
			name = await this.checkName(target, name, false);
		}
		target = filepath.join(target, name);

		let sfiles = await this._files(source);
		if (!sfiles.length){
			await this.aws.copyObject({
				Bucket: this._bucket,
				Key: target.substr(1),
				CopySource: this._bucket + "/" + source.substr(1)
			}).promise();	
	 	} else {
			let tfiles = sfiles
				.map(a => filepath.join(target, filepath.basename(a)));
			for(let i=0; i<tfiles.length; i++){
				if (sfiles[i] === source.substr(1)) continue;

				await this.aws.copyObject({
					Bucket: this._bucket,
					Key: tfiles[i].substr(1),
					CopySource: this._bucket + "/" + sfiles[i]
				}).promise();		
			}
		}

		return this.pathToId(target);
	}

	async exists(source: string): Promise<boolean> {
		source = this.idToPath(source);
		if (this.policy.comply(source, Operation.Read)){
			try {
				await this.info(source);
				return Promise.resolve(true);
			} catch(e){
				const files = await this._files(source, 1);
				if (files.length){
					return true;
				}
				return Promise.resolve(false);
			}
		}

		throw new Error("Access Denied");
	}

	async move(source: string, target: string, name: string, config?: IOperationConfig): Promise<string> {
		if (this._config.verbose){
			console.log("Move %s to %s", source, target);
		}

		target = await this.copy(source, target, name, config);
		await this.remove(source);

		return target;
	}

	private idToPath(id: string): string {
		return filepath.normalize(filepath.join(this._root, id));
	}
	private pathToId(path: string): string {
		if (this._root !== "/")
			path = path.replace(this._root, "");

		if (path[0] !== "/")
			path = "/" + path;

		return path;
	}

	private async _listFolder(
		path: string,
		prefix: string,
		cfg: IListConfig,
		list: IFsObject[]) : Promise<IFsObject[]> {

		if (path[path.length-1] !== "/")
			path = path + "/";
		if (path[0] === "/")
			path = path.substr(1);

		const files = await this.aws.listObjectsV2({
			Bucket: this._bucket,
			Delimiter: "/",
			Prefix: path
		}).promise();

		const res = (list && !cfg.nested) ? list : [];

		if (!cfg.skipFiles)
			for (let fobj of files.Contents){
				const name = fobj.Key;
				if (name === path) continue;

				const value = name.split("/").pop();

				if (cfg.exclude && cfg.exclude(value)) {
					continue;
				}

				if (cfg.include && !cfg.include(value)){
					continue;
				}

				const id = this.pathToId(name);
				const obj : IFsObject = { 
					id,
					value,
					size:fobj.Size,
					date:new Date(fobj.LastModified).valueOf()/1000,
					type : getFileType(name)
				};
				res.push(obj);
			}
				
		for (let fobj of files.CommonPrefixes){
			const name = fobj.Prefix.substr(0, fobj.Prefix.length - 1);

			const value = name.split("/").pop();
			if (cfg.exclude && cfg.exclude(value)) {
				continue;
			}

			const id = this.pathToId(name);
			const obj : IFsObject = { 
				id,
				value,
				size:0,
				date: null,
				type : "folder"
			};

			if (cfg.subFolders) {
				const next = await this._listFolder(
					name,
					"",
					cfg,
					res
				);

				if (cfg.nested){
					obj.data = next;
				}
			}

			if (cfg.include && !cfg.include(value)){
				continue;
			}	
			res.push(obj);
		}

		// folders first
		// sort files and folders by name
		if (list !== res){
			res.sort((a,b) => {
				if ((a.type === "folder" || b.type === "folder") && a.type !== b.type){
					return a.type === "folder" ? -1 : 1;
				}

				if (a.value !== b.value){
					return a.value.toUpperCase() > b.value.toUpperCase() ? 1 : -1;
				}
				return 0;
			});
		}

		return res;
	}

	private getNewName(name: string, counter: number, isFolder: boolean) : string {
		// filepath.extname grabs the characters after the last dot (app.css.gz return .gz, not .css.gz)
		const ext = !isFolder ? name.substring(name.indexOf(".")) : "";
		name = filepath.basename(name, ext);

		const match = name.match(/\(([0-9]*)\)$/);
		if (match) {
			name = name.substr(0, match.index);
			counter = Number(match[1])+1;
		}

		return name + "("+counter+")" + ext;
	}

	private async checkName(folder: string, name: string, isFolder: boolean) : Promise<string> {
		const files = await this.list(folder);

		let counter = 1;

		while (files.filter(a => a.value === name).length !== 0){
			name = this.getNewName(name, counter++, isFolder);
		}

		return name;
	}
}