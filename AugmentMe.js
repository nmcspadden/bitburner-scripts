import { buildAugMap, aug_bonus_types, findMyFactionsWithAug, getClosestNFFaction, NF, getPendingInstalls, readAugMap, augCostAvailable, augRepAvailable, augPreReqsAvailable } from "utils/augs.js";
import { checkSForBN, output } from "utils/script_tools.js";
import { numFormat } from "utils/format.js";

let TERMINAL = false;

/** @param {import(".").NS} ns **/
export async function main(ns) {
	TERMINAL = true;
	const flagdata = ns.flags([
		["type", ""],
		["help", false],
		["ask", false],
		["auto", false],
		["hide_purchased", false]
	])
	if (flagdata.help) {
		ns.tprint(
			`--type can be: ${Object.keys(aug_bonus_types).join(", ")}
			--ask prompts to buy; --auto autobuys any augs. If neither are specified, no purchasing will happen.
			--hide_purchased will not show owned/pending augs.`
		);
		return
	}
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// Neuroflux is handled completely differently
	if (flagdata.type == "neuro") {
		await handleNeuroflux(ns);
		ns.exit();
	}
	let preferred = await listPreferredAugs(ns, aug_map, flagdata.type, flagdata.hide_purchased);
	printPrettyAugList(ns, preferred, aug_map);
	// Now check to see if we should buy
	// TODO: Change the logic here
	// We should try to buy all the ones from the list of preferred augs by group (hack+ exp, hacknet, etc.) first
	// If there are no obtainable within that list, only _THEN_ do we consider the other groups
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
 * @param {boolean} filter_pending If true, we filter out any owned/pending installs
 * @returns List of aug names (strings) to purchase
 */
export async function listPreferredAugs(ns, aug_map, type, filter_pending = false) {
	let preferred = [];
	switch (type) {
		case "bladeburners":
			if (await checkSForBN(ns, 7)) preferred = listBladeburnerAugs(ns, aug_map)
			break;
		case "charisma":
			preferred = listCharismaAugs(ns, aug_map);
			break;
		case "combat":
			preferred = listCombatAugs(ns, aug_map);
			break;
		case "company":
			preferred = listCompanyAugs(ns, aug_map);
			break;
		case "crime":
			preferred = listCrimeAugs(ns, aug_map);
			break;
		case "faction":
			preferred = listFactionAugs(ns, aug_map);
			break;
		case "hack":
			preferred = listHackingAugs(ns, aug_map);
			break;
		case "hacknet":
			preferred = listHacknetAugs(ns, aug_map);
			break;
		case "":
			preferred = newPreferredAugs(ns, filter_pending);
			break;
		default:
			output(ns, TERMINAL, "Invalid type!");
			ns.exit();
	}
	// Don't include Neurofluxes here; they're handled separately
	preferred = preferred.filter(aug => !aug.includes("NeuroFlux"));
	// Exclude pending installs if desired
	if (filter_pending) preferred = preferred.filter(aug => !ns.getOwnedAugmentations(true).includes(aug))
	return preferred
}

/**
 * Get a list of preferred augmentations
 * @param {import(".").NS} ns 
 * @param {*} aug_map Map of objects from buildAugMap()
 * @param {*} filter_pending If true, we filter out any owned/pending installs
 * @returns List of names of augs we want to buy
 */
export async function newPreferredAugs(ns, filter_pending = true) {
	let aug_map = await readAugMap(ns);
	let faction_augs = listAugsByTypesFilteredByStats(ns, aug_map, "faction", "rep");
	let hacking_exp_augs = listAugsByTypesFilteredByStats(ns, aug_map, "hack", "exp");
	let hacking_augs = listAugsByTypesFilteredByStats(ns, aug_map, "hack", "");
	let hacknet_augs = [];
	if (checkSForBN(9)) hacknet_augs = listAugsByTypesFilteredByStats(ns, aug_map, "hacknet", "")
	let results = faction_augs.concat(hacknet_augs, hacking_exp_augs, hacking_augs);
	if (filter_pending) results = results.filter(aug => !ns.getOwnedAugmentations(true).includes(aug))
	return results
}

/**
 * Filter the aug map based on types from augs.js, then by a specific stat substring
 * @param {import(".").NS} ns 
 * @param {*} aug_map Map of objects from buildAugMap()
 * @param {*} type Type of aug based on augs.js constant
 * @param {*} stat_filter The stats on an aug must contain this substring - use empty string to match everything
 * @returns List of aug names based on filters
 */
function listAugsByTypesFilteredByStats(ns, aug_map, type, stat_filter) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include substring
	let aug_stat_types = getStatsFromTypes([type]).filter(stat => stat.includes(stat_filter));
	// Filter by augs that contain a stat matching the desired stat types
	desired_augs = Object.entries(aug_map).filter(
		([aug, model]) => !aug.includes(NF) && Object.keys(model.stats).some(stat => aug_stat_types.includes(stat))
	);
	return Object.keys(Object.fromEntries(desired_augs))
}

