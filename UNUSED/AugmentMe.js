import { buildAugMap, readAugMap, aug_bonus_types } from "utils/augs.js";

/** @param {NS} ns **/
export async function main(ns) {
	const flagdata = ns.flags([
		["factions", false],
		["locations", false],
		["gangs", false],
		["endgame", false],
		["corps", false],
        ["bladeburners", false],
		["all", false],
		["help", false],
		["type", []],
		["ask", false],
		["buy", false],
	])
	let factions_to_consider = [];
	let types_to_consider = [];
	if (flagdata.help) {
		ns.tprint(
			`Pass in any of: --factions, --locations, --gangs, --corps, --endgame; or --all for factions. Use --faction X for a specific faction.
			   --type can be: ${Object.keys(aug_bonus_types).join(", ")} or all.
			   --ask prompts to buy; --buy autobuys any augs. If neither are specified, no purchasing will happen.`
		);
		return
	}
	// If they didn't pass in a valid type, yell
	if (!flagdata.type == "all" && !Object.keys(aug_bonus_types).some(items => flagdata.type.includes(items))) {
		ns.tprint("you dun goofed");
		return
	}
	const pattern = [
		[data => { return data.factions || data.all }, () => factions_to_consider.push(...factionList)],
		[data => { return data.locations || data.all }, () => factions_to_consider.push(...locationFactionList)],
		[data => { return data.gangs || data.all }, () => factions_to_consider.push(...gangList)],
		[data => { return data.corps || data.all }, () => factions_to_consider.push(...corpList)],
		[data => { return data.bladeburners || data.all }, () => factions_to_consider.push(...bladeburners)],
		[data => { return data.endgame || data.all }, () => factions_to_consider.push(...endgameFactionList)],
		[data => { return data.faction }, (data) => { factions_to_consider.push(data.faction) }],
		[data => { return data.type }, (data) => { (data.type == "all" ? types_to_consider.push(Object.keys(aug_bonus_types)) : types_to_consider.push(data.type)) }],

	]
	for (const [condition, action] of pattern) {
		if (condition(flagdata)) action(flagdata)
	}
    ns.tprint(`Types: ${types_to_consider} Factions: ${factions_to_consider}`);
	// Build the map of possible augs
	let aug_map = buildAugMap(ns, factions_to_consider, true);
	// Map the shorthand type arguments to actual aug stats we want
	let aug_stat_types = getStatsFromTypes(types_to_consider.flat());
	// Now let's take a look at the rep requirements, and costs...
	let desired_aug_names = filterAugsByStats(ns, aug_map, aug_stat_types);
    ns.tprint(JSON.stringify(desired_aug_names, null, 2));
	// Narrow it down to +exp first...
	let desired_augs = Object.entries(aug_map).filter(([key, value]) => desired_aug_names.includes(key));
	let exp_augs = filterByExp(desired_augs);
	// Now prompt
	if (flagdata.ask || flagdata.buy) {
		if (exp_augs.length > 0) {
			await promptForAugs(ns, aug_map, exp_augs, flagdata.ask, flagdata.buy)
		} else {
			await promptForAugs(ns, aug_map, Object.fromEntries(desired_augs), flagdata.ask, flagdata.buy)
		}
	} else {
		let sorted_exp_augs = Object.keys(exp_augs).sort((a, b) => a["cost"] - b["cost"]).reverse();
		ns.tprint("Augs with +exp stats sorted by cost: " + sorted_exp_augs.join(", "));
		let sorted_desired_augs = Object.entries(Object.fromEntries(desired_augs)).sort(([,a], [,b]) => a["cost"] - b["cost"]).reverse()[0];
		ns.tprint("Augs to aim for with your desired stats: " + sorted_desired_augs.join(", "));
		ns.tprint(`Most expensive aug is ${sorted_desired_augs[0]} at ${ns.nFormat(Object.fromEntries(desired_augs)[sorted_desired_augs[0]]["cost"], '$0.00a')}`);
		let most_rep_aug = Object.entries(Object.fromEntries(desired_augs)).sort(([,a], [,b]) => a["repreq"] - b["repreq"]).reverse()[0][0];
		ns.tprint(`Most rep-required aug is ${most_rep_aug} at ${ns.nFormat(aug_map[most_rep_aug]["repreq"], '0.000a')}`);
	}
}

/** 
 * Return a list of aug names filtered by stats
 * @param {NS} ns
 * @param {map} aug_map Map of all augmentations generated by buildAugMap()
 * @param {array} desired_stats A list of stats to search for 
 */
