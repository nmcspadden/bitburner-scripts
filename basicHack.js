// Target Hack (c)2022 Tyrope
// usage: run targetHack.js [target]
// This is intended to run _on_ a target server, where it will hack itself

export function autocomplete(data, args) {
    return [...data.servers];
}

/** @param {NS} ns **/
export async function main(ns) {
    let tgt = ns.getHostname();
    if (ns.args[0]) tgt = ns.args[0]
    ns.disableLog('getServerSecurityLevel');
    ns.disableLog('getServerMaxMoney');

    // Infinite loop, go!
    while (true) {
        // Make sure we're not fighting unneeded security.
        while (ns.getServerSecurityLevel(tgt) > ns.getServerMinSecurityLevel(tgt)) {
            await ns.weaken(tgt);
        }

        // Make sure the server has max money available.
        if (ns.getServerMoneyAvailable(tgt) < ns.getServerMaxMoney(tgt)) {
            await ns.grow(tgt);
            continue;
        }
        await ns.hack(tgt);
    }
}