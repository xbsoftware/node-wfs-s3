import * as AWS from "aws-sdk";
import * as filepath from "path";
import * as stream from "stream";

import getFileType from "./filetypes";
import {CombinedPolicy, ForceRootPolicy} from "./policy";
import {IDriveConfig, IFsObject, IListConfig, IOperationConfig, IPolicy, Operation} from "./types";
import { ConfigurationServicePlaceholders } from "aws-sdk/lib/config_service_placeholders";

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
		if (root === ".")
			root = "/";

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

	async remove(path: string): Promise<void>{
		if (this._config.verbose){
			console.log("Delete %s", path);
		}

		const fullpath = this.idToPath(path);
		if (this.policy.comply(fullpath, Operation.Write)) {
			return this.aws.deleteObject({
				Bucket: this._bucket,
				Key: fullpath.substr(1)
			}).promise();
		}

		throw new Error("Access Denied");
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
			if(config && config.preventNameCollision){
				fullpath = await this.checkName(fullpath, "file");
			}

			const writeStream = new stream.PassThrough();
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

		let content;
		try {
			content = await this.aws.headObject({
				Bucket: this._bucket,
				Key: fullpath.substr(1)
			}).promise();
		} catch(e){
			return Promise.reject(e);
		}


		const name = filepath.basename(fullpath);
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

	async mkdir(path: string, _config?: IOperationConfig) : Promise<string> {
		return Promise.resolve(path);
	}

	async copy(sourceId: string, targetId: string, config?: IOperationConfig): Promise<string> {
		if (this._config.verbose){
			console.log("Copy %s to %s", sourceId, targetId);
		}

		const source = this.idToPath(sourceId);
		let target = this.idToPath(targetId);

		if (!this.policy.comply(source, Operation.Read) || !this.policy.comply(target, Operation.Write)) {
			throw new Error("Access Denied");
		}

		if(config && config.preventNameCollision){
			target = await this.checkName(target, "file");
		}

		// file to file
		await this.aws.copyObject({
			Bucket: this._bucket,
			Key: target.substr(1),
			CopySource: this._bucket + "/" + source.substr(1)
		}).promise();

		return this.pathToId(target);
	}

	async exists(source: string): Promise<boolean> {
		source = this.idToPath(source);
		if (this.policy.comply(source, Operation.Read)){
			try {
				await this.info(source);
				return Promise.resolve(true);
			} catch(e){
				return Promise.resolve(false);
			}
		}

		throw new Error("Access Denied");
	}

	async move(source: string, target: string, config?: IOperationConfig): Promise<string> {
		if (this._config.verbose){
			console.log("Move %s to %s", source, target);
		}

		await this.copy(source, target, config);
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

	private getNewName(name: string, counter: number, type: string) : string {
		// filepath.extname grabs the characters after the last dot (app.css.gz return .gz, not .css.gz)
		const ext = type === "file" ? name.substring(name.indexOf(".")) : "";
		name = filepath.basename(name, ext);

		const match = name.match(/\(([0-9]*)\)$/);
		if (match) {
			name = name.substr(0, match.index);
			counter = Number(match[1])+1;
		}

		return name + "("+counter+")" + ext;
	}

	private async checkName(path: string, type: string) : Promise<string> {
		const folder = filepath.dirname(path);
		let name = filepath.basename(path);

		const files = await this.list(folder);

		let counter = 1;

		while (files.filter(a => a.value === name).length !== 0){
			name = this.getNewName(name, counter++, type);
		}

		return filepath.join(folder, name);
	}
}