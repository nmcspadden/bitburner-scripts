import { workoutAllUntil, commitKarmaFocusedCrime } from "utils/crimes.js";
import { outputLog, HOME } from "utils/script_tools.js";

/**
 * Starting game plan (32 GB only)
 * 1. Gym until 80 of each stat
 * 2. Start mugging until we have enough money for the next RAM upgrade
 * 3. Spin up the earlygameplan.js
 */

export const START_LOG = "startinggameplan.log.txt";
const MIN_STAT = 80;

/** @param {import(".").NS} ns **/
export async function main(ns) {
	await ns.write(START_LOG, "Starting beginning game plan", "w")
	ns.toast("Starting beginning game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	// await outputLog(ns, START_LOG, "Activating sleeves, if we have any");
	// ns.exec('sleevesEarly.js', HOME);
	await outputLog(ns, START_LOG, "Beginning workout");
	await workoutAllUntil(ns, MIN_STAT);
	await outputLog(ns, START_LOG, "Committing crimes while upgrading loop");
	await crimeWhileUpgradingLoop(ns);
	await outputLog(ns, START_LOG, "Bought enough RAM to move to Early Game!");
	ns.spawn('earlygameplan.js');
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (ns.getServerMaxRam(HOME) <= 32) {
		if (ns.isBusy()) continue;
		// ns.exec('sleevesEarly.js', HOME);	
		// See if we can upgrade our home
		ns.exec('upgradeHome.js', HOME);
		// Otherwise, commit crime!
		timeout = commitKarmaFocusedCrime(ns);
		await ns.sleep(timeout); // Wait it out first
	}
}