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

const TASK_RECOVERY = "Recovery";
const TASK_CRIME = "Crime";
const TASK_GYM = "Gym";
const TASK_SYNC = "Synchro";
const TASK_FACTION = "Faction";
const TASK_CLASS = "Class";

const GYM_POWERHOUSE = "Powerhouse Gym"; // location
const FACTION_HACKING = "Hacking"; // factionWorkType
const FACTION_FIELD = "Field"; // factionWorkType
const FACTION_SECURITY = "Security"; // factionWorkType
const UNI_ROTHMAN = "Rothman University";

const STR_MIN = 80;
const DEF_MIN = 80;
const DEX_MIN = 40;
const AGI_MIN = 40;

const CRIME_HOMICIDE = "Homicide";
const CRIME_MUG = "Mug";
const CRIME_ACTION_MUG = "mug someone";

const CLASS_ALGORITHMS = "Algorithms";

/** @param {import(".").NS} ns **/
export async function main(ns) {
    // If we don't have SF10, bail
    if (!checkSForBN(ns, 10)) return

    const flagdata = ns.flags([
        ["augs", false],
        ["quiet", false]
    ]);

    ns.disableLog("ALL");
    // Don't open the tail window in quiet mode
    if (!flagdata.quiet) ns.tail();
    ns.print("** Starting sleeve daemon");
    let numsleeves = readNumSleeves(ns);
    ns.print(`We have ${numsleeves} sleeves`);
    while (numsleeves > 0) {
        for (let i = 0; i < numsleeves; i++) {
            sleeveTime(ns, i, flagdata.augs);
        }
        ns.print("Re-evaluating in 60 seconds...");
        await ns.sleep(60000);
    }
}

/**
 * Get augs that sleeves will care about
 * @param {import(".").NS} ns 
 * @param {number} index Sleeve number
 * @returns List of augs sorted by cost (descending)
 */
function getUsefulAugs(ns, index) {
    let augs_to_buy = ns.sleeve.getSleevePurchasableAugs(index);
    // There are some augs that are just useless on sleeves, like Red Pill and hacknet augs
    // Filter out ones the sleeve already has
    let sorted_augs = augs_to_buy
        .filter(aug => !ns.sleeve.getSleeveAugmentations(index).includes(aug))
        .filter(aug => !(
            aug["name"].includes("Hacknet") ||
            aug["name"].includes("Pill") ||
            aug["name"].includes("Neuroreceptor Management") ||
            aug["name"].includes("CashRoot"))
        )
        .sort(
            (a, b) => a["cost"] - b["cost"]
        ).reverse();
    return sorted_augs
}

/**
 * Get augs that sleeves will care about
 * @param {import(".").NS} ns 
 * @param {Number} index Sleeve number
 * @param {Boolean} buy_augs If true, we should buy augs for the sleeves too
 */
