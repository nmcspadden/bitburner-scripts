import { growTargetServer, findOptimal } from "utils/networkmap.js";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    let target = await findOptimal(ns);
    if (args[0]) target = args[0];
    await growTargetServer(ns, target);
}