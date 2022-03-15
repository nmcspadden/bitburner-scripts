import { maximizeScriptUse, isProcessRunning, HOME, maxThreads } from "utils/script_tools.js";

export const NETWORK_MAP = 'network_map.json';

/** 
 * Create a network map in JSON format
 * @param {import("../.").NS} ns 
 * @param {boolean} hack True if we should run scripts on servers
**/
export async function createNetworkMap(ns, hack = true) {
	const my_hack_level = ns.getHackingLevel();
	const scanHost = (host, myParent, currentData = {}) => {
		const myConnections = ns.scan(host);
		const currentMoney = ns.getServerMoneyAvailable(host);
		const hackTime = ns.getHackTime(host);

		if (host == HOME) {
			myParent = "";
		}

		let newData = {
			...currentData,
			[host]: {
				parent: myParent,
				connections: myConnections,
				root: ns.hasRootAccess(host),
				currentMoney,
				maxMoney: ns.getServerMaxMoney(host),
				hackLevel: ns.getServerRequiredHackingLevel(host),
				hackTime,
				ports: ns.getServerNumPortsRequired(host),
				moneyPerSec: currentMoney / hackTime,
				maxRAM: ns.getServerMaxRam(host)
			}
		};

		// Attempt to crack the server, record the result if we rooted it
		// Obviously, skip home...
		if (host != HOME && !newData[host]["root"] && (!host.includes("hacknet"))) {
			newData[host]["root"] = crackServer(ns, host);
		}

		// Recursively build the map of nodes
		myConnections
			.filter((node) => !newData[node]) // prevent infinite looping...
			.forEach((node) => {
				newData = scanHost(node, host, newData);
			});

		return newData;
	};

	// Recursively build the map
	const data = scanHost(HOME, HOME);
	// Now make 'em all grow if we want to
	const SERVERGROWER = "serverGrower.js";
	const BASICHACK = "basicHack.js";
	if (hack) {
		for (const node of Object.keys(data)) {
			let script = SERVERGROWER;
			// skip home, and don't try to hack servers we haven't rooted
			if (node == HOME) continue
			// If we've grown the server completely, do a hacking script instead
			// TODO: Don't bother on servers with low money (darkweb)
			if (
				(ns.getServerMoneyAvailable(node) > 0) &&
				(ns.getServerMoneyAvailable(node) == data[node].maxMoney) &&
				(data[node]["hackLevel"] <= my_hack_level)
			) {
				// Kill servergrower if we're switching to basicHack
				ns.kill(SERVERGROWER, node);
				script = BASICHACK;
			}
			// If we have root access, check to see if the server is already running the process
			// Or check to see if we have the process running on home targeting it
			if (!data[node]["root"]) continue
			let already_running_home = false;
			let already_running_target = false;
			if (isProcessRunning(ns, node, script)) {
				// ns.tprint(`${node} already running ${script}`);
				already_running_home = true;
			}
			if (isProcessRunning(ns, HOME, script, [node])) {
				// ns.tprint(`${node} already targeted by home with ${script}`);
				already_running_target = true;
			}
			if (!(already_running_home || already_running_target)) {
				// ns.tprint(`Attempting to run ${script} on ${node}`);
				await ns.scp(script, node);
				// Don't attempt to run the scripts on home if we're at 32GB or less,
				// or it interferes with startinggameplan
				let run_on_home = true;
				if (data["home"].maxRAM <= 32) run_on_home = false;
				maximizeScriptUse(ns, script, node, 100, run_on_home);
			}
			// TODO: backdoor the faction servers to replace joinFactions.js
		}
	}
	await ns.write(NETWORK_MAP, JSON.stringify(data, null, 2), 'w');
}

/** @param {NS} ns **/
export async function main(ns) {
	const argData = ns.flags([
		['daemon', false],
		["hack", false],
		["optimal", false]
	]);
	if (argData.optimal) {
		ns.tprint("Optimal server: " + await findOptimal(ns));
		return
	}
	if (argData.daemon) {
		while (true) {
			await createNetworkMap(ns, false);
			// Re-evaluate network map every minute
			await ns.sleep(60000);
		}
	} else {
		await createNetworkMap(ns, argData.hack);
	}
}

