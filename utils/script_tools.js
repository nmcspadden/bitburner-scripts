/** Run a script on a host with the maximum possible threads
 * @param {NS} ns 
 * @param {string} script Name of script to evaluate and run
 * @param {string} host Name of server to execute on
 * @param {boolean} run_on_home If the server does not have adequate RAM, run on home instead
*/
export function maximizeScriptUse(ns, script, host, run_on_home=false) {
	let current_ram = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	// ns.tprint(`${host} current RAM: ${current_ram}`);
	let script_cost = ns.getScriptRam(script);
	// ns.tprint(`${host} script cost: ${script_cost}`);
	let threads = Math.floor(current_ram / script_cost);
	// ns.tprint(`${host} threads: ${threads}`);
	if (threads > 0) {
		// Kill it first before recalculating usage
		ns.kill(script, host);
		ns.exec(script, host, threads);
	} else {
		ns.kill(script, 'home', host);
		ns.exec(script, 'home', 1, host);
	}
}