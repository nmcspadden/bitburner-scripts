/** Run a script on a host with the maximum possible threads
 * @param {NS} ns 
 * @param {string} script Name of script to evaluate and run
 * @param {string} host Name of server to execute on
 * @param {number} threshold Max percent of RAM to consume (default 100)
*/
export function maximizeScriptUse(ns, script, host, threshold=100) {
	let threads = maxThreads(ns, script, host);
	// ns.tprint(`${host} threads: ${threads}`);
	if (threads > 0) {
		// Kill it first before recalculating usage
		ns.kill(script, host);
		ns.exec(script, host, threads, threshold);
	} else {
		ns.kill(script, 'home', host);
		ns.exec(script, 'home', 1, host, threshold);
	}
}

/** Calculate maximum possible threads to run a script on a host
 * @param {NS} ns 
 * @param {string} script Name of script to evaluate and run
 * @param {string} host Name of server to execute on
 * @param {number} threshold Max percent of RAM to consume (default 100)
*/
export function maxThreads(ns, script, host, threshold=100) {
	let current_ram = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	// ns.tprint(`${host} current RAM: ${current_ram}`);
	let script_cost = ns.getScriptRam(script);
	// ns.tprint(`${host} script cost: ${script_cost}`);
	return Math.floor((current_ram * (threshold/100)) / script_cost);
}