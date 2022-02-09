import { workoutAllUntil, commitKarmaFocusedCrime, GANG_KARMA } from "utils/crimes.js";
import { maximizeScriptUse } from "utils/script_tools.js";

/**
 * Early Gameplan w/ Gangs (32 GB RAM)
**/

const HOME = 'home';
const MIN_STAT = 100;

/** @param {NS} ns **/
export async function main(ns) {
	// Create network map
	ns.exec("utils/networkmap.js", HOME);
	// Hit the gym until minimum stats
	await workoutAllUntil(ns, MIN_STAT);
	// 5-6 Start crimes until we can do homicides to get to the gang karma, also upgrade home
	await crimeWhileUpgradingLoop(ns);
	// 7. Start a gang
	startAGang(ns);
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (Math.abs(ns.heart.break()) <= GANG_KARMA) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// See if we can upgrade our home
		upgradeHome(ns);
		// If we have lots of money, see if we can buy darkweb programs
		// obtainPrograms(ns);
		ns.exec('obtainPrograms.js', HOME);
		// Spin up hacking XP tools
		growHackingXP(ns);
		// Otherwise, commit crime!
		commitKarmaFocusedCrime(ns);
	}
}


/** 
 * Upgrade the home
 * @param {NS} ns 
**/
function upgradeHome(ns) {
	// Do I have enough money to buy a RAM or core upgrade?
	let ram_cost = ns.getUpgradeHomeRamCost();
	let core_cost = ns.getUpgradeHomeCoresCost();
	let money = ns.getPlayer().money;
	let did_upgrade = false;
	if (money > ram_cost) {
		did_upgrade = ns.upgradeHomeRam();
		if (did_upgrade) ns.print(`Bought RAM upgrade for ${ns.nFormat(ram_cost, '0.00a')}`)
	}
	if (money > core_cost) {
		did_upgrade = ns.upgradeHomeCores();
		if (did_upgrade) ns.print(`Bought Cores upgrade for ${ns.nFormat(core_cost, '0.00a')}`)
	}
}

/** 
 * Spin up hacking scripts to grow hacking XP
 * @param {NS} ns
**/
function growHackingXP(ns) {
	let HACKSCRIPT;
	if (ns.getHackingLevel <= 300) {
		HACKSCRIPT =  "growHackingXP.js";
	} else {
		// TODO: Figure out which server to hack
		HACKSCRIPT = "basicHack.js";
	}
	maximizeScriptUse(ns,HACKSCRIPT, HOME);
}

/** 
 * Check factions to see if I can join one and start a gang
 * @param {NS} ns 
**/
function startAGang(ns) {
	let invitations = ns.checkFactionInvitations();
	const gangList = [
		"Slum Snakes",
		"Tetrads",
		"Silhouette",
		"Speakers for the Dead",
		"The Dark Army",
		"The Syndicate",
	];
	let ready_gang = invitations.find(gang => gangList.includes(gang));
	if (ready_gang) {
		let joined = ns.joinFaction(ready_gang);
		if (joined) ns.print(`Joined ${ready_gang} faction`)
	}
	ns.exec('gangs.js', HOME);
}