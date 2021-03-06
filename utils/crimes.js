import { numFormat } from "utils/format.js";

export const CRIMES = [
	"heist",
	"assassination",
	"kidnap",
	"grand theft auto",
	"homicide",
	"larceny",
	"mug someone",
	"rob store",
	"shoplift",
];

export const GANG_KARMA = 54000;

/** 
 * Work out all stats until they hit a certain level
 * @param {import("../.").NS} ns
 * @param {number} level The amount we all stats should be
**/
export async function workoutAllUntil(ns, level) {
	ns.disableLog("sleep");
	const STATS = [
		"strength",
		"defense",
		"dexterity",
		"agility",
	]
	for (let stat of STATS) {
		while (ns.getPlayer()[stat] < level) {
			if (!ns.isBusy()) {
				ns.toast("Training " + stat);
				ns.print("Training " + stat + " until " + level);
				ns.gymWorkout('Powerhouse Gym', stat, false)
			}
			await ns.sleep(1000);
		}
		ns.stopAction();
	}
}

/** 
 * Starting working out if below a certain level - NON BLOCKING
 * @param {import("../.").NS} ns
 * @param {number} level The amount we all stats should be
**/
export async function workoutAll(ns, level) {
	ns.disableLog("sleep");
	const STATS = [
		"strength",
		"defense",
		"dexterity",
		"agility",
	]
	for (let stat of STATS) {
		if (ns.getPlayer()[stat] < level) {
			if (!ns.getPlayer().className.includes(stat)) {
				ns.toast("Training " + stat);
				ns.print("Training " + stat + " until " + level);
				ns.gymWorkout('Powerhouse Gym', stat, false)
				return
			}
		}
	}
}

/** 
 * Commit a single crime to get us closer to Gang Karma levels
 * @param {import("../.").NS} ns
 * @returns {Number} ms required to commit the crime
**/
export function commitKarmaFocusedCrime(ns) {
	const HOMICIDE = "homicide";
	const MUG = "mug someone";
	// Calculate crime success chance of homicide
	let homicide_chance = ns.getCrimeChance(HOMICIDE);
	if (homicide_chance <= 0.7) {
		ns.print(`Homicide chance: ${ns.nFormat(homicide_chance, '0.00%')}, mugging people instead; Current karma: ${ns.heart.break()}`)
		return ns.commitCrime(MUG);
	} else {
		ns.print(`Committing homicide at ${ns.nFormat(homicide_chance, '0.00%')}; Current karma: ${ns.heart.break()}`);
		return ns.commitCrime(HOMICIDE);
	}
}

/** 
 * Commit crimes until we have enough negative karma to start a gang
 * @param {import("../.").NS} ns
**/
export async function crimeUntilGang(ns) {
	/** 
	 * Fastest stat growth is mugging, so start there
	 * Switch to homicide once it's >70% success chance
	**/
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (Math.abs(ns.heart.break()) <= GANG_KARMA) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		commitKarmaFocusedCrime(ns);
	}
}


/** @param {import("../.").NS} ns */
export async function main(ns) {
	const flagdata = ns.flags([
		["crimes", []],
		["help", false],
	])
	if (flagdata.help) {
		ns.tprint(
			`Pass in --crimes to only do a specific crime.`
		);
		return
	}
	let crimes = CRIMES;
	if (flagdata.crimes.length > 0) {
		// Only commit specific crimes
		crimes = flagdata.crimes;
	}
	// Disable the log
	ns.disableLog("ALL");
	ns.tail(); // Open a window to view the status of the script
	ns.print("Risk Value = Money Earned * Odds of Success(P(A) / ~P(A)) / Time taken");
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang

	while (true) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		/** Calculate the risk value of all crimes */
		let choices = crimes.map((crime) => {
			let crimeStats = ns.getCrimeStats(crime); // Let us look at the important bits
			let crimeChance = ns.getCrimeChance(crime); // We need to calculate if its worth it
			/** Using probabilty(odds) to calculate the "risk" to get the best reward
			 * Risk Value = Money Earned * Odds of Success(P(A) / ~P(A)) / Time taken
			 *
			 * Larger risk values indicate a better choice
			 */
			let crimeRiskValue =
				(crimeStats.money * Math.log10(crimeChance / (1 - crimeChance + Number.EPSILON))) /
				crimeStats.time;
			return [crime, crimeRiskValue];
		});

		let bestCrime = choices.reduce((prev, current) => {
			return prev[1] > current[1] ? prev : current;
		});

		ns.commitCrime(bestCrime[0]);
		ns.print(
			`Crime: ${bestCrime[0]}; Risk Value: ${bestCrime[1].toPrecision(3)}; Cash to Earn: \$${numFormat(ns
				.getCrimeStats(bestCrime[0])
				.money)}; Current karma: ${ns.heart.break()}`
		);
	}
}