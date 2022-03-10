/** @param {import("../.").NS} ns **/
export async function main(ns) {
	let did_upgrade = false;
	did_upgrade = ns.upgradeHomeRam();
	if (did_upgrade) {
		ns.print(`Bought RAM upgrade`);
		did_upgrade = false;
	}
	did_upgrade = ns.upgradeHomeCores();
	if (did_upgrade) {
		ns.print(`Bought Cores upgrade`);
	}
}