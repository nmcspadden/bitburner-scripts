import { mapSourceFiles, HOME, SF_MAP } from "utils/script_tools.js";
import { START_LOG } from "startinggameplan.js";
import { EARLY_LOG } from "earlygameplan.js";
import { MID_LOG } from "midgameplan.js";
import { AUGMAP } from "utils/augs.js";
import { NETWORK_MAP } from "utils/networkmap.js";
import { SERVERGRADES } from "WIP/gradeservers.js";

/* 
 Starter.js: starting point for launching the gameplans
*/

/** @param {import(".").NS} ns **/
export async function main(ns) {
    ns.tprint("Deleting old files...");
    // Clean up old files
    ns.rm(START_LOG);
    ns.rm(EARLY_LOG);
    ns.rm(MID_LOG);
    // These are .txt files
    ns.rm(SF_MAP + ".txt");
    ns.rm(AUGMAP + ".txt");
    ns.rm(NETWORK_MAP + ".txt");
    ns.rm(SERVERGRADES + ".txt");

    // Create the source file map
    ns.tprint("Creating source file map");
    await mapSourceFiles(ns);
    // Determine our current RAM level
    let home_ram = ns.getServerMaxRam(HOME);
    // Create network map
    ns.tprint("Creating network map");
    ns.exec("utils/networkmap.js", HOME);
    // We start at 32 GB RAM
    if (home_ram <= 32) {
        ns.tprint("Starting game plan");
        ns.spawn("startinggameplan.js", 1);
    } else if (home_ram <= 1000) {
        // Under 1 TB, we're in early game phase
        ns.tprint("Early game plan");
        ns.spawn('earlygameplan.js', 1);
    } else {
        // Haven't figured this one out yet...
        ns.tprint("Mid game plan");
        ns.spawn('midgameplan.js', 1);
    }
    ns.tprint("Nothing to do.");
    // TODO: When do we trigger endgame plan?
}