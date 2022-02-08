// Server Grower (c) 2022 Tyrope
// https://github.com/tyrope/bitburner/blob/master/serverGrower.js
// Usage: run serverGrower.js [target]
// parameter target: The server to grow.

/** @param {NS} ns **/
export async function main(ns) {
    const tgt = ns.getHostname();
    // Infinite loop, go!
    while (true) {
        // Make sure we're not fighting unneeded security.
        while (ns.getServerSecurityLevel(tgt) > ns.getServerMinSecurityLevel(tgt)) {
            await ns.weaken(tgt);
        }
        if (ns.getServerMoneyAvailable(tgt) < ns.getServerMaxMoney(tgt)) {
            await ns.grow(tgt);
        } else {
            break;
        }
    }
}