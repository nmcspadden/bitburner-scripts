import { numFormat } from "utils/format.js";

const CORP_NAME = "VIP Champagne";
const PRODUCT_CAPACITY_UPGRADE = "uPgrade: Capacity.I";
const TOBACCO_PRFX = "Tobacco-v";
const WILSON = "Wilson Analytics";

const JOB_LIST = [
  "Business",
  "Engineer",
  "Management",
  "Operations",
  "Research & Development",
];

const CITY_LIST = [
  "Aevum",
  "Chongqing",
  "Sector-12",
  "New Tokyo",
  "Ishima",
  "Volhaven"
];

/** @param {import("../.").NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();
  if (!ns.getPlayer().hasCorporation) bootstrapCorp(ns)
  ns.print("***Starting out Corporation management");
  let corp = ns.corporation.getCorporation();
  // In my corp right now, this is the second item in the array
  // TODO: Add a function to find a given division based on type
  let division_tobacco = corp.divisions[1].name; // "Sin Sticks"
  let product_names = ns.corporation.getDivision(division_tobacco).products;
  // The default max number of products is 3, but can be 4 with research
  let max_number_of_products = 3;
  if (ns.corporation.hasResearched(division_tobacco, PRODUCT_CAPACITY_UPGRADE)) max_number_of_products += 1
  // ns.print("Products: " + JSON.stringify(product_names, null, 2));
  // let tobacco_cities = corp.divisions[1].cities;
  while (true) {
    // Sell initial products at MAX / MP, then set to TA.II 
    // ns.print("Selling each product for MAX/MP and then TA.II");
    product_names.forEach(prod => {
      ns.corporation.sellProduct(division_tobacco, "Aevum", prod, "MAX", "MP", true);
      ns.corporation.setProductMarketTA2(division_tobacco, prod, true);
    });
    // Do we have less than the max number of products?
    while (product_names.length < max_number_of_products) {
      // develop more products
      developNewProduct(ns, division_tobacco);
      product_names = ns.corporation.getDivision(division_tobacco).products;
    }
    // Are any products in dev progress?
    let in_dev = product_names.find(prod => ns.corporation.getProduct(division_tobacco, prod).developmentProgress < 100);
    if (in_dev) ns.print("In development product: " + in_dev)
    // If nothing is in development, then we should sell off + discontinue the oldest one
    if (!in_dev) {
      await discontinueOldestProduct(ns, division_tobacco);
    }
    product_names = ns.corporation.getDivision(division_tobacco).products;
    // Now actual corp development:
    ns.print("Making improvements to Aevum");
    await improveCorp(ns, division_tobacco, "Aevum");
    ns.print("Sleeping for 5 seconds");
    await ns.sleep(5000); // sleep for 5 seconds  
  }
}

/**
 * Bootstrap a corp
 * @param {import("../.").NS} ns 
 */
