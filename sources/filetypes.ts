import {extname} from "path";

const types: {[id:string]:string} = {
	"docx": "doc",

	"xls": "excel",
	"xslx": "excel",

	"txt": "text",
	"md": "text",

	"html": "code",
	"htm": "code",
	"js": "code",
	"json": "code",
	"css": "code",
	"php": "code",
	"sh": "code",

	"mpg": "video",
	"mp4": "video",
	"avi": "video",
	"mkv": "video",

	"png": "image",
	"jpg": "image",
	"gif": "image",

	"mp3": "audio",
	"ogg": "audio",

	"zip": "archive",
	"rar": "archive",
	"7z": "archive",
	"tar": "archive",
	"gz": "archive"
};

function getType(name) : string {
	return types[extname(name).substr(1)] || "file";
}

export default getType;