// This code is largely stolen from someone else
// https://github.com/InfraK/bitburner-scripts/blob/master/bladeburner.js

import { output, compareArrays } from "utils/script_tools.js";

let TERMINAL = false;

// Only level these skills
const BB_IMPORTANT_SKILLS = [
    "Blade's Intuition",
    "Cloak",
    "Short-Circuit",
    "Digital Observer",
    "Overclock",
]

// The limit for Cloak + Short-Circuit, since they don't apply to the final BlackOp
const SKILL_LIMIT = 30;

/**
 * Get Stamina percentage
 * @returns Stamina percentage
 */
function getStaminaPercentage(ns) {
    const [current, max] = ns.bladeburner.getStamina();
    return current / max;
}

/**
 * Check if we can work
 * @returns True if stamina > 50%
 */
function canWork(ns) {
    return getStaminaPercentage(ns) > 0.5;
}

/**
 * Determine if we should train or not
 * @param {import(".").NS} ns
 * @returns True if stamina < 400
 */
function shouldTrain(ns) {
    const res = ns.bladeburner.getStamina();
    return res[1] < 400;
}

/**
 * Rest to recover stamina, by training or field analysis
 * @param {import(".").NS} ns
 * @returns Time it takes to trigger an action
 */
function rest(ns) {
    if (shouldTrain(ns)) {
        output(ns, TERMINAL, "Resting - training, because max stamina is < 400");
        ns.bladeburner.startAction("general", "Training");
        return ns.bladeburner.getActionTime("general", "Training");
    }
    output(ns, TERMINAL, "Resting - field analysis");
    ns.bladeburner.startAction("general", "Field Analysis");
    return ns.bladeburner.getActionTime;
}

/**
 * Do a Contract, Operation, or BlackOp
 * @param {import(".").NS} ns
 * @returns Time it takes to trigger an action
 */
function findBestBlackOp(ns) {
    const blackops = ns.bladeburner.getBlackOpNames();
    // Sort by rank requirement
    const bestBlackOp = blackops.map(blackop => {
        return {
            type: "blackop",
            name: blackop,
            chance: getChance("blackop", blackop, ns),
            rank: ns.bladeburner.getBlackOpRank(blackop),
            done: ns.bladeburner.getActionCountRemaining("blackop", blackop) // 0 if we've done it, 1 if we haven't
        };
    }).filter(op => op.done == 1)
    .reduce((a, b) => (a.rank < b.rank ? a : b));
    // blackOp looks like this: 
    // [{"type":"blackop","name":"Operation Typhoon","chance":[1,1],"rank":2500, "done": 1}
    // If the chance is 100%, and we have the rank to do it, and we haven't already done it, return it
    let current_rank = ns.bladeburner.getRank();
    output(ns, TERMINAL, `Next BlackOp: ${bestBlackOp.name}, requires rank ${ns.nFormat(bestBlackOp.rank, '0,0')} (current: ${ns.nFormat(current_rank, '0,0')}), chance is ${ns.nFormat(bestBlackOp.chance[0], '0.0%')}-${ns.nFormat(bestBlackOp.chance[1], '0.0%')}`)
    if (
        compareArrays(bestBlackOp.chance, [1, 1]) &&
        (current_rank >= bestBlackOp.rank) &&
        (bestBlackOp.done == 1)
    ) return bestBlackOp
}

/**
 * Get the chance to perform an action
 * @param {string} type Type of action
 * @param {string} name Name of action
 * @param {import(".").NS} ns
 * @returns Estimated success chance of action
 */
const getChance = (type, name, ns) =>
    ns.bladeburner.getActionEstimatedSuccessChance(type, name);

/**
 * Do a Contract, Operation, or BlackOp
 * @param {import(".").NS} ns
 * @returns Time it takes to trigger an action
 */
function workContractOrOp(ns) {
    const contracts = ns.bladeburner.getContractNames();
    const operations = ns.bladeburner.getOperationNames();
    /* This logic only sorts by chance; it doesn't take into account things like number of actions left.
    TODO: Add logic to check if there actually _are_ actions left, and if NOT, re-calculate based on best rank gain/hr
    (rankgain * chance) / time seems to be a reasonable metric
    */
    const bestContract = contracts
        .map(contract => {
            return {
                type: "contract",
                name: contract,
                chance: getChance("contract", contract, ns)
            };
        })
        .reduce((a, b) => (a.chance > b.chance ? a : b));

    const bestOp = operations
        .map(operation => {
            return {
                type: "operation",
                name: operation,
                chance: getChance("operation", operation, ns)
            };
        })
        .reduce((a, b) => (a.chance > b.chance ? a : b));

    const bestBlackOp = findBestBlackOp(ns);
    if (bestBlackOp) {
        output(ns, TERMINAL, `Beginning BlackOp ${bestBlackOp.name}`);
        ns.bladeburner.startAction(bestBlackOp.type, bestBlackOp.name);
        return ns.bladeburner.getActionTime(bestBlackOp.type, bestBlackOp.name);
    }

    if (bestOp.chance >= bestContract.chance) {
        output(ns, TERMINAL, `Beginning operation ${bestOp.name}`);
        ns.bladeburner.startAction(bestOp.type, bestOp.name);
        return ns.bladeburner.getActionTime(bestOp.type, bestOp.name);
    }
    output(ns, TERMINAL, `Beginning contract ${bestContract.name}`);
    ns.bladeburner.startAction(bestContract.type, bestContract.name);
    return (
        ns.bladeburner.getActionTime(bestContract.type, bestContract.name)
    );
}

