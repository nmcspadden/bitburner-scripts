// Hyper Batcher (c) 2022 Tyrope
// https://github.com/tyrope/bitburner/blob/master/hyperBatcher.js
// Usage: run hyperBatcher.js [target] (source) (percentage) (affectStocks) (simulate)
// Parameter target: The server to take money from.
// Parameter source: The server to run the attack. (default: the server this runs on.)
// Parameter percentage: Percentage of maxMoney to steal. (Default: 0.2)
// Parameter affectStocks: "H","G", or "GH", to let grows and/or hacks affect stocks. (Default: "")
// Parameter simulate: If true, don't run scripts; print the expected results instead. (Default: false)

import { isProcessRunning, findMatchingProcess } from "utils/script_tools";

export function autocomplete(data, args) {
    return [...data.servers];
}

let scriptStart;

/** Calculate the amount of hack threads needed for a batch attack.
 * @param {NS} ns
 * @param {String} tgt          The hostname of the target server.
 * @param {Number} moneyPct     The percent of the target's maximum money we want to hack.
 * @param {Boolean} hasFormulas Whether or not the player has access to formulas.
 * @return {Number[]}           The amount of threads, hack duration, security increase, actual money hacked.
 */
function calcHack(ns, tgt, moneyPct, hasFormulas) {
    // Calculate the hack.
    let maxMoney = ns.getServerMaxMoney(tgt);
    while (moneyPct > 1) { moneyPct /= 100; }
    let threads;
    let timeToHack;
    let fractionStole;

    if (!hasFormulas) {
        // Base on current amounts.
        threads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(tgt, moneyPct)));
        timeToHack = ns.getHackTime(tgt);
        fractionStole = ns.hackAnalyze(tgt);
    } else {
        // Use formulas to be accurate.
        let srv = ns.getServer(tgt);
        srv.hackDifficulty = srv.minDifficulty;
        srv.moneyAvailable = srv.moneyMax;
        let p = ns.getPlayer();

        threads = Math.floor(moneyPct / ns.formulas.hacking.hackPercent(srv, p));
        timeToHack = ns.formulas.hacking.hackTime(srv, p);
        fractionStole = ns.formulas.hacking.hackPercent(srv, p);
    }
    return [
        threads,
        timeToHack,
        ns.hackAnalyzeSecurity(threads),
        fractionStole * threads * maxMoney
    ];
}

/** Calculate the amount of grow threads needed for a batch attack.
 * @param {NS} ns
 * @param {String} tgt          The hostname of the target server.
 * @param {Number} money        The amount of money we've stolen.
 * @param {Boolean} hasFormulas Whether or not the player has access to formulas.
 * @return {Number[]}           The amount of threads, grow duration, security increase.
 */
function calcGrow(ns, tgt, money, hasFormulas) {
    let max = ns.getServerMaxMoney(tgt);
    let regrow = max / (max - Math.max(money, 1));
    let threads;
    let timeToGrow;

    if (!hasFormulas) {
        threads = ns.growthAnalyze(tgt, regrow);
        timeToGrow = ns.getGrowTime(tgt);
    } else {
        let srv = ns.getServer(tgt);
        srv.hackDifficulty = srv.minDifficulty;
        srv.moneyAvailable = srv.moneyMax - money;
        let p = ns.getPlayer();
        threads = Math.ceil(Math.log(regrow) / Math.log(ns.formulas.hacking.growPercent(srv, 1, p)));
        timeToGrow = ns.formulas.hacking.growTime(srv, p);
    }

    return [
        threads,
        timeToGrow,
        ns.growthAnalyzeSecurity(threads)
    ];
}

/** Calculate the amount of weaken threads needed for a batch attack.
 * @param {NS} ns
 * @param {String} tgt          The hostname of the target server.
 * @param {Number} secIncrease  The amount of security we need to lower.
 * @param {Boolean} hasFormulas Whether or not the player has access to formulas.
 * @return {Number[]}           The amount of threads, weaken duration, security decrease.
 */