/**
 * Prompt to buy a list of augs
 * @param {import(".").NS} ns
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
		// Do I satisfy pre-reqs?
		let needed_prereqs = augPreReqsAvailable(ns, aug_map[aug]["prereqs"]);
		if (needed_prereqs.length > 0) {
			// Calculate our pre-reqs first
			await promptForAugs(ns, aug_map, needed_prereqs, false);
		}
		// If all of those are true, let's do it
		if (needed_prereqs.length == 0) {
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
export async function handleNeuroflux(ns) {
	// Is the NF available to me right now?
	let player = ns.getPlayer();
	// my_factions_w_nf is a list of factions selling NF sorted descending by highest rep
	let my_factions_w_nf = findMyFactionsWithAug(ns, NF, player);
	if (my_factions_w_nf.length == 0) {
		output(ns, TERMINAL, "You don't currently belong to any factions that sell the NeuroFlux Governor.");
		return
	}
	// output(ns, TERMINAL, "Current money: " + ns.nFormat(player.money, '$0.00a'));
	let closest_faction = getClosestNFFaction(ns);
	let closest_faction_rep = ns.getFactionRep(closest_faction);
	let rep_req = ns.getAugmentationRepReq(NF);
	// If we don't have enough rep to buy it, abort
	if (rep_req > closest_faction_rep) {
		output(ns, TERMINAL, `Current NF rep requirement: ${ns.nFormat(rep_req, '0.000a')}`);
		output(ns, TERMINAL, `Closest faction is ${closest_faction} with rep ${ns.nFormat(closest_faction_rep, '0.000a')}`);
		return
	}
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
		if (didBuy) {
			output(ns, TERMINAL, `Bought from ${closest_faction} for ${ns.nFormat(bought_price, '$0.00a')}`)
		} else break
		await ns.sleep(250);
	}
	let aug_map = await buildAugMap(ns);
	output(ns, TERMINAL, getNFCheckbox(ns, aug_map));
}

/**
 * Get a list of names of priority augs for bladeburners stats
 * @param {*} aug_map Map of augs as generated by readAugMap()
 * @returns List of aug names (strings) to purchase
 */
function listBladeburnerAugs(ns, aug_map) {
	// If not a member of Bladeburners faction, this will be empty
	if (!ns.getPlayer().factions.includes("Bladeburner")) return []
	// Prefer success+ augs, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "bladeburners", "success");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "bladeburners", ""));
}

/**
 * Get a list of names of faction-rep-gain augs
 * @param {object} aug_map Map of augs as generated by readAugMap()
 * @returns List of aug names to purchase
 */
function listFactionAugs(ns, aug_map) {
	// Prefer rep+ augs, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "faction", "rep");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "faction", ""));
}

/**
 * Get a list of names of hacking augs
 * @param {object} aug_map Map of augs as generated by readAugMap
 * @returns List of aug names to purchase
 */
function listHackingAugs(ns, aug_map) {
	// Prefer exp+ augs, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "hack", "exp");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "hack", ""));
}

/**
 * Get a list of names of charisma-gain augs
 * @param {object} aug_map Map of augs as generated by readAugMap
 * @returns List of aug names to purchase
 */
function listCharismaAugs(ns, aug_map) {
	// Prefer exp+ augs, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "charisma", "exp");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "charisma", ""));
}

/**
 * Get a list of names of combat-gain augs
 * @param {object} aug_map Map of augs as generated by readAugMap
 * @returns List of aug names to purchase
 */