/**
 * Check our current skill levels and costs, and upgrade them
 * @param {import(".").NS} ns
 * @param {*} skill Skill object created by CheckSkills()
 */
function levelUpSkill(ns, skill) {
    output(ns, TERMINAL, `Leveling up ${skill.name} for ${skill.cost} points`);
    if (skill.cost < ns.bladeburner.getSkillPoints()) ns.bladeburner.upgradeSkill(skill.name)
}

/**
 * Remove irrelevant skills from a list of skills to consider
 * @param {array} skills List of skills to consider 
 * @param {string} name Skill to exclude
 * @param {number} limit If skill level is >= this limit, exclude the skill
 * @returns List of skills
 */
function removeUnhelpfulSkillIfLimited(skills, name, limit) {
    let unhelpful_skill = skills.find(skill => skill.name == name);
    let index = skills.findIndex(skill => skill.name == name);
    if (unhelpful_skill.level >= limit) {
        // If we found it, remove it
        if (index > -1) skills.splice(index, 1)
    }
    return skills
}

/**
 * Check our current skill levels and costs, and upgrade them
 * @param {import(".").NS} ns
 */
function checkSkills(ns) {
    const skills = ns.bladeburner.getSkillNames().map(skill => {
        return {
            name: skill,
            level: ns.bladeburner.getSkillLevel(skill),
            cost: ns.bladeburner.getSkillUpgradeCost(skill)
        };
    });
    // Only level up the important skills
    let important_skills = skills.filter(skill => BB_IMPORTANT_SKILLS.includes(skill.name));
    // If Overclock is capped (by the game) at 90, don't consider it
    important_skills = removeUnhelpfulSkillIfLimited(important_skills, "Overclock", 90);
    // If Cloak + Short-Circuit are capped, ignore them too
    important_skills = removeUnhelpfulSkillIfLimited(important_skills, "Cloak", SKILL_LIMIT);
    important_skills = removeUnhelpfulSkillIfLimited(important_skills, "Short-Circuit", SKILL_LIMIT);
    let cheapest_skill = important_skills.reduce((a, b) => (a.cost < b.cost ? a : b));
    important_skills.forEach(skill => {
        switch (skill.name) {
            case "Cloak":
            case "Short-Circuit":
                if (skill.level < SKILL_LIMIT) levelUpSkill(ns, skill)
                break;
            case "Overclock":
                // Overclock caps at 90, so don't bother trying
                if (skill.level < 90) levelUpSkill(ns, skill)
                break;
            default:
                levelUpSkill(ns, skill);
                break;
        }
    });
}

/**
 * Check if Chaos is too high
 * @param {import(".").NS} ns
 */
function chaosRising(ns) {
    /*
    Any time the spread between success chance is >15%, it's too unreliable and we should do Field Analysis
    If the average chance (low + high / 2) > 1.0, probably need to do field analysis
    Diplomacy scales better with Charisma, but I generally ignore Charisma as a stat, and it always takes 60s
    Stealth Retirement does about 1-3% chaos reduction per execution
    */
    const STEALTH_RET_OP = "Stealth Retirement Operation";
    let current_chaos = ns.bladeburner.getCityChaos(ns.bladeburner.getCity());
    if (current_chaos > 50) {
        // Too high! Spend time reducing it
        output(ns, TERMINAL, `Chaos is too high (${current_chaos})! Starting Stealth Retirement`);
        ns.bladeburner.startAction("operation", STEALTH_RET_OP);
        return ns.bladeburner.getActionTime(bestOp.type, bestOp.name);
    }
}

/**
 * Handle the Bladeburner logic
 * @param {import(".").NS} ns
 */
export async function handleBladeburner(ns) {
    output(ns, TERMINAL, "Setting auto-level on everything");
    // Set max autolevel of everything.
    const contracts = ns.bladeburner.getContractNames();
    const operations = ns.bladeburner.getOperationNames();

    contracts.forEach(contract =>
        ns.bladeburner.setActionAutolevel("contract", contract, true)
    );
    operations.forEach(operation =>
        ns.bladeburner.setActionAutolevel("operation", operation, true)
    );
    output(ns, TERMINAL, "Beginning Bladeburner loop");
    while (true) {
        // TODO: Check for Chaos
        const sleepTime = canWork(ns) ? workContractOrOp(ns) : rest(ns);
        output(ns, TERMINAL, `Sleeping for ${ns.tFormat(sleepTime)}`);
        await ns.sleep(sleepTime);
        checkSkills(ns);
    }
}


/**
 * @param {import(".").NS} ns
 */
export async function main(ns) {
    const flagdata = ns.flags([
        ["quiet", false],
    ])
    TERMINAL = !flagdata.quiet;
    if (!TERMINAL) {
        ns.disableLog("ALL");
        ns.tail();
    }
    // TODO: add in safety check to make sure we're part of Bladeburner
    // and/or have minimum stats to join it
    await handleBladeburner(ns);
}