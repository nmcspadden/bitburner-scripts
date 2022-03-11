import { checkSForBN, HOME } from "utils/script_tools.js";
import { CRIMES } from "utils/crimes.js";
import { getClosestNFFaction, NF } from "utils/augs.js";

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
const TASK_SYNC = "Synchro";
const TASK_FACTION = "Faction";

const GYM_POWERHOUSE = "Powerhouse Gym"; // location
const FACTION_HACKING = "Hacking"; // factionWorkType
const FACTION_FIELD = "Field"; // factionWorkType

const STR_MIN = 100;
const DEF_MIN = 100;
const DEX_MIN = 100;
const AGI_MIN = 100;

const CRIME_HOMICIDE = "Homicide";

/** @param {import(".").NS} ns **/
export async function main(ns) {
    // If we don't have SF10, bail
    if (!checkSForBN(ns, 10)) return
    ns.disableLog("ALL");
    ns.tail();
    ns.print("** Starting sleeve daemon");
    let numsleeves = readNumSleeves(ns);
    ns.print(`We have ${numsleeves} sleeves`);
    while (numsleeves > 0) {
        for (let i = 0; i < numsleeves; i++) {
            sleeveTime(ns, i);
        }
        ns.print("Re-evaluating in 60 seconds...");
        await ns.sleep(60000);
    }
}

/**
 * Get augs that sleeves will care about
 * @param {import(".").NS} ns 
 * @param {number} index Sleeve number
 */
function getUsefulAugs(ns, index) {
    ns.tprint("Getting all sleeve augs");
    let augs_to_buy = ns.sleeve.getSleevePurchasableAugs(index);
    // There are some augs that are just useless on sleeves, like Red Pill and hacknet augs
    ns.tprint("Total aug length: " + augs_to_buy.length);
    ns.tprint(augs_to_buy);
    ns.tprint("Sorting sleeves");
    let sorted_augs = augs_to_buy.
        filter(aug => !(
            aug["name"].includes("Hacknet") ||
            aug["name"].includes("Pill") ||
            aug["name"].includes("Neuroreceptor Management") ||
            aug["name"].includes("CashRoot"))
        ).
        sort(
            (a, b) => a["cost"] - b["cost"]
        ).reverse();
    ns.tprint(sorted_augs);
    ns.tprint("Total aug length: " + sorted_augs.length);
    return sorted_augs
}

/**
 * Get augs that sleeves will care about
 * @param {import(".").NS} ns 
 * @param {number} index Sleeve number
 */
function sleeveTime(ns, index) {
    /*
        What a working Sleeve looks like:
        {"task":"Crime","crime":"Homicide","location":"11250","gymStatType":"","factionWorkType":"None"}
        Idle sleeve:
        {"task":"Idle","crime":"","location":"","gymStatType":"","factionWorkType":"None"}
    }*/
    // ns.print(`Sleeve ${index}: Reading stats`);
    let stats = readSleeveStats(ns, index);
    // ns.print(`Sleeve ${index}: Checking current task`);
    let sleeve_task = readSleeveTask(ns, index);
    // Is there a closest NF faction?
    let faction = getClosestNFFaction(ns);
    let best_crime = calculateBestSleeveCrime(ns, index);
    // Reduce Shock to 97 first
    if (stats.shock > 97 && (sleeve_task.task != TASK_RECOVERY)) {
        ns.print(`Sleeve ${index}: Shock is >97, setting to Shock Recovery`);
        shockRecovery(ns, index);
        return
    }
    // Am I in a gang yet?
    else if (checkSForBN(ns, 2) && !ns.gang.inGang()) {
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
            workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Agility");
            return
        }
        // Start committing homicide!
        if ((sleeve_task.task != TASK_CRIME) && (sleeve_task.crime != CRIME_HOMICIDE)) {
            // ns.print(`Sleeve ${index}: Committing homicide at ${ns.nFormat(getCrimeSuccessChance(ns.getCrimeStats(CRIME_HOMICIDE), readSleeveStats(ns, index)), '0.00%')}% chance`)
            ns.print(`Sleeve ${index}: Committing homicide`);
            commitSleeveCrime(ns, index, CRIME_HOMICIDE);
            return
        }
    }
    // If the gang is done, and I'm under 100 sync, let's fix that first
    else if (stats.sync < 100 && sleeve_task.task != TASK_SYNC) {
        ns.print(`Sleeve ${index}: Sync level is at ${ns.nFormat(stats.sync / 100, '0.00%')}%, setting to synchronize`)
        ns.sleeve.setToSynchronize(index);
        return
    } else if (stats.sync < 100) {
        ns.print(`Sleeve ${index}: Sync level is at ${ns.nFormat(stats.sync / 100, '0.00%')}%, still synchronizing`)
        return
    }
    // Do we have a faction with NF, but we don't currently have enough rep to buy it?
    else if (faction && (ns.getAugmentationRepReq(NF) < ns.getFactionRep(faction))) {
        let tasks = [];
        for (let i = 0; i < readNumSleeves(ns); i++) {
            tasks.push(readSleeveTask(ns, i));
        }
        if (!tasks.some(sleeve => (sleeve.task == TASK_FACTION) && (sleeve.location == faction))) {
            ns.print(`Nobody is working for ${faction}`);
            workForNFFaction(ns, index, faction);
            return
        }
    }
    // Otherwise, commit a crime to make money
    else if ((sleeve_task.task != TASK_CRIME) || (sleeve_task.crime.toLowerCase() != best_crime.toLowerCase())) {
        ns.print(`Sleeve ${index}: Committing ${best_crime} at ${ns.nFormat(getCrimeSuccessChance(ns.getCrimeStats(best_crime), readSleeveStats(ns, index)), '0.00%')}% chance`)
        commitSleeveCrime(ns, index, best_crime);
        return
    }
}

