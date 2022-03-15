import { commitKarmaFocusedCrime } from "utils/crimes.js";
import { outputLog, HOME, waitForPid } from "utils/script_tools.js";
import { FILE_NUM_SLEEVES } from "sleevesEarly.js";

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
	await outputLog(ns, START_LOG, "*** Starting beginning game plan", "w")
	ns.toast("Starting beginning game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	let pid;
	await outputLog(ns, START_LOG, "Activating sleeves, if we have any");
	pid = ns.exec('sleevesEarly.js', HOME);
	await waitForPid(ns, pid);
	await outputLog(ns, START_LOG, "Beginning workout");
	ns.exec('gameplan/beginWorkout.js', HOME, 1, MIN_STAT);
	while (ns.getPlayer().agility < MIN_STAT) {
		// Update sleeves
		ns.print("Checking sleeve activity while working out..."); 
		pid = ns.exec('sleevesEarly.js', HOME);
		await waitForPid(ns, pid);
		ns.print("Sleeping 30 seconds");
		await ns.sleep(30000);
	}
	ns.print("Done working out.");
	// With sleeves training, this will likely mean negative money
	if (ns.getServerMoneyAvailable(HOME) < 0) {
		ns.exec('gameplan/resetStarter.js');
		return
	}

	await outputLog(ns, START_LOG, "Committing crimes while upgrading loop");
	await crimeWhileUpgradingLoop(ns);

	await outputLog(ns, START_LOG, "Bought enough RAM to move to Early Game!");
	// With sleeves training, this will likely mean negative money
	if (ns.getServerMoneyAvailable(HOME) < 0) {
		ns.exec('gameplan/resetStarter.js');
		return
	}
	ns.spawn('earlygameplan.js');
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	let timeout = 50; // In ms - too low of a time will result in a lockout/hang
	while (ns.getServerMaxRam(HOME) <= 32) {
		if (ns.isBusy()) continue;
		// await checkSleeves(ns);
		ns.exec('sleevesEarly.js', HOME);	
		// See if we can upgrade our home
		ns.exec('utils/upgradeHome.js', HOME);
		// Otherwise, commit crime!
		ns.exec('gameplan/karmaCrime.js', HOME);
		await ns.sleep(timeout);
	}
}

/* Retrieve data about sleeves.
This is a direct copy from SleevesEarly.js but we can't import it because
it increases the memory too much. */
/**
 * Get the number of sleeves
 * @param {import("..").NS} ns
 */
export function readNumSleeves(ns) {
	let data = ns.read(FILE_NUM_SLEEVES);
	if (!data) return -1
	return Number(ns.read(FILE_NUM_SLEEVES));
}

async function checkSleeves(ns) {
	for (let i = 0; i < readNumSleeves(ns); i++) {
		let pid = ns.exec('sleeves/getTask.js', HOME, 1, i);
		await waitForPid(ns, pid);
		pid = ns.exec('sleeves/getStats.js', HOME, 1, i);
		await waitForPid(ns, pid);
	}
}