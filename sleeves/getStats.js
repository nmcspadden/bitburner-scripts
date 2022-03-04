/* 
This is meant to be run by the sleeves.js orchestrator.
It takes a sleeve index # as its only argument, and then writes the sleeve stats to disk.
*/

import { FILE_SLEEVE_STATS } from "WIP/sleeves.js";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    if (!Number.isInteger(ns.args[0])) return
    let stats = ns.sleeve.getSleeveStats(ns.args[0]);
    await ns.write(FILE_SLEEVE_STATS(ns.args[0]), JSON.stringify(stats, null, 2), "w");
}