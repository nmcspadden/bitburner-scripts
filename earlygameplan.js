import { commitKarmaFocusedCrime, GANG_KARMA } from "utils/crimes.js";
import { lookForProcess, checkSForBN, outputLog, HOME } from "utils/script_tools.js";
import { upgradeHome, growHackingXP } from "utils/gameplan.js";

/**
 * Early Gameplan w/ Gangs (64+ GB RAM)
**/

const EARLY_LOG = "earlygameplan.log.txt";

/** @param {import(".").NS} ns **/
export async function main(ns) {
	await ns.write(EARLY_LOG, "Starting early game plan", "w");
	ns.toast("Starting early game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	// Start crimes until we can do homicides to get to the gang karma, also upgrade home
	outputLog(ns, EARLY_LOG, "Starting crime + upgrade loop...");
	await crimeWhileUpgradingLoop(ns);
	// Start a gang!
	outputLog(ns, EARLY_LOG, "Starting a gang");
	await startAGang(ns);
	// Join bladeburners, if possible
	joinBladeburners(ns);
	// Evaluate hacking scripts again
	outputLog(ns, EARLY_LOG, "Re-evaluating hacking scripts");
	growHackingXP(ns);
	// Go into a waiting loop where we upgrade, buy programs, re-evaluate hacking XP
	outputLog(ns, EARLY_LOG, "Passive money and upgrade loop while managing gang");
	await upgradingLoop(ns);
	outputLog(ns, EARLY_LOG, "Done with early game");
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {import(".").NS} ns
**/
async function crimeWhileUpgradingLoop(ns) {
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (Math.abs(ns.heart.break()) <= GANG_KARMA) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// See if we can upgrade our home
		upgradeHome(ns);
		// If we have lots of money, see if we can buy darkweb programs
		ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
		// Spin up hacking XP tools
		growHackingXP(ns);
		// Otherwise, commit crime!
		commitKarmaFocusedCrime(ns);
	}
}


/** 
 * Check factions to see if I can join one and start a gang
 * @param {import(".").NS} ns 
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
 * @param {import(".").NS} ns 
**/
async function upgradingLoop(ns) {
	// Loop until we have 1 TB of RAM
	let home_ram = ns.getServerMaxRam(HOME);
	let home_stats = [home_ram, 2]; // RAM, then Cores; the cores are actually irrelevant
	while (home_stats[0] <= 1000) {
		// Make sure gangs is running
		if (!lookForProcess(ns, HOME, "gangs.js")) ns.exec("gangs.js", HOME)
		// See if we can upgrade our home
		ns.print("Looking at home upgrades...");
		home_stats = upgradeHome(ns);
		// If we have lots of money, see if we can buy darkweb programs
		ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
		// Create new network map
		ns.print("Generating updated network map...");
		ns.exec("utils/networkmap.js", HOME);
		// Spin up hacking XP tools, only if we got more RAM
		if (home_stats[0] > home_ram) {
			ns.print("Re-evalauting hacking XP scripts");
			home_ram = home_stats[0];
			growHackingXP(ns);
		}
		// Run contract solver
		ns.exec('contractSolver.js', HOME, 1, "--quiet");
		// Sleep for 30 seconds
		ns.print("Sleeping for 30 seconds");
		await ns.sleep(30000);
	}
}

/** 
 * Loop through upgrades, hacking, buying programs, etc.
 * @param {import(".").NS} ns
**/
async function joinBladeburners(ns) {
	if (!checkSForBN(ns, 7)) return
	outputLog(ns, EARLY_LOG, "Joining the Bladeburners");
	ns.bladeburner.joinBladeburners();
	// What else do I do here?
}
