import { findMyFactionsWithAug } from "utils/augs.js";
import { donationAmountForRep, workUntilDonate } from "utils/repNeededForFavor.js";
import { locateServer } from "utils/networkmap.js";
import { HOME } from "utils/script_tools.js";

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

	let aug_map = await setUpGame(ns);

	/* Now do the actual endgame content */
	await print("Looking for Daedalus faction");
	await joinDaedalus(ns);
	await print("Evaluating the process of obtaining of The Red Pill...");
	await grindForRedPill(ns);
	// hack the world daemon!
	await print("HACK THE PLANET! HACK THE PLANET!");
	await hackThePlanet(ns);
}

/**
 * One-time setup scripts for the game phase
 * @param {import(".").NS} ns 
 * @returns the aug_map built by buildAugMap()
 */
async function setUpGame(ns) {
	/* Game Setup Scripts */
	// Make sure gangs is running
	if (!lookForProcess(ns, HOME, "gangs.js")) {
		await print("Starting gangs script...");
		ns.exec("gangs.js", HOME);
	}
	// Make sure bladeburners is running
	if (!lookForProcess(ns, HOME, "bladeburners.js")) {
		await print("Starting Bladeburners script...")
		ns.exec("bladeburner.js", HOME, 1, "--quiet");
	}
	// Make sure corporations are running
	if (!lookForProcess(ns, HOME, "corporations.js")) {
		await print("Starting Corporations script...")
		ns.exec("WIP/corporations.js", HOME);
	}
	// Try to buy more darkweb programs
	ns.exec("obtainPrograms.js", HOME, 1, "--quiet");
	// Start hacking
	ns.print("Checking for obtained programs...");
	while (!(ns.ls(HOME, '.exe').includes("Formulas.exe"))) {
		await ns.sleep(1000);
	}
	// Create new network map
	await print("Generating updated network map...");
	ns.exec("utils/networkmap.js", HOME);
	// Build the aug map first
	await buildAugMap(ns);
	// Evaluate hacking scripts again
	await print("Re-evaluating hacking scripts");
	growHackingXP(ns);
	return aug_map
}


/** 
 * Grind for The Red Pill. Typically this is Daedalus, but in BN2 it's the gang.
 * @param {import(".").NS} ns 
 */
async function grindForRedPill(ns) {
	let player = ns.getPlayer();
	if (ns.getOwnedAugmentations().includes(TheRedPill)) return
	let red_pill_req = ns.getAugmentationRepReq(TheRedPill)
	// First, find the faction with the red pill
	let factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
	/* DEV CHECK */
	ns.print(`Have corp: ${player.hasCorporation}, corp money: ${ns.nFormat(ns.corporation.getCorporation().funds, '$0.00a')}`);
	/* END DEV */
	let money_needed = donationAmountForRep(ns, factions_w_red_pill[0], red_pill_req);
	ns.print(`Need to donate ${money_needed}`);
	while (factions_w_red_pill.length == 0) {
		ns.print("You don't currently belong to any factions with " + TheRedPill);
		factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
		await ns.sleep(30000);
		return
	}
	while (!ns.getOwnedAugmentations().includes(TheRedPill)) {
		// Is the red pill pending for install?
		if (ns.getOwnedAugmentations(true).includes(TheRedPill)) {
			ns.installAugmentations('endgameplan.js');
		}
		ns.print("Hunt for the red pill!");
		//Do we have enough rep to buy it now?
		if (ns.getFactionRep(factions_w_red_pill[0]) >= red_pill_req) {
			let should_buy = await ns.prompt(`Buy ${TheRedPill} from ${factions_w_red_pill[0]}}?`);
			if (should_buy) {
				let did_buy = ns.purchaseAugmentation(factions_w_red_pill[0], TheRedPill);
				if (did_buy) {
					ns.print(`Purchased ${TheRedPill}!`)
					let should_reset = await ns.prompt("Reset to install The Red Pill?");
					if (should_reset) {
						ns.installAugmentations('endgameplan.js');
					} else {
						ns.exit();
					}
				}
			}
			return
		} else if (ns.getFactionFavor(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
			// Do we have enough favor to to donate rep?
			let should_donate = await ns.prompt(`Donate ${ns.nFormat(money_needed, '$0.00a')} to ${factions_w_red_pill[0]}?`);
			let did_donate = false;
			if (should_donate) did_donate = ns.donateToFaction(factions_w_red_pill[0], money_needed);
			if (did_donate) {
				ns.print(`Donated ${ns.nFormat(money_needed, '$0.00a')} to ${factions_w_red_pill[0]}`);
			}
		} else if (player.hasCorporation && (ns.corporation.getCorporation().funds >= money_needed)) {
			// Are we in a corporation with enough money to donate to earn The Red Pill?
			ns.print(`Bribing ${factions_w_red_pill[0]} for ${ns.nFormat(money_needed, '$0.00a')}`);
			let did_bribe = ns.corporation.bribe(factions_w_red_pill[0], money_needed, 0);
			if (did_bribe) ns.print("Bribed successfully!");
		}
		return // DEV ONLY
		// Okay, we don't have enough rep, or favor to donate yet.
		// The Red Pill costs 2.5m rep. That's not worth waiting for, 
		// so grind to 150 favor instead (which requires ~462k rep)
		ns.print(`Working for ${factions_w_red_pill[0]} until we can donate`)
		await workUntilDonate(ns, factions_w_red_pill[0]);
		if (ns.getFactionFavorGain(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
			ns.print("Next reset will let you donate favor for " + TheRedPill);
			let should_reset = await ns.prompt("Reset to buy The Red Pill?");
			if (should_reset) {
				ns.installAugmentations('endgameplan.js');
			} else {
				ns.exit();
			}
			return
		}
	}
}

/** 
 * Find the world daemon and hack it!.
 * @param {NS} ns 
**/
async function hackThePlanet(ns) {
	let daemon_path = await locateServer(ns, WORLD);
	ns.print(`Path to ${WORLD}: ${daemon_path.join(" -> ")}`);
	if (daemon_path.length < 5) return
	for (const step of daemon_path) {
		// ns.print("Connecting to: " + step)
		ns.connect(step);
	}
	ns.print("Checking to see if we have the required hacking level...");
	while (ns.getPlayer().hacking < ns.getServerRequiredHackingLevel(WORLD)) {
		// Wait for our hacking level to increase more
		await ns.sleep(1000);
	}
	let should_end_bitnode = await ns.prompt(`Backdoor the ${WORLD} and end the bitnode?`);
	if (should_end_bitnode) {
		await ns.installBackdoor();
	} else ns.connect('home');
}

async function joinDaedalus(ns) {
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

async function print(msg) {
	await outputLog(ns, END_LOG, msg);
}