function listCombatAugs(ns, aug_map) {
	// Prefer exp+ augs, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "combat", "exp");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "combat", ""));
}

/**
 * Get a list of names of company-gain augs
 * @param {object} aug_map Map of augs as generated by readAugMap
 * @returns List of aug names to purchase
 */
function listCompanyAugs(ns, aug_map) {
	// Prefer rep+ augs, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "company", "rep");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "company", ""));
}

/**
 * Get a list of names of crime-specific augs
 * @param {object} aug_map Map of augs as generated by readAugMap
 * @returns List of aug names to purchase
 */
function listCrimeAugs(ns, aug_map) {
	// Success first, then everything else
	let augs = listAugsByTypesFilteredByStats(ns, aug_map, "crime", "success");
	return augs.concat(listAugsByTypesFilteredByStats(ns, aug_map, "crime", ""));
}

/**
 * Get a list of names of Hacknet augs
 * @param {object} aug_map Map of augs as generated by readAugMap()
 * @returns List of aug names to purchase
 */
function listHacknetAugs(ns, aug_map) {
	return listAugsByTypesFilteredByStats(ns, aug_map, "hacknet", "")
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
			output(ns, TERMINAL, `Purchased ${aug} for $${numFormat(ns.getAugmentationPrice(aug))}!`);
		}
	} else ns.exit();
	return did_buy
}

/**
 * Print a nicely formatted list of Augs to purchase, with checkboxes for ones we have/satisfy reqs for
 * @param {import(".").NS} ns
 * @param {array} aug_list List of strings of aug names to purchase
 * @param {*} aug_map Map of augs built by buildAugMap()
 */
function printPrettyAugList(ns, aug_list, aug_map) {
	if (aug_list.length > 0) ns.tprint("Augs to purchase: ");
	else {
		ns.tprint("Nothing to purchase.");
		return
	}
	// Sort this by ones that are already owned, then pending
	let sorted_list = []
	sorted_list = aug_list.sort((a, b) => getPendingInstalls(ns).includes(a) - getPendingInstalls(ns).includes(b));
	sorted_list = aug_list.sort((a, b) => ns.getOwnedAugmentations().includes(a) - ns.getOwnedAugmentations().includes(b));
	sorted_list = sorted_list.reverse();
	sorted_list.forEach(aug => printAugCheckbox(ns, aug, aug_map));
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
	if (aug_map[aug]["pending"] || getPendingInstalls(ns).includes(aug)) {
		msg = `${aug} (pending install)`;
		condition = true;
	} else if (aug_map[aug]["owned"] || ns.getOwnedAugmentations().includes(aug)) {
		condition = true;
	} else {
		let satisfy_rep = augRepAvailable(ns, aug_map[aug]["repreq"], aug_map[aug]["factions"]);
		let satisfy_cost = augCostAvailable(ns, aug_map[aug]["cost"]);
		msg += ` -- Factions: ${aug_map[aug]["factions"].join(", ")}, ${printCheckbox(satisfy_rep, `Rep req: ${ns.nFormat(aug_map[aug]["repreq"], '0.000a')}`)}, ${printCheckbox(satisfy_cost, `Cost: ${ns.nFormat(aug_map[aug]["cost"], '$0.00a')}`)}`
	}
	ns.tprint(printCheckbox(condition, msg));
}

/**
 * Print a nicely formatted aug - checked box if we own it/pending, otherwise display the rep and costs
 * @param {import(".").NS} ns
 * @param {string} aug Name of an aug to print out in a nicely formatted way
 * @param {*} aug_map Map of augs built by buildAugMap()
 */
function getNFCheckbox(ns, aug_map) {
	let msg = `${NF}`
	let satisfy_rep = augRepAvailable(ns, aug_map[NF]["repreq"], aug_map[NF]["factions"]);
	let satisfy_cost = augCostAvailable(ns, aug_map[NF]["cost"]);
	msg += ` -- ${printCheckbox(satisfy_rep, `Rep req: ${ns.nFormat(aug_map[NF]["repreq"], '0.000a')}`)}, ${printCheckbox(satisfy_cost, `Cost: ${ns.nFormat(aug_map[NF]["cost"], '$0.00a')}`)}`
	return msg
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