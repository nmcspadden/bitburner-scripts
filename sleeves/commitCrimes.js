/* 
This is meant to be run by the sleevesEarly.js orchestrator.
Takes: Sleeve Index, crime to commit.
Does: Starts committing a crime.
*/

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    // If we don't have all args, bail
    if ((ns.args < 2) || !Number.isInteger(ns.args[0])) return
    ns.sleeve.setToCommitCrime(ns.args[0], ns.args[1]);
}