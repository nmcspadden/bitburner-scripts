import { commitKarmaFocusedCrime, GANG_KARMA } from "utils/crimes.js";
import { maximizeScriptUse, lookForProcess } from "utils/script_tools.js";
import { upgradeHome } from "utils/gameplan.js";

/**
 * Early Gameplan w/ Gangs (64+ GB RAM)
**/

const HOME = "home";

/** @param {NS} ns **/
export async function main(ns) {
	ns.toast("Starting early game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	// Start crimes until we can do homicides to get to the gang karma, also upgrade home
	await crimeWhileUpgradingLoop(ns);
	// Start a gang!
	await startAGang(ns);
	// TODO: Join bladeburners if possible
	ns.print("Kicking off hacking XP scripts");
	growHackingXP(ns);
	// Go into a waiting loop where we upgrade, buy programs, re-evaluate hacking XP
	// TODO: Long term, figure out the right target to hack
	await upgradingLoop(ns);
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (Math.abs(ns.heart.break()) <= GANG_KARMA) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// See if we can upgrade our home
		upgradeHome(ns);
		// If we have lots of money, see if we can buy darkweb programs
		ns.exec("obtainPrograms.js", HOME);
		// Spin up hacking XP tools
		growHackingXP(ns);
		// Otherwise, commit crime!
		commitKarmaFocusedCrime(ns);
	}
}


/** 
 * Spin up hacking scripts to grow hacking XP
 * @param {NS} ns
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

/** 
 * Check factions to see if I can join one and start a gang
 * @param {NS} ns 
**/
async function startAGang(ns) {
	const gangList = [
		"Slum Snakes",
		"Tetrads",
		"Silhouette",
		"Speakers for the Dead",
		"The Dark Army",
		"The Syndicate",
	];
	// Am I already in a gang? If so, don't need to do anything here
	ns.print("Checking to see if I'm in a gang...")
	if (ns.gang.inGang()) {
		// If I'm already in a gang, kick off the gang script and bail
		ns.exec("gangs.js", HOME);
		return
	}
	let ready_gang = ns.checkFactionInvitations().find(invite => gangList.includes(invite));
	while (!ready_gang) {
		// Wait 30 seconds until the invitations show up
		ns.print("Waiting for gang invitations...")
		await ns.sleep(30000);
		ready_gang = ns.checkFactionInvitations().find(invite => gangList.includes(invite));
	}
	let joined = ns.joinFaction(ready_gang);
	if (joined) ns.print(`Joined ${ready_gang} faction, starting a gang!`)
	ns.exec("gangs.js", HOME);
}

/** 
 * Loop through upgrades, hacking, buying programs, etc.
 * @param {NS} ns 
**/
async function upgradingLoop(ns) {
	while (ns.getServerMaxRam(HOME) <= 32) {
		// Make sure gangs is running
		if (!lookForProcess(ns, HOME, "gangs.js")) ns.exec("gangs.js", HOME)
		// See if we can upgrade our home
		ns.print("Looking at home upgrades...");
		upgradeHome(ns);
		// If we have lots of money, see if we can buy darkweb programs
		ns.exec("obtainPrograms.js", HOME);
		// Create new network map
		ns.print("Generating updated network map...");
		ns.exec("utils/networkmap.js", HOME);
		// Spin up hacking XP tools
		ns.print("Re-evalauting hacking XP scripts");
		growHackingXP(ns);
		// Sleep for 30 seconds
		ns.print("Sleeping for 30 seconds");
		await ns.sleep(30000);
	}
}