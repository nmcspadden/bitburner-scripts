// Server Grader (c) 2022 Tyrope
// https://github.com/tyrope/bitburner/blob/master/gradeServers.js
// Usage: run serverGrader.js (percent) (topOnly)
// Parameter percent: The % of maxMoney the batch will be stealing. (default: 20)
// Parameter topOnly: If given a number, will limit the amount of servers to only the top n. (default: Infinity)

import { squishLines, makeTable } from 'WIP/tablemaker.js'
import { getBatchInfo } from 'WIP/hyperbatcher.js'
import { readNetworkMap } from "utils/networkmap.js";

export const SERVERGRADES = 'servergrades.json';

/** @param {NS} ns **/
export async function main(ns) {
    // Fail if no Formulas.exe
    if (ns.ls('home', 'Formulas.exe').length == 0) {
        ns.tprint("You need Formulas.exe to use this script.");
        ns.exit();
    }
    ns.disableLog('ALL');
    ns.tail();

    const pct = ns.args[0] ? ns.args[0] : 20;
    const topOnly = ns.args[1] ? ns.args[1] + 1 : Infinity;

    // Get all the servers.
    let servers = Object.keys(await readNetworkMap(ns));

    // Only keep servers that...
    servers = servers.filter((s) => {
        return (
            // have money.
            ns.getServerMaxMoney(s) != 0 &&
            // are below or equal to our hacking level.
            ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
        )
    });

    // Sort by score.
    servers.sort((a, b) => { return getServerScore(ns, b, pct) - getServerScore(ns, a, pct); });

    let data = [["SERVER", "Max $", "%h", "$/s", "RAM", "batchtime", "Score"]];

    for (let server of servers) {
        if (data.length >= topOnly) {
            break;
        }
        data.push(getServerInfo(ns, server, pct));
    }
	await ns.write(SERVERGRADES, JSON.stringify(data, null, 2), 'w');
    ns.print(makeTable(data, false));
    await ns.sleep(10);
    squishLines(ns.getScriptName() + " " + ns.args.join(" "));
}

/** Calculate the score of 1 server.
 * @param {NS} ns
 * @param {String} server       Server to score.
 * @param {Number} pct          Percentage of maxMoney to hack.
 * @return {Number} The server's score.
**/
export function findOptimalServer(ns) {
    // Fail if no Formulas.exe
    if (ns.ls('home', 'Formulas.exe').length == 0) {
        ns.tprint("You need Formulas.exe to use this script.");
        ns.exit();
    }
}


/** Calculate the score of 1 server.
 * @param {NS} ns
 * @param {String} server       Server to score.
 * @param {Number} pct          Percentage of maxMoney to hack.
 * @return {Number} The server's score.
**/
export function getServerScore(ns, server, pct) {
    let chanceToHack;
    const srv = ns.getServer(server);
    srv.hackDifficulty = srv.minDifficulty;
    srv.moneyAvailable = srv.moneyMax;
    chanceToHack = ns.formulas.hacking.hackChance(srv, ns.getPlayer());
    let batchInfo = getBatchInfo(ns, server, pct);
    let moneyPerSec = batchInfo[2] / batchInfo[1];
    return (moneyPerSec * chanceToHack) / (batchInfo[0] * 0.25);
}

/** Get all the data of 1 server.
 * @param {NS} ns
 * @param {String} srv          Server to score.
 * @param {Number} pct          Percentage of maxMoney to hack.
 * @return {Object[]} The server's information.
**/
function getServerInfo(ns, srv, pct) {
    let batchInfo = getBatchInfo(ns, srv, pct);
    let chanceToHack = ns.formulas.hacking.hackChance(ns.getServer(srv), ns.getPlayer());
    return ([
        srv,
        ns.nFormat(ns.getServerMaxMoney(srv), "0.00a"), // "Max $"
        `${ns.nFormat(chanceToHack * 100, "0.00")}%`, // "%h"
        ns.nFormat(batchInfo[2] / batchInfo[1], "0.00a"), //"$/s"
        ns.nFormat(batchInfo[0] * 1e9, "0.00b"), //"RAM/b"
        timeFormat(ns, batchInfo[1], true), //"tB"
        ns.nFormat(getServerScore(ns, srv, pct), "0.000") //"Score"
    ]);
}

/**Format a given number in ms to a human-readable string, except shorter.
 * @param {NS} ns
 * @param {Number} time
 * @param {Boolean} msAcc
 * @return {String} a shortened ns.tFormat();
 */
export function timeFormat(ns, time, msAcc) {
    return ns.tFormat(time, msAcc)
        .replaceAll("days", "d")
        .replaceAll("hours", "h")
        .replaceAll("minutes", "m")
        .replaceAll("seconds", "s")

        .replaceAll("day", "d")
        .replaceAll("hour", "h")
        .replaceAll("minute", "m")
        .replaceAll("second", "s")

        .replaceAll(",", "")
        .replaceAll(" ", "");
}