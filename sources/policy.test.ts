/* tslint:disable:no-implicit-dependencies */
import { expect } from "chai";
import "mocha";

import * as policies from "./policy";
import { Operation } from "./types";

describe("Policies", () => {
	it("Read Policy", () => {
		const policy = new policies.ReadOnlyPolicy();
		expect(policy.comply("/any", Operation.Read)).to.eq(true);
		expect(policy.comply("/any", Operation.Write)).to.eq(false);
	});

	it("Deny Policy", () => {
		const policy = new policies.DenyPolicy();
		expect(policy.comply("/any", Operation.Read)).to.eq(false);
		expect(policy.comply("/any", Operation.Write)).to.eq(false);
	});

	it("Allow Policy", () => {
		const policy = new policies.AllowPolicy();
		expect(policy.comply("/any", Operation.Read)).to.eq(true);
		expect(policy.comply("/any", Operation.Write)).to.eq(true);
	});

	it("ForceRoot policy", () => {
		const policy = new policies.ForceRootPolicy("/sandbox");
		expect(policy.comply("/any", Operation.Read)).to.eq(false);
		expect(policy.comply("/sandbox/", Operation.Read)).to.eq(true);
		expect(policy.comply("/sandbox/any", Operation.Read)).to.eq(true);

		expect(policy.comply("/any", Operation.Write)).to.eq(false);
		expect(policy.comply("/sandbox/", Operation.Write)).to.eq(true);
		expect(policy.comply("/sandbox/any", Operation.Write)).to.eq(true);
	});

	it("Combined policy", () => {
		let policy = new policies.CombinedPolicy();
		expect(policy.comply("/any", Operation.Read)).to.eq(true);

		policy = new policies.CombinedPolicy(new policies.AllowPolicy());
		expect(policy.comply("/any", Operation.Read)).to.eq(true);

		policy = new policies.CombinedPolicy(new policies.AllowPolicy(), new policies.ReadOnlyPolicy());
		expect(policy.comply("/any", Operation.Read)).to.eq(true);
		expect(policy.comply("/any", Operation.Write)).to.eq(false);

		policy = new policies.CombinedPolicy(
			new policies.ReadOnlyPolicy(),
			new policies.ForceRootPolicy("/sandbox"));
		expect(policy.comply("/any", Operation.Read)).to.eq(false);
		expect(policy.comply("/sandbox/", Operation.Read)).to.eq(true);
		expect(policy.comply("/sandbox/any", Operation.Write)).to.eq(false);
	});
});