import { findMyFactionsWithAug } from "utils/augs.js";
import { donationAmountForRep, workUntilDonate } from "utils/repNeededForFavor.js";
import { locateServer } from "utils/networkmap.js";

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
const WORLD = "w0r1d_d43m0n";
const DAEDALUS = "Daedalus";
const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	// If we don't have >1TB RAM, just buy RAM upgrades until we do
	ns.exec('obtainPrograms.js', HOME);
	// 2-3 Run hacking programs
	//TODO figure out optimal thread counts here
	ns.exec('findOptimal.js', HOME);
	ns.exec('easy-hack.script', HOME, 2);
	// // 4. Manage existing gang
	ns.exec('gangs.js', HOME);
	// Wait until we can join Daedalus
	await ns.sleep(250);
	await waitForDaedalus(ns);
	await grindForRedPill(ns);
	// hack the world daemon!
	await hackThePlanet(ns);
}

/** 
 * Wait for Daedalus invite
 * @param {NS} ns 
**/
async function waitForDaedalus(ns) {
	if (ns.getPlayer().factions.includes(DAEDALUS)) return
	ns.tprint(`Waiting for ${DAEDALUS} invitation...`);
	while (!ns.checkFactionInvitations().includes(DAEDALUS)) {
		await ns.sleep(500);
	}
	ns.tprint("Joining " + DAEDALUS);
	ns.joinFaction(DAEDALUS);
}

/** 
 * Grind for The Red Pill. Typically this is Daedalus, but in BN2 it's the gang.
 * @param {NS} ns 
**/
async function grindForRedPill(ns) {
	if (ns.getOwnedAugmentations().includes(TheRedPill)) return
	let player = ns.getPlayer();
	let red_pill_req = ns.getAugmentationRepReq(TheRedPill)
	// First, find the faction with the red pill
	let factions_w_red_pill = findMyFactionsWithAug(ns, TheRedPill, player);
	if (factions_w_red_pill.length == 0) {
		ns.tprint("You don't currently belong to any factions with " + TheRedPill);
		ns.exit();
	}
	while (!ns.getOwnedAugmentations(true).includes(TheRedPill)) {
		ns.tprint("Hunt for the red pill!");
		//Do we have enough rep to buy it now?
		if (ns.getFactionRep(factions_w_red_pill[0]) >= red_pill_req) {
			let should_buy = await ns.prompt(`Buy ${TheRedPill} from ${factions_w_red_pill[0]}?`);
			if (should_buy) {
				let did_buy = ns.purchaseAugmentation(factions_w_red_pill[0], TheRedPill);
				if (did_buy) ns.tprint(`Purchased ${TheRedPill}!`)
			}
			// Do we have enough favor to to donate rep?
		} else if (ns.getFactionFavor(factions_w_red_pill[0]) >= FAVOR_TO_DONATE) {
			let money_needed = donationAmountForRep(ns, factions_w_red_pill[0], red_pill_req);
			// ns.tprint(`Need to donate ${money_needed}`);
			let should_donate = await ns.prompt(`Donate ${ns.nFormat(money_needed, '$0.00a')} to ${factions_w_red_pill[0]}?`);
			let did_donate = false;
			if (should_donate) {
				did_donate = ns.donateToFaction(factions_w_red_pill[0], money_needed);
			} else {
				ns.exit();
			}
			if (did_donate) {
				ns.tprint(`Donated ${ns.nFormat(money_needed, '$0.00a')} to ${factions_w_red_pill[0]}`);
			}
		}
		// Okay, we don't have enough rep, or favor to donate yet.
		// The Red Pill costs 2.5m rep. That's not worth waiting for, 
		// so grind to 150 favor instead (which requires ~462k rep)
		ns.tprint(`Working for ${factions_w_red_pill[0]} until we can donate`)
		await workUntilDonate(ns, factions_w_red_pill[0]);
		let total_future_faction = ns.getFactionFavor(factions_w_red_pill[0]) + ns.getFactionFavorGain(factions_w_red_pill[0]);
		if (total_future_faction >= FAVOR_TO_DONATE) {
			ns.tprint("Next reset will let you donate favor for " + TheRedPill);
			ns.exit();
		}
	}
	// Is the Red Pill pending install?
	let should_reset = await ns.prompt(`Reset to install ${TheRedPill}?`);
	if (should_reset) {
		ns.installAugmentations('endgameplan.js');
	} else {
		ns.exit();
	}
}

/** 
 * Find the world daemon and hack it!.
 * @param {NS} ns 
**/
async function hackThePlanet(ns) {
	// Do we own the Red Pill? If not, don't do anything
	if (!ns.getOwnedAugmentations().includes(TheRedPill)) return
	let daemon_path = await locateServer(ns, WORLD);
	ns.tprint(`Path to ${WORLD}: ${daemon_path.join(" -> ")}`);
	for (const step of daemon_path) {
		// ns.tprint("Connecting to: " + step)
		ns.connect(step);
	}
	let should_end_bitnode = await ns.prompt(`Backdoor the ${WORLD} and end the bitnode?`);
	if (should_end_bitnode) {
		await ns.installBackdoor();
	} else ns.connect('home');
}