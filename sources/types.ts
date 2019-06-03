export interface IPolicy {
	comply(path: string, operation: Operation):boolean;
}

export enum Operation {
	Read = 1,
	Write
}

export interface IFsObject {
	value: string;
	id: string;
	size:number;
	date:number;
	type:string;
	data? : IFsObject[];
}

export interface IListConfig {
	skipFiles?:boolean;
	subFolders?:boolean;
	nested?:boolean;
	exclude?: (a:string) => boolean;
	include?: (a:string) => boolean;
}

export interface IDriveConfig {
	verbose?:boolean;
	secretKey?: any;
	accessKey?: any;
}

export interface IOperationConfig {
	preventNameCollision?: boolean;
}
