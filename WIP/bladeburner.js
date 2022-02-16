// This code is largely stolen from someone else
// https://github.com/InfraK/bitburner-scripts/blob/master/bladeburner.js

import { output } from "utils/script_tools.js";

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
 * @param {import("../.").NS} ns
 * @returns True if stamina < 400
 */
function shouldTrain(ns) {
    const res = ns.bladeburner.getStamina();
    return res[1] < 400;
}

/**
 * Rest to recover stamina, by training or field analysis
 * @param {import("../.").NS} ns
 * @returns Time it takes to trigger an action
 */
function rest(ns) {
    if (shouldTrain(ns)) {
        output(ns, TERMINAL, "Resting - training, because stamina is < 400");
        ns.bladeburner.startAction("general", "Training");
        return ns.bladeburner.getActionTime("general", "Training") * 1000;
    }
    output(ns, TERMINAL, "Resting - field analysis");
    ns.bladeburner.startAction("general", "Field Analysis");
    return ns.bladeburner.getActionTime * 1000;
}

/**
 * Get the chance to perform an action
 * @param {string} type Type of action
 * @param {string} name Name of action
 * @param {import("../.").NS} ns
 * @returns Estimated success chance of action
 */
const getChance = (type, name, ns) =>
    ns.bladeburner.getActionEstimatedSuccessChance(type, name);

/**
 * Do a Contract, Operation
 * @param {import("../.").NS} ns
 * @returns Time it takes to trigger an action
 */
function workContractOrOp(ns) {
    output(ns, TERMINAL, "Evaluating contracts + operations");
    const contracts = ns.bladeburner.getContractNames();
    const operations = ns.bladeburner.getOperationNames();

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

    // TODO: add Black Op in here somewhere 
    if (bestOp.chance >= bestContract.chance) {
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
 * @param {import("../.").NS} ns
 * @param {*} skill Skill object created by CheckSkills()
 */
function levelUpSkill(ns, skill) {
    output(ns, TERMINAL, `Leveling up ${skill.name} for ${skill.cost} points`);
    if (skill.cost < ns.bladeburner.getSkillPoints()) ns.bladeburner.upgradeSkill(skill.name)
}

/**
 * Check our current skill levels and costs, and upgrade them
 * @param {import("../.").NS} ns
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
    output(ns, TERMINAL, "Checking skills");
    skills.filter(skill => BB_IMPORTANT_SKILLS.includes(skill)).forEach(skill => {
        switch (skill) {
            case "Cloak":
            case "Short-Circuit":
                if (skill.level < SKILL_LIMIT) levelUpSkill(ns, skill)
                break;
            default:
                levelUpSkill(ns, skill);
                break;
        }
    });
}

/**
 * Handle the Bladeburner logic
 * @param {import("../.").NS} ns
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
        const sleepTime = canWork(ns) ? workContractOrOp(ns) : rest(ns);
        output(ns, TERMINAL, `Sleep time: ${ns.tFormat(sleepTime)}`);
        await ns.sleep(sleepTime);
        checkSkills(ns);
    }
}


/**
 * @param {import("../.").NS} ns
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
    await handleBladeburner(ns);
}