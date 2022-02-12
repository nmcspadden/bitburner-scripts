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
const START_LOG = "startinggameplan.log.txt";

/** @param {import(".").NS} ns **/
export async function main(ns) {
	await ns.write(START_LOG, "Starting beginning game plan", "w")
	ns.toast("Starting beginning game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	await ns.write(START_LOG, "Beginning workout", "a");
	await workoutAllUntil(ns, MIN_STAT);
	await ns.write(START_LOG, "Crime while upgrading loop", "a");
	await crimeWhileUpgradingLoop(ns);
	ns.print("Bought enough RAM to move to Early Game");
	await ns.write(START_LOG, "Finished, spawning early game plan", "a");
	ns.spawn('earlygameplan.js');
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (ns.getServerMaxRam(HOME) <= 32) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// See if we can upgrade our home
		upgradeHome(ns);
		// Otherwise, commit crime!
		commitKarmaFocusedCrime(ns);
	}
}