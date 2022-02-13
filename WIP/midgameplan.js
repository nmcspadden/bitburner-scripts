import { output } from "utils/script_tools.js";
import { upgradeHome } from "utils/gameplan.js";


/**
 * Mid Gameplan w/ Gangs (1+ TB RAM)
 * At this point, we have started a gang, and have 1 TB of RAM
 * Continue looping through earning money, upgrading home, buying augs
 * If we're in BB, run the BB tools
 * Buy all the +faction augs
 * Buy all the +exp augs
 * Buy all the hacking augs
 * If bladeburners are in use, buy all the combat augs too
 * Buy all the NFs
 * If gangs are making enough money that saving up for Qlink (25t) isn't bananas, do that
 * Loop back until no more augs to buy
 */

const HOME = 'home';
const MID_LOG = "midgameplan.log.txt";

/** @param {NS} ns **/
export async function main(ns) {
	await ns.write(EARLY_LOG, "Starting mid game plan", "w");
	ns.toast("Starting mid game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	// Make sure gangs is running
	if (!lookForProcess(ns, HOME, "gangs.js")) {
		ns.print("Starting gangs script...")
		ns.exec("gangs.js", HOME)
	}
	// Try to buy more darkweb programs
	ns.print("")
	ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
	// Create new network map
	ns.print("Generating updated network map...");
	ns.exec("utils/networkmap.js", HOME);

	// 5. Buy all the hacking exp augs
	let exp_augs = listPreferredAugs(ns, gangList, aug_bonus_types["hack"], true);
	do {
		// Buy the augs
		exp_augs = listPreferredAugs(ns, gangList, aug_bonus_types["hack"], true);
	} while (exp_augs.length > 0)
	//TODO: replace this with inline imports that recognize when there are no more to buy
	ns.exec('AugmentMe.js', HOME, 1, "--gangs", "--type", "hack", "--buy");
	ns.exec('AugmentMe.js', HOME, 1, "--gangs", "--type", "faction", "--buy");
	// // 6. Buy NFs
	// ns.exec('neuroflux.js', HOME, 1, "--auto", "--nowork");
}