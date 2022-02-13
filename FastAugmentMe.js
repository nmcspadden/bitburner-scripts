import { buildAugMap, aug_bonus_types } from "utils/augs.js";
import { checkSForBN } from "utils/script_tools.js";

/** @param {NS} ns **/
export async function main(ns) {
	const flagdata = ns.flags([
		["type", ""],
		["help", false],
		["ask", false],
		["auto", false],
	])
	if (flagdata.help) {
		ns.tprint(
			`--type can be: ${Object.keys(aug_bonus_types).join(", ")}
			--ask prompts to buy; --auto autobuys any augs. If neither are specified, no purchasing will happen.`
		);
		return
	}
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// Handle type
	let preferred = await listPreferredAugs(ns, aug_map, flagdata.type);
	ns.tprint(`Augs to buy: ${preferred.join(", ")}`);
	// Now check to see if we should buy
	if (preferred.length > 0) {
		if (!flagdata.ask && !flagdata.auto) return
		ns.tprint("Shopping?");
		await promptForAugs(ns, aug_map, preferred, flagdata.ask)
	}
}

/**
 * Get a list of names of priority augs
 * @param {NS} ns
 * @param {*} aug_map Map of objects from buildAugMap()
 * @param {string} type Type of augs to look for
 * @returns List of aug names (strings) to purchase
 */
export async function listPreferredAugs(ns, aug_map, type) {
	let preferred  = [];
	if (type) {
		switch (type) {
			case "bladeburners":
				if (await checkSForBN(ns, 7)) preferred = listBladeburnerAugs(aug_map)
				break;
			case "charisma":
				preferred = listCharismaAugs(aug_map);
				break;
			case "combat":
				preferred = listCombatAugs(aug_map);
				break;
			case "company":
				preferred = listCompanyAugs(aug_map);
				break;
			case "crime":
				preferred = listCrimeAugs(aug_map);
				break;
			case "faction":
				preferred = listFactionAugs(aug_map);
				break;
			case "hack":
				preferred = listPreferredHackingAugs(aug_map);
				break;
			default:
				ns.tprint("Invalid type!");
				ns.exit();
		}
	}
}

/**
 * Get a list of names of priority augs for bladeburners stats
 * @param {NS} ns
 * @returns List of aug names (strings) to purchase
 */
function listBladeburnerAugs(aug_map) {
	// First, check if I want success augs
	let desired_augs = listBladeburnerAugsPrimitive(aug_map, "success", false);
	// If those are all done, get the rest
	if (desired_augs.length > 0) desired_augs = listBladeburnerAugsPrimitive(aug_map, "bladeburner", false);	
	return desired_augs
}
 
/**
 * Get a list of names of priority augs for bladeburners success
 * @param {NS} ns
 * @param {string} substring Substring of stats to search for
 * @returns List of aug names (strings) to purchase
 */
function listBladeburnerAugsPrimitive(aug_map, substring, owned = false) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include substring
	let aug_stat_types = getStatsFromTypes(["bladeburners"]).filter(stat => stat.includes(substring));
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
 * Get a list of names of priority augs for hacking
 * @param {NS} ns
 * @returns List of aug names (strings) to purchase
 */
function listPreferredHackingAugs(aug_map) {
	let desired_augs = listExpAugs(aug_map, "hack");
	if (desired_augs.length > 0) return desired_augs
	desired_augs = listSuccessAugs(aug_map, "hack");
	if (desired_augs.length > 0) return desired_augs
	desired_augs = listHackingAugs(aug_map);
	if (desired_augs.length > 0) return desired_augs
	// If nothing left to buy, return an empty list
	return []
}

/**
* Get a list of names of faction-rep-gain augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listFactionAugs(aug_map, owned = false) {
	// Prefer rep+ augs
	let desired_augs = listRepAugs(aug_map, "faction");
	if (desired_augs.length > 0) return desired_augs
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["faction"]);
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of hacking augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listHackingAugs(aug_map, owned = false) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["hack"]);
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of charisma-gain augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listCharismaAugs(aug_map, owned = false) {
	// Prefer exp+ augs
	let desired_augs = listExpAugs(aug_map, "charisma");
	if (desired_augs.length > 0) return desired_augs
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["charisma"]);
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of combat-gain augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listCombatAugs(aug_map, owned = false) {
	// Prefer exp+ augs
	let desired_augs = listExpAugs(aug_map, "combat");
	if (desired_augs.length > 0) return desired_augs
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["combat"]);
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of company-gain augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listCompanyAugs(aug_map, owned = false) {
	// Prefer exp+ augs
	let desired_augs = listRepAugs(aug_map, "company");
	if (desired_augs.length > 0) return desired_augs
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["company"]);
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of crime-specific augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listCrimeAugs(aug_map, owned = false) {
	// Prefer success+ augs
	let desired_augs = listSuccessAugs(aug_map, "crime");
	if (desired_augs.length > 0) return desired_augs
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["crime"]);
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
 * Return a list of aug stats from the passed in types
 * @param {array} types Shorthand types passed in to ns.flags
 */
function getStatsFromTypes(types) {
	let stat_list = [];
	for (let type of types) {
		stat_list.push(aug_bonus_types[type]);
	}
	return stat_list.flat()
}

