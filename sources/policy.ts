import {IPolicy, Operation} from "./types";

/* tslint:disable:max-classes-per-file */

export class CombinedPolicy implements IPolicy {
	private _all : IPolicy[];
	constructor(...all: IPolicy[]){
		this._all = all;
	}
	comply(path: string, operation: Operation){
		for (const one of this._all){
			if (!one.comply(path, operation)) {
				return false;
			}
		}
		return true;
	}
}

export class ReadOnlyPolicy implements IPolicy {
	comply(path:string, operation:Operation){
		if (operation === Operation.Read){
			return true;
		}

		return false;
	}
}

export class ForceRootPolicy implements IPolicy {
	private _root: string;
	constructor(root: string){
		this._root = root;
	}
	comply(path: string, operation: Operation){
		if (path.indexOf(this._root) === 0){
			return true;
		}
		return false;
	}
}

export class AllowPolicy implements IPolicy {
	comply(path: string, operation: Operation){ return true; }
}


export class DenyPolicy implements IPolicy {
	comply(path: string, operation: Operation){ return false; }
}