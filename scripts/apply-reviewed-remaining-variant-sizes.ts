import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ReviewedUpdate = {
  readonly id: string;
  readonly sku: string;
  readonly size: string;
  readonly replaceFrom?: string;
  readonly evidence: string;
  readonly source: string;
};

type VariantRow = {
  readonly id: string;
  readonly sku: string | null;
  readonly name: string;
  readonly size: string | null;
  readonly updated_at: string;
};

type ExceptionReview = {
  readonly category:
    | "ambiguous_title"
    | "conflicting_evidence"
    | "configuration_geometry_missing"
    | "exact_configuration_missing"
    | "numbered_object_dimensions_missing"
    | "source_identity_missing"
    | "unclassified";
  readonly reason: string;
  readonly evidence: string;
  readonly nextAction: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const apply = process.argv.includes("--apply");
const unknownSize = "Không rõ";
const artifactDirectory = path.resolve(
  process.cwd(),
  "outputs/product-size-audit",
  `remaining-variants-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);

const updates: readonly ReviewedUpdate[] = [
  {
    id: "1d7177a7-0c08-4871-ac79-618e66d0181b",
    sku: "ACCCA00005",
    size: "W350 x D350 mm",
    evidence: "AMIS: kích thước Ø 35 cm",
    source: "MISA AMIS Products API exact SKU; Cassina Collection Chandigarh",
  },
  {
    id: "5db062f2-c735-4a2e-b850-0db99f0d45e7",
    sku: "ACCCA00004",
    size: "W125 x D125 mm (Cup W100 x D100 mm)",
    evidence: "AMIS: kích thước cốc ø10 cm, đĩa ø12.5 cm",
    source: "MISA AMIS Products API exact SKU; Cassina Service Prunier",
  },
  {
    id: "a2bcf4b9-fd9e-43a3-8a6a-5e1c9ecc0527",
    sku: "ACCCA00006",
    size: "W200 x D200 mm",
    evidence: "AMIS: kích thước Ø 20 cm",
    source: "MISA AMIS Products API exact SKU; Cassina Service Prunier",
  },
  {
    id: "580c634c-ce18-4cb9-ab46-1c36893c5bb2",
    sku: "ACCCA00007",
    size: "W210 x D210 mm",
    evidence: "AMIS: kích thước Ø 21 cm",
    source: "MISA AMIS Products API exact SKU; Cassina Service Prunier",
  },
  {
    id: "384c62ee-5cf9-4462-b4e4-c89cc88470a4",
    sku: "ACCCA00008",
    size: "W270 x D270 mm",
    evidence: "AMIS: kích thước Ø 27 cm",
    source: "MISA AMIS Products API exact SKU; Cassina Service Prunier",
  },
  {
    id: "df56750f-b726-4d18-8985-429b99d8f5f0",
    sku: "ACCHA00221",
    size: "W420 x H445 mm",
    evidence: "AMIS: Rộng 42 x Cao 44.5 cm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "8fbfe91f-41f5-4528-8836-b11013c0f504",
    sku: "ACCHA00293",
    size: "W640 x D280 x H700 mm",
    evidence: "AMIS: H70.0 x W64.0 x D28.0 cm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "0d03784d-469b-426d-a851-9281eafa8915",
    sku: "ACCHA00245",
    size: "W250-450 x D20 mm",
    replaceFrom: "W450 x D20 mm",
    evidence: "HAY item AD864-D012-AL56: W2 x L25-45 cm",
    source: "https://a.storyblok.com/f/315528/x/24c3bde2c2/hay_accessories_pricelist_ss26-euro_excl-_vat.pdf",
  },
  {
    id: "c43a58bf-fbd7-45ee-9231-45a58dd3c997",
    sku: "ACCHA00246",
    size: "W250-450 x D20 mm",
    replaceFrom: "W450 x D20 mm",
    evidence: "HAY item AD864-D012-AO16: W2 x L25-45 cm",
    source: "https://a.storyblok.com/f/315528/x/24c3bde2c2/hay_accessories_pricelist_ss26-euro_excl-_vat.pdf",
  },
  {
    id: "74cdc160-9fa9-415c-8e6d-9bb56d936a14",
    sku: "ACCHA00247",
    size: "W250-450 x D20 mm",
    replaceFrom: "W450 x D20 mm",
    evidence: "HAY item AD864-D012-AO17: W2 x L25-45 cm",
    source: "https://a.storyblok.com/f/315528/x/24c3bde2c2/hay_accessories_pricelist_ss26-euro_excl-_vat.pdf",
  },
  {
    id: "8684cd06-f769-48de-8439-c9b2e22fb425",
    sku: "ACCHA00248",
    size: "W400-650 x D25 mm",
    replaceFrom: "W650 x D25 mm",
    evidence: "HAY item AD864-D013-AL56: W2.5 x L40-65 cm",
    source: "https://a.storyblok.com/f/315528/x/24c3bde2c2/hay_accessories_pricelist_ss26-euro_excl-_vat.pdf",
  },
  {
    id: "88dc3e9b-1ffb-49da-8bf3-5b1728ecdf87",
    sku: "ACCHA00249",
    size: "W400-650 x D25 mm",
    replaceFrom: "W650 x D25 mm",
    evidence: "HAY item AD864-D013-AO16: W2.5 x L40-65 cm",
    source: "https://a.storyblok.com/f/315528/x/24c3bde2c2/hay_accessories_pricelist_ss26-euro_excl-_vat.pdf",
  },
  {
    id: "1260ce1f-728e-4862-803c-af17e929282f",
    sku: "ACCHA00250",
    size: "W400-650 x D25 mm",
    replaceFrom: "W650 x D25 mm",
    evidence: "HAY item AD864-D013-AO17: W2.5 x L40-65 cm",
    source: "https://a.storyblok.com/f/315528/x/24c3bde2c2/hay_accessories_pricelist_ss26-euro_excl-_vat.pdf",
  },
  {
    id: "a4ba3b74-acee-4f67-b445-934fc6c05380",
    sku: "ACCHA00257",
    size: "W1600 x D25 mm",
    evidence: "HAY item AD865-D029-AL56: W2.5 x L160 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-leash-flat-m-l-red-blue",
  },
  {
    id: "fb27d26b-15d9-4a0d-a59b-140101d3965a",
    sku: "ACCHA00258",
    size: "W1600 x D25 mm",
    evidence: "HAY item AD865-D029-AO16: W2.5 x L160 cm",
    source: "https://www.hay.com/hay/accessories/textiles/pet-space/dogs/hay-dogs-leash-flat-m-l-lavender-green",
  },
  {
    id: "7317b44f-25b1-4875-88eb-c3f8dacac5e4",
    sku: "ACCHA00259",
    size: "W1600 x D25 mm",
    evidence: "HAY item AD865-D029-AO17: W2.5 x L160 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-leash-flat-m-l-blue-off-white",
  },
  {
    id: "eb14884e-347a-4a15-830b-86ab8f9518c7",
    sku: "ACCHA00260",
    size: "W1600 x D10 mm",
    evidence: "HAY item AD865-D030-AL56: W1 x L160 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-leash-braided-m-l-red-blue",
  },
  {
    id: "8d4b66c7-c02e-48c4-b41b-d74b7fee14dd",
    sku: "ACCHA00261",
    size: "W1600 x D10 mm",
    evidence: "HAY item AD865-D030-AO16: W1 x L160 cm",
    source: "https://www.hay.com/hay/accessories/textiles/pet-space/dogs/hay-dogs-leash-braided-m-l-lavender-green",
  },
  {
    id: "01601c5c-f2b6-4bba-bea4-4113b9dbd886",
    sku: "ACCHA00262",
    size: "W1600 x D10 mm",
    evidence: "HAY item AD865-D030-AO17: W1 x L160 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-leash-braided-m-l-blue-off-white",
  },
  {
    id: "6b45f9a3-4298-49c3-b057-c463a1f69a07",
    sku: "ACCHA00251",
    size: "W155 x D155 x H70 mm",
    evidence: "HAY item AD866-A601-AL51: H7 x W15.5 x L15.5 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-bowl-small-blue-red",
  },
  {
    id: "36aac977-26ee-4bc3-bb4e-284e82d474b6",
    sku: "ACCHA00252",
    size: "W155 x D155 x H70 mm",
    evidence: "AMIS item AD866-A601-AL56; HAY Dogs Bowl Small family: H7 x W15.5 x L15.5 cm",
    source: "MISA AMIS Products API exact item; https://www.hay.com/hay/accessories/dogs/hay-dogs-bowl",
  },
  {
    id: "b241bd7b-8faf-4afa-a1be-911c68ae2644",
    sku: "ACCHA00253",
    size: "W208 x D208 x H70 mm",
    evidence: "HAY item AD866-A603-AO18: H7 x W20.8 x L20.8 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-bowl-large-yellow-blue",
  },
  {
    id: "6f420f2a-e71f-4c44-9d88-400670d227a2",
    sku: "ACCHA00254",
    size: "W208 x D208 x H70 mm",
    evidence: "HAY item AD866-A603-AO19: H7 x W20.8 x L20.8 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-bowl-large-blue-yellow",
  },
  {
    id: "d60f66c7-f6b8-4b67-ae79-8d098031e4a7",
    sku: "ACCHA00255",
    size: "W80 x D80 x H290 mm",
    evidence: "HAY item AD867-D027: H29 x W8 x L8 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-rope-toy-blue-purple-ochre",
  },
  {
    id: "cde361c6-bbb7-4a3f-bf81-f7c51b238a37",
    sku: "ACCHA00256",
    size: "W80 x D80 x H290 mm",
    evidence: "HAY item AD867-D028: H29 x W8 x L8 cm",
    source: "https://www.hay.com/hay/accessories/dogs/hay-dogs-rope-toy-red-turquoise-off-white",
  },
  {
    id: "c35e1fd9-eac9-4af0-acba-d033180624c9",
    sku: "ACCHA00377",
    size: "W70 x D70 x H190 mm",
    evidence: "HAY item AE366-D807-AB27: H19 x W7 x L7 cm",
    source: "https://www.hay.com/hay/accessories/travel/miz-water-bottle-540-ml-red",
  },
  {
    id: "9128e444-63a2-43a3-93f7-3a27b6999a9d",
    sku: "ACCHA00378",
    size: "W70 x D70 x H190 mm",
    evidence: "HAY item AE366-D807-AC37: H19 x W7 x L7 cm",
    source: "https://www.hay.com/hay/accessories/travel/miz-water-bottle-540-ml-charcoal",
  },
  {
    id: "e87ddbda-78c7-46b3-ae43-1ff9326cab1e",
    sku: "ACCHA00379",
    size: "W70 x D70 x H240 mm",
    evidence: "HAY item AE366-D808-AC37: H24 x W7 x L7 cm",
    source: "https://www.hay.com/hay/accessories/travel/miz-water-bottle-720-ml-charcoal",
  },
  {
    id: "d9fda64e-d5b6-4503-849f-52df81fc8f0c",
    sku: "ACCHA00380",
    size: "W70 x D70 x H240 mm",
    evidence: "HAY item AE366-D808-AE89: H24 x W7 x L7 cm",
    source: "https://www.hay.com/hay/accessories/travel/miz-water-bottle-720-ml-dark-blue",
  },
  {
    id: "f85a6745-da8b-452b-8208-343b73705898",
    sku: "ACCVO00008",
    size: "W480 x H410 mm",
    evidence: "AMIS: W48 x H41 cm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "20878457-5c10-4ee7-b0aa-efb7fa88522c",
    sku: "ACCCA00019",
    size: "W86 x D86 x H153 mm",
    evidence: "Cassina Home Fragrances reed diffuser 500 ml: diameter 8.6 x H15.3 cm",
    source: "https://www.cassina.com/content/dam/ld/cassina/products/h/o/m/d01-home-fragrances/09_scheda-prodotto/scheda-prodotto-home-fragrances.pdf",
  },
  {
    id: "fc335c1d-de4e-4ac4-a58b-b2784bceb0e9",
    sku: "ACCCA00016",
    size: "W110 x D110 x H110 mm",
    evidence: "Cassina Home Fragrances candle L 500 g: diameter 11 x H11 cm",
    source: "https://www.cassina.com/content/dam/ld/cassina/products/h/o/m/d01-home-fragrances/09_scheda-prodotto/scheda-prodotto-home-fragrances.pdf",
  },
  {
    id: "83bbb1da-c362-4b0b-b5e3-51ce2bdfde74",
    sku: "ACCCA00018",
    size: "W86 x D86 x H153 mm",
    evidence: "Cassina Home Fragrances reed diffuser 500 ml: diameter 8.6 x H15.3 cm",
    source: "https://www.cassina.com/content/dam/ld/cassina/products/h/o/m/d01-home-fragrances/09_scheda-prodotto/scheda-prodotto-home-fragrances.pdf",
  },
  {
    id: "aac158f5-6523-40e6-8ebe-cd850f45338b",
    sku: "ACCCA00017",
    size: "W110 x D110 x H110 mm",
    evidence: "Cassina Home Fragrances candle L 500 g: diameter 11 x H11 cm",
    source: "https://www.cassina.com/content/dam/ld/cassina/products/h/o/m/d01-home-fragrances/09_scheda-prodotto/scheda-prodotto-home-fragrances.pdf",
  },
  {
    id: "998d0980-e442-4dad-b19e-ed668315b02a",
    sku: "ACCCA00014",
    size: "W80 x D80 x H100 mm",
    evidence: "Cassina Home Fragrances candle M 330 g: diameter 8 x H10 cm",
    source: "https://www.cassina.com/content/dam/ld/cassina/products/h/o/m/d01-home-fragrances/09_scheda-prodotto/scheda-prodotto-home-fragrances.pdf",
  },
  {
    id: "e56f0cc4-a42a-48e8-b911-863ac951a801",
    sku: "ABKVT00001",
    size: "W310 x D235 x H75 mm",
    evidence: "Vitra Atlas of Furniture Design format: 31 x 23.5 x 7.5 cm",
    source: "https://www.vitra.com/en-un/product/details/atlas-of-furniture-design",
  },
  {
    id: "61aa4312-e633-42f0-963b-7b843139d1d3",
    sku: "ABKVT00002",
    size: "W245 x D170 x H21 mm",
    evidence: "Vitra Essential Eames format: 24.5 x 17 x 2.1 cm",
    source: "https://www.vitra.com/fr-lp/product/details/essential-eames",
  },
  {
    id: "32931eeb-70af-4d2b-afe0-88d0a74678bc",
    sku: "CHRVT00026",
    size: "W700-750 x D565-790 x H970-1095 mm",
    evidence: "AMIS: W700-750 x H970-1095 x D565-790 mm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "4f0846b6-602e-45b0-a5a6-0d24c764d64f",
    sku: "CHRVT00027",
    size: "W700-750 x D565-790 x H970-1095 mm",
    evidence: "AMIS: W700-750 x H970-1095 x D565-790 mm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "841e28dc-8efe-4500-ad4a-753ce2e314f4",
    sku: "CLGVT00005",
    size: "W680 x D840 x H825 mm",
    evidence: "AMIS: kích thước 680 x 840 x 825 mm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "b0d5dd1a-9f65-40f3-bd40-72c357f59ed7",
    sku: "LPLFL00074",
    size: "W1656 x D100 x H100 mm",
    evidence: "Flos: horizontal body, width 100 mm, length 1656 mm",
    source: "https://flos.com/es/es/luce-cilindrica/M-luce-cilindrica.html",
  },
  {
    id: "eb798002-1cec-4d79-83ea-df2bb53415c1",
    sku: "LPLLP00062",
    size: "W680 x D680 x H345 mm",
    evidence: "AMIS: kích thước 680 x 680 x 345 mm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "54330b1a-33a2-4689-8d3b-be17d70629e8",
    sku: "LTLHA00017",
    size: "W110 x D110 x H240 mm",
    evidence: "AMIS: W11 x D11 x H24 cm",
    source: "MISA AMIS Products API exact SKU; HAY Parade Portable Lamp 240",
  },
  {
    id: "079bb969-dc33-4f0c-9955-01e2682f5f35",
    sku: "LTLHA00020",
    size: "W110 x D110 x H240 mm",
    evidence: "AMIS: W11 x D11 x H24 cm",
    source: "MISA AMIS Products API exact SKU; HAY Parade Portable Lamp 240",
  },
  {
    id: "e7c5c506-9f81-4ec4-8c0b-92455539381a",
    sku: "LTLML00001",
    size: "W550 x D550 x H700/860 mm",
    evidence: "Martinelli Luce: diameter 55 cm, adjustable height 70-86 cm",
    source: "https://martinelliluce.it/en/pipistrello/pipistrello-620",
  },
  {
    id: "3c1c4c0a-c769-484d-a163-fbd7f6c613e7",
    sku: "LTLML00002",
    size: "W550 x D550 x H700/860 mm",
    evidence: "Martinelli Luce: diameter 55 cm, adjustable height 70-86 cm",
    source: "https://martinelliluce.it/en/pipistrello/pipistrello-620",
  },
  {
    id: "b51f9e58-07f9-4428-a01a-5f857b581324",
    sku: "LTLML00003",
    size: "W550 x D550 x H700/860 mm",
    evidence: "Martinelli Luce: diameter 55 cm, adjustable height 70-86 cm",
    source: "https://martinelliluce.it/en/pipistrello/pipistrello-620",
  },
  {
    id: "4d884b3e-a32d-43be-90c6-51af23e0a884",
    sku: "LWLVT0002",
    size: "W1040 x D300 x H35 mm",
    evidence: "AMIS: kích thước 1040 x 300 x 35 mm",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "b4d824b7-b082-490b-a56e-ba46d934052a",
    sku: "TBLVT00007",
    size: "W1210 x D1210 x H725 mm",
    evidence: "AMIS: DI121 x 72.5 cm, mặt bàn tròn",
    source: "MISA AMIS Products API exact SKU",
  },
  {
    id: "00bdb199-23d2-4f19-a440-47d6eec475e6",
    sku: "GAIA Surface Mounted/Fixed Downlight",
    size: "W75 x D75 x H100 mm",
    evidence: "Nanoco GAIA family: diameter 75 mm, height 100 mm",
    source: "https://www.thegioidien.com/PrPricelist/Nanoco-Chieu-Sang-Pricelist-042024.pdf",
  },
  {
    id: "11e8a5dd-a902-4f04-949f-f3d04f5268ce",
    sku: "LPLFL00069",
    size: "W495 x H1054 mm",
    evidence: "Flos exact Round Small + Drop Up configuration: 19.5 x 41.5 in",
    source: "https://flos.com/en/wo/arrangements---2-elements-arrangements-round-s-drop-up/B-arrangements-roundS-dropup.html",
  },
  {
    id: "fa528758-d241-41b9-b063-0f6eb89fcb13",
    sku: "AVA Track Light, DI40 x L120 mm, Adjustable, CRI90, D38, IP20, 35k hours",
    size: "W40 x D40 x H120 mm",
    evidence: "Catalog name: DI40 x L120 mm",
    source: "Supabase catalog name; diameter expands to W and D",
  },
  {
    id: "57f9d6f3-1111-4a49-b633-7a4f372e766e",
    sku: "MAIA Spotlight, DI45 x L153, Adjustable, CRI 90, D24, IP20",
    size: "W45 x D45 x H153 mm",
    evidence: "Exact OEM fingerprint: diameter 45 x length 153 mm, CRI90, 24-degree beam, IP20",
    source: "https://www.e-litelighting.com/wp-content/uploads/2026/01/E-LITE-Main-Lighting-Catalogue-Global.pdf",
  },
  {
    id: "8e853a15-7fb7-4f2e-adc5-019cb1720ef0",
    sku: "PEBBLES PENDANT LARGE CONFIGURATION 4, D300 X H1182 mm.",
    size: "W300 x D300 x H1182 mm",
    evidence: "Bomma: diameter 300 mm, height 1182 mm",
    source: "https://www.bomma.cz/product/pebbles-pendant-large-configuration-4/",
  },
  {
    id: "bf0a85e7-9197-4540-91b7-fe1a992a95c8",
    sku: "PYRITE CHANDELIER, D380 X H1430mm, 26 pcs / 13x gold / brushed gold, 13x silver / anthracite",
    size: "W380 x D380 x H1430 mm",
    evidence: "Bomma rectangular 26-piece configuration: diameter 380 mm, height 1430 mm",
    source: "https://www.bomma.cz/product/pyrite-chandelier-26-pcs-13x-gold-brushed-gold-13x-silver-anthracite-2/",
  },
  {
    id: "812eb18c-c236-41dd-9818-a231254f4ea9",
    sku: "TATU, H25 X DI8 X L20.5CM, White Grey,\nGyratory structure manufactured in pure red or white grey glossy ABS plastic.",
    size: "W205 x D80 x H250 mm",
    evidence: "Santa & Cole: H25 cm, diameter 8 cm, length 20.5 cm",
    source: "https://usa.santacole.com/recursos/productos/downloads/pdf_cotas/Tatu_td.pdf",
  },
  {
    id: "063215b0-94d1-4711-8482-25e8bb407ea9",
    sku: "RAIMOND II, R61 \nStainless Steel",
    size: "W610 x D610 x H610 mm",
    evidence: "Moooi: width, depth and height 61 cm",
    source: "https://www.moooi.com/eu/product/raimond-ii-raimond-ii-r61-stainless-steel",
  },
  {
    id: "17378089-c290-4226-9abb-df9a55474734",
    sku: "RAIMOND II, R89 \nStainless Steel",
    size: "W890 x D890 x H890 mm",
    evidence: "Moooi: width, depth and height 89 cm",
    source: "https://www.moooi.com/en/product/raimond-ii-raimond-ii-r89-stainless-steel",
  },
  {
    id: "d64afab8-f2e9-409a-9293-f99195b8f823",
    sku: "PROP LIGHT FLOOR",
    size: "W250 x D250 x H1070 mm",
    evidence: "Moooi: body diameter 25 cm, height 107 cm",
    source: "https://moooi.co.jp/item/14817.html",
  },
  {
    id: "b3784eea-f040-590f-972d-590bbfd7f24a",
    sku: "CHRBB00030",
    size: "W660 x D700 x H700 mm (SH350 mm)",
    evidence: "B&B Italia drawing AB66P: W66 x D70 x H70 cm, seat height 35 cm; AB66PN uses the same model geometry",
    source: "https://www.bebitalia.com/en-us/productpdf/download/file/id/1869/name/Abaco.pdf/",
  },
  {
    id: "b4a98d9e-2bbb-5e7f-b333-dbaa5b5428d2",
    sku: "CHRBB00031",
    size: "W1100 x D1100 x H350 mm",
    evidence: "B&B Italia Harry Large model HL110P: diameter 110 cm, height 35 cm",
    source: "https://content.bebitalia.com/Cataloghi/B%26B%20Italia_The%20Collection%202025.pdf",
  },
  {
    id: "00d6b46c-1b39-52fe-8931-bbc354cb07fd",
    sku: "CHRBB00026",
    size: "W690 x D420 x H395 mm",
    evidence: "Maxalto Febo ottoman model 2831T: 69 x 42 x H39.5 cm",
    source: "https://content.maxalto.com/Masterguide/masterguide_MAXALTO%20NEWS%202020.pdf",
  },
  {
    id: "674bd04c-9d90-4856-a506-71370969a769",
    sku: "ACCCA00009",
    size: "W130-220 mm (individual item length; 24-piece set)",
    evidence: "Cassina technical sheet: six cutlery types in the set have lengths from 13 cm to 22 cm",
    source: "https://www.cassina.com/content/dam/ld/cassina/products/l/e/-/d05-le-due-facce-della-luna/09_scheda-prodotto/scheda-prodotto-D05-le-due-facce-della-luna.pdf.coredownload.pdf",
  },
];

const reviewRetractions = [
  {
    id: "7e87ac00-a000-5cb6-b840-f73e83f748d1",
    sku: "CABBB00005",
    size: "W4140 x D465 x H2697-2699 mm (component D320-465 mm)",
    reason: "SKU chính xác không có BOM/mã model trên MISA; đối chiếu bằng bố cục ảnh chưa đủ chắc chắn để gắn size.",
  },
  {
    id: "4e197c53-bb68-5a7f-82ac-43a6eeb05365",
    sku: "CABBB00006",
    size: "W3505 x D460 x H2620 mm (component D250-460 mm)",
    reason: "MISA ghi mã FLC003 nhưng ảnh nội bộ không khớp rõ với bản vẽ FLC003 chính hãng đời cũ.",
  },
] as const;

const exceptionCategoryLabels: Record<ExceptionReview["category"], string> = {
  ambiguous_title: "Tên có kích thước nhưng ý nghĩa không chắc chắn",
  conflicting_evidence: "Nguồn dữ liệu hoặc hình ảnh mâu thuẫn",
  configuration_geometry_missing: "Thiếu bản vẽ hình học của cấu hình lắp ghép",
  exact_configuration_missing: "Thiếu mã/BOM cấu hình chính xác",
  numbered_object_dimensions_missing: "Thiếu kích thước của vật phẩm đánh số",
  source_identity_missing: "Thiếu định danh dữ liệu nguồn",
  unclassified: "Chưa phân loại",
};

function classifyException(row: VariantRow): ExceptionReview {
  if (row.id === "09864b35-7634-4f87-8cdd-abc2de58d16f") {
    return {
      category: "ambiguous_title",
      reason: "Tên ghi L1000 x W338 x D192 mm, nhưng tiết diện 338/192 mm không hợp lý với thanh ray đèn và có thể đã mất dấu thập phân (33.8/19.2).",
      evidence: "Supabase/Airtable chỉ có tên và dữ liệu thô; chưa tìm được tài liệu kỹ thuật Nanoco AVA chính xác.",
      nextAction: "Đối chiếu báo giá, file đính kèm gốc hoặc bản vẽ hãng trước khi gắn W/D/H.",
    };
  }

  if (row.id === "7e87ac00-a000-5cb6-b840-f73e83f748d1") {
    return {
      category: "exact_configuration_missing",
      reason: "FLAT C FRAME 2025 không có BOM hoặc mã model chính xác trên MISA. Bố cục ảnh gần giống một cấu hình hãng nhưng chưa đủ để xác nhận kích thước.",
      evidence: "Kích thước từng được suy từ đối chiếu trực quan ảnh SKU với một bản vẽ Flat.C Frame chính hãng.",
      nextAction: "Lấy mã cấu hình/BOM hoặc bản vẽ báo giá chính xác của SKU CABBB00005.",
    };
  }

  if (row.id === "4e197c53-bb68-5a7f-82ac-43a6eeb05365") {
    return {
      category: "conflicting_evidence",
      reason: "MISA ghi mã FLC003 nhưng ảnh nội bộ trông hẹp hơn cấu hình FLC003 trong bản vẽ chính hãng đời cũ, nên chưa thể tin cậy kích thước tổng.",
      evidence: "Mã cấu hình và hình ảnh hiện có dẫn tới hai cách nhận diện không khớp nhau.",
      nextAction: "Xác nhận lại ảnh đúng SKU, mã FLC003 và bản vẽ/báo giá gốc của CABBB00006.",
    };
  }

  if (row.id === "df9ed737-d836-5422-8ebe-3b6ba9c481f1") {
    return {
      category: "configuration_geometry_missing",
      reason: "Cấu hình Dambo DM202S + DM178LD_2 nối chaise theo góc; không thể cộng chiều rộng từng module để suy ra kích thước phủ bì.",
      evidence: "Đã có mã module MISA và bản vẽ module chính hãng B&B Italia, nhưng thiếu mặt bằng thể hiện kích thước tổng sau lắp.",
      nextAction: "Lấy bản vẽ cấu hình hoặc báo giá đại lý của đúng tổ hợp này.",
    };
  }

  if (row.id === "decde22e-488c-5f10-b1a4-fb4a8514c048") {
    return {
      category: "configuration_geometry_missing",
      reason: "Jack là hệ module sàn-trần với nhiều lựa chọn bề rộng khoang, độ sâu kệ và chiều cao trụ tăng chỉnh; SKU không có BOM.",
      evidence: "Ảnh chỉ cho thấy bốn khoang, không đủ xác định bề rộng, độ sâu và chiều cao trụ đã chọn.",
      nextAction: "Lấy mã cấu hình/BOM Jack hoặc bản vẽ từ đại lý.",
    };
  }

  if (row.id === "de1efee1-5237-508b-b692-7b37d7ec5f2f") {
    return {
      category: "configuration_geometry_missing",
      reason: "Tufty-Time 20 gồm TY115BS_3 + TY140CV_3 + TY140PV_3 + T60_C; hai module 140 cong nên kích thước rời không xác định được W/D tổng sau lắp.",
      evidence: "Đã xác nhận mã module MISA và kích thước module chính hãng; còn thiếu mặt bằng của đúng cấu hình lắp.",
      nextAction: "Lấy bản vẽ tổ hợp chính xác từ configurator hoặc báo giá đại lý B&B.",
    };
  }

  if (row.id === "9d955cf7-d66d-5f77-a8ad-0c88726a27d7") {
    return {
      category: "configuration_geometry_missing",
      reason: "Untitled gồm U247D + U100PQ + U210LD + U110AD. U247D đặt góc và tổ hợp không thẳng hàng nên kích thước module rời không xác định được W/D tổng.",
      evidence: "Đã xác nhận bản vẽ module chính hãng; nhãn AM140G trên MISA mâu thuẫn với BOM Untitled và thuộc dòng sản phẩm khác.",
      nextAction: "Lấy mặt bằng lắp ghép chính xác hoặc bản vẽ cấu hình từ đại lý.",
    };
  }

  if (row.id === "f5bd8072-3f32-489c-a126-0f39387fe57d") {
    return {
      category: "source_identity_missing",
      reason: "Bản ghi placeholder không có SKU, liên kết sản phẩm, hình ảnh, dữ liệu nguồn hoặc kích thước.",
      evidence: "Bản ghi Supabase chỉ còn Airtable record id recAX2FZNQ5iXNpz5.",
      nextAction: "Khôi phục định danh bản ghi nguồn hoặc đưa variant mồ côi vào đợt dọn catalog riêng.",
    };
  }

  if (row.sku?.startsWith("ACCBD")) {
    return {
      category: "numbered_object_dimensions_missing",
      reason: "REMIX VOL.4 DNA là tổ hợp kính nhiều mảnh, đánh số riêng; số thứ tự và số lượng mảnh không mã hóa W/D/H.",
      evidence: "Catalog BD Barcelona hiện có xác định số vật phẩm và số mảnh nhưng không ghi kích thước vật lý theo từng số.",
      nextAction: "Xin bảng kích thước vật phẩm đánh số từ BD Barcelona hoặc đo sản phẩm thực tế.",
    };
  }

  if (row.sku?.startsWith("USM Haller Cabinet No.")) {
    return {
      category: "exact_configuration_missing",
      reason: "Tên No.x và ảnh không chứa BOM module USM để phân biệt bề rộng khoang, độ sâu, chiều cao chân/bánh xe và chiều cao tổng.",
      evidence: "Supabase/Airtable có ảnh nhưng không có mã cấu hình hoặc trường kích thước.",
      nextAction: "Đối chiếu ảnh với mã quick-ship/cấu hình chính hãng USM hoặc lấy BOM đơn hàng gốc.",
    };
  }

  if (
    row.id === "8afc4b8c-7c89-490d-b5aa-4f173e3ab083"
    || row.id === "07f69f8d-cbcc-4f8a-a182-6b88b9b4d4ab"
    || row.id === "d31b34ca-4f9d-439e-84c8-3fad57577697"
  ) {
    return {
      category: "exact_configuration_missing",
      reason: "Tên chỉ xác định hệ/dòng Martinelli Luce có nhiều cấu hình, không có chiều dài module, diffuser/canopy hoặc mã tổ hợp đã chọn.",
      evidence: "Trang chính hãng liệt kê nhiều kích thước/cấu hình hợp lệ.",
      nextAction: "Lấy mã hãng hoặc dòng báo giá chính xác trước khi gắn kích thước.",
    };
  }

  return {
    category: "unclassified",
    reason: "Chưa có quy tắc đã duyệt phù hợp với bản ghi này.",
    evidence: "Đợt kiểm tra variant chưa có size trên Supabase.",
    nextAction: "Cần kiểm thủ công.",
  };
}

function markdownCell(value: string | null | undefined): string {
  return (value ?? "—").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function buildNeedsReviewMarkdown(
  exceptionItems: readonly (VariantRow & ExceptionReview)[],
  exceptionCounts: Readonly<Record<string, number>>,
): string {
  const lines = [
    "# Danh sách variant cần kiểm kích thước",
    "",
    `- Cần kiểm size: **${exceptionItems.length} variant**.`,
    `- Trạng thái: trường size đã ghi \`${unknownSize}\`; không gắn kích thước suy đoán.`,
    "",
    "## Tổng hợp",
    "",
    "| Nhóm ngoại lệ | Số lượng |",
    "| --- | ---: |",
    ...Object.entries(exceptionCounts).map(([category, count]) =>
      `| ${markdownCell(exceptionCategoryLabels[category as ExceptionReview["category"]] ?? category)} | ${count} |`
    ),
  ];

  for (const category of Object.keys(exceptionCategoryLabels) as ExceptionReview["category"][]) {
    const items = exceptionItems.filter((item) => item.category === category);
    if (items.length === 0) continue;
    lines.push(
      "",
      `## ${exceptionCategoryLabels[category]} (${items.length})`,
      "",
      "| SKU | Tên đầy đủ sản phẩm | Variant ID | Lý do chưa gắn size | Cần bổ sung/đối chiếu |",
      "| --- | --- | --- | --- | --- |",
      ...items.map((item) =>
        `| ${markdownCell(item.sku)} | ${markdownCell(item.name)} | \`${item.id}\` | ${markdownCell(item.reason)} | ${markdownCell(item.nextAction)} |`
      ),
    );
  }

  return `${lines.join("\n")}\n`;
}

