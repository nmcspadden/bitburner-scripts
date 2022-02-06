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
		["factions", false],
		["locations", false],
		["gangs", false],
		["endgame", false],
		["corps", false],
		["all", false],
		["faction", ""],
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
		[data => { return data.endgame || data.all }, () => factions_to_consider.push(...endgameFactionList)],
		[data => { return data.faction }, (data) => { factions_to_consider.push(data.faction) }],
		[data => { return data.type }, (data) => { (data.type == "all" ? types_to_consider.push(Object.keys(aug_bonus_types)) : types_to_consider.push(data.type)) }],

	]
	for (const [condition, action] of pattern) {
		if (condition(flagdata)) action(flagdata)
	}
	// Build the aug map first
	let aug_map = await buildAugMap(ns);
	// Look for preferred augs based on the exp+, faction+, then hack+ stats
	let preferred = await listPreferredAugs(ns);
	ns.tprint(preferred);
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
		let sorted_desired_augs = Object.entries(Object.fromEntries(desired_augs)).sort(([, a], [, b]) => a["cost"] - b["cost"]).reverse()[0];
		ns.tprint("Augs to aim for with your desired stats: " + sorted_desired_augs.join(", "));
		ns.tprint(`Most expensive aug is ${sorted_desired_augs[0]} at ${ns.nFormat(Object.fromEntries(desired_augs)[sorted_desired_augs[0]]["cost"], '$0.00a')}`);
		let most_rep_aug = Object.entries(Object.fromEntries(desired_augs)).sort(([, a], [, b]) => a["repreq"] - b["repreq"]).reverse()[0][0];
		ns.tprint(`Most rep-required aug is ${most_rep_aug} at ${ns.nFormat(aug_map[most_rep_aug]["repreq"], '0.000a')}`);
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
	let factions_to_consider = factionList.concat(locationFactionList, gangList, endgameFactionList, corpList);
	let my_augs = ns.getOwnedAugmentations();
	for (const faction of factions_to_consider) {
		let avail_augs = ns.getAugmentationsFromFaction(faction);
		for (const aug of avail_augs) {
			// ns.tprint(`Considering ${aug} from ${faction}`)
			// Get basic aug data
			aug_map[aug] = getAugData(ns, aug);
			// Add to the list of factions already found for a given aug
			let augs_factions = [];
			if (aug in aug_map) augs_factions = aug_map[aug]["factions"]
			augs_factions.push(faction);
			aug_map[aug]["factions"] = augs_factions;
			// Check if I own any of them
			aug_map[aug]["owned"] = my_augs.includes(aug);
		}
	}
	await ns.write("augmap.json", JSON.stringify(aug_map, null, 2), 'w');
	return aug_map;
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
		"factions": [],
		"owned": false,
	}
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
 * Get a list of names of exp-enhancing augs
 * @param {object} aug_map Map of augs as generated by readAugMap
 * @param {boolean} owned True to include augs I own, false to exclude them
 * @returns List of aug names to purchase
 */
function listExpAugs(aug_map, owned=false) {
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
function listFactionAugs(aug_map, owned=false) {
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
function listHackingAugs(aug_map, owned=false) {
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
 * TODO: FINISH THIS
 * @param aug_map Map of augs from readAugMap()
 * @param {array} desired_augs List of strings to buy
 * @param {boolean} should_prompt True if we should prompt to buy
 * @param {boolean} should_autobuy True if we should just autobuy without prompting
 * @returns Same list of aug names sorted by rep, then by cost
 */
async function promptForAugs(ns, aug_map, desired_augs, should_prompt, should_autobuy) {
	for (const aug of Object.keys(desired_augs)) {
		await purchaseAug(ns, aug, aug_map, should_prompt, should_autobuy);
	}
}


// EVERYTHING BELOW THIS SUCKS
/**
 * Build a list of preferred augs
 * @param {NS} ns
 * @param {array} factions_to_consider A list of factions to search through 
 * @param {array} types_to_consider A list of types to search through 
 * @returns List of args to buy (list of strings)
 */
export async function listSomePreferredAugs(ns, aug_map, types_to_consider, exp = false) {
	// Ultimately, we want all augs to buy, regardless of rep/cost
	// The list should be ordered so:
	// 1. Exp+ augs sorted by rep, then cost
	// 2. All type-based augs sorted by rep, then cost
	// So first, determine exp augs, sorted by rep, then cost; 
	// Build the map of possible augs
	// Map the shorthand type arguments to actual aug stats we want
	let aug_stat_types = getStatsFromTypes(types_to_consider.flat());
	// Now let's take a look at the rep requirements, and costs...
	let desired_augs = filterAugsByStats(ns, aug_map, aug_stat_types);
	if (exp) {
		// Narrow it down to +exp first...
		desired_augs = filterByExp(desired_augs);
	}
	// Then determine type augs, by rep, then cost
	let sorted_desired_augs = sortAugsByRepThenCost(desired_augs);
	return sorted_desired_augs;
}

/** 
 * Return a list of aug names filtered by stats
 * @param {NS} ns
 * @param {map} aug_map Map of augmentations generated by buildAugMap()
 * @param {array} desired_stats A list of stats to search for 
 */
function filterAugsByStats(ns, aug_map, desired_stats) {
	let desired_augs = {};
	// Brute force it:
	for (let [aug, model] of Object.entries(aug_map)) {
		/**
		 * Basic filtering code:
		 * desired_stats = ["hacking_exp_mult", "hacking_money_mult"]
		 * Object.keys(item["stats"]) = ["hacking_mult", "hacking_exp_mult", "hacking_speed_mult"]
		 * let matches = desired_stats.filter( items => actual_stats.includes(items) );
		 */
		// Look for matching stats
		if (desired_stats.some(item => Object.keys(model["stats"]).includes(item))) {
			desired_augs[aug] = model;
			// ns.tprint(`${aug} from [${model["factions"].join(", ")}]: ${matching_stats.join(", ")}`);
		}
	}
	return desired_augs;
}

/**
 * Return a dictionary of augs containing +exp bonuses
 * @param aug_map Object of augmentations
 */
function filterByExp(aug_map) {
	// Prioritize exp gain first
	let exp_augs = {};
	for (const [aug, aug_model] of Object.entries(aug_map)) {
		for (const stat of Object.keys(aug_model["stats"])) {
			if (stat.includes("exp")) {
				exp_augs[aug] = aug_model
			}
		}
	}
	return exp_augs
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


// function printCheckbox(condition, label) {
//   return `[${!!condition ? 'x' : ' '}] ${label}`
// }