/**
 * Get augs that sleeves will care about
 * @param {import(".").NS} ns , index
 * @param {number} index Sleeve number
 * @returns {string} Name of the best crime to commit
 */
function calculateBestSleeveCrime(ns, index) {
    // New algorithm: Find the most moneymaking crime with a chance > 70%
    const best_crime = CRIMES
        .map(crime => {
            return {
                name: crime,
                chance: getCrimeSuccessChance(ns.getCrimeStats(crime), readSleeveStats(ns, index)),
                karma: ns.getCrimeStats(crime).karma,
                money: ns.getCrimeStats(crime).money
            };
        })
        .filter(crime => crime.chance > 0.7)
        .reduce((a, b) => (a.money > b.money ? a : b));
    return best_crime.name
}


/**
 * Calculate chance of a sleeve to commit a crime
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
    // Values higher than 100% are irrelevant, reduce to 100%
    if (chance > 1) chance = 1
    return chance;
}

/**
 * Determine if we should work for a faction to get NF rep
 * @param {import(".").NS} ns
 */
function workForNFFaction(ns, index, faction) {
    ns.print(`Sleeve ${index}: Working for ${faction}`);
    // TODO: Determine best rep/sec here
    return ns.sleeve.setToFactionWork(index, faction, FACTION_FIELD);
}

/* Retrieve data about sleeves */
/**
 * Get the number of sleeves
 * @param {import(".").NS} ns
 */
function readNumSleeves(ns) {
    return ns.sleeve.getNumSleeves();
}

/**
 * Get sleeve stats
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function readSleeveStats(ns, index) {
    if (!Number.isInteger(index)) return {}
    return ns.sleeve.getSleeveStats(index);
}

/**
 * Get sleeve task
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function readSleeveTask(ns, index) {
    if (!Number.isInteger(index)) return {}
    return ns.sleeve.getTask(index);
}

/* Sleeve actions */
/**
 * Get sleeve task
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function workOutAtGym(ns, index, gym, stat) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToGymWorkout(index, gym, stat);
}

/**
 * Get sleeve task
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function commitSleeveCrime(ns, index, crime) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToCommitCrime(index, crime)
}

/**
 * Get sleeve task
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function shockRecovery(ns, index) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToShockRecovery(index);
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

What Sleeve Stats looks like:
{
    "shock": 0,
    "sync": 77.96386375382257,
    "hacking": 1,
    "strength": 100,
    "defense": 116,
    "dexterity": 90,
    "agility": 90,
    "charisma": 1
}
*/