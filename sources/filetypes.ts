import {extname} from "path";

const types: {[id:string]:string} = {
	"docx": "document",
	"doc":  "document",
	"odt":  "document",
	"xls":  "document",
	"xslx": "document",
	"pdf":  "document",
	"djvu": "document",
	"djv":  "document",
	"pptx": "document",
	"ppt":  "document",

	"html":   "code",
	"htm":    "code",
	"js":     "code",
	"json":   "code",
	"css":    "code",
	"scss":   "code",
	"sass":   "code",
	"less":   "code",
	"php":    "code",
	"sh":     "code",
	"coffee": "code",
	"txt":    "code",
	"md":     "code",
	"go":     "code",
	"yml":    "code",

	"mpg": "video",
	"mp4": "video",
	"avi": "video",
	"mkv": "video",
	"ogv": "video",

	"png":  "image",
	"jpg":  "image",
	"jpeg": "image",
	"webp": "image",
	"gif":  "image",
	"tiff": "image",
	"tif":  "image",
	"svg":  "image",

	"mp3":  "audio",
	"ogg":  "audio",
	"flac": "audio",
	"wav":  "audio",

	"zip": "archive",
	"rar": "archive",
	"7z":  "archive",
	"tar": "archive",
	"gz":  "archive"
};

function getType(name) : string {
	return types[extname(name).substr(1)] || "file";
}

export default getType;