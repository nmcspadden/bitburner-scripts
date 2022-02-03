import { workoutAllUntil, commitKarmaFocusedCrime, GANG_KARMA } from "utils/crimes.js";

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
	// not enough RAM to do this script + findOptimal + easy-hack in 32 GB
	// ns.exec('easy-hack.script', HOME, 2);
	// 4. Hit the gym until minimum stats
	await workoutAllUntil(ns, MIN_STAT);
	// 5-6 Start crimes until we can do homicides to get to the gang karma, also upgrade home
	await crimeWhileUpgradingLoop(ns);
	// TODO figure out how to do more hacking based on increased RAM amounts
	// 7. Start a gang
	startAGang(ns);
}

/** 
 * Commit crimes, but if we have enough money, buy more home upgrades
 * @param {NS} ns 
**/
async function crimeWhileUpgradingLoop(ns) {
	ns.disableLog("ALL"); // Disable the log
	ns.tail(); // Open a window to view the status of the script
	let timeout = 250; // In ms - too low of a time will result in a lockout/hang
	while (Math.abs(ns.heart.break()) <= GANG_KARMA) {
		await ns.sleep(timeout); // Wait it out first
		if (ns.isBusy()) continue;
		// Do I have enough money to buy a RAM or core upgrade?
		let ram_cost = ns.getUpgradeHomeRamCost();
		let core_cost = ns.getUpgradeHomeCoresCost();
		let money = ns.getPlayer().money;
		let did_upgrade = false;
		if (money > ram_cost) {
			did_upgrade = ns.upgradeHomeRam();
			if (did_upgrade) ns.print(`Bought RAM upgrade for ${ns.nFormat(ram_cost, '0.00a')}`)
		}
		if (money > core_cost) {
			did_upgrade = ns.upgradeHomeCores();
			if (did_upgrade) ns.print(`Bought Cores upgrade for ${ns.nFormat(core_cost, '0.00a')}`)
		}
		// Otherwise, commit crime!
		commitKarmaFocusedCrime(ns);
		// If we have lots of money, buy darkweb programs too
		ns.exec('obtainPrograms.js', HOME);
	}
}

/** 
 * Check factions to see if I can join one and start a gang
 * @param {NS} ns 
**/
function startAGang(ns) {
	let invitations = ns.checkFactionInvitations();
	const gangList = [
		"Slum Snakes",
		"Tetrads",
		"Silhouette",
		"Speakers for the Dead",
		"The Dark Army",
		"The Syndicate",
	];
	let ready_gang = invitations.find(gang => gangList.includes(gang));
	if (ready_gang) {
		let joined = ns.joinFaction(ready_gang);
		if (joined) ns.print(`Joined ${ready_gang} faction`)
	}
	ns.exec('gangs.js', HOME);
}