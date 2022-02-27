import { growTargetServer, findOptimal } from "utils/networkmap.js";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    let target = await findOptimal(ns);
    await growTargetServer(ns, target);
}