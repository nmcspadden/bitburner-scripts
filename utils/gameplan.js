import { maximizeScriptUse } from "utils/script_tools.js";


/** 
 * Upgrade the home
 * @param {import("../.").NS} ns 
 * @returns A 2-length array of RAM, Cores of home
**/
export function upgradeHome(ns) {
	// Do I have enough money to buy a RAM or core upgrade?
	let ram_cost = ns.getUpgradeHomeRamCost();
	let core_cost = ns.getUpgradeHomeCoresCost();
	let money = ns.getPlayer().money;
	let did_upgrade = false;
	let home_tuple = [];
	let home_server_stats;
	if (money > ram_cost) {
		did_upgrade = ns.upgradeHomeRam();
		if (did_upgrade) {
			ns.print(`Bought RAM upgrade for ${ns.nFormat(ram_cost, '0.00a')}`);
			home_server_stats = ns.getServer("home");
		}
	}
	if (money > core_cost) {
		did_upgrade = ns.upgradeHomeCores();
		if (did_upgrade) {
			ns.print(`Bought Cores upgrade for ${ns.nFormat(core_cost, '0.00a')}`);
		}
	}
	home_server_stats = ns.getServer("home");
	home_tuple.push(home_server_stats.maxRam);
	home_tuple.push(home_server_stats.cpuCores);
	return home_tuple;
}

/** 
 * Spin up hacking scripts to grow hacking XP
 * @param {import(".").NS} ns
**/
function growHackingXP(ns) {
	let HACKSCRIPT;
	if (ns.getHackingLevel() <= 300) {
		HACKSCRIPT = "growHackingXP.js";
	} else {
		// TODO: Figure out which server to hack
		HACKSCRIPT = "basicHack.js";
	}
	// Run this to 75% of total RAM
	maximizeScriptUse(ns, HACKSCRIPT, HOME, 75);
}