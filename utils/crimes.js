let crimes = [
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

/** 
 * Work out all stats until they hit a certain level
 * @param {NS} ns 
 * @param {number} level The amount we all stats should be
**/
export async function workoutAllUntil(ns, level) {
	const STATS = [
		"strength",
		"defense",
		"dexterity",
		"agility",
	]
	let me = ns.getPlayer();
	for (let stat of STATS) {
		while (me[stat] < level) {
			if (!ns.isBusy()) {
				ns.toast("Training " + stat);
				ns.gymWorkout('Powerhouse Gym', stat, false)
			}
			await ns.sleep(100);
			me = ns.getPlayer();
		}
		ns.stopAction();
	}
}

/** 
 * Commit crimes until we have enough negative karma to start a gang
 * @param {NS} ns 
**/
export async function crimeUntilGang(ns) {
	/** 
	 * Fastest stat growth is mugging, so start there
	 * Switch to homicide once it's >70% success chance
	**/
	const HOMICIDE = "homicide";
	const MUG = "mug someone";
	const GANG_KARMA = 54000;

	// Disable the log
	ns.disableLog("ALL");

	ns.tail(); // Open a window to view the status of the script
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	let homicide_chance;
	let karma = ns.heart.break();
	while (Math.abs(karma) <= GANG_KARMA) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// Calculate crime success chance of homicide
		homicide_chance = ns.getCrimeChance(HOMICIDE);
		if (homicide_chance <= 0.7) {
			ns.commitCrime(MUG);
			ns.print(`Homicide chance: ${homicide_chance}, mugging people instead.`)
		} else {
			ns.commitCrime(HOMICIDE);
			ns.print(`Committing homicide at ${homicide_chance}; Current karma: ${karma}`);
		}
		karma = ns.heart.break();
	}
}


/** @param {NS} ns */
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
	if (flagdata.crimes.length > 0) {
		// Only commit specific crimes
		crimes = flagdata.crimes;
	}
	// First, work out a bit to build up stats
	const MIN_STAT = 30;
	await workoutAllUntil(ns, MIN_STAT);
	// Disable the log
	ns.disableLog("ALL");

	ns.tail(); // Open a window to view the status of the script
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
			`Crime: ${bestCrime[0]} Risk Value: ${bestCrime[1].toPrecision(3)} Cash to Earn: \$${ns
				.getCrimeStats(bestCrime[0])
				.money.toPrecision(4)}; Current karma: ${ns.heart.break()}`
		);
	}
}