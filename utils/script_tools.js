/** Run a script on a host with the maximum possible threads
 * @param {NS} ns 
 * @param {string} script Script to run on a host 
 * @param {NS} host Host to check against
*/
export async function maximizeScriptUse(ns, script, host) {
	let current_ram = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	let script_cost = ns.getScriptRam(script);
	let threads = Math.floor(current_ram / script_cost); 
	ns.exec(script, host, threads);
}