export async function bootstrapCorp(ns) {
  ns.disableLog("ALL");
  ns.tail();
  const FIRST_INDUSTRY = "Agriculture";
  const DIVISION = "Rich Table";
  let player = ns.getPlayer();
  if (player.funds < 150000000000) {
    ns.print("Not enough funds to start a corporation. You need $150b.");
    ns.exit();
  }
  ns.print("Creating corporation!");
  ns.corporation.createCorporation(CORP_NAME, true);
  // return // ONLY DURING DEV
  let corp = ns.corporation.getCorporation();
  // This is so the script can be safely idempotent; running expandIndustry with the same args causes 
  // a runtime error
  if (corp.divisions.length == 0) {
    ns.print("Creating new industry!");
    ns.corporation.expandIndustry(FIRST_INDUSTRY, DIVISION);
  }
  const SMART_SUPPLY = "Smart Supply";
  if (!ns.corporation.hasUnlockUpgrade(SMART_SUPPLY)) {
    ns.print("Buying Smart Supply");
    ns.corporation.unlockUpgrade(SMART_SUPPLY);
  }
  // Possible safe ways to check for Office / Warehouse APIs?
  /* BEGINNING PHASE */
  corp = ns.corporation.getCorporation();
  // Turn on smart supply for starting city
  ns.print("Enabling Smart Supply for " + DIVISION + " in " + corp.divisions[0].cities[0]);
  ns.corporation.setSmartSupply(DIVISION, corp.divisions[0].cities[0], true);
  // Now expand offices to other cities
  ns.print("Starting expansion of other cities");
  for (const city of CITY_LIST) {
    let employee_list = [];
    // Expand the office to each new city
    if (!corp.divisions[0].cities.includes(city)) {
      ns.print("Expanding to " + city);
      ns.corporation.expandCity(DIVISION, city);
    }
    let office = ns.corporation.getOffice(DIVISION, city);
    if (office.employees < 3) {
      ns.print("Hiring employees");
      for (let i = 1; i <= 3; i++) {
        // Hire 3 employees for each city
        employee_list.push(ns.corporation.hireEmployee(DIVISION, city));
      }
      ns.print("Assigning jobs to employees");
      await assignEmployees(ns, employee_list, DIVISION, city, ["Operations", "Engineer", "Business"]);
    }
    if (ns.corporation.getHireAdVertCount(DIVISION) < 1) {
      // Buy one level of AdVert
      ns.print("Buying one round of AdVert");
      ns.corporation.hireAdVert(DIVISION);
    }
    // Buy a warehouse if we don't have one
    if (!ns.corporation.hasWarehouse(DIVISION, city)) {
      ns.print("Buying Warehouse");
      ns.corporation.purchaseWarehouse(DIVISION, city);
    }
    ns.print("Enabling Smart Supply for " + DIVISION + " in " + corp.divisions[0].cities[0]);
    ns.corporation.setSmartSupply(DIVISION, city, true);
    // Upgrade the warehouse to fit at least 300
    ns.print("Upgrading the warehouse to 300");
    while (ns.corporation.getWarehouse(DIVISION, city).size < 300) {
      ns.corporation.upgradeWarehouse(DIVISION, city);
    }
    // Now start selling Plants + Food
    ns.print("Setting sale prices for materials Plants + Food");
    ns.corporation.sellMaterial(DIVISION, city, "Plants", "MAX", "MP");
    ns.corporation.sellMaterial(DIVISION, city, "Food", "MAX", "MP");
    // Loop!
    corp = ns.corporation.getCorporation();
    ns.print(`* Current funds: $${numFormat(corp.funds)}`);
    await ns.sleep(100);
  }
  /* TIME TO GROW */
  ns.print("TIME TO GROW!");
  // Now time to get some upgrades
  const UPGRADE_LIST = [
    "FocusWires",
    "Neural Accelerators",
    "Speech Processor Implants",
    "Nuoptimal Nootropic Injector Implants",
    "Smart Factories"
  ];
  ns.print("Checking initial upgrade levels...");
  for (const upgrade of UPGRADE_LIST) {
    // Level each upgrade twice
    const DESIRED_LEVEL = 2;
    for (let i = 0; i < DESIRED_LEVEL - ns.corporation.getUpgradeLevel(upgrade); i++) {
      ns.corporation.levelUpgrade(upgrade);
    }
    ns.print(`${upgrade} is now level ${ns.corporation.getUpgradeLevel(upgrade)}`);
  }
  ns.print("Buying initial materials in each city");
  // Buy materials
  for (const city of CITY_LIST) {
    while (ns.corporation.getMaterial(DIVISION, city, "Hardware")["qty"] < 125) {
      ns.corporation.buyMaterial(DIVISION, city, "Hardware", 12.5);
      ns.corporation.buyMaterial(DIVISION, city, "AI Cores", 7.5);
      ns.corporation.buyMaterial(DIVISION, city, "Real Estate", 2.7);
      /* What a Material looks like:
      {"name":"Hardware","qty":1250,"qlt":0,"prod":0,"sell":0}
      */
      // Wait for a tick - can't use 10 seconds becaue bonus times breaks the timing
      ns.print("Waiting for Hardware quantity to reach 125...");
      await ns.sleep(50);
      ns.print("Current hardware material: " + ns.corporation.getMaterial(DIVISION, city, "Hardware")["qty"]);
    }
    ns.print("Setting materials back down to 0 purchasing");
    ns.corporation.buyMaterial(DIVISION, city, "Hardware", 0);
    ns.corporation.buyMaterial(DIVISION, city, "AI Cores", 0);
    ns.corporation.buyMaterial(DIVISION, city, "Real Estate", 0);
    corp = ns.corporation.getCorporation();
    ns.print(`* Current funds: $${numFormat(corp.funds)}`);
    // Now wait for employee stats to improve
    ns.print("Looking at Employee Happiness, Morale, and Energy");
    let average_morale = calculateAverageEmployeeStat(ns, DIVISION, city, "Morale");
    while (average_morale < 100.00) {
      ns.print("Waiting for employee morale to improve. Currently: " + average_morale);
      await ns.sleep(10000);
      average_morale = calculateAverageEmployeeStat(ns, DIVISION, city, "Morale");
    }
  }
  ns.print("Ready to move on...");
}

