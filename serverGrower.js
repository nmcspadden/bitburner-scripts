// Originally based on:
// Server Grower (c) 2022 Tyrope
// https://github.com/tyrope/bitburner/blob/master/serverGrower.js
// Usage: run serverGrower.js [target]
// parameter target: The server to grow (default: current server)
// This can run on home against a target, or on a server against itself

export const SERVER_GROWN_FILE = "server_fully_grown.txt";

/** @param {NS} ns **/
export async function main(ns) {
    let tgt = ns.getHostname();
    if (ns.args[0]) tgt = ns.args[0]
    // Infinite loop, go!
    while (true) {
        // Make sure we're not fighting unneeded security.
        while (ns.getServerSecurityLevel(tgt) > ns.getServerMinSecurityLevel(tgt)) {
            await ns.weaken(tgt);
        }
        if (ns.getServerMoneyAvailable(tgt) < ns.getServerMaxMoney(tgt)) {
            await ns.grow(tgt);
        } else {
            // Write a record to disk
            await ns.write(SERVER_GROWN_FILE, "All done!", 'w');
            break;
        }
    }
}