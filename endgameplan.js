import { buildAugMap, findMyFactionsWithAug, getPendingInstalls } from "utils/augs.js";
import { donationAmountForRep, workUntilDonate, calculateBribeNeededForRep } from "utils/repNeededForFavor.js";
import { locateServer } from "utils/networkmap.js";
import { outputLog, isProcessRunning, HOME } from "utils/script_tools.js";
import { growHackingXP, joinFactions } from "utils/gameplan.js";
import { numFormat } from "utils/format.js";
import { hasStockAccess } from "stocks";
import { handleNeuroflux } from "WIP/FastAugmentMe3.js";

/**
 * End-Gameplan
 * 1. Create network map
 * 1.5. Buy programs from darkweb
 * 4. Run gangs
 * 6. If don't have Q-link yet, wait for Q-link (25t)
 * 7. Buy all the exp+ augs
 * 8. Buy all the faction rep+ augs for Daedalus
 * 9. Once all augs bought, buy NF until hack level > 2500
 * 10. If Hack > 2500, +30 augs, 100b+ money, wait for Daedalus invite
 * 11. Grind faction until 150 Favor (462k rep)
 * 12. Buy the Red Pill
 * 13. Hunt down that World Daemon, buy NF until meet the required hack level
 * 
 */

export const END_LOG = "endgameplan.log.txt";
const TheRedPill = "The Red Pill";
const FAVOR_TO_DONATE = 150;
const WORLD = "w0r1d_d43m0n";

/** @param {NS} ns **/
export async function main(ns) {
	await ns.write(END_LOG, "Starting end game plan", "w");
	ns.toast("Starting end game plan!", "info", null);
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script

	await setUpGame(ns);

	/* Now do the actual endgame content */
	await logprint(ns, "Looking for Daedalus faction");
	await joinDaedalus(ns);
	await logprint(ns, "Evaluating the process of obtaining of The Red Pill...");
	await grindForRedPill(ns);
	// hack the world daemon!
	await logprint(ns, "HACK THE PLANET! HACK THE PLANET!");
	await hackThePlanet(ns);
}

/**
 * One-time setup scripts for the game phase
 * @param {import(".").NS} ns 
 * @returns the aug_map built by buildAugMap()
 */
async function setUpGame(ns) {
	/* Game Setup Scripts */
	// Ensure network map is up to date
	if (!isProcessRunning(ns, 'home', 'networkmap.js', ['--daemon'])) {
		await outputLog(ns, END_LOG, "Running network mapping daemon...");
		ns.exec("utils/networkmap.js", HOME, 1, "--daemon");
		await ns.sleep(2000);
	}
	// Active sleeves, if we have any
	if (!isProcessRunning(ns, HOME, "sleeves.js")) {
		await logprint(ns, "Activating sleeves, if we have any");
		ns.exec('sleeves.js', HOME);
	}
	// Make sure gangs is running
	if (!isProcessRunning(ns, HOME, "gangs.js")) {
		await logprint(ns, "Starting gangs script...");
		ns.exec("gangs.js", HOME, 1, "--quiet");
	}
	// Make sure bladeburners is running
	if (!isProcessRunning(ns, HOME, "bladeburners.js")) {
		await logprint(ns, "Starting Bladeburners script...")
		ns.exec("bladeburner.js", HOME, 1, "--quiet");
	}
	// Make sure corporations are running
	if (!isProcessRunning(ns, HOME, "corporations2.js")) {
		await logprint(ns, "Starting Corporations script...")
		ns.exec("WIP/corporations2.js", HOME);
	}
	// Try to buy more darkweb programs
	ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
	// Build the aug map
	await buildAugMap(ns);
	// Evaluate hacking scripts again
	await logprint(ns, "Re-evaluating hacking scripts");
	growHackingXP(ns);
	// Stonks?
	if (!isProcessRunning(ns, HOME, "stocks.js") && hasStockAccess(ns)) {
		await logprint(ns, "Running Stocks script");
		ns.exec("stocks.js", HOME);
	}
	await logprint(ns, "Sleeping for 10 seconds");
	await ns.sleep(10000);
}


