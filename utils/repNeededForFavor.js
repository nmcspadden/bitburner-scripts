/*
usage: run repNeededForFavor.js Faction
    returns how much reputation you need in total with a faction or company to reach 150 favor.

formula adapted from Faction.js/getFavorGain(), Company.js/getFavorGain() and Constants.js:
    https://github.com/danielyxie/bitburner/blob/master/src/Faction.js
    
    Originally inspired by:
     also available as netscript 1.0 script (running in Firefox)
     https://github.com/sschmidTU/BitBurnerScripts/
     @author sschmidTU
*/

const FAVOR_TO_DONATE = 150;

function repNeededForFavor(targetFavor) {

    let favorGain = 0;
    let rep = 0;

    let ReputationToFavorBase = 500;
    let ReputationToFavorMult = 1.02;

    let reqdRep = ReputationToFavorBase;
    while (favorGain < targetFavor) {
        rep += reqdRep;
        ++favorGain;
        reqdRep *= ReputationToFavorMult;
    }

    return rep;
}

/**
 * Run standalone
 * @param {NS} ns 
**/
export async function main(ns) {
    // let faction = ns.args[0];
    // ns.tprint('You need ' + calculateRepNeededForFavor(ns, faction).toLocaleString() + ' total reputation with faction ' + faction
    //     + ' to get to 150 favor.');
    let repreq = ns.args[0];
    ns.tprint(donationAmountForRep(ns, 'Daedalus', 2500000));
}

/**
 * Return the rep needed for 150 favor for a given faction
 * @param {NS} ns 
 * @param {string} faction The faction you want 150 favor in 
**/
export function calculateRepNeededForFavor(ns, faction) {
    let startingFavor = ns.getFactionFavor(faction);
    if (startingFavor >= 150) {
        ns.tprint("Current favor is already " + startingFavor);
        return 0
    }
    const repToFavour = (rep) => Math.ceil(25500 * 1.02 ** (rep - 1) - 25000);
    return Math.max(0, repNeededForFavor(FAVOR_TO_DONATE) - repToFavour(startingFavor));
}

/**
 * Work for a faction until you have enough rep to get 150 favor
 * @param {NS} ns 
 * @param {string} faction The faction you want 150 favor in 
 * @param {boolean} donate If True, do the donation at the end
**/
export async function workUntilDonate(ns, faction) {
    let started_working = false;
    // If we're already at 150, we're done
    if (ns.getFactionFavor(faction) >= FAVOR_TO_DONATE) return
    let rep_needed = calculateRepNeededForFavor(ns, faction)
    while (ns.getFactionRep(faction) < rep_needed) {
        //TODO: Calculate how long this will take
        // This intentionally stops working after a time and re-starts to update the rep
        started_working = ns.workForFaction(faction, "Hacking Contracts");
        await ns.sleep(60000);
    }
    // We have enough rep to buy now, stop working
    if (started_working) {
        ns.stopAction();
        started_working = false;
    }
}

/**
 * Return the amount of money needed to donate to hit a specific rep amount
 * @param {NS} ns 
 * @param {string} faction Name of faction to calculate 
 * @param {number} repreq Amount of rep we want to reach 
 */
export function donationAmountForRep(ns, faction, repreq) {
    // Assuming we already have 150 favor for donation
    let current_rep = ns.getFactionRep(faction);
    let faction_rep_mult = ns.getPlayer().faction_rep_mult;
    return Math.ceil(1e6 * (Math.max(0, repreq - current_rep) / faction_rep_mult));
}

/**
 * Return the amount of money needed to bribe (from a corp) to hit a specific rep amount
 * @param {NS} ns 
 * @param {string} faction Name of faction to calculate 
 * @param {number} repreq Amount of rep we want to reach 
 */
 export function calculateBribeNeededForRep(ns, faction, repreq) {
    let current_rep = ns.getFactionRep(faction);
    return Math.ceil(1e8 * (Math.max(0, repreq - current_rep)));
}