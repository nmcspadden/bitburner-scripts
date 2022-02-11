/* TO DO: 
Add RAM checks to see what we start
*/

const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	// Create network map
	ns.exec("utils/networkmap.js", HOME);
	// // Grow hacking XP on joesguns
	// ns.exec("growHackingXP.js", HOME);
	// Start early game plan
	ns.spawn("earlygameplan.js", HOME);
}