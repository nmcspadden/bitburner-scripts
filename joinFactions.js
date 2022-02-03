import { locateServer } from "utils/networkmap.js";


const factionMap = new Map([
	["CyberSec", "CSEC"],
	["NiteSec", "avmnite-02h"],
	["The Black Hand", "I.I.I.I"],
	["BitRunners", "run4theh111z"]
])

/**
 * Finds the faction servers and hacks them
 * Only run from home server
 * @param {NS} ns 
**/
export async function main(ns) {
	if (ns.getHostname() != 'home') {
		ns.tprint("This script can only be run from home.");
		return
	}

	let player = ns.getPlayer()
	let my_factions = player.factions;
	ns.tprint("Current factions: " + my_factions.join(", "));
	let my_level = player.hacking

	for (const [faction, server] of factionMap) {
		// Skip ones we've already joined
		if (my_factions.includes(faction)) { continue }
		ns.tprint("Considering " + faction);
		//this_server is a server object
		//server is a string of the current target server's name
		let this_server = ns.getServer(server);
		let req_hacking = ns.getServerRequiredHackingLevel(server);
		if (my_level <= req_hacking) {
			ns.tprint(`Oh noez, we're ${my_level} but need ${req_hacking}`);
			continue
		}
		// Check to see if we've already cracked it
		if (!ns.hasRootAccess(server)) {
			ns.tprint("Cracking into " + server);
			if (ns.fileExists("BruteSSH.exe")) {
				ns.brutessh(server);
			}
			if (ns.fileExists("FTPCrack.exe")) {
				ns.ftpcrack(server);
			}
			if (ns.fileExists("RelaySMTP.exe")) {
				ns.relaysmtp(server);
			}
			if (ns.fileExists("HTTPWorm.exe")) {
				ns.httpworm(server);
			}
			if (ns.fileExists("SQLInject.exe")) {
				ns.sqlinject(server);
			}
			try {
				ns.nuke(server);
			} catch (error) {
				ns.tprint("Still need to open ports!");
				continue
			}

		}
		let map_to_server = await locateServer(ns, server);  // this will be a reverse-ordered list from home to target
		ns.tprint(map_to_server.join(" -> "));
		if (!this_server.backdoorInstalled) {
			for (const step of map_to_server) {
				// ns.tprint("Connecting to: " + step)
				ns.connect(step);
			}
			ns.tprint(`Installing backdoor on ${server}`);
			await ns.installBackdoor();
		}
	}
	ns.connect('home');
	// Check our faction invites
	let invited_factions = ns.checkFactionInvitations();
	for (const faction of invited_factions) {
		if (factionMap.has(faction)) {
			let did_join = ns.joinFaction(faction);
			if (did_join) ns.tprint("Joined " + faction)
		}
	}
}