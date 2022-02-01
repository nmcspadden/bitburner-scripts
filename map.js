/** @param {NS} ns **/
export async function main(ns) {
	let seenList = [];
	ScanServer(ns, "home", seenList, 1);
}

function ScanServer(ns, serverName, seenList, indent){
	if(seenList.includes(serverName)) return;
	seenList.push(serverName);
	var serverList = ns.scan(serverName);
	for(var i = 0; i < serverList.length; i++){
		var newServer = serverList[i];
		if(seenList.includes(newServer)) continue;
		PrintServerInfo(ns, newServer, indent)
		ScanServer(ns, newServer, seenList, indent + 1);
	}
}

function PrintServerInfo(ns, serverName, indent){
	var indentString = "";
	if(ns.hasRootAccess(serverName)){
		indentString = "▄▄▄▄".repeat(indent);
	}else{
		indentString = "_ _ ".repeat(indent);
	}
	var serverHackingLevel = ns.getServerRequiredHackingLevel(serverName);
	var canHackIndicator = "";

	if(ns.getHackingLevel() >= serverHackingLevel && !ns.hasRootAccess(serverName))
		canHackIndicator = "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!";
	ns.tprint (indentString + serverName + " (" + serverHackingLevel + ")" + canHackIndicator);
}