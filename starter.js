/* TO DO: 
Add RAM checks to see what we start
*/

const HOME = 'home';

/** @param {NS} ns **/
export async function main(ns) {
	// Create network map
	ns.spawn("utils/networkmap.js", HOME);
	// Create network map
	ns.exec("growHackingXP.js", HOME);
	// Start early game plan
	ns.exec("earlygameplan.js", HOME);
}