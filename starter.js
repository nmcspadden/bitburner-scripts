import { mapSourceFiles, HOME, SF_MAP } from "utils/script_tools.js";
import { START_LOG } from "startinggameplan.js";
import { EARLY_LOG } from "earlygameplan.js";
import { MID_LOG } from "midgameplan.js";
import { AUGMAP } from "utils/augs.js";
import { NETWORK_MAP } from "utils/networkmap.js";

/* 
 Starter.js: starting point for launching the gameplans
*/

/** @param {import(".").NS} ns **/
export async function main(ns) {
    // Clean up old files
    ns.rm(START_LOG);
    ns.rm(EARLY_LOG);
    ns.rm(MID_LOG);
    ns.rm(AUGMAP);
    ns.rm(SF_MAP);
    ns.rm(NETWORK_MAP + ".txt");

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