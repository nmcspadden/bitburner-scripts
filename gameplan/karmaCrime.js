/* 
This is meant to be run by the startinggameplan.js orchestrator.
Takes: 
Does: Commits a crime based on current karma level.
*/

import { commitKarmaFocusedCrime } from "utils/crimes";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    await ns.sleep(commitKarmaFocusedCrime(ns));
}