/**
* Return an Object of the network map from JSON
* @param {NS} ns
*/
export async function readNetworkMap(ns) {
	const NETWORK_MAP_LOCAL = NETWORK_MAP + ".txt";
	// If we don't have a network map yet, make one
	if (ns.ls('home', NETWORK_MAP_LOCAL).length == 0) {
		await createNetworkMap(ns);
	}
	return JSON.parse(ns.read(NETWORK_MAP_LOCAL));
}

/**
* Search for a path to specific server
* @param {NS} ns
* @param {string} server A server to generate a path for
* @returns Ordered list of servers from home to target server
*/
export async function locateServer(ns, server) {
	let network_map = await readNetworkMap(ns);
	let premap_to_server = locateServerPrimitive(ns, server, network_map, []);
	premap_to_server.push('home');
	return premap_to_server.reverse();  // this will be a reverse-ordered list from home to target
}

/**
* Crack a server
* @param {NS} ns
* @param {string} server A server to crack
* @param server_data Server data from BuildAugMap()
* @returns True if we nuked it
*/
export function crackServer(ns, server) {
	// If we don't have root access, open ports and nuke it
	if (!ns.hasRootAccess(server)) {
		if (ns.fileExists("BruteSSH.exe")) {
			ns.brutessh(server);
		}
		if (ns.fileExists("FTPCrack.exe")) {
			ns.ftpcrack(server);
		}
		if (ns.fileExists("RelaySMTP.exe")) {
			ns.relaysmtp(server);
		}
		if (ns.fileExists("HTTPWorm.exe")) {
			ns.httpworm(server);
		}
		if (ns.fileExists("SQLInject.exe")) {
			ns.sqlinject(server);
		}
		try {
			ns.nuke(server);
		} catch (e) {
			// do nothing
		}
	}
	return ns.hasRootAccess(server)
}

/**
 * Grow a target server from all other servers
 * @param {import("../.").NS} ns 
 * @param {string} target 
 */
export async function growTargetServer(ns, target) {
	const SCRIPT = 'serverGrower.js';
	// Run the same script on all servers except exclusions
	let network_map = await readNetworkMap(ns);
	for (const server of Object.keys(network_map)) {
		if (server == HOME) continue
		if (network_map[server].maxRAM < 1) continue
		await ns.scp(SCRIPT, server);
		let threads = maxThreads(ns, SCRIPT, server, 100);
		if (threads > 0) {
			// Kill it first before recalculating usage
			ns.kill(SCRIPT, server);
			ns.exec(SCRIPT, server, threads, target);
		}
	}
}

/**
 * Find the most optimal server we can hack
 * @param {import("../.").NS} ns 
 * @returns {string} Name of server
 */
export async function findOptimal(ns) {
	let optimalServer = "foodnstuff";
	let optimalVal = 0;
	let currVal;
	let currTime;
	let network_map = await readNetworkMap(ns);
	for (const server of Object.keys(network_map)) {
		if (server.includes("hacknet")) continue
		currVal = network_map[server].maxMoney;
		currTime = ns.getWeakenTime(server) + ns.getGrowTime(server) + network_map[server].hackTime;
		currVal /= currTime;
		if (network_map[server].root && (currVal >= optimalVal)) {
			optimalVal = currVal;
			optimalServer = server;
		}
	}
	return optimalServer;
}

/**
* Search for a specific server by iterating through parents; generally don't call this publicly
* @param {string} server Server to look for
* @param {object} network_map Object of network map as generated by readNetworkMap()
* @param {array} connection_list An array of paths leading up to a server (in reverse order)
* @returns A reverse list of paths leading up a server
*/
function locateServerPrimitive(ns, server, network_map, connection_list) {
	if (!Object.keys(network_map).includes(server)) return []
	if (network_map[server].parent != '') {
		connection_list.push(server);
		locateServerPrimitive(ns, network_map[server].parent, network_map, connection_list);
	}
	return connection_list;
}