function calcWeaken(ns, tgt, secIncrease, hasFormulas) {
    // Calculate the weaken we need to counter hack.
    let secEffect = 0;
    let threads = Math.ceil(secIncrease / ns.weakenAnalyze(1));
    if (!hasFormulas) {
        return [threads, ns.getWeakenTime(tgt), secEffect];
    }
    let srv = ns.getServer(tgt);
    srv.hackDifficulty = srv.minDifficulty;
    srv.moneyAvailable = srv.moneyMax;
    let p = ns.getPlayer();

    return [threads, ns.formulas.hacking.weakenTime(srv, p), secEffect];
}

/** Calculate the maximum amount of batches we can run based on server RAM
 * @param  {String} runTimes The duration of all attacks (in ms); order: HWGW.
 * @param  {String} delay    The delay between end times (in ms).
 * @return {Number[]}        The start time of all attacks (in ms); order: HWGW.
 */
function calcDelays(runTimes, delay) {
    return [
        runTimes[1] - delay - runTimes[0],
        0,
        runTimes[1] + delay - runTimes[2],
        delay * 2
    ];
}

/** Calculates every batch we can feasibly start before the first hack lands.
 * @param {NS} ns
 * @param {Number} delay       the delay between landings.
 * @param {Number[4]} runTimes the runtime of each script.
 * @param {Number[4]} threads  the number of threads for each script.
 * @param {String} src         the hostname of the server launching the attack.
 */
function calcBatches(ns, delay, runTimes, threads, src) {
    // Calculate our delays.
    const delays = calcDelays(runTimes, delay);
    // We can run this many batches before the first hack lands.
    const firstHackLand = delays[0] + runTimes[0];
    // we can run this many batches before RAM runs out.
    let ramUse =
        ns.getScriptRam('/batch/hack.js', src) * threads[0] +
        ns.getScriptRam('/batch/grow.js', src) * threads[2] +
        ns.getScriptRam('/batch/weaken.js', src) * (threads[1] + threads[3]);
    // This will break if multiple batchers are running.
    let maxBatches = (ns.getServerMaxRam(src) - ns.getServerUsedRam(src)) / ramUse;

    // Get the start times.
    let execs = Array();
    let i = 0;
    while (maxBatches > i && firstHackLand > delays[1] + delay * (4 * i)) {
        execs.push([delays[0] + delay * (4 * i), 'H']);
        execs.push([delays[1] + delay * (4 * i), 'Wh']);
        execs.push([delays[2] + delay * (4 * i), 'G']);
        execs.push([delays[3] + delay * (4 * i), 'Wg']);
        i++;
    }
    return execs.sort((a, b) => a[0] - b[0]);
}