/** 
 * Grind for The Red Pill. Typically this is Daedalus, but in BN2 it's the gang.
 * @param {import(".").NS} ns 
 */
async function grindForRedPill(ns) {
	let player = ns.getPlayer();
	if (ns.getOwnedAugmentations().includes(TheRedPill)) return
	let red_pill_req = ns.getAugmentationRepReq(TheRedPill)
	ns.print("Rep required for The Red Pill: " + red_pill_req);
	// First, find the faction with the red pill
	// In BN2, this is your gang; everywhere else, it's Daedalus
	let factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
	while (factions_w_red_pill.length == 0) {
		ns.print("You don't currently belong to any factions with " + TheRedPill);
		factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
		await ns.sleep(30000);
		return
	}
	while (!ns.getOwnedAugmentations().includes(TheRedPill)) {
		/*
		1. Is it currently pending for install? Install it.
		2. Do we have enough rep to buy it now? Buy it.
		3. Do we have enough favor to donate rep to buy it? Donate / LOOP
		4. Do we have enough corp money to bribe for rep to buy it? Bribe / LOOP
		5. If we don't have a corp, ask to work for the rep
		*/
		ns.print("Hunt for the red pill!");
		// Join any random factions that are present
		joinFactions(ns);
		// Am I in a corp and do I have enough to bribe for it?
		await bribeToBuy(ns, factions_w_red_pill[0], red_pill_req);
		// Do I need to work for favor? (Only if not in a corp)
		if (!player.hasCorporation) await workUntilDonate(ns, factions_w_red_pill[0])
		// Do we have enough favor to donate rep to buy it?
		await donateForRepToBuy(ns, factions_w_red_pill[0], red_pill_req);
		// Do we have enough rep to buy it now?
		await buyRedPillNow(ns, factions_w_red_pill[0], red_pill_req);
		// Is the red pill pending for install?
		if (ns.getOwnedAugmentations(true).includes(TheRedPill)) {
			ns.print("Installing The Red Pill!");
			ns.installAugmentations('endgameplan.js');
		}
		await ns.sleep(60000);
	}
}

/** 
 * Find the world daemon and hack it!.
 * @param {import(".").NS} ns 
**/
async function hackThePlanet(ns) {
	if (!ns.getOwnedAugmentations().includes(TheRedPill)) return
	let daemon_path = await locateServer(ns, WORLD);
	if (daemon_path.length < 5) {
		ns.print("The World daemon was not calculated correctly :(");
		ns.exit();
	}
	ns.print(`Checking to see if we have the required hacking level (${ns.getServerRequiredHackingLevel(WORLD)})...`);
	growHackingXP(ns);
	while (ns.getPlayer().hacking < ns.getServerRequiredHackingLevel(WORLD)) {
		// Join any random factions that are present
		joinFactions(ns);
		let current_level = ns.getPlayer().hacking;
		// Wait for our hacking level to increase more
		ns.print(`Waiting 10 seconds for hacking level to increase to ${ns.getServerRequiredHackingLevel(WORLD)}...`);
		// Also buy all available Neurofluxes
		await outputLog(ns, END_LOG, "Evaluating NeuroFlux Governor upgrades");
		await handleNeuroflux(ns);
		await ns.sleep(10000);
		let new_level = ns.getPlayer().hacking;
		if (((current_level - new_level) < 200) && (getPendingInstalls(ns).length > 0)) {
			// If we didn't go up by at least 200 levels in 10 seconds, we're probably going too slow and need to reset
			ns.print("Your hacking level went up by less than 200 in 10 seconds. You should reset.");
			let should_reset = await ns.prompt("Install augmentations and reset?");
			if (should_reset) ns.installAugmentations('endgameplan.js');
		}
	}
	while (!ns.hasRootAccess(WORLD)) {
		// Try to buy more darkweb programs
		ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
		ns.exec("utils/networkmap.js", HOME);
		await ns.sleep(1000);
	}
	ns.print(`Path to ${WORLD}: ${daemon_path.join(" -> ")}`);
	for (const step of daemon_path) {
		ns.connect(step);
	}
	let should_end_bitnode = await ns.prompt(`Backdoor the ${WORLD} and end the bitnode?`);
	if (should_end_bitnode) {
		await ns.installBackdoor();
	} else ns.connect('home');
}

