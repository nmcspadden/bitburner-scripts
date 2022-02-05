import { listPreferredAugs, gangList, aug_bonus_types } from "WIP/AugmentMe2.js";

/**
 * Mid Gameplan w/ Gangs (1+ TB RAM)
 * 1. Buy programs from darkweb
 * 2. Run findOptimal with 60% RAM
 * 3. Run easy-hack with 30% RAM
 * 4. Start gang
 * 5. Buy all the +hacking exp augs
 * 6. Buy all the NFs
 * 7. If gangs are making enough money that saving up for Qlink (25t) isn't bananas, do that
 * 8. Loop back until no more augs to buy
 */

const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	// If we don't have >1TB RAM, just buy RAM upgrades until we do
	ns.exec('obtainPrograms.js', HOME);
	// 2-3 Run hacking programs
	//TODO figure out optimal thread counts here
	ns.exec('findOptimal.js', HOME);
	ns.exec('easy-hack.script', HOME, 2);
	// 4. Manage existing gang
	ns.exec('gangs.js', HOME);
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