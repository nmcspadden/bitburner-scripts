export const factionList = [
	/* basic factions */
	"CyberSec",
	"Tian Di Hui",
	"Netburners",
	"NiteSec",
	"The Black Hand",
	"BitRunners",
];

export const locationFactionList = [
	"Sector-12",
	"Chongqing",
	"New Tokyo",
	"Ishima",
	"Aevum",
	"Volhaven",

];

export const gangList = [
	"Slum Snakes",
	"Tetrads",
	"Silhouette",
	"Speakers for the Dead",
	"The Dark Army",
	"The Syndicate",
];

export const endgameFactionList = [
	"The Covenant",
	"Daedalus",
	"Illuminati",
];

export const corpList = [
	"ECorp",
	"MegaCorp",
	"KuaiGong International",
	"Four Sigma",
	"NWO",
	"Blade Industries",
	"OmniTek Incorporated",
	"Bachman & Associates",
	"Clarke Incorporated",
	"Fulcrum Secret Technologies",
];

export const bladeburners = [
    "Bladeburners"
];

export const aug_bonus_types = {
	hack: ["hacking_mult", "hacking_exp_mult", "hacking_speed_mult", "hacking_chance_mult", "hacking_grow_mult", "hacking_money_mult"],
	faction: ["faction_rep_mult"],
	company: ["company_rep_mult", "work_money_mult"],
	crime: ["crime_success_mult", "crime_money_mult"],
	combat: ["agility_exp_mult", "agility_mult", "defense_exp_mult", "defense_mult", "dexterity_exp_mult", "dexterity_mult", "strength_exp_mult", "strength_mult"],
	charisma: ["charisma_exp_mult", "charisma_mult"]
};

const AUGMAP = "augmap.json.txt";


/** @param {NS} ns **/
export async function main(ns) {
	const flagdata = ns.flags([
		["help", false],
		["ask", false],
		["auto", false],
	])
	if (flagdata.help) {
		ns.tprint(
			`--ask prompts to buy; --auto autobuys any augs. If neither are specified, no purchasing will happen.`
		);
		return
	}
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// Look for preferred augs based on the exp+, faction+, then hack+ stats
	let preferred = await listPreferredAugs(ns);
	ns.tprint(`Augs to buy: ${preferred.join(", ")}`);
	// Now check to see if we should buy
	if (preferred.length > 0) {
		if (!flagdata.ask && !flagdata.auto) return
		await promptForAugs(ns, aug_map, preferred, flagdata.ask)
	}
}

/**
 * Return an Object of the aug map from JSON
 * @param {NS} ns
 * @returns Object of the aug map
 */
export async function readAugMap(ns) {
	if (!ns.ls('home', AUGMAP)) {
		await buildAugMap(ns);
	}
	return JSON.parse(ns.read(AUGMAP));
}

/**
 * Build up a map of augmentations available everywhere for future slicing
 * @param {NS} ns
 * @returns Object of the aug map
 */
export async function buildAugMap(ns) {
	let aug_map = {};
	/* Keys: augmentation name; 
	 * Values: an object aug_model 
	 * "factions": [list of strings], 
	 * "repreq": 0, 
	 * "cost": 0, 
	 * "stats": [list of strings],
	 * "prereqs": [list of strings],
	 * "owned": false,
	*/
	let factions_to_consider = factionList.concat(locationFactionList, gangList, endgameFactionList, corpList, bladeburners);
	// ns.tprint(`Factions to consider: ${factions_to_consider}`);
	let my_augs = ns.getOwnedAugmentations();
	for (const faction of factions_to_consider) {
		let avail_augs = ns.getAugmentationsFromFaction(faction);
		for (const aug of avail_augs) {
			// ns.tprint(`Considering ${aug} from ${faction}`);
			// Get basic aug data
			if (!(aug in aug_map)) {
				aug_map[aug] = getAugData(ns, aug);
				aug_map[aug]["factions"] = [];
			}
			// Add to the list of factions already found for a given aug
			let augs_factions = [];
			// are there already factions?
			// ns.tprint(`Existing factions: ${aug_map[aug]["factions"]}`);
			if (aug in aug_map && "factions" in aug_map[aug]) {
				augs_factions = aug_map[aug]["factions"];
				// ns.tprint(`Pre factions: ${augs_factions}`);
			}
			augs_factions.push(faction);
			// ns.tprint(`Mid factions: ${augs_factions}`);
			aug_map[aug]["factions"] = augs_factions;
			// ns.tprint(`Post factions: ${augs_factions}`);
			// Check if I own any of them
			aug_map[aug]["owned"] = my_augs.includes(aug);
		}
	}
	await ns.write("augmap.json", JSON.stringify(aug_map, null, 2), 'w');
	return aug_map;
}

/**
 * Get a list of names of priority augs
 * @param {NS} ns
 * @returns List of aug names (strings) to purchase
 */
export async function listPreferredAugs(ns) {
	let aug_map = await readAugMap(ns);
	/* Preferred order:
	1. Hacking exp+ augs
	2. Faction rep+ augs
	3. Hacking augs 
	 */
	let exp_augs = listExpAugs(aug_map);
	// ns.tprint("EXP Augs: ");
	// ns.tprint(exp_augs);
	if (exp_augs.length > 0) return exp_augs
	let faction_augs = listFactionAugs(aug_map);
	// ns.tprint("Faction Augs: ");
	// ns.tprint(faction_augs);
	if (faction_augs.length > 0) return faction_augs
	let hacking_augs = listHackingAugs(aug_map);
	// ns.tprint("Hacking Augs:");
	// ns.tprint(hacking_augs);
	if (hacking_augs.length > 0) return hacking_augs
	// If nothing left to buy, return an empty list
	return []
}

/**
 * Fetch all data about an aug
 * @param {NS} ns
 * @param {string} aug Name of an aug to fetch data about
 * @returns An object of data about an aug
 */
function getAugData(ns, aug) {
	return {
		"stats": ns.getAugmentationStats(aug),
		"repreq": ns.getAugmentationRepReq(aug),
		"cost": ns.getAugmentationPrice(aug),
		"prereqs": ns.getAugmentationPrereq(aug),
	}
}

/**
* Get a list of names of exp-enhancing augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listExpAugs(aug_map, owned = false) {
	let desired_augs = {};
	// Map the shorthand type arguments to actual aug stats we want, filtered to only include exp
	let aug_stat_types = getStatsFromTypes(["hack"]).filter(stat => stat.includes("exp"));
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
* Get a list of names of faction-rep-gain augs
* @param {object} aug_map Map of augs as generated by readAugMap
* @param {boolean} owned True to include augs I own, false to exclude them
* @returns List of aug names to purchase
*/
function listFactionAugs(aug_map, owned = false) {
	let desired_augs = {};
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