/**
 * Calculate running average morale/happiness/energy of employees in an office
 * @param {import("../.").NS} ns 
 * @param {string} division Name of division
 * @param {string} city Name of city
 * @param {string} stat Should be "Morale", "Happiness", or "Energy"
 * @returns True if I own both, otherwise False
 */
function calculateAverageEmployeeStat(ns, division, city, stat) {
  // If we got a bad type, assume "Morale"
  if (!["Morale", "Happiness", "Energy"].includes(stat)) stat = "Morale"
  let office = ns.corporation.getOffice(division, city);
  let average = 0;
  for (const employee of office.employees) {
    average += ns.corporation.getEmployee(division, city, employee).mor
  }
  return average / office.employees.length
}

/**
 * Check if I own both Warehouse + Office APIs
 * @param {import("../.").NS} ns 
 * @returns True if I own both, otherwise False
 */
function checkForCorpAPIs(ns) {
  return ns.corporation.hasUnlockUpgrade("Warehouse API") && ns.corporation.hasUnlockUpgrade("Office API")
}

/**
 * Improve the corp overall with research, unlocks, hiring
 * @param {import("../.").NS} ns 
 * @param {*} corp Corporation object
 * @param {string} division Name of division
 * @param {string} city Name of city
 */
async function improveCorp(ns, division, city) {
  /*
  1. Buy Wilson Analytics
  2. if AdvertInc. is cheaper than +15 Aevum, buy that
  3. Otherwise, buy +15 Aevum, hire new employees, re-assign 3 to each of the 5 roles (2 to biz, 4 to research)
  4. For each other city, increase size to be Aevum-60 
  */
  let office = ns.corporation.getOffice(division, city);
  // Can we afford Wilson Analytics?
  let wilson_cost = ns.corporation.getUpgradeLevelCost(WILSON);
  if (ns.corporation.getCorporation().funds >= wilson_cost) {
    ns.print(`Upgrading ${WILSON} for $${numFormat(wilson_cost)}`);
    ns.corporation.levelUpgrade(WILSON);
  }
  // Compare AdVert vs. expanding Aevum - go with whichever is cheaper
  const EXPANSION_SIZE = 15;
  let advert_cost = ns.corporation.getHireAdVertCost(division);
  let aevum_exp_cost = ns.corporation.getOfficeSizeUpgradeCost(division, city, EXPANSION_SIZE);
  if (advert_cost < aevum_exp_cost) {
    ns.print(`Hiring AdVert for ${numFormat(advert_cost)}`);
    ns.corporation.hireAdVert(division);
  } else {
    ns.print("Expanding office size by " + EXPANSION_SIZE);
    ns.corporation.upgradeOfficeSize(division, city, EXPANSION_SIZE);
    ns.print(`Hiring employees for ${city} office`);
    office = ns.corporation.getOffice(division, city);
    // Hire employees until we're at cap
    while (office.employees.length < office.size) {
      ns.corporation.hireEmployee(division, city);
      office = ns.corporation.getOffice(division, city);
    }
    // To assign employees, divide the total number by 5; then assign each batch to one job, then the next, etc.
    // Subtract one from Business and add one to Research & Dev from each batch
    ns.print("Assigning employees to jobs");
    await assignEmployees(ns, office.employees, division, city);
  }
}

