import { maxThreads } from "utils/script_tools.js";

/** @param {NS} ns **/
export async function main(ns) {
	// Run a function with max memory usage
	let script = ns.args[0];
	let threads = maxThreads(ns, script, 'home');
	ns.tprint(`Max threads for ${script}: ${threads}`);
}