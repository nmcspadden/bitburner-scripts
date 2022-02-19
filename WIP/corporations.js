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

/** @param {import("../.").NS} ns **/
export async function main(ns) {
    let corp = ns.corporation.getCorporation();
    // In my corp right now, this is the second item in the array
    // TODO: Add a function to find a given division based on type
    let division_tobacco = corp.divisions[1].name; // "Sin Sticks"
    let products = ns.corporation.getDivision(division_tobacco).products;
    while (true) {
        // Set all products to TA.II
        ns.tprint("Setting product to TA.II");
        products.forEach(prod => ns.corporation.setProductMarketTA2(division_tobacco, prod, true));
        // Are any products in dev progress?
        let in_dev = products.find(prod => ns.corporation.getProduct(division_tobacco, prod).developmentProgress < 100);
        if (!in_dev) {
            //discontinue the oldest/crappiest one if nothing's in development right now
            // Naively assume the first product in the list is the oldest
            let product_to_remove = products[0].name;
            // Sell all of it at MP to get rid of all inventory
            ns.corporation.sellProduct(division_tobacco, "Aevum", product_to_remove, "MAX", "MP", true)
            // Wait until we have no more
            while (ns.corporation.getDivision(division_tobacco).products[product_to_remove]) {
                // something?
            }
        }
    }
}