/**
 * Buys Neuroflux Governor for you.
 * If you have access, and enough money, it will:
 * -Look for the faction with closest level of rep to the requirement
 * -If you're under, work for that faction (hacking contracts) until you meet the requirement
 * -Prompt you to buy NF until you can't afford it anymore
 * -Saying no to the prompt ends the script
 * 
 * --auto skips the prompt and will keep buying
 * --simulate will not actually purchase, but simulate the money costs. Can be used with --auto
 * --nowork will skip the work step if you don't have sufficient rep
 */

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
	let my_factions_w_nf = player.factions.filter(
		faction => ns.getAugmentationsFromFaction(faction).includes(NF)
	).sort((repA, repB) => ns.getFactionRep(repA) - ns.getFactionRep(repB)).reverse();
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
	// While there are factions who sell NF and I don't want to stop buying:
	while (money >= price) {
		// While our rep is less than the requirement (and not simulating), start working for that faction
		while ((ns.getFactionRep(closest_faction) < ns.getAugmentationRepReq(NF)) && !flagdata.simulate && !flagdata.nowork) {
			// This intentionally stops working after a time and re-starts to update the rep
			started_working = ns.workForFaction(closest_faction, "Hacking Contracts");
			await ns.sleep(30000);
		}
		// We have enough rep to buy now, stop working
		if (started_working) {
			ns.stopAction();
			started_working = false;
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
				didBuy = ns.purchaseAugmentation(buyable_factions_now, NF);
				money = ns.getPlayer().money;
				price = ns.getAugmentationPrice(NF);
			} else {
				// If simulating, raise the price
				didBuy = true;
				money -= price;
				price = Math.pow(price, 1.14);
			}

			if (didBuy) ns.tprint(`Bought from ${closest_faction} for ${ns.nFormat(price, '$0.00a')}`)
		} else {
			ns.exit();
		}
	}
	ns.tprint(`You're out of money, need ${ns.nFormat(ns.getAugmentationPrice(NF), '$0.00a')}`);
}

/** 
 * Determine the faction whose rep is closest to the next rep requirement. 
 * @param {NS} ns 
 * @param avail_factions Factions I belong to that sell NF 
**/
function getClosestNFFaction(ns, avail_factions) {
	let sorted_fax = avail_factions.sort((a, b) => (ns.getAugmentationRepReq(NF) - ns.getFactionRep(a)) < (ns.getAugmentationRepReq(NF) - ns.getFactionRep(b)))
	// ns.tprint(sorted_fax);
	return sorted_fax[0]
}