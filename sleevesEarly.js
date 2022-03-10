import { checkSForBN, HOME, waitForPid } from "utils/script_tools.js";

/*
1. In Early game phase during karma grind, sleeves should work out
2. Once stats are good enough, start committing homicide until the gang grind is done
3. After that, we switch to sleeves.js
*/

export const FILE_NUM_SLEEVES = "/sleeves/results/NumSleeves.txt";
export const FILE_SLEEVE_STATS = (index) => `/sleeves/results/Sleeve${index}-stats.txt`;
export const FILE_SLEEVE_TASK = (index) => `/sleeves/results/Sleeve${index}-task.txt`;

const TASK_RECOVERY = "Recovery";
const TASK_CRIME = "Crime";
const TASK_GYM = "Gym";

const STAT_STR = "Train Strength";
const STAT_DEF = "Train Defense";
const STAT_DEX = "Train Dexterity";
const STAT_AGI = "Train Agility";
const STAT_CHA = "Train Charisma";

const GYM_POWERHOUSE = "Powerhouse Gym";

const STR_MIN = 100;
const DEF_MIN = 100;
const DEX_MIN = 60;
const AGI_MIN = 60;

const CRIME_HOMICIDE = "Homicide";

/** @param {import("..").NS} ns **/
export async function main(ns) {
    // If we don't have SF10, bail
    if (!checkSForBN(ns, 10)) return
    ns.disableLog("ALL");
    // ns.tail();
    // ns.print("** Starting sleeve daemon");
    // Map out the number of sleeves we have
    ns.exec('sleeves/getNumSleeves.js', HOME);
    let numsleeves = readNumSleeves(ns);
    ns.print(`We have ${numsleeves} sleeves`);
    // while ((numsleeves > 0) && (ns.getServerMaxRam(HOME) <= 32)) {
    for (let i = 0; i < numsleeves; i++) {
        await sleeveTime(ns, i);
    }
    // await ns.sleep(30000);
    // ns.print("We now have >32GB RAM, switch to SleevesMid.js");
}

/**
 * Handle a sleeve's activity
 * @param {import("..").NS} ns 
 * @param {number} index Sleeve number
 */
async function sleeveTime(ns, index) {
    /*
        What a working Sleeve looks like:
        {"task":"Crime","crime":"Homicide","location":"11250","gymStatType":"","factionWorkType":"None"}
        Idle sleeve:
        {"task":"Idle","crime":"","location":"","gymStatType":"","factionWorkType":"None"}
    }*/
    let stats = await readSleeveStats(ns, index);
    let sleeve_task = await readSleeveTask(ns, index);
    // Reduce Shock to 97 first
    if (stats.shock > 97 && (sleeve_task.task != TASK_RECOVERY)) {
        ns.print(`Sleeve ${index}: Shock is >97, setting to Shock Recovery`);
        shockRecovery(ns, index);
        return
    }
    // Before starting any crimes, we want to get our stats to 100/100/60/60
    if ((stats.strength < STR_MIN) || (sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_STR)) {
        ns.print(`Sleeve ${index}: Strength is <${STR_MIN}, working out at the gym`);
        workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_STR);
        return
    }
    if ((stats.defense < DEF_MIN) || (sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_DEF)) {
        ns.print(`Sleeve ${index}: Defense is <${DEF_MIN}, working out at the gym`);
        workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_DEF);
        return
    }
    if ((stats.dexterity < DEX_MIN) || (sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_DEX)) {
        ns.print(`Sleeve ${index}: Dexterity is <${DEX_MIN}, working out at the gym`);
        workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_DEX);
        return
    }
    if ((stats.agility < AGI_MIN) || (sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_AGI)) {
        ns.print(`Sleeve ${index}: Agility is <${AGI_MIN}, working out at the gym`);
        workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_AGI);
        return
    }
    // Start committing homicide!
    if ((sleeve_task.task != TASK_CRIME) && (sleeve_task.crime != CRIME_HOMICIDE)) {
        ns.print(`Sleeve ${index}: Committing homicide`);
        commitSleeveCrime(ns, index, CRIME_HOMICIDE);
        return
    }
    // Now switch to sleeves.js
    ns.print("Early game sleeve work is done; switch to SleevesMid.js");
}

/* Retrieve data about sleeves */
/**
 * Get the number of sleeves
 * @param {import("..").NS} ns
 */
export function readNumSleeves(ns) {
    let data = ns.read(FILE_NUM_SLEEVES);
    if (!data) return -1
    return Number(ns.read(FILE_NUM_SLEEVES));
}

/**
 * Get sleeve stats
 * @param {import("..").NS} ns
 * @param {Number} index Index of sleeve
 */
export async function readSleeveStats(ns, index) {
    if (!Number.isInteger(index)) return {}
    let pid = ns.exec('sleeves/getStats.js', HOME, 1, index);
    await waitForPid(ns, pid);
    return JSON.parse(ns.read(FILE_SLEEVE_STATS(index)));
}

/**
 * Get sleeve stats
 * @param {import("..").NS} ns
 * @param {Number} index Index of sleeve
 */
export async function readSleeveTask(ns, index) {
    if (!Number.isInteger(index)) return {}
    let pid = ns.exec('sleeves/getTask.js', HOME, 1, index);
    await waitForPid(ns, pid);
    return JSON.parse(ns.read(FILE_SLEEVE_TASK(index)));
}

/* Sleeve actions */
function workOutAtGym(ns, index, gym, stat) {
    if (!Number.isInteger(index)) return false
    return ns.exec('sleeves/workout.js', HOME, 1, index, gym, stat);
}

function commitSleeveCrime(ns, index, crime) {
    if (!Number.isInteger(index)) return false
    return ns.exec('sleeves/commitCrime.js', HOME, 1, index, crime);
}

function shockRecovery(ns, index) {
    if (!Number.isInteger(index)) return false
    return ns.exec('sleeves/shockRecovery.js', HOME, 1, index);
}
/*
What crimeStats looks like:
{
    "difficulty": 0.2,
    "karma": 0.25,
    "kills": 0,
    "money": 36000,
    "name": "Mug",
    "time": 4000,
    "type": "mug someone",
    "hacking_success_weight": 0,
    "strength_success_weight": 1.5,
    "defense_success_weight": 0.5,
    "dexterity_success_weight": 1.5,
    "agility_success_weight": 0.5,
    "charisma_success_weight": 0,
    "hacking_exp": 0,
    "strength_exp": 3,
    "defense_exp": 3,
    "dexterity_exp": 3,
    "agility_exp": 3,
    "charisma_exp": 0,
    "intelligence_exp": 0
}
*/