/**
 * Sort augs by rep req, then cost
 * @param aug_list List of aug names to sort
 * @param aug_map Map of augs from readAugMap()
 * @returns Same list of aug names sorted by rep, then by cost
 */
function sortAugsByRepThenCost(aug_list, aug_map) {
	let aug_objects = {};
	for (const aug in aug_list) {
		aug_objects[aug] = aug_map[aug]
	}
	// Sort by rep
	let sorted_rep_augs = Object.fromEntries(Object.entries(aug_objects).sort(([, a], [, b]) => a["repreq"] - b["repreq"]).reverse());
	return Object.fromEntries(
		Object.entries(sorted_rep_augs).sort(
			([, a], [, b]) => a["cost"] - b["cost"]
		).reverse()
	);
}

/**
 * Prompt to buy a list of augs
 * @param aug_map Map of augs from readAugMap()
 * @param {array} desired_augs List of strings to buy
 * @param {boolean} should_prompt True if we should prompt to buy; false means we buy silently
 * @returns Same list of aug names sorted by rep, then by cost
 */
async function promptForAugs(ns, aug_map, desired_augs, should_prompt) {
	for (const aug of desired_augs) {
		// ns.tprint(`Considering ${aug}`);
		// Do I have a faction for whom satisifes the rep cost?
		let satisfy_rep = augRepAvailable(ns, aug_map[aug]["repreq"], aug_map[aug]["factions"]);
		// ns.tprint("Rep: " + satisfy_rep);
		// Do I have the money?
		let rich_af = augCostAvailable(ns, aug_map[aug]["cost"]);
		// ns.tprint("Cost: " + rich_af);
		// Do I satisfy pre-reqs?
		let needed_prereqs = augPreReqsAvailable(ns, aug_map[aug]["prereqs"]);
		// ns.tprint("PreReqs: " + needed_prereqs);
		if (needed_prereqs.length > 0) {
			// Calculate our pre-reqs first
			await promptForAugs(ns, aug_map, needed_prereqs, should_prompt);
		}
		// If all of those are true, let's do it
		if (satisfy_rep && rich_af && (needed_prereqs.length == 0)) {
			await purchaseAug(ns, aug, satisfy_rep, should_prompt);
		}
	}
}

/** 
 * Purchase an aug. Return true if succeeded, otherwise false.
 * @param {NS} ns 
 * @param {string} aug Name of augmentation 
 * @param {string} faction Which faction to buy from
 * @param {boolean} should_prompt True if we should prompt to buy; false means we buy silently
**/
async function purchaseAug(ns, aug, faction, should_prompt = true) {
	let should_buy = true;
	let did_buy = false;
	if (should_prompt) {
		should_buy = await ns.prompt(`Buy ${aug}?`);
	}
	if (should_buy) {
		await ns.sleep(5);
		did_buy = ns.purchaseAugmentation(faction, aug);
		if (did_buy) {
			ns.tprint(`Purchased ${aug}!`);
		}
	} else ns.exit();
}

/** 
 * Return list of factions I have enough rep to buy from
 * @param {NS} ns 
 * @param {string} aug Name of augmentation 
 * @param {number} repreq Amount of rep required 
 * @param {array} factions List of factions to check 
**/
function augRepAvailable(ns, repreq, factions) {
	// Is this aug available to purchase right now?
	let player = ns.getPlayer();
	let myfactions = player.factions;
	let common_factions = factions.filter(faction => myfactions.includes(faction));
	return common_factions.find(faction => repreq <= ns.getFactionRep(faction))
}

/** 
 * Return true if I have enough money to buy a faction
 * @param {NS} ns 
 * @param {string} aug Name of augmentation 
 * @param {number} price Cost of aug
**/
function augCostAvailable(ns, price) {
	// Is this aug available to purchase right now?
	let my_money = ns.getPlayer().money;
	return (my_money >= price)
}

/** 
 * Return a list of prereqs I do NOT satisfy; otherwise empty list
 * @param {NS} ns 
 * @param {string} aug Name of augmentation 
 * @param {number} prereqs List of aug prereqs
**/
function augPreReqsAvailable(ns, prereqs) {
	// Do I meet all the pre-reqs?
	let my_augs = ns.getOwnedAugmentations(true);
	return prereqs.filter(item => !my_augs.includes(item))
}

/**
* Get a list of names of exp-enhancing augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listExpAugs(aug_map, type, owned = false) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes([type]).filter(stat => stat.includes("exp"));
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of rep-enhancing augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listRepAugs(aug_map, type, owned = false) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes([type]).filter(stat => stat.includes("rep"));
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

/**
* Get a list of names of success-enhancing augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listSuccessAugs(aug_map, type, owned = false) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes([type]).filter(stat => stat.includes("success"));
	// Now let's take a look at the rep requirements, and costs...
	for (let [aug, model] of Object.entries(aug_map)) {
		// Look for matching stats
		if (aug_stat_types.some(item => Object.keys(model["stats"]).includes(item))) {
			// Skip items we own unless specifically told to include them
			if (aug_map[aug]["owned"] && !owned) continue
			desired_augs[aug] = model;
		}
	}
	return Object.keys(sortAugsByRepThenCost(desired_augs, aug_map))
}

