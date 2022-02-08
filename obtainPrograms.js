/** @param {NS} ns **/
export async function main(ns) {
	const programs = [
		"BruteSSH.exe",
		"AutoLink.exe",
		"FTPCrack.exe",
		"relaySMTP.exe",
		"HTTPWorm.exe",
		"ServerProfiler.exe",
		"DeepscanV1.exe",
		"DeepscanV2.exe",
		"SQLInject.exe",
		"Formulas.exe",
	];
	// First, get TOR
	ns.tprint("Checking for TOR...")
	let gotTor = ns.purchaseTor();
	if (gotTor) {
		ns.tprint("Purchased TOR access")
	}
	ns.tprint("Going shopping!")
	// Go buy shit
	for (let program of programs) {
		ns.tprint("Considering " + program)
		let purchased = ns.purchaseProgram(program);
		if (purchased) {
			ns.tprint("Purchased " + program)
		}
	}
}