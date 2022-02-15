import { mapSourceFiles } from "utils/script_tools.js";

/* 
 Starter.js: starting point for launching the gameplans
*/

const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
    // Create the source file map
    await mapSourceFiles(ns);
    // Determine our current RAM level
    let home_ram = ns.getServerMaxRam(HOME);
    // Create network map
    ns.exec("utils/networkmap.js", HOME);
    // We start at 32 GB RAM
    if (home_ram <= 32) {
        // Start early game plan
        ns.spawn("startinggameplan.js", 1);
    } else if (home_ram <= 1000) {
        // Under 1 TB, we're in early game phase
        ns.spawn('earlygameplan.js', 1);
    } else {
        // Haven't figured this one out yet...
        ns.spawn('midgameplan.js', 1);
    }
    // TODO: When do we trigger endgame plan?
}