/* 
This is meant to be run by the startinggameplan.js orchestrator.
Takes: 
Does: Soft resets and re-runs starter.js.
*/

import { commitKarmaFocusedCrime } from "utils/crimes";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    ns.softReset('starter.js');
}