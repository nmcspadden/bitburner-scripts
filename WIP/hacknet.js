// From https://github.com/InfinityBMX/bitburner-scripts/blob/master/hacknet-manager.js

import { findOptimal } from "utils/networkmap.js";

const HACKNET_PURCHASE_RATIO = 0.1;
const HACKNET_UPGRADE_RATIO = 0.2;
const HACKNET_CACHE_RATIO = 0.01;

const CACHE_CAP = 2048;

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    const maxNodes = ns.hacknet.maxNumNodes();
    const flagdata = ns.flags([
        ["focus", "money"],
        ["noupgrade", false],
    ]);
    while (true) {
        const cash = ns.getServerMoneyAvailable('home');
        let purchaseBudget = cash * HACKNET_PURCHASE_RATIO;
        let upgradeBudget = cash * HACKNET_UPGRADE_RATIO;
        let cacheBudget = cash * HACKNET_CACHE_RATIO;
        if (!flagdata.noupgrade) {
            if (ns.hacknet.numNodes() < maxNodes && ns.hacknet.getPurchaseNodeCost() < purchaseBudget) {
                ns.hacknet.purchaseNode();
            }

            let cheapestUpgrade = findCheapestUpgrade(ns);
            switch (cheapestUpgrade.type) {
                case 'cores':
                    if (ns.hacknet.getCoreUpgradeCost(cheapestUpgrade.server, 1) < upgradeBudget)
                        ns.hacknet.upgradeCore(cheapestUpgrade.server, 1);
                    break;
                case 'level':
                    if (ns.hacknet.getLevelUpgradeCost(cheapestUpgrade.server, 1) < upgradeBudget)
                        ns.hacknet.upgradeLevel(cheapestUpgrade.server, 1);
                    break;
                case 'ram':
                    if (ns.hacknet.getRamUpgradeCost(cheapestUpgrade.server, 1) < upgradeBudget)
                        ns.hacknet.upgradeRam(cheapestUpgrade.server, 1);
                    break;
                default:
                    ns.tprint('Hacknet Upgrade failed to find a cheapest option');
            }

            let cache_cap_adjusted = CACHE_CAP;
            // Don't keep upgrading cache when generating money, because it never increases in price
            if (flagdata.focus != "money") cache_cap_adjusted = 1e12;
            let bestCache = findBestCacheUpgrade(ns, cacheBudget);
            if ((ns.hacknet.hashCapacity() < cache_cap_adjusted) && (bestCache >= 0)) // -1 for no upgrade
                ns.hacknet.upgradeCache(bestCache, 1);
        }
        switch (flagdata.focus) {
            case 'research':
                if (ns.getPlayer().hasCorporation) ns.hacknet.spendHashes('Exchange for Corporation Research')
                break;
            case 'corp':
                if (ns.getPlayer().hasCorporation) ns.hacknet.spendHashes('Sell for Corporation Funds')
                break;
            case 'hack':
                let server = await findOptimal(ns);
                ns.print("Optimal server: " + server);
                ns.hacknet.spendHashes("Reduce Minimum Security", server);
                ns.hacknet.spendHashes("Increase Maximum Money", server);
                break;
            case 'money':
            default:
                while (ns.hacknet.numHashes() > ns.hacknet.hashCost('Sell for Money'))
                    ns.hacknet.spendHashes('Sell for Money');
        }
        await ns.sleep(1000);
    }
}

/** @param {NS} ns **/
const findCheapestUpgrade = (ns) => {
    let lowestUpgrades = {};
    let lowestServers = { cores: 0, level: 0, ram: 0 };
    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
        let stats = ns.hacknet.getNodeStats(i);
        for (const upgrade of ['cores', 'level', 'ram']) {
            if (!lowestUpgrades[upgrade] || (lowestUpgrades[upgrade] && stats[upgrade] < lowestUpgrades[upgrade])) {
                lowestUpgrades[upgrade] = stats[upgrade];
                lowestServers[upgrade] = i;
            }
        }
    }
    let coreCost = ns.hacknet.getCoreUpgradeCost(lowestServers.cores, 1);
    let levelCost = ns.hacknet.getLevelUpgradeCost(lowestServers.level, 1);
    let ramCost = ns.hacknet.getRamUpgradeCost(lowestServers.ram, 1);
    if (coreCost < levelCost && coreCost < ramCost)
        return { type: 'cores', server: lowestServers.cores };
    else if (levelCost <= coreCost && levelCost <= ramCost)
        return { type: 'level', server: lowestServers.level };
    return { type: 'ram', server: lowestServers.ram };
}

/** 
 * @param {NS} ns 
 * @param {number} budget Amount we can spend on cache
 * **/
const findBestCacheUpgrade = (ns, budget) => {
    let cachePrices = [...Array(ns.hacknet.numNodes()).keys()]
        .filter(i => ns.hacknet.getCacheUpgradeCost(i, 1) <= budget)
        .sort((x, y) => ns.hacknet.getCacheUpgradeCost(y, 1) - ns.hacknet.getCacheUpgradeCost(x, 1));
    return cachePrices.length > 0 ? cachePrices[0] : -1;
}