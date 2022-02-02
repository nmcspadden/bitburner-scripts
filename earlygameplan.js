import { locateServer } from "utils/networkmap.js";
import { workoutAllUntil, crimeUntilGang } from "utils/crimes.js";

/**
 * Early Gameplan w/ Gangs (32 GB RAM)
 * 1. Buy programs from darkweb
 * 2. Run findOptimal with 1 thread
 * 3. Run easy-hack with 2 threads
 * 4. Gym until 30 of each stat
 * 5. Start mugging until >70% chance of homicide
 * 6. Homicide until -54k karma
 * 7. Start gang
 * 8. Along the way, evaluate if we have enough money for the next RAM upgrade
 */

const HOME = 'home';
const MIN_STAT = 30;

/** @param {NS} ns **/
export async function main(ns) {
	// 2-3 Run hacking programs
	//TODO figure out optimal thread counts here
	ns.exec('findOptimal.js', HOME);
	ns.exec('easy-hack.script', HOME, 2);
	// 4. Hit the gym until minimum stats
	await workoutAllUntil(ns, MIN_STAT);
	// 5-6 Start mugging until we can do homicides to get to the gang karma
	await crimeUntilGang(ns);
	// TODO figure out how to intersperse RAM upgrades in here
	// 7. Start a gang
	ns.exec('gangs.js', HOME);
}