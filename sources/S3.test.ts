/* tslint:disable:no-implicit-dependencies */
import { expect } from "chai";
import "mocha";

import S3 from "./S3";
import { ForceRootPolicy } from "./policy";


async function strToStr(stream){
	return new Promise((res, rej) => {
		let text = "";
		stream.on("data", chunk => {
			text += chunk.toString("utf8");
		});

		stream.on("end", () => {
			res(text);
		});
	});
}

function cleanDates(data){
	data.forEach(key => {
		if (key.files && key.files.length){
			cleanDates(key.files);
		}
	});
}

let drive : S3;
let driveSub : S3;
describe("S3", () => {
	beforeEach(async () => {

	});

	describe("exists", () => {
		it("Can check does file exist", async () => {
			const check1 = await drive.exists("/sub/c.jpg");
			const check2 = await drive.exists("/sub2/c.jpg");

			expect(check1).to.eq(true);
			expect(check2).to.eq(false);
		});
	});

	describe("info", () => {
		it("Get info about a file", async () => {
			const info1 = await drive.info("/sub/c.jpg");
			expect(info1.value).to.eq("c.jpg");
			expect(info1.type).to.eq("image");

			const info2 = await drive.info("/a.txt");
			expect(info2.value).to.eq("a.txt");
			expect(info2.type).to.eq("text");
		});
	});

	describe("copy", () => {
		it("Can copy a file", async () => {
			const path = "/sub/deep/copy.doc";
			const path2 = "/sub/deep.doc";

			await drive.copy("/sub/deep/deep.doc", "/sub/deep/copy.doc");
			const check = await drive.exists(path);
			expect(check).to.eq(true);
			await drive.remove(path);

			await drive.copy("/sub/deep/deep.doc", "/sub/deep.doc");
			const check2 = await drive.exists(path2);
			expect(check2).to.eq(true);
			await drive.remove(path2);
		});

		it("Can copy and rename a file (if exists)", async () => {
			await drive.copy("/c.jpg", "/sub/c.jpg", { preventNameCollision:true });
			const check = await drive.exists("/sub/c(1).jpg");
			expect(check).to.eq(true);
			await drive.remove("/sub/c(1).jpg");
		});

	// 	it("Can copy a folder", async () => {
	// 		const path = __dirname+"/../test/sandbox/sub2";

	// 		await drive.copy("/sub", "/sub2");
	// 		const list1 = await drive.list("/sub", { subFolders: true });
	// 		const list2 = await drive.list("/sub2", { subFolders: true });
	// 		expect(cleanDates(list1)).to.deep.eq(cleanDates(list2));

	// 		await drive.copy("/sub", "/sub2/");
	// 		const list3 = await drive.list("/sub2/sub", { subFolders: true });
	// 		expect(cleanDates(list1)).to.deep.eq(cleanDates(list3));

	// 		await fs.remove(path);
	// 	});

	// 	it("Can copy and rename a folder (if exists)", async () => {
	// 		await drive.mkdir("/test.folder");
	// 		await drive.mkdir("/sub/test.folder");

	// 		await drive.copy("/test.folder", "/sub", {preventNameCollision:true});
	// 		const path = __dirname+"/../test/sandbox/sub/test.folder(1)";

	// 		const check = await fs.pathExists(path);
	// 		expect(check).to.eq(true);

	// 		await fs.remove(__dirname+"/../test/sandbox/test.folder");
	// 		await fs.remove(__dirname+"/../test/sandbox/sub/test.folder");
	// 		await fs.remove(path);
	// 	});
	});

	// describe("move", () => {
	// 	it("Can move a file", async () => {
	// 		const path1 = __dirname+"/../test/sandbox/sub/deep/deep.doc";
	// 		const path2 = __dirname+"/../test/sandbox/sub/deep/copy.doc";

	// 		await drive.move("/sub/deep/deep.doc", "/sub/deep/copy.doc");
	// 		const check1 = await fs.pathExists(path1);
	// 		const check2 = await fs.pathExists(path2);
	// 		expect(check1).to.eq(false);
	// 		expect(check2).to.eq(true);
	// 		await fs.move(path2, path1);
	// 	});

	// 	it("Can move and rename a file (if exists)", async () => {
	// 		const path1 = __dirname+"/../test/sandbox/c.jpg";
	// 		const path2 = __dirname+"/../test/sandbox/sub/c(1).jpg";

	// 		await drive.move("/c.jpg", "/sub", {preventNameCollision:true});
	// 		const check1 = await fs.pathExists(path1);
	// 		const check2 = await fs.pathExists(path2);
	// 		expect(check1).to.eq(false);
	// 		expect(check2).to.eq(true);
	// 		await fs.move(path2, path1);
	// 	});

	// 	it("Can move a folder", async () => {
	// 		const path1 = __dirname+"/../test/sandbox/sub3";
	// 		const path2 = __dirname+"/../test/sandbox/sub2";
	// 		const path3 = __dirname+"/../test/sandbox/sub/deep/sub2";

	// 		await drive.copy("/sub", "/sub3");
	// 		await drive.move("/sub3", "/sub2");
	// 		const list1 = await drive.list("/sub", { subFolders: true });
	// 		const list2 = await drive.list("/sub2", { subFolders: true });
	// 		expect(cleanDates(list1)).to.deep.eq(cleanDates(list2));
	// 		const check1 = await fs.pathExists(path1);
	// 		expect(check1).to.eq(false);

	// 		await drive.move("/sub2", "/sub/deep");
	// 		const list3 = await drive.list("/sub/deep/sub2", { subFolders: true });
	// 		expect(cleanDates(list1)).to.deep.eq(cleanDates(list3));
	// 		const check2 = await fs.pathExists(path2);
	// 		expect(check2).to.eq(false);

	// 		await fs.remove(path3);
	// 	});

	// 	it("Can move and rename a folder (if exists)", async () => {
	// 		const path1 = __dirname+"/../test/sandbox/test.folder";
	// 		const path2 = __dirname+"/../test/sandbox/sub/test.folder";
	// 		const path3 = __dirname+"/../test/sandbox/sub/test.folder(1)";

	// 		await drive.mkdir("/test.folder");
	// 		await drive.mkdir("/sub/test.folder");

	// 		await drive.move("/test.folder", "/sub", {preventNameCollision:true});
	// 		const check1 = await fs.pathExists(path1);
	// 		const check2 = await fs.pathExists(path2);
	// 		expect(check1).to.eq(false);
	// 		expect(check2).to.eq(true);

	// 		await fs.remove(path2);
	// 		await fs.remove(path3);
	// 	});
	// });

	describe("write and remove", () => {
		it("Can write a file", async () => {
			const data = await drive.read("/sub/deep/deep.doc");
			await drive.write("/sub/deep/copy.doc", data);

			let text = await drive.read("/sub/deep/copy.doc");
			text = await strToStr(text);

			expect(text.toString("utf8")).to.eq("test");
			await drive.remove("/sub/deep/copy.doc");
		});

		it("Can write  and rename a file (if exists)", async () => {
			const data = await drive.read("/sub/deep/deep.doc");
			await drive.write("/sub/deep/deep.doc", data, {preventNameCollision:true});

			let text = await drive.read("/sub/deep/deep(1).doc");
			text = await strToStr(text);

			expect(text.toString("utf8")).to.eq("test");
			await drive.remove("/sub/deep/deep(1).doc");
		});
	});

	describe("read", () => {
		it("Can read a file", async () => {
			const data = await drive.read("/sub/deep/deep.doc");
			const text = await strToStr(data);

			expect(text).to.eq("test");
		});
	});

	describe("list", () => {

		it("Can read root", async () => {
			const data = await drive.list("/");

			expect(data.length).to.eq(4);

			expect(data[0].value).to.eq("sub");
			expect(data[0].id).to.eq("/sub");
			expect(!!data[0].data).to.eq(false);
			expect(data[0].type).to.eq("folder");

			expect(data[1].value).to.eq("a.txt");
			expect(data[2].value).to.eq("b.txt");
			expect(data[3].value).to.eq("c.jpg");

			expect(data[1].type).to.eq("text");
			expect(data[3].type).to.eq("image");
		});

		it("Can read sub level", async () => {
			const data = await drive.list("/sub");

			expect(data.length).to.eq(2);

			expect(data[0].value).to.eq("deep");
			expect(!!data[0].data).to.eq(false);

			expect(data[1].value).to.eq("c.jpg");
		});

		it("Can read folders only", async () => {
			const data = await drive.list("/", { skipFiles: true });

			expect(data.length).to.eq(1);
			expect(data[0].value).to.eq("sub");
		});


		it("Can read nested folders", async () => {
			const data = await drive.list("/", { skipFiles: true, subFolders:true, nested:true });

			expect(data.length).to.eq(1);
			expect(data[0].value).to.eq("sub");
			expect(data[0].data.length).to.eq(1);
			expect(data[0].data[0].value).to.eq("deep");
			expect(data[0].data[0].id).to.eq("/sub/deep");
			expect(data[0].data[0].data.length).to.eq(0);
		});

		it("Can read nested files and folders", async () => {
			const data = await drive.list("/", { subFolders:true, nested:true });

			expect(data.length).to.eq(4);
			expect(data[0].data.length).to.eq(2);
			expect(data[0].data[0].data.length).to.eq(1);
		});

		it("Prevent access outside of root", async () => {
			const tdata = await driveSub.list("/");
			expect(tdata.length).to.eq(2);

			try {
				await driveSub.list("../");
			} catch(e){
				return;
			}
			expect.fail();
		});

		it("Prevent wrong root value", async () => {
			try {
				new S3("./data");
			} catch(e){
				return;
			}
			expect.fail();
        });

		it("Can include by mask", async () => {
			const data = await drive.list("/", {
				subFolders:true,
				include: file => /\.(txt|doc)$/.test(file)
			});
			expect(data.length).to.eq(3);
			expect(data[0].value).to.eq("a.txt");
			expect(data[1].value).to.eq("b.txt");
			expect(data[2].value).to.eq("deep.doc");
		});

		it("Can exclude by mask", async () => {
			const data = await drive.list("/", { exclude: file => file === "a.txt" });
			expect(data.length).to.eq(3);
			expect(data[0].value).to.eq("sub");
			expect(data[1].value).to.eq("b.txt");
			expect(data[2].value).to.eq("c.jpg");
		});
	});
});