function sleeveTime(ns, index, buy_augs = false) {
    /*
        What a working Sleeve looks like:
        {"task":"Crime","crime":"Homicide","location":"11250","gymStatType":"","factionWorkType":"None"}
        Idle sleeve:
        {"task":"Idle","crime":"","location":"","gymStatType":"","factionWorkType":"None"}
    }*/
    let stats = readSleeveStats(ns, index);
    let sleeve_task = readSleeveTask(ns, index);
    // Is there a closest NF faction?
    let faction = getClosestNFFaction(ns);
    let best_crime = calculateBestSleeveCrime(ns, index);
    // Reduce Shock to 97 first
    if (stats.shock > 97) {
        if (sleeve_task.task != TASK_RECOVERY) {
            ns.print(`Sleeve ${index}: Shock is >97, setting to Shock Recovery`);
            shockRecovery(ns, index);
        }
        return
    }
    // Am I in a gang yet?
    else if (checkSForBN(ns, 2) && !ns.gang.inGang()) {
        // Before starting any crimes, we want to get our stats to 100/100/60/60
        if (stats.strength < STR_MIN) {
            if (sleeve_task.task != TASK_GYM || !sleeve_task.gymStatType.toLowerCase().includes("strength")) {
                ns.print(`Sleeve ${index}: Strength is <${STR_MIN}, working out at the gym`);
                workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Strength");
            }
            ns.print(`Sleeve ${index}: Strength is ${stats.strength}/${STR_MIN}`);
            return
        }
        if (stats.defense < DEF_MIN) {
            if (sleeve_task.task != TASK_GYM || !sleeve_task.gymStatType.toLowerCase().includes("defense")) {
                ns.print(`Sleeve ${index}: Defense is <${DEF_MIN}, working out at the gym`);
                workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Defense");
            }
            ns.print(`Sleeve ${index}: Defense is ${stats.defense}/${DEF_MIN}`);
            return
        }
        if (stats.dexterity < DEX_MIN) {
            if (sleeve_task.task != TASK_GYM || !sleeve_task.gymStatType.toLowerCase().includes("dexterity")) {
                ns.print(`Sleeve ${index}: Dexterity is <${DEX_MIN}, working out at the gym`);
                workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Dexterity");
            }
            ns.print(`Sleeve ${index}: Dexterity is ${stats.dexterity}/${DEX_MIN}`);
            return
        }
        if (stats.agility < AGI_MIN) {
            if (sleeve_task.task != TASK_GYM || !sleeve_task.gymStatType.toLowerCase().includes("agility")) {
                ns.print(`Sleeve ${index}: Agility is <${AGI_MIN}, working out at the gym`);
                workOutAtGym(ns, index, GYM_POWERHOUSE, "Train Agility");
            }
            ns.print(`Sleeve ${index}: Agility is ${stats.agility}/${AGI_MIN}`);
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
    // Do we have a faction with NF, but we don't currently have enough rep to buy it?
    else if (faction && (ns.getAugmentationRepReq(NF) > ns.getFactionRep(faction))) {
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
    // Do we own The Red Pill and I'm trying to hack it? Time to grow hacking skills!
    else if (ns.getOwnedAugmentations().includes('The Red Pill')) {
        if ((sleeve_task.task != TASK_CLASS) || (sleeve_task.location != UNI_ROTHMAN)) {
            ns.print(`Sleeve ${index}: Taking Algorithms course to learn hacking`);
            takeUniversityCourse(ns, index, UNI_ROTHMAN, CLASS_ALGORITHMS);
        }
        return
    }
    // If the gang is done, and I'm under 100 sync, let's fix that first
    else if (stats.sync < 100) {
        if (sleeve_task.task != TASK_SYNC) {
            ns.print(`Sleeve ${index}: Sync level is at ${ns.nFormat(stats.sync / 100, '0.00%')}, setting to synchronize`)
            ns.sleeve.setToSynchronize(index);
        } else {
            ns.print(`Sleeve ${index}: Sync level is at ${ns.nFormat(stats.sync / 100, '0.00%')}, still synchronizing`)
        }
        return
    }
    // If the gang is done, and I'm above 0 shock, let's fix that first
    else if (stats.shock > 0) {
        if (sleeve_task.task != TASK_RECOVERY) {
            ns.print(`Sleeve ${index}: Shock level is at ${ns.nFormat(stats.shock / 100, '0.00%')}, setting to shock recovery`)
            ns.sleeve.setToShockRecovery(index);
        } else {
            ns.print(`Sleeve ${index}: Shock level is at ${ns.nFormat(stats.shock / 100, '0.00%')}, still recovering`)
        }
        return
    }
    // Do we need to generate rep to buy The Red Pill?
    else if (ns.getPlayer().factions.includes("Daedalus") && !ns.getOwnedAugmentations().includes("The Red Pill")) {
        let tasks = [];
        for (let i = 0; i < readNumSleeves(ns); i++) {
            tasks.push(readSleeveTask(ns, i));
        }
        if (!tasks.some(sleeve => (sleeve.task == TASK_FACTION) && (sleeve.location == "Daedalus"))) {
            ns.print(`Nobody is working for Daedalus`);
            workForNFFaction(ns, index, "Daedalus");
            return
        }
    }
    // Otherwise, commit a crime to make money
    else if ((sleeve_task.task != TASK_CRIME) || (!best_crime.toLowerCase().includes(sleeve_task.crime.toLowerCase()))) {
        ns.print(`Sleeve ${index}: Committing ${best_crime} at ${ns.nFormat(getCrimeSuccessChance(ns.getCrimeStats(best_crime), readSleeveStats(ns, index)), '0.00%')}% chance`)
        commitSleeveCrime(ns, index, best_crime);
        return
    }
    // Should we buy this sleeve any augs?
    if (stats.shock == 0) augmentSleeve(ns, index)
    // ns.print(`Sleeve ${index}: nothing changed`);
}

/**
 * Determine the best sleeve crime to make money
 * @param {import(".").NS} ns , index
 * @param {number} index Sleeve number
 * @returns {string} Name of the best crime to commit
 */
function calculateBestSleeveCrime(ns, index) {
    const best_crime = CRIMES
        .map(crime => {
            return {
                name: crime,
                chance: getCrimeSuccessChance(ns.getCrimeStats(crime), readSleeveStats(ns, index)),
                karma: ns.getCrimeStats(crime).karma,
                money: ns.getCrimeStats(crime).money,
                effective_gain: (ns.getCrimeStats(crime).money / ns.getCrimeStats(crime).time) * getCrimeSuccessChance(ns.getCrimeStats(crime), ns.sleeve.getSleeveStats(index))
            };
        })
        .filter(crime => crime.chance > 0.7)
        .reduce((a, b) => (a.effective_gain > b.effective_gain ? a : b), CRIME_MUG);
    if (!best_crime.name) return CRIME_ACTION_MUG;
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
 * Determine best type of work to earn rep for a faction
 * @param {import(".").NS} ns 
 * @param {Number} index sleeve index
 * @param {String} faction Faction to check against
 */
 function determineBestFactionWork(ns, index, faction) {
    let types = [FACTION_HACKING, FACTION_FIELD, FACTION_SECURITY];
    const best_type = types
        .map(type => {
            return {
                name: type,
                rate: getFactionRepRate(ns, index, type, faction)
            }
        })
        .reduce((a, b) => (a.rate > b.rate ? a : b));
    return best_type.name
}

/**
 * Determine rep rate for a sleeve for a given work type and faction
 * @param {import(".").NS} ns 
 * @param {Number} index sleeve index
 * @param {String} type Type of work ("Hacking", "Security", "Field")
 * @param {String} faction Faction to check against
 */
function getFactionRepRate(ns, index, type, faction) {
    let favorMult = 1;
    let stats = ns.sleeve.getSleeveStats(index);
    let info = ns.sleeve.getInformation(index);
    let faction_favor = ns.getFactionFavor(faction);
    favorMult = 1 + faction_favor / 100;
    switch (type) {
        case "Hacking":
            return getFactionHackingWorkRepGain(stats, info) * ((100 - stats.shock) / 100) * favorMult;
        case "Field":
            return getFactionFieldWorkRepGain(stats, info) * ((100 - stats.shock) / 100) * favorMult;
        case "Security":
            return getFactionSecurityWorkRepGain(stats, info) * ((100 - stats.shock) / 100) * favorMult;
    }
}

/**
 * Get the rep gain rate of Field work for a sleeve
 * @param {*} stats Sleeve stats
 * @param {*} info Sleeve information
 * @returns rate of field rep gain
 */
function getFactionFieldWorkRepGain(stats, info) {
    const t =
        (0.9 *
            (stats.hacking / MaxSkillLevel +
                stats.strength / MaxSkillLevel +
                stats.defense / MaxSkillLevel +
                stats.dexterity / MaxSkillLevel +
                stats.agility / MaxSkillLevel +
                stats.charisma / MaxSkillLevel)) /
        5.5;
    return t * info.mult.factionRep;
}

/**
 * Get the rep gain rate of Hacking work for a sleeve
 * @param {*} stats Sleeve stats
 * @param {*} info Sleeve information
 * @returns rate of hacking rep gain
 */
function getFactionHackingWorkRepGain(stats, info) {
    return (stats.hacking / MaxSkillLevel) * info.mult.factionRep;
}

/**
 * Get the rep gain rate of Security work for a sleeve
 * @param {*} stats Sleeve stats
 * @param {*} info Sleeve information
 * @returns rate of security rep gain
 */
function getFactionSecurityWorkRepGain(stats, info) {
    const t =
        (0.9 *
            (stats.hacking / MaxSkillLevel +
                stats.strength / MaxSkillLevel +
                stats.defense / MaxSkillLevel +
                stats.dexterity / MaxSkillLevel +
                stats.agility / MaxSkillLevel)) /
        4.5;
    return t * info.mult.factionRep;
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
 * @returns {import(".").SleeveStats} Stats of sleeve
 */
function readSleeveStats(ns, index) {
    if (!Number.isInteger(index)) return {}
    return ns.sleeve.getSleeveStats(index);
}

/**
 * Get sleeve task
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 * @returns {import(".").SleeveTask} Sleeve's current task
 */
function readSleeveTask(ns, index) {
    if (!Number.isInteger(index)) return {}
    return ns.sleeve.getTask(index);
}

/* Sleeve actions */
/**
 * Work out at gym
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 * @param {String} gym What gym to work out
 * @param {String} stat What stat to train
 */
function workOutAtGym(ns, index, gym, stat) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToGymWorkout(index, gym, stat);
}

/**
 * Start committing crimes
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 * @param {String} crime What crime to commit
 */
function commitSleeveCrime(ns, index, crime) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToCommitCrime(index, crime)
}

/**
 * Start recovering from shock
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function shockRecovery(ns, index) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToShockRecovery(index);
}

/**
 * Determine if we should work for a faction to get NF rep
 * @param {import(".").NS} ns
 * @param {Number} index Sleeve number
 * @param {String} faction Faction to work for
 */
function workForNFFaction(ns, index, faction) {
    ns.print(`Sleeve ${index}: Working for ${faction}`);
    // TODO: Determine best rep/sec here
    return ns.sleeve.setToFactionWork(index, faction, FACTION_SECURITY);
}

/**
 * Determine if we should take a university course
 * @param {import(".").NS} ns
 * @param {Number} index Sleeve number
 * @param {String} uni University to study at
 * @param {String} course Course to take
 */
function takeUniversityCourse(ns, index, uni, course) {
    if (!Number.isInteger(index)) return false
    return ns.sleeve.setToUniversityCourse(index, uni, course);
}

/**
 * Buy augments for sleeve
 * @param {import(".").NS} ns
 * @param {Number} index Index of sleeve
 */
function augmentSleeve(ns, index) {
    if (!Number.isInteger(index)) return false
    let useful_augs = getUsefulAugs(ns, index);
    useful_augs.forEach(aug => {
        let remaining_money = ns.getServerMoneyAvailable(HOME) - aug.cost;
        // Don't go below $1b when buying augs
        if ((aug.cost < ns.getServerMoneyAvailable(HOME)) && (remaining_money > 1e9)) {
            let did_buy = ns.sleeve.purchaseSleeveAug(index, aug.name);
            if (did_buy) ns.print(`Sleeve ${index}: Bought ${aug.name}`)
        }
    })
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