const PRODUCT_CAPACITY_UPGRADE = "uPgrade: Capacity.I";
const TOBACCO_PRFX = "Tobacco-v";

/** @param {import("../.").NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();
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
      developNewProduct(ns);
      product_names = ns.corporation.getDivision(division_tobacco).products;
    }
    // Are any products in dev progress?
    let in_dev = product_names.find(prod => ns.corporation.getProduct(division_tobacco, prod).developmentProgress < 100);
    ns.print("In development product: " + in_dev)
    // If nothing is in development, then we should sell off + discontinue the oldest one
    if (!in_dev) {
      await discontinueOldestProduct(ns);
    }
    product_names = ns.corporation.getDivision(division_tobacco).products;
    ns.print("Sleeping for 5 seconds");
    await ns.sleep(5000); // sleep for 5 seconds  
  }
}

function developNewProduct(ns) {
  let new_product_name = nextProductName(ns);
  ns.print("Creating new product: " + new_product_name);
  // Safety check: make sure we don't have it, since a name collision causes a runtime error
  while (ns.corporation.getDivision(division_tobacco).products.includes(new_product_name)) {
    product_number += 1;
    new_product_name = TOBACCO_PRFX + product_number;
  }
  // new product in numerical order, with 1b each of design and marketing investment.
  ns.corporation.makeProduct(division_tobacco, "Aevum", new_product_name, 1000000000, 1000000000);
}

function nextProductName(ns) {
  let product_names = ns.corporation.getDivision(division_tobacco).products.sort();
  let last_version = 1;
  // If there are existing products, try to figure out the last one
  if (product_names.length > 0) {
    let last_char = product_names.slice(-1)[0].slice(-1);
    // if the last character is a number (not NaN), use it for evaluation
    if (!isNaN(last_char)) last_version = last_char;
  }
  return TOBACCO_PRFX + last_version + 1;
}

async function discontinueOldestProduct(ns) {
  let product_names = ns.corporation.getDivision(division_tobacco).products.sort();
  // Safety net, don't discontinue if we have no products
  if (product_names.length == 0) return
  // Sell all of it at MP to get rid of all inventory
  ns.print(`Selling off ${product_names[0]}`);
  ns.corporation.setProductMarketTA2(division_tobacco, product_names[0], false);
  ns.corporation.sellProduct(division_tobacco, "Aevum", product_names[0], "MAX", "MP", true);
  ns.print("Waiting 20 seconds...");
  await ns.sleep(20000); // wait 20 seconds for two ticks to sell all inventory
  ns.print("Discontinuing product");
  // Now discontinue once we're done selling
  ns.corporation.discontinueProduct(division_tobacco, product_names[0]);
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
*/
