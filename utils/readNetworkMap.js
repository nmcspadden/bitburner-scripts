/**
* Return an Object of the network map from JSON
* @param {NS} ns
*/
export function readNetworkMap(ns) {
	const NETWORK_MAP = 'network_map.json.txt';
	return JSON.parse(ns.read(NETWORK_MAP));
}

/**
* Search for a specific server by iterating through parents
* @param {NS} ns
*/
export function locateServerPrimitive(server, network_map, connection_list) {
	if (network_map[server].parent != '') {
		// ns.tprint(`Current server: ${server}`)
		// ns.tprint(`Parent: ${network_map[server].parent}`)
		connection_list.push(server);
		// ns.tprint(`Current connection list: ${connection_list.join(", ")}`)
		locateServerPrimitive(network_map[server].parent, network_map, connection_list);
	}
	return connection_list;
}

/**
* Search for a specific server
* @param {NS} ns
* @returns List of servers from home to target 
*/
export function locateServer(ns, server) {
	// if (!ns.ls('home', 'network_map.json.txt')) 
	let network_map = readNetworkMap(ns);
	let connection_list = [];
	let premap_to_server = locateServerPrimitive(server, network_map, connection_list);
	premap_to_server.push('home');
	return premap_to_server.reverse();  // this will be a reverse-ordered list from home to target
}