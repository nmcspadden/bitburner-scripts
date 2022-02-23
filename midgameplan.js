import { outputLog, lookForProcess, HOME } from "utils/script_tools.js";
import { buildAugMap } from "utils/augs.js";
import { listPreferredAugs, promptForAugs, handleNeuroflux } from "FastAugmentMe.js";
import { upgradeHome, growHackingXP, joinFactions } from "utils/gameplan.js";
import { hasStockAccess } from "stocks";


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

/* TODOs:
- Add income calculation to determine whether waiting for an aug is worthwhile or not
- Add Sleeve support 
- Add --wait options for all scripts to daemonize them so they can sit there waiting
*/

export const MID_LOG = "midgameplan.log.txt";
const TheRedPill = "The Red Pill";

/** @param {import(".").NS} ns **/
export async function main(ns) {
	await ns.write(MID_LOG, "Starting mid game plan", "w");
	ns.toast("Starting mid game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script

	if (!endGameTrigger(ns)) {
		let aug_map = await setUpGame(ns);
		await buyAugmentLoop(ns, aug_map);
	}
	await outputLog(ns, MID_LOG, "Moving to endgame!");
	ns.spawn('endgameplan.js');
}

/**
 * Main loop where we buy augs and do things
 * @param {import(".").NS} ns 
 * @param {*} aug_map Map of objects from buildAugMap()
 */
async function buyAugmentLoop(ns, aug_map) {
	let home_ram = ns.getServerMaxRam(HOME);
	let home_stats = [home_ram, 2]; // RAM, then Cores; the cores are actually irrelevant
	// Start with combat augs, as they directly help Bladeburner
	let augs_to_buy = [].concat(
		await listPreferredAugs(ns, aug_map, "combat", false),
		await listPreferredAugs(ns, aug_map, "hack", false),
		await listPreferredAugs(ns, aug_map, "bladeburners", false),
		await listPreferredAugs(ns, aug_map, "faction", false),
	);
	let original_aug_length = augs_to_buy.length;
	let purchased_augs = 0;
	await outputLog(ns, MID_LOG, `There are ${original_aug_length} augs to purchase`);
	// We move to Endgame when there are no more augs left to buy, or we hit hacking 2500
	while (augs_to_buy.length > 0 || !endGameTrigger(ns)) {
		// Join Section-12 faction if it's waiting
		await outputLog(ns, MID_LOG, "Joining pending factions");
		joinFactions(ns);
		// Attempt to buy the augs silently
		ns.print("Augs to buy: " + augs_to_buy.join(", "));
		await outputLog(ns, MID_LOG, "Checking for augmentations to buy");
		let purchased_aug_list = await promptForAugs(ns, aug_map, augs_to_buy, false);
		// How many are left?
		purchased_augs += purchased_aug_list.length;
		if (purchased_augs < original_aug_length) await outputLog(ns, MID_LOG, `You have ${original_aug_length - purchased_augs} left to buy`)
		// Recalculate how many augs are left to buy
		augs_to_buy = [].concat(
			await listPreferredAugs(ns, aug_map, "combat", false),
			await listPreferredAugs(ns, aug_map, "hack", false),
			await listPreferredAugs(ns, aug_map, "bladeburners", false),
			await listPreferredAugs(ns, aug_map, "faction", false),
		);
		// Also buy all available Neurofluxes
		await outputLog(ns, MID_LOG, "Evaluating NeuroFlux Governor upgrades");
		await handleNeuroflux(ns);
		// Now check: is the next cheapest aug simply too expensive? If so, we should install and reset
		await isCheapestAugReasonable(ns, augs_to_buy);
		// See if we can upgrade our home
		ns.print("Looking at home upgrades...");
		home_stats = upgradeHome(ns);
		// Spin up hacking XP tools, only if we got more RAM
		if (home_stats[0] > home_ram) {
			ns.print("Re-evalauting hacking XP scripts");
			home_ram = home_stats[0];
			growHackingXP(ns);
		}
		// If we have lots of money, see if we can buy darkweb programs
		ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
		// Create new network map
		await outputLog(ns, MID_LOG, "Generating updated network map...");
		ns.exec("utils/networkmap.js", HOME);
		// Run contract solver
		await outputLog(ns, MID_LOG, "Checking for contracts...");
		ns.exec("contractSolver.js", HOME, 1, "--quiet");
		// Sleep for 30 seconds
		ns.print("Sleeping for 30 seconds");
		await ns.sleep(30000);
	}
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

/**
 * One-time setup scripts for the game phase
 * @param {import(".").NS} ns 
 * @returns the aug_map built by buildAugMap()
 */
async function setUpGame(ns) {
	// Make sure gangs is running
	if (!lookForProcess(ns, HOME, "gangs.js")) {
		await outputLog(ns, MID_LOG, "Starting gangs script...");
		ns.exec("gangs.js", HOME);
	}
	// Try to buy more darkweb programs
	ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
	// Create new network map
	await outputLog(ns, MID_LOG, "Generating updated network map...");
	ns.exec("utils/networkmap.js", HOME);
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// Evaluate hacking scripts again
	await outputLog(ns, MID_LOG, "Re-evaluating hacking scripts");
	growHackingXP(ns);
	// Make sure bladeburners is running
	if (!lookForProcess(ns, HOME, "bladeburners.js")) {
		await outputLog(ns, MID_LOG, "Starting Bladeburners script...")
		ns.exec("bladeburner.js", HOME, 1, "--quiet");
	}
	// Make sure corporations are running
	if (!lookForProcess(ns, HOME, "corporations.js")) {
		await outputLog(ns, MID_LOG, "Starting Corporations script...")
		ns.exec("WIP/corporations.js", HOME);
	}
	// Stonks?
	if (!lookForProcess(ns, HOME, "stocks.js") && hasStockAccess(ns)) {
		await outputLog(ns, MID_LOG, "Running Stocks script");
		ns.exec("stocks.js", HOME);
	}
	return aug_map
}

/**
 * Main loop where we buy augs and do things
 * @param {import(".").NS} ns 
 * @param {array} auglist List of augs to buy
 * @param {*} aug_map Map of objects from buildAugMap()
 */
async function isCheapestAugReasonable(ns, auglist) {
	let sortable_augs = {};
	for (const aug of auglist) {
		// Skip augs I already own/have pending
		if (ns.getOwnedAugmentations(true).includes(aug)) continue
		sortable_augs[aug] = ns.getAugmentationPrice(aug);
	}
	let sorted_list = Object.fromEntries(
		Object.entries(sortable_augs).sort(
			([, a], [, b]) => a["cost"] - b["cost"]
		).reverse()
	)
	let cheapest_aug = Object.keys(sorted_list)[0];
	ns.print("Cheapest aug " + cheapest_aug + " costs " + ns.nFormat(sorted_list[cheapest_aug], '$0.00a'));
	// If the cheapest aug is > 1 trillion, it's probably time to reset
	// Except Q-Link, that shit's 25t to start with
	if ((cheapest_aug != "QLink") && (sorted_list[cheapest_aug] >= 1000000000000) && (ns.getServerMoneyAvailable(HOME) < sorted_list[cheapest_aug])) {
		ns.print("The cheapest aug costs more than $1t, and isn't QLink. You should reset.");
		let should_reset = await ns.prompt("Install augmentations and reset?");
		if (should_reset) ns.installAugmentations('starter.js');
	}
}