/**
 * Assign all employees to jobs
 * @param {import("../.").NS} ns
 * @param {array} employee_list List of all employees
 * @param {string} division The division we're building in
 * @param {string} city The city office we're assigning
 */
async function assignEmployees(ns, employee_list, division, city, job_list = JOB_LIST) {
  let batch_size = Math.floor(employee_list.length / job_list.length); // use ints just in case we ever have a non-divisible-by-5 numeral
  ns.print("Assigning " + batch_size + " jobs each to " + job_list.join(", "));
  for (const role of job_list) {
    await ns.corporation.setAutoJobAssignment(division, city, role, batch_size);
  }
}

/**
 * Create a new iteratively-named product
 * @param {import("../.").NS} ns
 * @param {string} division The division we're building in
 */
function developNewProduct(ns, division) {
  let new_product_name = nextProductName(ns, division);
  ns.print("Creating new product: " + new_product_name);
  // // Safety check: make sure we don't have it, since a name collision causes a runtime error
  // while (ns.corporation.getDivision(division).products.includes(new_product_name)) {
  //   product_number += 1;
  //   new_product_name = TOBACCO_PRFX + product_number;
  // }
  // new product in numerical order, with 1b each of design and marketing investment.
  ns.corporation.makeProduct(division, "Aevum", new_product_name, 1000000000, 1000000000);
}

/**
 * Calculate the next product name
 * @param {import("../.").NS} ns
 * @param {string} division The division we're building in
 * @returns the next product name
 */
function nextProductName(ns, division) {
  let product_names = ns.corporation.getDivision(division).products.sort((a, b) => a - b);
  let last_version = 1;
  // If there are existing products, try to figure out the last one
  if (product_names.length > 0) {
    let last_char = product_names.slice(-1)[0].slice(9);
    // if the last character is a number (not NaN), use it for evaluation
    if (!isNaN(last_char)) last_version = Number(last_char);
  }
  return TOBACCO_PRFX + (last_version + 1);
}

/**
 * Discontinue the oldest product (based on name)
 * @param {import("../.").NS} 
 * @param {*} division The division we're building in
 */
async function discontinueOldestProduct(ns, division) {
  let product_names = ns.corporation.getDivision(division).products.sort((a, b) => a - b);
  // ns.print("Product names: " + product_names);
  // Safety net, don't discontinue if we have no products
  if (product_names.length == 0) return
  // Sell all of it at MP to get rid of all inventory
  ns.print(`Selling off ${product_names[0]}`);
  ns.corporation.setProductMarketTA2(division, product_names[0], false);
  ns.corporation.sellProduct(division, "Aevum", product_names[0], "MAX", "MP", true);
  ns.print("Waiting 10 seconds...");
  await ns.sleep(10000); // wait 20 seconds for two ticks to sell all inventory
  ns.print("Discontinuing product");
  // Now discontinue once we're done selling
  ns.corporation.discontinueProduct(division, product_names[0]);
}

