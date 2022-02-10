/* TO DO: 
Add RAM checks to see what we start
*/

/** @param {NS} ns **/
export async function main(ns) {
	// Create network map
	ns.exec("utils/networkmap.js", HOME);
	// Start early game plan
	ns.exec("earlygameplan.js", HOME);
}