import { workoutAllUntil, commitKarmaFocusedCrime } from "utils/crimes.js";
import { upgradeHome } from "utils/gameplan.js";

/**
 * Starting game plan (32 GB only)
 * 1. Gym until 100 of each stat
 * 2. Start mugging until we have enough money for the next RAM upgrade
 * 3. Spin up the earlygameplan.js
 */

const HOME = 'home';
const MIN_STAT = 100;

/** @param {NS} ns **/
export async function main(ns) {
	await workoutAllUntil(ns, MIN_STAT);
	await crimeWhileUpgradingLoop(ns);
	ns.spawn('earlygameplan.js');
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (ns.getServerMaxRam(HOME) <= 32) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// See if we can upgrade our home
		upgradeHome(ns);
		// Otherwise, commit crime!
		commitKarmaFocusedCrime(ns);
	}
	ns.tprint("Bought enough RAM to move to Early Game")
}