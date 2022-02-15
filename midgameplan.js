import { outputLog, lookForProcess } from "utils/script_tools.js";
import { buildAugMap } from "utils/augs.js";
import { listPreferredAugs, promptForAugs, NF, handleNeuroflux } from "FastAugmentMe.js";


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

/** @param {import(".").NS} ns **/
export async function main(ns) {
	await ns.write(MID_LOG, "Starting mid game plan", "w");
	ns.toast("Starting mid game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	// Make sure gangs is running
	if (!lookForProcess(ns, HOME, "gangs.js")) {
		await outputLog(ns, MID_LOG, "Starting gangs script...")
		ns.exec("gangs.js", HOME)
	}
	// Try to buy more darkweb programs
	ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
	// Create new network map
	await outputLog(ns, MID_LOG, "Generating updated network map...");
	ns.exec("utils/networkmap.js", HOME);
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// TODO: Bladeburner tools
	await buyAugmentLoop(ns, aug_map);
	// ENDGAME: When there are no more augs left to buy
}

/**
 * Main loop where we buy augs and do things
 * @param {import("../.").NS} ns 
 * @param {*} aug_map Map of objects from buildAugMap()
 */
async function buyAugmentLoop(ns, aug_map) {
	// Start with combat augs, as they directly help Bladeburner
	let augs_to_buy = [].concat(
		await listPreferredAugs(ns, aug_map, "combat"),
		await listPreferredAugs(ns, aug_map, "hack"),
		await listPreferredAugs(ns, aug_map, "bladeburners"),
		await listPreferredAugs(ns, aug_map, "faction"),
	);
	ns.tprint(await listPreferredAugs(ns, aug_map, "combat"));
	let original_aug_length = augs_to_buy.length;
	let purchased_augs = 0;
	await outputLog(ns, MID_LOG, `There are ${original_aug_length} augs to purchase`);
	while (augs_to_buy.length > 0) {
		// Attempt to buy the augs silently
		ns.tprint("Augs to buy: " + augs_to_buy.join(", "));
		await outputLog(ns, MID_LOG, "Buying augmentations");
		let purchased_aug_list = await promptForAugs(ns, aug_map, augs_to_buy, false);
		// How many are left?
		purchased_augs += purchased_aug_list.length;
		if (purchased_augs < original_aug_length) await outputLog(ns, MID_LOG, `You have ${original_aug_length - purchased_augs} left to buy`)
		// Recalculate how many augs are left to buy
		augs_to_buy = [].concat(
			await listPreferredAugs(ns, aug_map, "combat"),
			await listPreferredAugs(ns, aug_map, "hack"),
			await listPreferredAugs(ns, aug_map, "bladeburners"),
			await listPreferredAugs(ns, aug_map, "faction"),
		);
		// Also buy all available Neurofluxes
		await outputLog(ns, MID_LOG, "Buying NeuroFlux Governor levels");
		handleNeuroflux(ns);
		// Create new network map
		await outputLog(ns, MID_LOG, "Generating updated network map...");
		ns.exec("utils/networkmap.js", HOME);
		// Run contract solver
		await outputLog(ns, MID_LOG, "Checking for contracts...");
		ns.exec('contractSolver.js', HOME, 1, "--quiet");
		// Sleep for 30 seconds
		ns.print("Sleeping for 30 seconds");
		await ns.sleep(30000);
	}
}