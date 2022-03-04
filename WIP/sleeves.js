import { checkSForBN, HOME } from "utils/script_tools.js";
import { gamePhase } from "utils/gameplan.js";
import { CRIMES } from "utils/crimes.js";

/*
1. In Early game phase during karma grind, sleeves should be performing highest success % crime
2. Once Homicide is > 33%, only do that
3. Once gang is formed, they should passively try to hack
4. If have factions < 150 Favor, work for them (starting with closest rep to favor amount)
5. If I'm working out a gym or taking a course, do that instead
*/

export const FILE_NUM_SLEEVES = "/sleeves/results/NumSleeves.txt";
export const FILE_SLEEVE_STATS = (index) => `/sleeves/results/Sleeve${index}-stats.txt`;
export const FILE_SLEEVE_TASK = (index) => `/sleeves/results/Sleeve${index}-task.txt`;

const TASK_RECOVERY = "Recovery";
const TASK_CRIME = "Crime";
const TASK_GYM = "Gym";

const GYM_POWERHOUSE = "Powerhouse Gym";

const STR_MIN = 100;
const DEF_MIN = 100;
const DEX_MIN = 100;
const AGI_MIN = 100;

const CRIME_HOMICIDE = "Homicide";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    // If we don't have SF10, bail
    if (!checkSForBN(ns, 10)) return
    ns.disableLog("ALL");
    ns.tail();
    ns.print("** Starting sleeve daemon");
    // Map out the number of sleeves we have
    ns.exec('sleeves/getNumSleeves.js', HOME);
    let numsleeves = readNumSleeves(ns);
    while (true) {
        for (let i = 0; i < numsleeves; i++) {
            sleeveTime(ns, i);
        }
        await ns.sleep(30000);
    }

    // let numsleeves = ns.sleeve.getNumSleeves();
    // for (let i = 0; i < numsleeves; i++) {
    //     let augs = getUsefulAugs(ns);
    //     for (const aug of augs) {
    //         let money = ns.getServerMoneyAvailable("home");
    //         ns.tprint("Aug: " + aug.name + " Cost: " + aug.cost);
    //         if (money > aug["cost"]) {
    //             let did_buy = ns.sleeve.purchaseSleeveAug(0, aug["name"]);
    //             if (did_buy) ns.tprint(`Buying ${aug["name"]} for ${aug["cost"]}`);
    //         }
    //     }
    // }
}

/**
 * Get augs that sleeves will care about
 * @param {import("../.").NS} ns 
 */
// function getUsefulAugs(ns, index) {
//     ns.tprint("Getting all sleeve augs");
//     let augs_to_buy = ns.sleeve.getSleevePurchasableAugs(index);
//     // There are some augs that are just useless on sleeves, like Red Pill and hacknet augs
//     ns.tprint("Total aug length: " + augs_to_buy.length);
//     ns.tprint(augs_to_buy);
//     ns.tprint("Sorting sleeves");
//     let sorted_augs = augs_to_buy.
//         filter(aug => !(
//             aug["name"].includes("Hacknet") ||
//             aug["name"].includes("Pill") ||
//             aug["name"].includes("Neuroreceptor Management") ||
//             aug["name"].includes("CashRoot"))
//         ).
//         sort(
//             (a, b) => a["cost"] - b["cost"]
//         ).reverse();
//     ns.tprint(sorted_augs);
//     ns.tprint("Total aug length: " + sorted_augs.length);
//     return sorted_augs
// }

/**
 * Get augs that sleeves will care about
 * @param {import("../.").NS} ns 
 * @param {number} index Sleeve number
 */
