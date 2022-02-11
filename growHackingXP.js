// Hack XP grow script (c) 2022 Tyrope
// https://github.com/tyrope/bitburner/blob/master/growXP.js
// usage: run growXP.js

/** @param {NS} ns **/
export async function main(ns) {
    // Infinite loop, go!
    while (true) {
        while (ns.getServerSecurityLevel('joesguns') > ns.getServerMinSecurityLevel('joesguns')) {
            await ns.weaken('joesguns');
        }
        await ns.grow('joesguns');
    }
}