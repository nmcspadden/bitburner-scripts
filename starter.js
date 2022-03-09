import { mapSourceFiles, HOME, SF_MAP } from "utils/script_tools.js";
import { START_LOG } from "startinggameplan.js";
import { EARLY_LOG } from "earlygameplan.js";
import { MID_LOG } from "midgameplan.js";
import { AUGMAP } from "utils/augs.js";
import { NETWORK_MAP } from "utils/networkmap.js";
import { SERVERGRADES } from "WIP/gradeservers.js";
import { readNumSleeves, readSleeveStats, FILE_NUM_SLEEVES, FILE_SLEEVE_STATS, FILE_SLEEVE_TASK } from "sleevesEarly.js";

/* 
 Starter.js: starting point for launching the gameplans
*/
const MAX_SLEEVES = 8;

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
    // Sleeve files
    ns.rm(FILE_NUM_SLEEVES);
    for (let i = 0; i < MAX_SLEEVES; i++) {
        ns.rm(FILE_SLEEVE_STATS(i));
        ns.rm(FILE_SLEEVE_TASK(i));
    }

    // Create the source file map
    ns.tprint("Creating source file map");
    await mapSourceFiles(ns);
    // Determine our current RAM level
    let home_ram = ns.getServerMaxRam(HOME);
    // Create network map
    ns.tprint("Creating network map");
    ns.exec("utils/networkmap.js", HOME);
    // Check if we have any sleeves
    ns.tprint("Checking for sleeves...");
    ns.exec("sleeves/getNumSleeves.js", HOME);
    await ns.sleep(200);
    let sleeves = readNumSleeves(ns);
    ns.tprint("We have " + sleeves + " sleeves");
    for (let i = 0; i < sleeves; i++) {
        await readSleeveStats(ns, i);
        await ns.sleep(100);
    }
    ns.tprint("Got all sleeve stats");
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