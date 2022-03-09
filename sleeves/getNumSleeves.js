/* 
This is meant to be run by the sleevesEarly.js orchestrator.
It writes the number of sleeves to disk.
*/

import { FILE_NUM_SLEEVES } from "sleevesEarly.js";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    let num = ns.sleeve.getNumSleeves();
    await ns.write(FILE_NUM_SLEEVES, num, "w");
}