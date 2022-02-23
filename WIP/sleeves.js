/** @param {import("../.").NS} ns **/
export async function main(ns) {
    let augs = getUsefulAugs(ns);
    for (const aug of augs) {
        let money = ns.getServerMoneyAvailable("home");
        ns.tprint("Aug: " + aug.name + " Cost: " + aug.cost);
        if (money > aug["cost"]) {
            ns.tprint(`Buying ${aug["name"]} for ${aug["cost"]}`);
            let did_buy = ns.sleeve.purchaseSleeveAug(0, aug["name"]);
        }
    }
}

/**
 * Get augs that sleeves will care about
 * @param {import("../.").NS} ns 
 */
function getUsefulAugs(ns) {
    let numsleeves = ns.sleeve.getNumSleeves();
    if (numsleeves == 0) return
    ns.tprint("Getting all sleeve augs");
    let augs_to_buy = ns.sleeve.getSleevePurchasableAugs(0);
    // There are some augs that are just useless on sleeves, like Red Pill and hacknet augs
    ns.tprint("Total aug length: " + augs_to_buy.length);
    ns.tprint(augs_to_buy);
    ns.tprint("Sorting sleeves");
    let sorted_augs = augs_to_buy.
        filter(aug => !(
            aug["name"].includes("Hacknet") ||
            aug["name"].includes("Pill") ||
            aug["name"].includes("Neuroreceptor Management") ||
            aug["name"].includes("CashRoot"))
        ).
        sort(
            (a, b) => a["cost"] - b["cost"]
        ).reverse();
    ns.tprint(sorted_augs);
    ns.tprint("Total aug length: " + sorted_augs.length);
    return sorted_augs
}