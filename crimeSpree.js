// This code is largely stolen from someone else
// TODO: go find the github or reddit post I got this from

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

/** @param {NS} ns */
export async function main(ns) {
	const flagdata = ns.flags([
		["murder", false],
		["help", false],
	])
	if (flagdata.help) {
		ns.tprint(
			`Pass in --murder to only do homicides to earn the -54k karma to start a gang.`
		);
		return
	}
	if (flagdata.murder) {
		// Only commit homicide for people
		crimes = ["homicide"];
	}
	// First, work out a bit to build up stats
	const MIN_STAT = 30;
	const STATS = [
		"strength",
		"defense",
		"dexterity",
		"agility",
	]
	let me = ns.getPlayer();
    for (let stat of STATS) {
        while (me[stat] < MIN_STAT) {
            if (!ns.isBusy()) {
				ns.toast("Training " + stat);
                ns.gymWorkout('Powerhouse Gym', stat, false)
            }
            await ns.sleep(100)
            me = ns.getPlayer()
        }
        ns.stopAction()
    }
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