/* This is what a Corporation object from ns.corporation.getCorporation() looks like
{
  "name": "Meatverse",
  "funds": 858309042649583.9,
  "revenue": 481473439757.02216,
  "expenses": 10966858.481108518,
  "public": true,
  "totalShares": 1500000000,
  "numShares": 100000000,
  "shareSaleCooldown": 0,
  "issuedShares": 0,
  "sharePrice": 3527317.0835508555,
  "state": "PRODUCTION",
  "divisions": [
    {
      "name": "Maetlaof",
      "type": "Agriculture",
      "awareness": 318.80060563210816,
      "popularity": 80.55360405033026,
      "prodMult": 528.7179946097363,
      "research": 78282.62184471556,
      "lastCycleRevenue": 48035874.419416204,
      "lastCycleExpenses": 9362291.263454221,
      "thisCycleRevenue": 0,
      "thisCycleExpenses": 93596683.2135016,
      "upgrades": [
        0,
        6
      ],
      "cities": [
        "Aevum",
        "Chongqing",
        "Sector-12",
        "New Tokyo",
        "Ishima",
        "Volhaven"
      ],
      "products": []
    },
    {
      "name": "Sin Sticks",
      "type": "Tobacco",
      "awareness": 108609817.00207567,
      "popularity": 116810833.63979183,
      "prodMult": 6,
      "research": 217220.7609576378,
      "lastCycleRevenue": 481425403882.6027,
      "lastCycleExpenses": 1604567.2176542967,
      "thisCycleRevenue": 0,
      "thisCycleExpenses": 16048915.431034619,
      "upgrades": [
        0,
        144
      ],
      "cities": [
        "Aevum",
        "Chongqing",
        "Sector-12",
        "New Tokyo",
        "Ishima",
        "Volhaven"
      ],
      "products": [
        "Neptune's Kingdom",
        "Plutonium",
        "Oortastic"
      ]
    }
  ]
}

What Divisions from ns.corporation.getDivision(divisionname) looks like:
[
  {
    "name": "Maetlaof",
    "type": "Agriculture",
    "awareness": 319.28060563210806,
    "popularity": 80.67300405033022,
    "prodMult": 528.7179946097363,
    "research": 78465.42167822777,
    "lastCycleRevenue": 47795060.811348274,
    "lastCycleExpenses": 9355013.752744824,
    "thisCycleRevenue": 0,
    "thisCycleExpenses": 93568552.0205201,
    "upgrades": [
      0,
      6
    ],
    "cities": [
      "Aevum",
      "Chongqing",
      "Sector-12",
      "New Tokyo",
      "Ishima",
      "Volhaven"
    ],
    "products": []
  },
  {
    "name": "Sin Sticks",
    "type": "Tobacco",
    "awareness": 108609817.48207566,
    "popularity": 116810833.7591918,
    "prodMult": 6,
    "research": 217890.33171196186,
    "lastCycleRevenue": 481359279040.9125,
    "lastCycleExpenses": 1604352.2573597457,
    "thisCycleRevenue": 0,
    "thisCycleExpenses": 16045913.734527837,
    "upgrades": [
      0,
      144
    ],
    "cities": [
      "Aevum",
      "Chongqing",
      "Sector-12",
      "New Tokyo",
      "Ishima",
      "Volhaven"
    ],
    "products": [
      "Neptune's Kingdom",
      "Plutonium",
      "Oortastic"
    ]
  }
]

What a Product looks like:
{
  "name": "Neptune's Kingdom",
  "dmd": 99.17760000000192,
  "cmp": 19.822400000000552,
  "pCost": 16231.320473274052,
  "sCost": "MP*3800",
  "cityData": {
    "Aevum": [
      49320.15759400763,
      24.84449413246525,
      24.84442147803543
    ],
    "Chongqing": [
      17711.04888482423,
      20.408641349546777,
      20.408549232704694
    ],
    "Ishima": [
      15305.149297504016,
      20.481816063471392,
      20.481733418784795
    ],
    "New Tokyo": [
      13473.037263093716,
      20.071899988208006,
      20.07190096665291
    ],
    "Sector-12": [
      17897.66908282317,
      20.417786680977766,
      20.41778418337042
    ],
    "Volhaven": [
      15643.169533826713,
      20.520137820616664,
      20.520108579617414
    ]
  },
  "developmentProgress": 100.09179492337837
}

What an Office looks like:
{
  "loc": "Aevum",
  "size": 390,
  "minEne": 0,
  "maxEne": 100,
  "minHap": 0,
  "maxHap": 100,
  "maxMor": 110,
  "employees": [
    "xS3RVpm",
    "FhEKJg6",
    ...
  ],
  "employeeProd": {
    "Operations": 66431.555991098,
    "Engineer": 71284.66524481219,
    "Business": 27966.22150579291,
    "Management": 70983.26080915287,
    "Research & Development": 68906.91757981491,
    "Training": 0
  }
}

What a Warehouse looks like:
{
  "level": 3,
  "loc": "Aevum",
  "size": 300,
  "sizeUsed": 157.41848516400472,
  "smartSupplyEnabled": true
}

*/