function filterAugsByStats(ns, aug_map, desired_stats) {
	let desired_augs = [];
	// Get my augs first
	let my_augs = ns.getOwnedAugmentations(true);
	// Brute force it:
	for (let [aug, model] of Object.entries(aug_map)) {
		// Filter out my already installed augs
		if (my_augs.includes(aug)) continue
		/*
		 * Basic filtering code:
		 * desired_stats = ["hacking_exp_mult", "hacking_money_mult"]
		 * Object.keys(item["stats"]) = ["hacking_mult", "hacking_exp_mult", "hacking_speed_mult"]
		 * let matches = desired_stats.filter( items => actual_stats.includes(items) );
		 */
		// Look for matching stats
		let matching_stats = desired_stats.filter(items => Object.keys(model["stats"]).includes(items));
		if (matching_stats.length > 0) {
			desired_augs.push(aug);
			// ns.tprint(`${aug} from [${model["factions"].join(", ")}]: ${matching_stats.join(", ")}`);
		}
	}
	return desired_augs.flat();
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
 * Return a dictionary of augs containing +exp bonuses
 * @param aug_map Object of augmentations
 */
function filterByExp(aug_map) {
	// Prioritize exp gain first
	let fixed_aug_map = Object.fromEntries(Object.values(aug_map));
	let exp_augs = {};
	for (const [aug, aug_model] of Object.entries(fixed_aug_map)) {
		for (const stat of Object.keys(aug_model["stats"])) {
			if (stat.includes("exp")) {
				exp_augs[aug] = aug_model
			}
		}
	}
	return exp_augs
}

/** @param {NS} ns **/
async function promptForAugs(ns, aug_map, desired_augs, should_prompt, should_autobuy) {
	// Sort by cost, then prompt to buy
	let sorted_augs = Object.fromEntries(Object.entries(desired_augs).sort((a, b) => a["cost"] - b["cost"]).reverse());
	ns.tprint("Augs to aim for: " + Object.keys(sorted_augs).join(", "));
	// ns.tprint(JSON.stringify(Object.keys(sorted_augs), null, 4));
	for (const [aug, aug_model] of Object.entries(sorted_augs)) {
		await purchaseAug(ns, aug, aug_map, should_prompt, should_autobuy);
	}
	// Object.keys(sorted_augs).forEach(aug => await purchaseAug(ns, aug, aug_map, should_prompt, should_autobuy));
}

function getCommonFaction(player_factions, faction_list) {
	return faction_list.filter(faction => player_factions.includes(faction))
}

/** 
 * Purchase an aug. Return true if succeeded, otherwise false.
 * @param {NS} ns 
 * @param {string} aug Name of augmentation 
 * @param aug_model Model of stats about augmentation
**/
async function purchaseAug(ns, aug, aug_map, should_prompt, should_autobuy) {
	// So, you want to buy an augmentation.
	// ns.tprint(`Considering ${aug}`);
	// Do I have the rep?
	let repAvail = augRepAvailable(ns, aug_map[aug]["repreq"], aug_map[aug]["factions"]);
	// ns.tprint("Rep: " + repAvail);
	// Do I have the money?
	let costAvail = augCostAvailable(ns, aug_map[aug]["cost"]);
	// ns.tprint("Cost: " + costAvail);
	// Do I satisfy pre-reqs?
	let prereqsAvail = augPreReqsAvailable(ns, aug_map[aug]["prereq"])
	// ns.tprint("PreReqs: " + prereqsAvail);
	if (prereqsAvail) {
		for (const pre of prereqsAvail) await purchaseAug(ns, pre, aug_map, should_prompt, should_autobuy)
	}
	// If all of those are true, let's do it
	if (repAvail && costAvail && (prereqsAvail.length == 0)) {
		let should_buy = false;
		let did_buy = false;
		if (should_prompt) {
			should_buy = await ns.prompt(`Buy ${aug}?`);
		}
		if (should_autobuy || should_buy) {
			did_buy = ns.purchaseAugmentation(repAvail, aug);
			if (did_buy) ns.tprint(`Purchased ${aug}!`)
			await ns.sleep(5);
		} else {
			ns.exit();
		}
	}
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
	let commonFaction = getCommonFaction(myfactions, factions);
	return commonFaction.find(faction => repreq <= ns.getFactionRep(faction))
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
	let unsatisfied = prereqs.filter(item => !my_augs.includes(item));
	return unsatisfied
}