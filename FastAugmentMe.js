import { buildAugMap, aug_bonus_types, findMyFactionsWithAug, sortAugsByRepThenCost } from "utils/augs.js";
import { checkSForBN, output } from "utils/script_tools.js";

export const NF = "NeuroFlux Governor";
let TERMINAL = false;

/** @param {import(".").NS} ns **/
export async function main(ns) {
	TERMINAL = true;
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
	// Neuroflux is handled completely differently
	if (flagdata.type == "neuro") {
		handleNeuroflux(ns);
		ns.exit();
	}
	// Handle type
	let preferred = await listPreferredAugs(ns, aug_map, flagdata.type);
	printPrettyAugList(ns, preferred, aug_map);
	// Now check to see if we should buy
	if (preferred.length > 0) {
		if (!flagdata.ask && !flagdata.auto) return
		await promptForAugs(ns, aug_map, preferred, flagdata.ask)
	}
}

/**
 * Get a list of names of priority augs, filtering out NeuroFlux
 * @param {import(".").NS} ns
 * @param {*} aug_map Map of objects from buildAugMap()
 * @param {string} type Type of augs to look for
 * @param {boolean} owned Whether we include augs we already own
 * @returns List of aug names (strings) to purchase
 */
export async function listPreferredAugs(ns, aug_map, type, owned=true) {
	let preferred = [];
	if (type) {
		switch (type) {
			case "bladeburners":
				if (await checkSForBN(ns, 7)) preferred = listBladeburnerAugs(aug_map, owned)
				break;
			case "charisma":
				preferred = listCharismaAugs(aug_map, owned);
				break;
			case "combat":
				preferred = listCombatAugs(aug_map, owned);
				break;
			case "company":
				preferred = listCompanyAugs(aug_map, owned);
				break;
			case "crime":
				preferred = listCrimeAugs(aug_map, owned);
				break;
			case "faction":
				preferred = listFactionAugs(aug_map, owned);
				break;
			case "hack":
				preferred = listPreferredHackingAugs(aug_map, owned);
				break;
			default:
				output(ns, TERMINAL, "Invalid type!");
				ns.exit();
		}
	}
	return preferred.filter(aug => !aug.includes("NeuroFlux"))
}

/**
 * Prompt to buy a list of augs
 * @param {*} aug_map Map of objects from buildAugMap()
 * @param {array} desired_augs List of strings to buy
 * @param {boolean} should_prompt True if we should prompt to buy; false means we buy silently
 * @returns List of augs that we purchased
 */
export async function promptForAugs(ns, aug_map, desired_augs, should_prompt) {
	let purchased_augs = [];
	for (const aug of desired_augs) {
		// Do I have a faction for whom satisifes the rep cost?
		let satisfy_rep = augRepAvailable(ns, aug_map[aug]["repreq"], aug_map[aug]["factions"]);
		// Do I have the money?
		let rich_af = augCostAvailable(ns, aug_map[aug]["cost"]);
		// Do I satisfy pre-reqs?
		let needed_prereqs = augPreReqsAvailable(ns, aug_map[aug]["prereqs"]);
		if (needed_prereqs.length > 0) {
			// Calculate our pre-reqs first
			await promptForAugs(ns, aug_map, needed_prereqs, should_prompt);
		}
		// If all of those are true, let's do it
		if (satisfy_rep && rich_af && (needed_prereqs.length == 0)) {
			let did_buy = await purchaseAug(ns, aug, satisfy_rep, should_prompt);
			if (did_buy) purchased_augs.push(aug);
		}
	}
	return purchased_augs
}

