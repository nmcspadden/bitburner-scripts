/** 
 * Upgrade the home
 * @param {import("../.").NS} ns 
 * @returns A 2-length array of RAM, Cores of home
**/
export function upgradeHome(ns) {
	// Do I have enough money to buy a RAM or core upgrade?
	let home_tuple = []
	let ram_cost = ns.getUpgradeHomeRamCost();
	let core_cost = ns.getUpgradeHomeCoresCost();
	let money = ns.getPlayer().money;
	let did_upgrade = false;
	let home_server_stats = ns.getServer("home");
	if (money > ram_cost) {
		did_upgrade = ns.upgradeHomeRam();
		if (did_upgrade) {
			ns.print(`Bought RAM upgrade for ${ns.nFormat(ram_cost, '0.00a')}`);
			home_tuple[0] = home_server_stats.maxRam;
		}
	}
	if (money > core_cost) {
		did_upgrade = ns.upgradeHomeCores();
		if (did_upgrade) {
			ns.print(`Bought Cores upgrade for ${ns.nFormat(core_cost, '0.00a')}`);
			home_tuple[1] = home_server_stats.cpuCores;
		}
	}
}