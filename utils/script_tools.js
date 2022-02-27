export const SF_MAP = "sourcefiles.json";
export const HOME = "home";

/** Run a script on a host with the maximum possible threads
 * @param {import("../.").NS} ns 
 * @param {string} script Name of script to evaluate and run
 * @param {string} host Name of server to execute on
 * @param {number} threshold Max percent of RAM to consume (default 100)
 * @param {boolean} run_on_home If true, run on home if we can't run on target server
*/
export function maximizeScriptUse(ns, script, host, threshold = 100, run_on_home = true) {
	let threads = maxThreads(ns, script, host, threshold);
	// ns.tprint(`${host} threads: ${threads}`);
	if (threads > 0) {
		// Kill it first before recalculating usage
		ns.kill(script, host);
		ns.exec(script, host, threads);
		return
	}
	if (run_on_home) {
		ns.kill(script, 'home', host);
		ns.exec(script, 'home', 1, host);
	}
}

/** Calculate maximum possible threads to run a script on a host
 * @param {import("../.").NS} ns 
 * @param {string} script Name of script to evaluate and run
 * @param {string} host Name of server to execute on
 * @param {number} threshold Max percent of RAM to consume (default 100)
*/
export function maxThreads(ns, script, host, threshold = 100) {
	// ns.tprint(`${host} Max ram: ${ ns.getServerMaxRam(host)}, used ram: ${ ns.getServerUsedRam(host)}`);
	let current_ram = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	// ns.tprint(`${host} current RAM: ${current_ram}`);
	let script_cost = ns.getScriptRam(script);
	// ns.tprint(`${host} script cost: ${script_cost}`);
	return Math.floor((current_ram * (threshold / 100)) / script_cost);
}

/** Look for a matching script on any host's process list
 * @param {NS} ns 
 * @param {string} host Name of server to execute on
 * @param {string} script Name of script to search for
 * @param {array} args List of args to also validate; if the only value of this is "*" then match any args
 * @returns True if we found the script running, false otherwise
*/
export function isProcessRunning(ns, host, script, args = []) {
	/* Example ns.ps() output:
	[
		{"filename":"gangs.js","threads":1,"args":[],"pid":2},
		{"filename":"basicHack.js","threads":1,"args":["n00dles"],"pid":3146},
	]
	*/
	let process_list = ns.ps(host);
	if (args == "*") return process_list.some(proc => proc["filename"].includes("script"))
	return process_list.some(proc => (proc["filename"].includes(script) && compareArrays(args, proc["args"])))
}

/** Find a matching script on any host's process list
 * @param {NS} ns 
 * @param {string} host Name of server to execute on
 * @param {string} script Name of script to search for
 * @param {array} args List of args to also validate; if the only value of this is "*" then match any args
 * @returns {Process} An object matching the process that was matched
*/
export function findMatchingProcess(ns, host, script, args = []) {
	/* Example ns.ps() output:
	[
		{"filename":"gangs.js","threads":1,"args":[],"pid":2},
		{"filename":"basicHack.js","threads":1,"args":["n00dles"],"pid":3146},
	]
	*/
	let process_list = ns.ps(host);
	if (args == "*") return process_list.some(proc => proc["filename"].includes("script"))
	return process_list.find(proc => (proc["filename"].includes(script) && compareArrays(args, proc["args"])))
}

/** Check to see if we're in a BN or own its source file
 * @param {NS} ns 
 * @param {number} source Source to file to check for validation of
 * @returns True if we own the source file or are in that bitnode
*/
export async function checkSForBN(ns, source) {
	let current_bn = ns.getPlayer().bitNodeN;
	let sf = await checkSourceFile(ns, source);
	return ((source == current_bn) || await checkSourceFile(ns, source));
}

/** Check to see if we own a source file
 * @param {NS} ns 
 * @param {number} source Source to file to check for validation of
 * @returns True if we own the source file
*/
export async function checkSourceFile(ns, source) {
	// Output looks sorta like this:
	// [{"n":1,"lvl":3},{"n":4,"lvl":3},{"n":2,"lvl":1},{"n":5,"lvl":1},{"n":6,"lvl":1}]
	let sfmap = await readSourceFilesMap(ns);
	// ns.tprint(JSON.stringify(sfmap, null, 2));
	return sfmap.some(file => file["n"] == Number(source))
}

/** Check all source files and write to disk
 * @param {NS} ns 
*/
export async function mapSourceFiles(ns) {
	await ns.write(SF_MAP, JSON.stringify(ns.getOwnedSourceFiles(), null, 2), "w");
}

/** Read written source file map
 * @param {NS} ns 
 * @returns Object equivalent to ns.getOwnedSourceFiles() output
*/
export async function readSourceFilesMap(ns) {
	const SF_MAP_LOCAL = SF_MAP + ".txt";
	// If we don't have a source file map yet, make one
	if (ns.ls('home', SF_MAP_LOCAL).length == 0) {
		await mapSourceFiles(ns);
	}
	return JSON.parse(ns.read(SF_MAP_LOCAL));
}

/**
 * Compare two arrays for equality
 * @param {*} array1 
 * @param {*} array2 
 */
export function compareArrays(array1, array2) {
	return (array1.length === array2.length) && array1.every(function (value, index) { return value === array2[index] })
}

/** 
 * Write a message to print + log
 * @param {import(".").NS} ns 
 * @param {string} logfile File to append to
 * @param {string} msg Message to write
**/
export async function outputLog(ns, logfile, msg) {
	ns.print(msg);
	await ns.write(logfile, msg + "\n", "a");
}

/** 
 * Write a message to either print or terminal
 * @param {import(".").NS} ns 
 * @param {boolean} terminal If true, output to terminal; otherwise print to log
 * @param {string} msg Message to write
**/
export function output(ns, terminal = true, msg) {
	terminal ? ns.tprint(msg) : ns.print(msg)
}