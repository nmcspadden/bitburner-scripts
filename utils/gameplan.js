import { maximizeScriptUse, HOME } from "utils/script_tools.js";

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
 * @param {import("../.").NS} ns
**/
export function growHackingXP(ns) {
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

/** 
 * Join pending factions
 * @param {import("../.").NS} ns
**/
export function joinFactions(ns) {
	// Check our faction invites
	let invited_factions = ns.checkFactionInvitations();
	for (const faction of invited_factions) {
		let did_join = ns.joinFaction(faction);
		if (did_join) ns.print("Joined " + faction)
	}
}

/**
 * Determine which phase of the game we're in
 * @param {import("../.").NS} ns 
 * @returns {string} starting, early, mid, end
 */
 export function gamePhase(ns) {
	// Determine our current RAM level
	let home_ram = ns.getServerMaxRam(HOME);
	if (home_ram <= 32) {
		return "starting"
	} else if (home_ram <= 1000) {
		return "early"
	} else if (endGameTrigger(ns)) {
		return "end"
	}
	return "mid"
}

/** 
 * Determine if we meet the conditions to move to Endgame (capable of joining Daedalus)
 * @param {import(".").NS} ns 
 * @returns True if we meet Daedalus requirements: hacking >= 2500, combat stats >= 1500
**/
function endGameTrigger(ns) {
	// return true if hacking level >= 2500 (to join Daedalus), or ALL combat stats >= 1500
	let player = ns.getPlayer()
	return (player.hacking >= 2500) || ((player.strength >= 1500) && (player.defense >= 1500) && (player.dexterity >= 1500) && (player.agility >= 1500))
}