async function rest<T>(query: URLSearchParams, init: RequestInit = {}): Promise<T> {
  const url = new URL("/rest/v1/variants", SUPABASE_URL);
  url.search = query.toString();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY!}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Variants request failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function main(): Promise<void> {
  await mkdir(artifactDirectory, { recursive: true });

  const ids = [...updates, ...reviewRetractions].map(({ id }) => id);
  const rows = await rest<VariantRow[]>(
    new URLSearchParams({
      select: "id,sku,name,size,updated_at",
      id: `in.(${ids.join(",")})`,
      order: "id.asc",
    }),
  );
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const preflight = updates.map((update) => {
    const row = rowsById.get(update.id);
    if (!row) return { ...update, status: "missing" as const };
    if (row.sku !== update.sku) {
      return { ...update, status: "sku_mismatch" as const, actualSku: row.sku, currentSize: row.size };
    }
    const expectedCurrentSize = update.replaceFrom ?? null;
    if (row.size !== update.size && row.size !== expectedCurrentSize) {
      return { ...update, status: "already_has_different_size" as const, currentSize: row.size };
    }
    return {
      ...update,
      status: row.size === update.size ? "already_applied" as const : "ready" as const,
      currentSize: row.size,
      updatedAt: row.updated_at,
      name: row.name,
    };
  });
  const retractionPreflight = reviewRetractions.map((retraction) => {
    const row = rowsById.get(retraction.id);
    if (!row) return { ...retraction, status: "missing" as const };
    if (row.sku !== retraction.sku) {
      return {
        ...retraction,
        status: "sku_mismatch" as const,
        actualSku: row.sku,
        currentSize: row.size,
      };
    }
    if (row.size !== retraction.size && row.size !== null && row.size !== unknownSize) {
      return {
        ...retraction,
        status: "already_has_different_size" as const,
        currentSize: row.size,
      };
    }
    return {
      ...retraction,
      status: row.size === unknownSize ? "already_retracted" as const : "ready" as const,
      currentSize: row.size,
      updatedAt: row.updated_at,
      name: row.name,
    };
  });

  const applied: string[] = [];
  const stale: string[] = [];
  const retracted: string[] = [];
  const retractionStale: string[] = [];
  if (apply) {
    for (const item of preflight) {
      if (item.status !== "ready") continue;
      const changed = await rest<VariantRow[]>(
        new URLSearchParams({
          id: `eq.${item.id}`,
          size: item.replaceFrom === undefined ? "is.null" : `eq.${item.replaceFrom}`,
          updated_at: `eq.${item.updatedAt}`,
        }),
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ size: item.size }),
        },
      );
      if (changed.length === 1 && changed[0]?.size === item.size) {
        applied.push(item.id);
      } else {
        stale.push(item.id);
      }
    }
    for (const item of retractionPreflight) {
      if (item.status !== "ready") continue;
      const changed = await rest<VariantRow[]>(
        new URLSearchParams({
          id: `eq.${item.id}`,
          size: item.currentSize === null ? "is.null" : `eq.${item.currentSize}`,
          updated_at: `eq.${item.updatedAt}`,
        }),
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ size: unknownSize }),
        },
      );
      if (changed.length === 1 && changed[0]?.size === unknownSize) {
        retracted.push(item.id);
      } else {
        retractionStale.push(item.id);
      }
    }
  }

  const remaining = await rest<VariantRow[]>(
    new URLSearchParams({
      select: "id,sku,name,size,updated_at",
      or: `(size.is.null,size.eq.${unknownSize})`,
      order: "name.asc",
      limit: "1000",
    }),
  );
  const exceptionItems = remaining.map((row) => ({ ...row, ...classifyException(row) }));
  const exceptionCounts = Object.fromEntries(
    [...new Set(exceptionItems.map(({ category }) => category))]
      .sort()
      .map((category) => [
        category,
        exceptionItems.filter((item) => item.category === category).length,
      ]),
  );
  const report = {
    apply,
    reviewed: updates.length,
    ready: preflight.filter(({ status }) => status === "ready").length,
    alreadyApplied: preflight.filter(({ status }) => status === "already_applied").length,
    blocked: preflight.filter(({ status }) => status !== "ready" && status !== "already_applied").length,
    applied,
    stale,
    movedToReview: reviewRetractions.length,
    retractionReady: retractionPreflight.filter(({ status }) => status === "ready").length,
    alreadyRetracted: retractionPreflight.filter(({ status }) => status === "already_retracted").length,
    retractionBlocked: retractionPreflight.filter(
      ({ status }) => status !== "ready" && status !== "already_retracted"
    ).length,
    retracted,
    retractionStale,
    remainingWithoutSize: remaining.length,
    remainingExceptionsByCategory: exceptionCounts,
    preflight,
    retractionPreflight,
  };

  await Promise.all([
    writeFile(path.join(artifactDirectory, "reviewed-updates.json"), JSON.stringify(report, null, 2)),
    writeFile(path.join(artifactDirectory, "rollback.json"), JSON.stringify(
      preflight.flatMap((item) =>
        item.status === "ready" && applied.includes(item.id)
          ? [{ id: item.id, sku: item.sku, size: item.currentSize }]
          : []
      ),
      null,
      2,
    )),
    writeFile(path.join(artifactDirectory, "remaining-without-size.json"), JSON.stringify(remaining, null, 2)),
    writeFile(path.join(artifactDirectory, "remaining-exceptions.json"), JSON.stringify({
      count: exceptionItems.length,
      byCategory: exceptionCounts,
      items: exceptionItems,
    }, null, 2)),
    writeFile(
      path.join(artifactDirectory, "moved-to-review.json"),
      JSON.stringify(retractionPreflight, null, 2),
    ),
    writeFile(
      path.join(artifactDirectory, "NEEDS-REVIEW.md"),
      buildNeedsReviewMarkdown(exceptionItems, exceptionCounts),
    ),
  ]);

  process.stdout.write(`${JSON.stringify({
    artifactDirectory,
    ...report,
    preflight: undefined,
    retractionPreflight: undefined,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
