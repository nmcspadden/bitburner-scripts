/* 
This is meant to be run by the sleevesEarly.js orchestrator.
Takes: Sleeve Index.
Does: Starts recovering from shock.
*/

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    // If we don't have all args, bail
    if ((ns.args < 1) || !Number.isInteger(ns.args[0])) return
    ns.sleeve.setToShockRecovery(ns.args[0]);
}