function sleeveTime(ns, index) {
    /*
        What a working Sleeve looks like:
        {"task":"Crime","crime":"Homicide","location":"11250","gymStatType":"","factionWorkType":"None"}
        Idle sleeve:
        {"task":"Idle","crime":"","location":"","gymStatType":"","factionWorkType":"None"}
    }*/
    let stats = readSleeveStats(ns, index);
    let sleeve_task = readSleeveTask(ns, index);
    // Reduce Shock to 97 first
    if (stats.shock > 97 && (sleeve_task.task != TASK_RECOVERY)) {
        ns.print(`Sleeve ${index}: Shock is >97, setting to Shock Recovery`);
        shockRecovery(ns, index);
        return
    }
    // Am I in a gang yet?
    if (checkSForBN(ns, 2) && !ns.gang.inGang()) {
        // Before starting any crimes, we want to get our stats to 100/100/60/60
        if ((stats.strength < STR_MIN) && (sleeve_task.task != TASK_GYM)) {
            ns.print(`Sleeve ${index}: Strength is <${STR_MIN}, working out at the gym`);
            workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Strength");
            return
        }
        if ((stats.defense < DEF_MIN) && (sleeve_task.task != TASK_GYM)) {
            ns.print(`Sleeve ${index}: Defense is <${DEF_MIN}, working out at the gym`);
            workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Defense");
            return
        }
        if ((stats.dexterity < DEX_MIN) && (sleeve_task.task != TASK_GYM)) {
            ns.print(`Sleeve ${index}: Dexterity is <${DEX_MIN}, working out at the gym`);
            workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Dexterity");
            return
        }
        if ((stats.agility < AGI_MIN) && (sleeve_task.task != TASK_GYM)) {
            ns.print(`Sleeve ${index}: Agility is <${AGI_MIN}, working out at the gym`);
            workOutAtGymt(ns, index, GYM_POWERHOUSE, "Train Agility");
            return
        }
        // Start committing homicide!
        if ((sleeve_task.task != TASK_CRIME) && (sleeve_task.crime != CRIME_HOMICIDE)) {
            ns.print(`Sleeve ${index}: Committing homicide at ${ns.nFormat(getCrimeSuccessChance(ns.getCrimeStats(CRIME_HOMICIDE), readSleeveStats(ns, index)), '0.00%')}% chance`)
            commitSleeveCrime(ns, index, CRIME_HOMICIDE);
        }
    }
    // What do I do after the gang is done?
}

/**
 * Get augs that sleeves will care about
 * @param {import("../.").NS} ns , index
 * @param {number} index Sleeve number
 * @returns {string} Name of the best crime to commit
 */
function calculateBestSleeveCrime(ns, index) {
    const best_crime = CRIMES
        .map(crime => {
            return {
                name: crime,
                chance: getCrimeSuccessChance(ns.getCrimeStats(crime),readSleeveStats(ns, index)),
                karma: ns.getCrimeStats(crime).karma
            };
        })
        .reduce((a, b) => (a.chance > b.chance ? a : b));
    return best_crime.name
}


/**
 * Get augs that sleeves will care about
 * @param {CrimeStats} Crime Generated by ns.getCrimeStats("Mug")
 * @param {SleeveStats} P Generated by ns.sleeve.getSleeveStats(i)
 */
function getCrimeSuccessChance(Crime, P) {
    let chance =
        Crime.hacking_success_weight * P.hacking +
        Crime.strength_success_weight * P.strength +
        Crime.defense_success_weight * P.defense +
        Crime.dexterity_success_weight * P.dexterity +
        Crime.agility_success_weight * P.agility +
        Crime.charisma_success_weight * P.charisma;
    chance /= 975; //CONSTANTS.MaxSkillLevel
    chance /= Crime.difficulty;
    return chance;
}

/* Retrieve data about sleeves */
function readNumSleeves(ns) {
	let data = ns.read(FILE_NUM_SLEEVES);
	if (!data) return -1
	return Number(ns.read(FILE_NUM_SLEEVES));
}

function readSleeveStats(ns, index) {
	if (!Number.isInteger(index)) return {}
    ns.exec('sleeves/getStats.js', HOME, 1, index);
	return JSON.parse(ns.read(FILE_SLEEVE_STATS(index)));
}

function readSleeveTask(ns, index) {
	if (!Number.isInteger(index)) return {}
    ns.exec('sleeves/getTask.js', HOME, 1, index);
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