async function joinDaedalus(ns) {
	// If I already have The Red Pill, this is irrelevant
	if (ns.getOwnedAugmentations(true).includes(TheRedPill)) return
	const DAEDALUS = "Daedalus";
	if (ns.getPlayer().factions.includes(DAEDALUS)) return
	// Check our faction invites
	let invited_factions = ns.checkFactionInvitations();
	while (!invited_factions.includes(DAEDALUS)) {
		// Wait for Daedalus to show up
		await ns.sleep(30000);
		invited_factions = ns.checkFactionInvitations();
	}
	if (invited_factions.includes(DAEDALUS)) {
		let did_join = ns.joinFaction(DAEDALUS);
		if (did_join) ns.print("Joined " + DAEDALUS)
	}
}

async function logprint(ns, msg) {
	await outputLog(ns, END_LOG, msg);
}

async function buyRedPillNow(ns, faction, red_pill_req) {
	//Do we have enough rep to buy it now?
	if (ns.getFactionRep(faction) < red_pill_req) {
		ns.print("Not enough rep to buy The Red Pill");
		return
	}
	let should_buy = await ns.prompt(`Buy ${TheRedPill} from ${faction}?`);
	if (should_buy) {
		let did_buy = ns.purchaseAugmentation(faction, TheRedPill);
		if (did_buy) {
			ns.print(`Purchased ${TheRedPill}!`)
			let should_reset = await ns.prompt("Reset to install The Red Pill?");
			if (should_reset) {
				ns.installAugmentations('endgameplan.js');
			} else {
				ns.exit();
			}
		}
	} else {
		ns.exit();
	}
}

async function donateForRepToBuy(ns, faction, red_pill_req) {
	if (ns.getFactionRep(faction) >= red_pill_req) {
		ns.print("Already have enough rep, no need to donate");
		return
	}
	if (ns.getFactionFavor(faction) < FAVOR_TO_DONATE) {
		ns.print("Not enough favor to donate money for rep");
		return
	}
	let money_needed = donationAmountForRep(ns, faction, red_pill_req);
	// Do we have enough favor to to donate rep?
	let should_donate = await ns.prompt(`Donate ${numFormat(money_needed)} to ${faction}?`);
	let did_donate = false;
	if (should_donate) did_donate = ns.donateToFaction(faction, money_needed);
	if (did_donate) {
		ns.print(`Donated $${numFormat(money_needed)} to ${faction}`);
	}
}

async function bribeToBuy(ns, faction, red_pill_req) {
	if (ns.getFactionRep(faction) >= red_pill_req) {
		ns.print("Already have enough rep, no need to bribe");
		return
	}
	if (ns.getFactionFavor(faction) >= FAVOR_TO_DONATE) {
		ns.print("Enough favor to donate, that's the cheaper option, sorta");
		return
	}
	let in_corp = ns.getPlayer().hasCorporation;
	let corp_funds = ns.corporation.getCorporation().funds
	let corp_money_needed = calculateBribeNeededForRep(ns, faction, red_pill_req);
	// Are we in a corporation with enough money to donate to earn The Red Pill?
	if (in_corp && (corp_funds >= corp_money_needed)) {
		ns.print(`Bribing ${faction} for $${numFormat(corp_money_needed)}`);
		let did_bribe = ns.corporation.bribe(faction, corp_money_needed, 0);
		if (did_bribe) ns.print("Bribed successfully!");
	} else if (in_corp) {
		// Not enough money, but we can wait it out
		ns.print(`Need: $${numFormat(corp_money_needed)}, corp currently has: $${numFormat(corp_funds)}`);
	}
}