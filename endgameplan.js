import { findMyFactionsWithAug } from "utils/augs.js";
import { donationAmountForRep, workUntilDonate } from "utils/repNeededForFavor.js";
import { locateServer, createNetworkMap } from "utils/networkmap.js";
import { maximizeScriptUse } from "utils/script_tools.js";

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

const TheRedPill = "The Red Pill";
const FAVOR_TO_DONATE = 150;
const WORLD = "w0r1d_d43m0n";
const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	ns.exec('gangs.js', HOME);
	// Once we have enough money ($5b for Formulas.exe)
	while (ns.getPlayer().money < 7000000000) {
		await ns.sleep(10000);
	}
	ns.exec('obtainPrograms.js', HOME);
	// Start hacking
	ns.tprint("Checking for obtained programs...");
	while (!(ns.ls(HOME, '.exe').includes("Formulas.exe"))) {
		await ns.sleep(1000);
	}
	// Build a new map to re-root everything
	ns.tprint("Generating new network map...");
	await createNetworkMap(ns);
	maximizeScriptUse(ns, "growHackingXP.js", HOME);
	while (ns.getPlayer().hacking <= 2500) {
		ns.disableLog("ALL");
		ns.tprint("Waiting for hacking level to hit 2500...");
		await ns.sleep(5000);
	}
	// Create network map
	await createNetworkMap(ns);
	// Join Daedalus if it's currently waiting
	await joinDaedalus(ns);
	await grindForRedPill(ns);
	// hack the world daemon!
	await hackThePlanet(ns);
}


/** 
 * Grind for The Red Pill. Typically this is Daedalus, but in BN2 it's the gang.
 * @param {NS} ns 
**/
async function grindForRedPill(ns) {
	let player = ns.getPlayer();
	if (ns.getOwnedAugmentations().includes(TheRedPill)) return
	let red_pill_req = ns.getAugmentationRepReq(TheRedPill)
	// First, find the faction with the red pill
	let factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
	while (factions_w_red_pill.length == 0) {
		ns.tprint("You don't currently belong to any factions with " + TheRedPill);
		factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
		await ns.sleep(30000);
		return
	}
	while (!ns.getOwnedAugmentations().includes(TheRedPill)) {
		// Is the red pill pending for install?
		if (ns.getOwnedAugmentations(true).includes(TheRedPill)) {
			ns.installAugmentations('endgameplan.js');
		}
		ns.tprint("Hunt for the red pill!");
		//Do we have enough rep to buy it now?
		if (ns.getFactionRep(factions_w_red_pill[0]) >= red_pill_req) {
			let should_buy = await ns.prompt(`Buy ${TheRedPill} from ${factions_w_red_pill[0]}}?`);
			if (should_buy) {
				let did_buy = ns.purchaseAugmentation(factions_w_red_pill[0], TheRedPill);
				if (did_buy) {
					ns.tprint(`Purchased ${TheRedPill}!`)
					let should_reset = await ns.prompt("Reset to install The Red Pill?");
					if (should_reset) {
						ns.installAugmentations('endgameplan.js');
					} else {
						ns.exit();
					}
				}
			}
			return
			// Do we have enough favor to to donate rep?
		} else if (ns.getFactionFavor(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
			let money_needed = donationAmountForRep(ns, factions_w_red_pill[0], red_pill_req);
			// ns.tprint(`Need to donate ${money_needed}`);
			let should_donate = await ns.prompt(`Donate ${ns.nFormat(money_needed, '$0.00a')} to ${factions_w_red_pill[0]}?`);
			let did_donate = false;
			if (should_donate) did_donate = ns.donateToFaction(factions_w_red_pill[0], money_needed);
			if (did_donate) {
				ns.tprint(`Donated ${ns.nFormat(money_needed, '$0.00a')} to ${factions_w_red_pill[0]}`);
			}
		}
		// Okay, we don't have enough rep, or favor to donate yet.
		// The Red Pill costs 2.5m rep. That's not worth waiting for, 
		// so grind to 150 favor instead (which requires ~462k rep)
		ns.tprint(`Working for ${factions_w_red_pill[0]} until we can donate`)
		await workUntilDonate(ns, factions_w_red_pill[0]);
		if (ns.getFactionFavorGain(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
			ns.tprint("Next reset will let you donate favor for " + TheRedPill);
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
	ns.tprint(`Path to ${WORLD}: ${daemon_path.join(" -> ")}`);
	if (daemon_path.length < 5) return
	for (const step of daemon_path) {
		// ns.tprint("Connecting to: " + step)
		ns.connect(step);
	}
	// TODO: Add in logic to wait for required hacking level
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
		if (did_join) ns.tprint("Joined " + DAEDALUS)
	}
}