/**
* Upgrade Neuroflux Governor
 * @param {import(".").NS} ns
*/
export function handleNeuroflux(ns) {
	// Is the NF available to me right now?
	let player = ns.getPlayer();
	output(ns, TERMINAL, "Current money: " + ns.nFormat(player.money, '$0.00a'));
	// my_factions_w_nf is a list of factions selling NF sorted descending by highest rep
	let my_factions_w_nf = findMyFactionsWithAug(ns, NF, player);
	if (my_factions_w_nf.length == 0) {
		output(ns, TERMINAL, "You don't currently belong to any factions that sell the NeuroFlux Governor.");
		return
	}
	/*
		What this should do for v3:
		- Money goes faster than rep
		- While we have enough money, check to see if we have enough rep
		- Farm for rep until we have enough to buy
		- Buy until we can't
		- If out of money, end script and complain
	*/
	let closest_faction = getClosestNFFaction(ns, my_factions_w_nf);
	output(ns, TERMINAL, `Current NF rep req: ${ns.nFormat(ns.getAugmentationRepReq(NF), '0.000a')}`);
	output(ns, TERMINAL, `Closest faction is ${closest_faction} with rep ${ns.nFormat(ns.getFactionRep(closest_faction), '0.000a')}`);
	let didBuy = false;
	let money = player.money;
	let price = ns.getAugmentationPrice(NF);
	let bought_price;
	// While there are factions who sell NF and I don't want to stop buying:
	while (money >= price) {
		// Buy while we have enough money
		bought_price = price;
		didBuy = ns.purchaseAugmentation(closest_faction, NF);
		money = ns.getPlayer().money;
		price = ns.getAugmentationPrice(NF);
		if (didBuy) output(ns, TERMINAL, `Bought from ${closest_faction} for ${ns.nFormat(bought_price, '$0.00a')}`)
	}
	output(ns, TERMINAL, `Not enough money to buy more NFs, need ${ns.nFormat(price, '$0.00a')}`);
}

/**
 * Get a list of names of priority augs for bladeburners stats
 * @param {*} aug_map Map of augs as generated by readAugMap()
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names (strings) to purchase
 */
function listBladeburnerAugs(aug_map, owned = false) {
	// First, check if I want success augs
	let desired_augs = listBladeburnerAugsPrimitive(aug_map, "success", owned);
	// If those are all done, get the rest
	if (desired_augs.length > 0) desired_augs = listBladeburnerAugsPrimitive(aug_map, "bladeburner", owned);
	return desired_augs
}

/**
 * Get a list of names of priority augs for bladeburners success
 * @param {*} aug_map Map of augs as generated by readAugMap()
 * @param {string} substring A given substring to filter stats for
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
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
 * @param {*} aug_map Map of augs as generated by readAugMap()
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names (strings) to purchase
 */
function listPreferredHackingAugs(aug_map, owned = false) {
	let desired_augs = listExpAugs(aug_map, "hack", owned);
	if (desired_augs.length > 0) return desired_augs
	desired_augs = listSuccessAugs(aug_map, "hack", owned);
	if (desired_augs.length > 0) return desired_augs
	desired_augs = listHackingAugs(aug_map, owned);
	if (desired_augs.length > 0) return desired_augs
	// If nothing left to buy, return an empty list
	return []
}

/**
 * Get a list of names of faction-rep-gain augs
 * @param {object} aug_map Map of augs as generated by readAugMap()
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names to purchase
 */
