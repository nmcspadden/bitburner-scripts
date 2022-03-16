import { checkSForBN, HOME, waitForPid } from "utils/script_tools.js";

/*
1. In Early game phase during karma grind, sleeves should work out
2. Once stats are good enough, start committing homicide until the gang grind is done
3. After that, we switch to sleeves.js
*/

export const FILE_NUM_SLEEVES = "/sleeves/results/NumSleeves.txt";
export const FILE_SLEEVE_STATS = (index) => `/sleeves/results/Sleeve${index}-stats.txt`;
export const FILE_SLEEVE_TASK = (index) => `/sleeves/results/Sleeve${index}-task.txt`;

export const STR_MIN = 80;
export const DEF_MIN = 80;
export const DEX_MIN = 40;
export const AGI_MIN = 40;

const TASK_RECOVERY = "Recovery";
const TASK_CRIME = "Crime";
const TASK_GYM = "Gym";

const STAT_STR = "Train Strength";
const STAT_DEF = "Train Defense";
const STAT_DEX = "Train Dexterity";
const STAT_AGI = "Train Agility";
const STAT_CHA = "Train Charisma";

const GYM_POWERHOUSE = "Powerhouse Gym";

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
        await ns.sleep(50);
    }
}

/**
 * Handle a sleeve's activity
 * @param {import(".").NS} ns 
 * @param {Number} index Sleeve number
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
    if (stats.shock > 97) {
        if (sleeve_task.task != TASK_RECOVERY) {
            ns.print(`Sleeve ${index}: Shock is >97, setting to Shock Recovery`);
            await shockRecovery(ns, index);
        }
        return
    }
    // Before starting any crimes, we want to get our stats to 100/100/60/60
    if (stats.strength < STR_MIN) {
        if ((sleeve_task.task != TASK_GYM) && (sleeve_task.gymStatType != STAT_STR)) {
            ns.print(`Sleeve ${index}: Strength is <${STR_MIN}, working out at the gym`);
            await workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_STR);
        }
        return
    }
    if (stats.defense < DEF_MIN) {
        if ((sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_DEF)) {
            ns.print(`Sleeve ${index}: Defense is <${DEF_MIN}, working out at the gym`);
            await workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_DEF);
        }
        return
    }
    if (stats.dexterity < DEX_MIN) {
        if ((sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_DEX)) {
            ns.print(`Sleeve ${index}: Dexterity is <${DEX_MIN}, working out at the gym`);
            await workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_DEX);
        }
        return
    }
    if (stats.agility < AGI_MIN) {
        if ((sleeve_task.task != TASK_GYM) || (sleeve_task.gymStatType != STAT_AGI)) {
            ns.print(`Sleeve ${index}: Agility is <${AGI_MIN}, working out at the gym`);
            await workOutAtGym(ns, index, GYM_POWERHOUSE, STAT_AGI);
        }
        return
    }
    // Start committing homicide!
    if ((sleeve_task.task != TASK_CRIME) && (sleeve_task.crime != CRIME_HOMICIDE)) {
        ns.print(`Sleeve ${index}: Committing homicide`);
        await commitSleeveCrime(ns, index, CRIME_HOMICIDE);
        return
    }
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
async function workOutAtGym(ns, index, gym, stat) {
    if (!Number.isInteger(index)) return false
    let pid = ns.exec('sleeves/workout.js', HOME, 1, index, gym, stat);
    await waitForPid(ns, pid);
}

async function commitSleeveCrime(ns, index, crime) {
    if (!Number.isInteger(index)) return false
    let pid = ns.exec('sleeves/commitCrimes.js', HOME, 1, index, crime);
    await waitForPid(ns, pid);
}

async function shockRecovery(ns, index) {
    if (!Number.isInteger(index)) return false
    let pid = ns.exec('sleeves/shockRecovery.js', HOME, 1, index);
    await waitForPid(ns, pid);
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