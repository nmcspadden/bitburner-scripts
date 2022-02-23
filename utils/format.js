// Tyrope
// https://github.com/tyrope/bitburner/blob/master/lib/format.js

/**
 * Format a given number in ms to a human-readable string, except shorter.
 * @param {NS} ns
 * @param {Number} time
 * @param {Boolean} msAcc
 * @returns {String} a shortened ns.tFormat();
 */
 export function timeFormat(ns, time, msAcc) {
    return ns.tFormat(time, msAcc)
        .replaceAll("days", "d")
        .replaceAll("hours", "h")
        .replaceAll("minutes", "m")
        .replaceAll("seconds", "s")

        .replaceAll("day", "d")
        .replaceAll("hour", "h")
        .replaceAll("minute", "m")
        .replaceAll("second", "s")

        .replaceAll(",", "")
        .replaceAll(" ", "");
}

/**
 * Format a given number into an exponent.
 * @param {Number} num
 * @returns {String} the number represented in exponents.
 */
export function exponentFormat(num) {
    let exp = Math.floor(Math.log10(num));
    let base = Math.round(num / 10 ** (exp - 3)) / 1e3;
    return base + 'e' + exp;
}

/**
 * Kind of like ns.nFormat, but better.
 * @param {Number} num
 * @param {String?} type 'game' or 'SI' suffix style (Default: 'game')
 * @returns {String} formatted number.
 */
export function numFormat(num, type = 'game') {
    const GAME_SUFFIX = ['', 'k', 'm', 'b', 't', 'q', 'Q', 's', 'S', 'o', 'n'];
    const SI_SUFFIX = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    let suffix;

    let negative;
    if (num < 0) {
        negative = true;
        num = Math.abs(num);
    }
    // pick the correct suffix array.
    if (type.toLowerCase() == 'game') {
        suffix = GAME_SUFFIX;
    } else if (type.toUpperCase() == 'SI') {
        suffix = SI_SUFFIX;
    } else {
        // No valid suffix? have an exponent.
        return exponentFormat(num);
    }

    // Get the exponent
    let exp = Math.floor(Math.log10(num));

    // Do we have a suffix that big?
    if (exp / 3 >= suffix.length || exp < 0) {
        return exponentFormat(num);
    }

    // Get the right base.
    let base = num / 10 ** (exp - exp % 3);

    let return_val = Math.round(base * 1e3) / 1e3 + suffix[Math.floor(exp / 3)];
    // Return it with the right suffix.
    if (negative) return "-" + return_val
    return return_val;
}