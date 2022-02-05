import { findMyFactionsWithAug } from "utils/augs.js";


const NF = "NeuroFlux Governor";

/** @param {NS} ns **/
export async function main(ns) {
	const flagdata = ns.flags([
		["auto", false],
		["simulate", false],
		["nowork", false],
		["help", false]
	])
	if (flagdata.help) {
		ns.tprint("--auto to automatically buy until you can't; --simulate to simulate but not actually spend resources; --nowork to not work for a faction when out of rep");
		return
	}
	// Is the NF available to me right now?
	let player = ns.getPlayer();
	ns.tprint("Current money: " + player.money);
	// my_factions_w_nf is a list of factions selling NF sorted descending by highest rep
	let my_factions_w_nf = findMyFactionsWithAug(ns, NF, player);
	if (my_factions_w_nf.length == 0) {
		ns.tprint("You don't currently belong to any factions that sell the NeuroFlux Governor.");
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
	ns.tprint(`Current NF rep req: ${ns.getAugmentationRepReq(NF)}`)
	ns.tprint(`Closest faction is ${closest_faction} with rep ${ns.getFactionRep(closest_faction)}`);
	let started_working = false;
	let shouldBuy = flagdata.auto;
	let didBuy = false;
	let money = ns.getPlayer().money;
	let price = ns.getAugmentationPrice(NF);
	let bought_price;
	// While there are factions who sell NF and I don't want to stop buying:
	while (money >= price) {
		// While our rep is less than the requirement (and not simulating), start working for that faction
		while ((ns.getFactionRep(closest_faction) < ns.getAugmentationRepReq(NF)) && !flagdata.simulate && !flagdata.nowork) {
			// This intentionally stops working after a time and re-starts to update the rep
			started_working = ns.workForFaction(closest_faction, "Hacking Contracts");
			await ns.sleep(30000);
		}
		if (started_working) {
			ns.stopAction();
			started_working = false;
		}
		// Do we have enough rep to buy now? If not, we probably said nowork
		if (ns.getFactionRep(closest_faction) < ns.getAugmentationRepReq(NF)) {
			ns.tprint("Not enough rep to buy more.");
			ns.exit();
		}
		// Buy while we have enough money
		// If 'auto' mode set, do not prompt
		if (!flagdata.auto) {
			shouldBuy = await ns.prompt(`Buy from ${closest_faction} for ${ns.nFormat(price, '$0.00a')}`);
		}
		// If prompted yes, or 'auto' is set, proceed
		if (shouldBuy) {
			// If not simulating, do the purchase and re-evaluate our metrics
			if (!flagdata.simulate) {
				bought_price = price;
				didBuy = ns.purchaseAugmentation(closest_faction, NF);
				money = ns.getPlayer().money;
				price = ns.getAugmentationPrice(NF);
			} else {
				// If simulating, raise the price
				bought_price = price;
				didBuy = true;
				money -= price;
				price = Math.pow(price, 1.14);
			}

			if (didBuy) ns.tprint(`Bought from ${closest_faction} for ${ns.nFormat(bought_price, '$0.00a')}`)
		} else {
			ns.exit();
		}
	}
	ns.tprint(`You're out of money, need ${ns.nFormat(price, '$0.00a')}`);
}

/** 
 * Determine the faction whose rep is closest to the next rep requirement. 
 * @param {NS} ns 
 * @param avail_factions Factions I belong to that sell NF 
**/
function getClosestNFFaction(ns, avail_factions) {
	let rep_sorted_fax = avail_factions.sort((a, b) => ns.getFactionRep(a) - ns.getFactionRep(b));
	let sorted_fax = rep_sorted_fax.sort((a, b) => (ns.getAugmentationRepReq(NF) - ns.getFactionRep(a)) < (ns.getAugmentationRepReq(NF) - ns.getFactionRep(b)))
	return sorted_fax[0]
}

/** 
 * Find factions that sell a given augmentation, sorted by rep (descending)
 * @param {NS} ns 
 * @param {string} aug An aug to search for
**/
function findFactionsWithAug(ns, aug, player) {
	return player.factions.filter(
		faction => ns.getAugmentationsFromFaction(faction).includes(aug)
	).sort((repA, repB) => ns.getFactionRep(repA) - ns.getFactionRep(repB)).reverse();
}