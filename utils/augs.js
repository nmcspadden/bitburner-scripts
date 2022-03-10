export const AUGMAP = "augmap.json";
export const NF = "NeuroFlux Governor";

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
	charisma: ["charisma_exp_mult", "charisma_mult"],
    bladeburners: ["bladeburner_success_chance_mult", "bladeburner_max_stamina_mult", "bladeburner_stamina_gain_mult", "bladeburner_analysis_mult"],
	hacknet: ["hacknet_node_money_mult", "hacknet_node_purchase_cost_mult", "hacknet_node_ram_cost_mult", "hacknet_node_core_cost_mult", "hacknet_node_level_cost_mult"]
};

/** 
 * Find my factions that sell a given augmentation, sorted by rep (descending)
 * @param {import("../.").NS} ns 
 * @param {string} aug An aug to search for
**/
export function findMyFactionsWithAug(ns, aug, player) {
	return player.factions.filter(
		faction => ns.getAugmentationsFromFaction(faction).includes(aug)
	).sort((repA, repB) => ns.getFactionRep(repA) - ns.getFactionRep(repB)).reverse();
}

/**
 * Build up a map of augmentations available everywhere for future slicing
 * @param {import("../.").NS} ns 
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
	 * "pending": false,
	*/
	let factions_to_consider = factionList.concat(locationFactionList, gangList, endgameFactionList, corpList, bladeburners);
	// ns.tprint(`Factions to consider: ${factions_to_consider}`);
	let all_my_augs = ns.getOwnedAugmentations(true);
	let my_augs = ns.getOwnedAugmentations();
	let pending_augs = all_my_augs.filter(aug => !my_augs.includes(aug));
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
			aug_map[aug]["pending"] = pending_augs.includes(aug);
		}
	}
	await ns.write(AUGMAP, JSON.stringify(aug_map, null, 2), 'w');
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
	}
}

/**
 * Return an Object of the aug map from JSON
 * @param {NS} ns
 * @returns Object of the aug map
 */
 export async function readAugMap(ns) {
	if (!ns.ls('home', AUGMAP+".txt")) {
		await buildAugMap(ns);
	}
	return JSON.parse(ns.read(AUGMAP+".txt"));
}

/**
 * Sort augs by rep req, then cost
 * @param aug_list List of aug names to sort
 * @param aug_map Map of augs from readAugMap()
 * @returns Same list of aug names sorted by rep, then by cost
 */
 export function sortAugsByRepThenCost(aug_list, aug_map) {
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
 * Determine the faction whose rep is closest to the next rep requirement. 
 * @param {import(".").NS} ns
 * @param avail_factions Factions I belong to that sell NF 
**/
export function getClosestNFFaction(ns) {
	let rep_sorted_fax = ns.getPlayer().factions.filter(fct => ns.getAugmentationsFromFaction(fct).includes(NF)).sort((a, b) => ns.getFactionRep(a) - ns.getFactionRep(b)).reverse();
	let sorted_fax = rep_sorted_fax.sort((a, b) => (ns.getAugmentationRepReq(NF) - ns.getFactionRep(a)) < (ns.getAugmentationRepReq(NF) - ns.getFactionRep(b)))
	return sorted_fax[0]
}