const HOME = 'home';
const NETWORK_MAP = 'network_map.json';

/** @param {NS} ns **/
export async function main(ns) {
	const argData = ns.flags([
		['daemon', false]
	]);

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
				moneyPerSec: currentMoney / hackTime
			}
		};

		myConnections
			.filter((node) => !newData[node]) // prevent infinite looping...
			.forEach((node) => {
				newData = scanHost(node, host, newData);
			});

		return newData;
	};

	const run = async () => {
		const data = scanHost(HOME, HOME);
		await ns.write(NETWORK_MAP, JSON.stringify(data, null, 2), 'w');
	};

	if (argData.daemon) {
		while (true) {
			await run();
			await ns.sleep(30000);
		}
	} else {
		await run();
	}
}