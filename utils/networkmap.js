import { maximizeScriptUse, isProcessRunning, HOME } from "utils/script_tools.js";
import { SERVER_GROWN_FILE } from "serverGrower.js";

export const NETWORK_MAP = 'network_map.json';

/** 
 * Create a network map in JSON format
 * @param {import("../.").NS} ns 
**/
export async function createNetworkMap(ns) {
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
		if (host != HOME && !newData[host]["root"]) {
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
	// Now make 'em all grow
	const SERVERGROWER = "serverGrower.js";
	const BASICHACK = "basicHack.js";
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
	await ns.write(NETWORK_MAP, JSON.stringify(data, null, 2), 'w');
}

/** @param {NS} ns **/
export async function main(ns) {
	const argData = ns.flags([
		['daemon', false]
	]);
	if (argData.daemon) {
		while (true) {
			await createNetworkMap(ns);
			await ns.sleep(30000);
		}
	} else {
		await createNetworkMap(ns);
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