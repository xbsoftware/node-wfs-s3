Web File System - AWS S3 driver
=========

[![npm version](https://badge.fury.io/js/wfs-s3.svg)](https://badge.fury.io/js/wfs-s3) 
[![Build Status](https://drone-github.webix.io/api/badges/xbsoftware/node-wfs-s3/status.svg)](https://drone-github.webix.io/xbsoftware/node-wfs-s3)

File system abstraction with access management.

API provides common file operations for some folder on AWS s3 drive. Any operations outside of the folder will be blocked. Also, it possible to configure a custom policy for read/write operations.


Can be used as backend for Webix File Manager https://webix.com/filemanager


## API

### Get data

```js
const wfs = require("wfs-s3");
const fs = new wfs.S3("s3://temp-files/some/");

//get files in a folder
let files = await fs.list("/subfolder");

//get files in a folder and subfolders as plain list
let files = await fs.list("/subfolder", { subFolders: true });

//get files in a folder and subfolders as nested structure
let files = await fs.list("/subfolder", { subFolders: true, nested:true });

//get folder only
let files = await fs.list("/subfolder", { skipFiles: true });

//get files that match a mask
let files = await fs.list("/subfolder", { include: a => /\.(txt|doc)/.test(a) });

//ignore some files
let files = await fs.list("/subfolder", { exclude: a => a === ".git" });

//get info about a single file
let info = await fs.info("some.txt");

//check if file exists
let check = await fs.exists("some.txt");
```

### Modify files

```js
//make folder
await fs.mkdir("sub2");

//remove
await fs.remove("some.txt");

//copy
await fs.copy("some.txt", "/sub/");

//move
await fs.copy("some.txt", "some-data.txt");

//read
let stream = await fs.read("some.txt");

//write
await fs.write("some.txt", stream)
```

### Access Policy

```js
// ForceRoot policy is added automatically

// readonly
const wfs = require("wfs-local");
const fs = new wfs.S3("s3://temp-files/some/", new wfs.policies.ReadOnlyPolicy());

// custom
const fs = new wfs.S3("s3://temp-files/some/", {
    comply: (path, op) => {
        if (op == wfs.Operation.Read) return true;
        // write to temp folder only
        if (file.indexOf("/path/") === 0) return true;

        return false;
    }
});
```

### Other API

```js
//logging
const wfs = require("wfs-local");
const fs = new wfs.S3("s3://temp-files/some/", null, { verbose: true });
```


## License 

MIT