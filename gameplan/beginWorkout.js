/* 
This is meant to be run by the startinggameplan.js orchestrator.
Takes: Desired level.
Does: Starts working out at a gym.
*/

import { workoutAll } from "utils/crimes";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    if ((ns.args < 1) || !Number.isInteger(ns.args[0])) return
    await workoutAll(ns, ns.args[0])
}