/** Run the batch hacks.
 * @param {NS} ns
 * @param {String} tgt          The server we're stealing money from.
 * @param {String} src          The server running the hacks.
 * @param {Number[4]} threads   The amount of threads of the script types.
 * @param {Array} execs         Array of [Number,String]; indicating delay and type of script.
 * @param {Number} profit       The expected money to get per hack.
 * @param {String} affectStocks A string containing "H" to have hacks influence stocks, "G" to have grow influence stocks.
 * @return {Promise<boolean>} True if we cancelled early, requiring recalculation before restarting.
**/
async function startBatching(ns, tgt, src, threads, execs, firstLand, profit, affectStocks) {
    const currLvl = ns.getHackingLevel;
    const startLvl = currLvl();
    const now = ns.getTimeSinceLastAug;
    const batchStart = now();

    ns.print(`INFO: Launching attack: ${src} -> ${tgt}.\nFirst hack will land at T+${timeFormat(ns, now() + firstLand - scriptStart)}\nTotal yield ${ns.nFormat(profit, "$0.00a")} over ${execs.length} scripts`);

    let script = ""; let t; let slept = 0;
    for (let x of execs) {
        if (currLvl() != startLvl) {
            ns.print(`WARNING: [T+${timeFormat(ns, now() - scriptStart, false)}]Hack level increased, aborting hack.`);
            return true;
        }
        // Check if an abort has been called by hack.js
        if (ns.fileExists(`ABORT_${tgt}.txt`, src)) {
            ns.rm(`ABORT_${tgt}.txt`, src);
            if (batchStart - now() <= 0) {
                ns.print(`ERROR: [T+${timeFormat(ns, now() - scriptStart, false)}]ABORT received from hack.js.`);
                return true;
            }
        }

        switch (x[1]) {
            case "H":
                script = "/batch/hack.js";
                t = threads[0];
                break;
            case "G":
                script = "/batch/grow.js";
                t = threads[2];
                break;
            case "Wh":
                script = "/batch/weaken.js";
                t = threads[1];
                break;
            case "Wg":
                script = "/batch/weaken.js";
                t = threads[3];
                break;
        }

        if (x[0] - slept < 0) {
            ns.print(`ERROR: [T+${timeFormat(ns, now() - scriptStart, false)}]Trying to sleep a negative amount. We've fallen behind!`);
            return true;
        }
        await ns.sleep(x[0] - slept);
        slept = x[0];

        // Ensure we're not bumping into RAM limitations
        if (ns.getServerMaxRam(src) - ns.getServerUsedRam(src) < ns.getScriptRam(script, src)) {
            ns.print(`ERROR: [T+${timeFormat(ns, now() - scriptStart, false)}]Aborting, out of RAM.`);
            return true;
        }
        ns.exec(script, src, t, tgt, profit, affectStocks.includes(x[1]), now());
    }
    return false;
}

/** Calculate the threads needed to hack tgt for pct% of maxMoney.
 * @param {NS} ns
 * @param  {String} tgt Server hostname to attack.
 * @param  {Number} pct Percentage of maxMoney we want to steal.
 * @param  {Boolean} hasFormulas Whether or not the player has access to formulas.
 * @return {Object[3]}  Threads required, Script runtimes, money hacked per batch.
 */
function calcThreads(ns, tgt, pct, hasFormulas) {
    let threads = Array(4), runTimes = Array(4); let sec; let profit;
    [threads[0], runTimes[0], sec, profit] = calcHack(ns, tgt, pct, hasFormulas);
    [threads[1], runTimes[1]] = calcWeaken(ns, tgt, sec, hasFormulas);
    [threads[2], runTimes[2], sec] = calcGrow(ns, tgt, profit, hasFormulas);
    [threads[3], runTimes[3]] = calcWeaken(ns, tgt, sec, hasFormulas);

    return [threads, runTimes, profit];
}