function listFactionAugs(aug_map, owned = false) {
	// Prefer rep+ augs
	let desired_augs = listRepAugs(aug_map, "faction", owned);
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
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
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
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names to purchase
 */
function listCharismaAugs(aug_map, owned = false) {
	// Prefer exp+ augs
	let desired_augs = listExpAugs(aug_map, "charisma", owned);
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
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names to purchase
 */
function listCombatAugs(aug_map, owned = false) {
	// Prefer exp+ augs
	let desired_augs = listExpAugs(aug_map, "combat", owned);
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
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names to purchase
 */
function listCompanyAugs(aug_map, owned = false) {
	// Prefer exp+ augs
	let desired_augs = listRepAugs(aug_map, "company", owned);
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
 * @param {boolean} owned True to include augs I own, false to exclude them (default: false)
 * @returns List of aug names to purchase
 */
function listCrimeAugs(aug_map, owned = false) {
	// Prefer success+ augs
	let desired_augs = listSuccessAugs(aug_map, "crime", owned);
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
 * @returns Flast list of aug stats for a given type
 */
function getStatsFromTypes(types) {
	let stat_list = [];
	for (let type of types) {
		stat_list.push(aug_bonus_types[type]);
	}
	return stat_list.flat()
}

/** 
 * Purchase an aug. Return true if succeeded, otherwise false.
 * @param {import(".").NS} ns
 * @param {string} aug Name of augmentation 
 * @param {string} faction Which faction to buy from
 * @param {boolean} should_prompt True if we should prompt to buy; false means we buy silently
 * @returns True if we purchased the aug; false if we did not
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
			output(ns, TERMINAL, `Purchased ${aug}!`);
		}
	} else ns.exit();
	return did_buy
}

/** 
 * Return list of factions I have enough rep to buy from
 * @param {import(".").NS} ns
 * @param {number} repreq Amount of rep required 
 * @param {array} factions List of factions to check 
 * @returns True if there is a faction we can buy this aug from right now
**/
function augRepAvailable(ns, repreq, factions) {
	// Is this aug available to purchase right now?
	let player = ns.getPlayer();
	let myfactions = player.factions;
	let common_factions = factions.filter(faction => myfactions.includes(faction));
	return common_factions.find(faction => repreq <= ns.getFactionRep(faction))
}

/** 
 * Return true if I have enough money to buy something
 * @param {import(".").NS} ns
 * @param {number} price Cost of aug
 * @returns True if we have enough money to buy the thing
**/
function augCostAvailable(ns, price) {
	// Is this aug available to purchase right now?
	let my_money = ns.getPlayer().money;
	return (my_money >= price)
}

/** 
 * Return a list of prereqs I do NOT satisfy; otherwise empty list
 * @param {import(".").NS} ns
 * @param {number} prereqs List of aug prereqs
 * @returns List of prerequisite augs that I don't already own/have pending for a given aug
**/
function augPreReqsAvailable(ns, prereqs) {
	// Do I meet all the pre-reqs?
	let my_augs = ns.getOwnedAugmentations(true);
	return prereqs.filter(item => !my_augs.includes(item))
}

/**
* Get a list of names of exp-enhancing augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {string} type The type of augs to consider when we filter for success
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
* @param {string} type The type of augs to consider when we filter for success
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
* @param {string} type The type of augs to consider when we filter for success
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

/**
 * Print a nicely formatted list of Augs to purchase, with checkboxes for ones we have/satisfy reqs for
 * @param {import(".").NS} ns
 * @param {array} aug_list List of strings of aug names to purchase
 * @param {*} aug_map Map of augs built by buildAugMap()
 */
function printPrettyAugList(ns, aug_list, aug_map) {
	ns.tprint("Augs to purchase: ");
	aug_list.forEach(aug => printAugCheckbox(ns, aug, aug_map));
}

/**
 * Print a nicely formatted aug - checked box if we own it/pending, otherwise display the rep and costs
 * @param {import(".").NS} ns
 * @param {string} aug Name of an aug to print out in a nicely formatted way
 * @param {*} aug_map Map of augs built by buildAugMap()
 */
function printAugCheckbox(ns, aug, aug_map) {
	let msg = `${aug}`
	let condition = false;
	if (aug_map[aug]["pending"]) {
		msg = `${aug} (pending install)`;
		condition = true;
	} else if (aug_map[aug]["owned"]) {
		condition = true;
	} else {
		let satisfy_rep = augRepAvailable(ns, aug_map[aug]["repreq"], aug_map[aug]["factions"]);
		let satisfy_cost = augCostAvailable(ns, aug_map[aug]["cost"]);
		msg += ` -- Factions: ${aug_map[aug]["factions"].join(", ")}, ${printCheckbox(satisfy_rep, `Rep req: ${ns.nFormat(aug_map[aug]["repreq"], '0.000a')}`)}, ${printCheckbox(satisfy_cost, `Cost: ${ns.nFormat(aug_map[aug]["cost"], '$0.00a')}`)}`
	}
	ns.tprint(printCheckbox(condition, msg));
}

/**
 * Print a checkbox based on whether a condition is true
 * @param {*} condition If true, the box is checked
 * @param {*} label The message to print after the checkbox
 * @returns String containing a checked/unchecked box and the message
 */
function printCheckbox(condition, label) {
	return `[${!!condition ? 'x' : ' '}] ${label}`
}

/** 
 * Determine the faction whose rep is closest to the next rep requirement. 
 * @param {import(".").NS} ns
 * @param avail_factions Factions I belong to that sell NF 
**/
function getClosestNFFaction(ns, avail_factions) {
	let rep_sorted_fax = avail_factions.sort((a, b) => ns.getFactionRep(a) - ns.getFactionRep(b));
	let sorted_fax = rep_sorted_fax.sort((a, b) => (ns.getAugmentationRepReq(NF) - ns.getFactionRep(a)) < (ns.getAugmentationRepReq(NF) - ns.getFactionRep(b)))
	return sorted_fax[0]
}
