import { outputLog, isProcessRunning, HOME } from "utils/script_tools.js";
import { newPreferredAugs, promptForAugs, handleNeuroflux } from "AugmentMe.js";
import { upgradeHome, growHackingXP, joinFactions } from "utils/gameplan.js";
import { hasStockAccess } from "stocks";
import { buildAugMap, findCheapestAug, findIdealAugToBuy } from "utils/augs";
import { numFormat } from "utils/format.js";
import { getPendingInstalls } from "./utils/augs";


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
const BB = "Bladeburners";

/** @param {import(".").NS} ns **/
export async function main(ns) {
	await ns.write(MID_LOG, "Starting mid game plan", "w");
	ns.toast("Starting mid game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	let aug_map = await setUpGame(ns);
	await outputLog(ns, MID_LOG, "*** Beginning midgame loop!")
	await buyAugmentLoop(ns, aug_map);
	await outputLog(ns, MID_LOG, "*** Moving to endgame!");
	if (getPendingInstalls(ns) > 0) ns.installAugmentations('endgameplan.js');
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
	let augs_to_buy = await newPreferredAugs(ns, true);
	let original_aug_length = augs_to_buy.length;
	let purchased_augs = 0;
	let purchased_aug_list = [];
	// await outputLog(ns, MID_LOG, `There are ${original_aug_length} augs to purchase`);
	// We move to Endgame when there are no more augs left to buy, or we hit hacking 2500
	while (augs_to_buy.length > 0) {
		// Join Section-12 faction if it's waiting
		await outputLog(ns, MID_LOG, "Joining pending factions");
		joinFactions(ns);

		// Now let's buy the best aug until we can't
		ns.print("Augs we want to buy: " + augs_to_buy.join(", "));
		await outputLog(ns, MID_LOG, "Checking for augmentations to buy");
		let buyme = await findIdealAugToBuy(ns, augs_to_buy)
		while (buyme) {
			purchased_aug_list.push(await promptForAugs(ns, aug_map, [buyme], false));
			// Determine next ideal aug to buy
			buyme = await findIdealAugToBuy(ns, augs_to_buy);
		}
		// How many are left?
		purchased_augs += purchased_aug_list.length;
		if (purchased_augs < original_aug_length) await outputLog(ns, MID_LOG, `You have ${original_aug_length - purchased_augs} left to buy`)
		// Recalculate how many augs are left to buy
		augs_to_buy = await newPreferredAugs(ns, true);
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
		// Make sure corporations are running
		if (
			!isProcessRunning(ns, HOME, "corporations.js") &&
			(ns.getServerMaxRam(HOME) > ns.getScriptRam('corporations.js'))
		) {
			// await outputLog(ns, MID_LOG, "Starting Corporations script...")
			ns.exec("corporations.js", HOME);
		}
		// If we have lots of money, see if we can buy darkweb programs
		ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
		// Run contract solver
		await outputLog(ns, MID_LOG, "Checking for contracts...");
		ns.exec("contractSolver.js", HOME, 1, "--quiet");
		// Sleep for 30 seconds
		ns.print("Sleeping for 30 seconds");
		await ns.sleep(30000);
	}
}

/**
 * One-time setup scripts for the game phase
 * @param {import(".").NS} ns 
 * @returns the aug_map built by buildAugMap()
 */
async function setUpGame(ns) {
	// Ensure network map is up to date
	if (!isProcessRunning(ns, 'home', 'networkmap.js', ['--daemon'])) {
		await outputLog(ns, MID_LOG, "Running network mapping daemon...");
		ns.exec("utils/networkmap.js", HOME, 1, "--daemon");
		await ns.sleep(2000);
	}
	// Active sleeves, if we have any
	if (!isProcessRunning(ns, HOME, "sleeves.js")) {
		await outputLog(ns, MID_LOG, "Activating sleeves, if we have any");
		ns.exec('sleeves.js', HOME);
	}
	// Make sure gangs is running
	if (!isProcessRunning(ns, HOME, "gangs.js")) {
		await outputLog(ns, MID_LOG, "Starting gangs script...");
		ns.exec("gangs.js", HOME, 1, "--quiet");
	}
	// Try to buy more darkweb programs
	ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// Evaluate hacking scripts again
	await outputLog(ns, MID_LOG, "Re-evaluating hacking scripts");
	growHackingXP(ns);
	// Make sure bladeburners is running
	if (!isProcessRunning(ns, HOME, "bladeburners.js")) {
		await outputLog(ns, MID_LOG, "Starting Bladeburners script...")
		ns.exec("bladeburner.js", HOME, 1, "--quiet");
	}
	// Make sure corporations are running
	if (
		!isProcessRunning(ns, HOME, "corporations.js") &&
		(ns.getServerMaxRam(HOME) > ns.getScriptRam('corporations.js'))
	) {
		await outputLog(ns, MID_LOG, "Starting Corporations script...")
		ns.exec("corporations.js", HOME);
	}
	// Stonks?
	if (!isProcessRunning(ns, HOME, "stocks.js") && hasStockAccess(ns)) {
		await outputLog(ns, MID_LOG, "Running Stocks script");
		ns.exec("stocks.js", HOME);
	}
	return aug_map
}

/**
 * Determine if the cheapest aug is reasonably attainable, or prompt for reset
 * @param {import(".").NS} ns 
 * @param {array} auglist List of augs to buy
 */
async function isCheapestAugReasonable(ns, auglist) {
	const cheapest_aug = await findCheapestAug(ns, auglist);
	if (!cheapest_aug || (cheapest_aug == "Empty")) return
	const cheapest_cost = ns.getAugmentationPrice(cheapest_aug);
	ns.print("Cheapest aug " + cheapest_aug + " costs $" + numFormat(cheapest_cost));
	// If the cheapest aug is > 1 trillion, it's probably time to reset
	// Except Q-Link, that shit's 25t to start with
	if (
		((cheapest_aug != "QLink") &&
		(cheapest_cost >= 1e12) &&
		(ns.getServerMoneyAvailable(HOME) < cheapest_cost) &&
		(ns.getOwnedAugmentations(true).length - ns.getOwnedAugmentations(false).length) > 0) ||
		// Or if the last one is Q-Link and we can't afford it
		((cheapest_aug == "QLink") && (ns.getServerMoneyAvailable(HOME) < cheapest_cost))
	) {
		// ns.print("The cheapest aug costs more than $1t, and isn't QLink. You should reset.");
		// let should_reset = await ns.prompt("Install augmentations and reset?");
		// if (should_reset) ns.installAugmentations('midgameplan.js');
		ns.print("The cheapest aug costs more than $1t, and isn't QLink. You should reset.");
		ns.installAugmentations('midgameplan.js');
	}
}