/** @param {NS} ns **/
export async function main(ns) {
    scriptStart = ns.getTimeSinceLastAug();
    ns.clearLog();
    ns.disableLog('ALL');
    //Parameter parsing.
    if (ns.args[0] == undefined) {
        ns.tprint("ERROR: Invalid target.");
        ns.tprint("INFO: Usage: target(string), source(string, optional), percent(number, optional), affectStocks(string, optional), simulate(boolean, optional).");
        ns.exit();
    }

    const tgt = ns.args[0];
    const src = ns.args[1] ? ns.args[1] : ns.getHostname();
    const pct = ns.args[2] ? ns.args[2] : 0.2;
    const affectStocks = ns.args[3] ? ns.args[3] : "";
    const sim = ns.args[4];

    // Constants.
    const delay = 100;
    const hasFormulas = ns.fileExists('Formulas.EXE', 'home');
    if (!hasFormulas) {
        if (
            ns.getServerMaxMoney(tgt) != ns.getServerMoneyAvailable(tgt) ||
            ns.getServerMinSecurityLevel(tgt) != ns.getServerSecurityLevel(tgt)
        ) {
            ns.tprint("ERROR: Targeting a non-prepped server without formulas.");
            ns.exit();
        }
        ns.tprint("WARN: Formulas not found.");
    }

    // Calculate the threads needed, runTimes and actual money hacked.
    let threads, runTimes, profit;
    [threads, runTimes, profit] = calcThreads(ns, tgt, pct, hasFormulas);

    // If we're only simulating, we just got enough info.
    if (sim) {
        let ram =
            ns.getScriptRam('/batch/hack.js') * threads[0] +
            ns.getScriptRam('/batch/grow.js') * threads[2] +
            ns.getScriptRam('/batch/weaken.js') * (threads[1] + threads[3]);
        let time = runTimes[3] + delay * 2;
        ns.tprint(`${src} -> ${tgt}, stealing \$${ns.nFormat(profit, "0.000a")} in ${ns.tFormat(time)} using ${ns.nFormat(ram * 1e9, "0.00b")} RAM`);
        ns.tprint(`Threads: hack(${threads[0]}), weaken(${threads[1]}), grow(${threads[2]}), weaken(${threads[3]});`);
        ns.exit();
    }

    if (ns.getServerMaxMoney(tgt) != ns.getServerMoneyAvailable(tgt) ||
        ns.getServerMinSecurityLevel(tgt) != ns.getServerSecurityLevel(tgt)) {
        ns.tprint(`ERROR: Server ${tgt} not prepared.`);
        ns.exit();
    }

    // ensure the src server has the latest hacking scripts.
    if (src != 'home') {
        for (let file of ['/batch/hack.js', '/batch/grow.js', '/batch/weaken.js']) {
            ns.print(`uploading ${file}`);
            await ns.scp(file, 'home', src);
        }
    }

    // Ensure there's no abort file lingering.
    if (ns.fileExists(`ABORT_${tgt}.txt`, src)) {
        ns.rm(`ABORT_${tgt}.txt`, src);
    }

    let recalc = false;
    while (true) {
        if (recalc) {
            if (ns.getHostname() == src) {
                ns.tprint(`FAIL: [${src}]Recalc is telling us to killall, but we're hacking from the dispatcher.`);
            }
            // ns.killall(src);
            killMyself(ns, src);
            [threads, runTimes, profit] = calcThreads(ns, tgt, pct);
            recalc = false;
        }
        let execs = calcBatches(ns, delay, runTimes, threads, src);
        let time = execs.filter(x => x[1] == "H")[0][0];
        recalc = await startBatching(ns, tgt, src, threads, execs, time + runTimes[0], profit, affectStocks);
        // If a batch fails, make sure we let it fully run out.
        await ns.sleep(runTimes[1] + delay * 2);
    }
}

/**Returns information about a percent% batch hack against tgt (Used in gradeServers.js)
 * @params {NS} ns
 * @params {String} tgt Target server
 * @params {number} percent decimal-represented money percentage
 * @return {number[]} [RAM Usage, Time in ms, hacked money.]
 */
export function getBatchInfo(ns, tgt, percent) {
    const hasFormulas = ns.fileExists('Formulas.EXE', 'home');
    let profit = calcHack(ns, tgt, percent, hasFormulas)[3];
    percent = profit / ns.getServerMaxMoney(tgt);
    let threads = calcThreads(ns, tgt, percent, hasFormulas)[0];
    let time = calcWeaken(ns, tgt, calcGrow(ns, tgt, profit, hasFormulas)[2], hasFormulas)[1] + 200;
    return ([
        ns.getScriptRam('/batch/hack.js', "home") * threads[0] +
        ns.getScriptRam('/batch/grow.js', "home") * threads[2] +
        ns.getScriptRam('/batch/weaken.js', "home") * (threads[1] + threads[3]),
        time,
        profit
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

/**
 * Kill all hyperbatcher-related scripts specifically
 * @param {import("../.").NS} ns 
 * @param {string} host Host to target for script nuking
 */
function killMyself(ns, host) {
    let hack = findMatchingProcess(ns, host, "hack.js", "*");
    ns.kill(hack.pid, host);
    let grow = findMatchingProcess(ns, host, "grow.js", "*");
    ns.kill(grow.pid, host);
    let weaken = findMatchingProcess(ns, host, "weaken.js", "*");
    ns.kill(weaken.pid, host);
    // let hyperbatcher = findMatchingProcess(ns, host, "hack.js", "*");
    // ns.kill(hyperbatcher.pid, host);
}