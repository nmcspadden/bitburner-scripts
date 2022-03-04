/* 
This is meant to be run by the sleeves.js orchestrator.
Takes: Sleeve Index, Gym, Stat to train.
Does: Start training that stat at gym.
*/

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    // If we don't have all args, bail
    if ((ns.args < 3) || !Number.isInteger(ns.args[0])) return
    ns.sleeve.setToGymWorkout(ns.args[0], ns.args[1], ns.args[2]);
}