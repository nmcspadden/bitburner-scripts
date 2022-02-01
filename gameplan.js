import { findMyFactionsWithAug } from "utils/augs.js";
import { calculateRepNeededForFavor, workUntilDonate } from "utils/repNeededForFavor.js";

/**
 * End-Gameplan
 * 1. Create network map
 * 1.5. Buy programs from darkweb
 * 2. Run findOptimal with 70% threads
 * 3. Run easy-hack with 20% threads
 * 4. Run gangs
 * 5. Run stocks
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


/** @param {NS} ns **/
export async function main(ns) {
	ns.tprint("Hunt for the red pill!");
	await grindForRedPill(ns);
}


/** 
 * Grind for The Red Pill. Typically this is Daedalus, but in BN2 it's the gang.
 * @param {NS} ns 
**/
async function grindForRedPill(ns) {
	let player = ns.getPlayer();
	// First, find the faction with the red pill
	let factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
	if (factions_w_red_pill.length == 0) {
		ns.tprint("You don't currently belong to any factions with " + TheRedPill);
		return
	}
	//Do we have enough rep to buy it now?
	if (ns.getFactionRep(factions_w_red_pill[0]) >= ns.getAugmentationRepReq(TheRedPill)) {
		let should_buy = await ns.prompt(`Buy ${TheRedPill} from ${factions_w_red_pill[0]}}?`);
		if (should_buy) {
			did_buy = ns.purchaseAugmentation(factions_w_red_pill[0], TheRedPill);
			if (did_buy) ns.tprint(`Purchased ${TheRedPill}!`)
		}
		return
	// Do we have enough favor to to donate rep?
	} else if (ns.getFactionFavor(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
		let rep_needed = "TODO";
		let did_donate = ns.donateToFaction(faction, rep_needed);
		if (did_donate) {
			ns.tprint(`Donated ${rep_needed} to ${faction}`);
			ns.tprint("Next reset will let you buy " + TheRedPill)
		}
		return
	}
	// Okay, we don't have enough rep, or favor to donate yet.
	// The Red Pill costs 2.5m rep. That's not worth waiting for, 
	// so grind to 150 favor instead (which requires ~462k rep)
	ns.tprint(`Working for ${factions_w_red_pill[0]} until we can donate`)
	await workUntilDonate(ns, factions_w_red_pill[0]);
	if (ns.getFactionFavorGain(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
		ns.tprint("Next reset will let you donate favor for " + TheRedPill);
		return
	}
}