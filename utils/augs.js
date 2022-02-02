/** 
 * Find my factions that sell a given augmentation, sorted by rep (descending)
 * @param {NS} ns 
 * @param {string} aug An aug to search for
**/
export function findMyFactionsWithAug(ns, aug, player) {
	return player.factions.filter(
		faction => ns.getAugmentationsFromFaction(faction).includes(aug)
	).sort((repA, repB) => ns.getFactionRep(repA) - ns.getFactionRep(repB)).reverse();
}