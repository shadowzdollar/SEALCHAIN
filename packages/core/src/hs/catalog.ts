/**
 * Curated subset of the EAC Common External Tariff (CET, 2022 version with the
 * 35% fourth band), focused on the products Rwandan SMEs actually export.
 *
 * IMPORTANT: rates here are INDICATIVE. They were compiled from secondary
 * sources during planning and have not yet been confirmed against the gazetted
 * CET by the compliance-research role. The platform surfaces this status to
 * users (`CATALOG_SOURCE.lastVerifiedAt === null`) and the validation engine
 * emits a warning for unverified entries. Overrides confirmed by the compliance
 * team are stored in the database (tariff_overrides) and take precedence.
 *
 * For EAC-originating goods traded between Partner States the applicable duty
 * is 0% when supported by a valid EAC Certificate of Origin — the CET rate
 * below is what the consignee risks paying WITHOUT proof of origin.
 */
import type { QuantityUnit, RuleSource } from '../types';

export interface TariffLine {
  /** 8 digits, no dots */
  code: string;
  description: string;
  /** Extra search terms: trade names, local names, common misspellings. */
  keywords: string[];
  /** Ad valorem CET rate in percent. */
  cetRate: number;
  /** Set for items on the EAC Sensitive List (rate differs from band). */
  sensitive?: boolean;
  /** Supplementary unit customs expects alongside kg. */
  unit: QuantityUnit;
  /** Requirement ids (see corridors) triggered by this line. */
  requirements?: string[];
  note?: string;
}

export const CATALOG_SOURCE: RuleSource = {
  title: 'EAC Common External Tariff 2022 (indicative extract)',
  url: 'https://www.eac.int/customs/common-external-tariff',
  lastVerifiedAt: null,
};

const PHYTO = ['PHYTO', 'KEPHIS_PERMIT'];
const VET = ['VET_CERT', 'KE_DVS_PERMIT'];

export const TARIFF_CATALOG: TariffLine[] = [
  // --- Chapter 01-05: live animals & animal products
  { code: '01022900', description: 'Live bovine animals (cattle), other than pure-bred breeding', keywords: ['cattle', 'cow', 'cows', 'bull', 'livestock', 'inka'], cetRate: 25, unit: 'HEAD', requirements: VET },
  { code: '01049000', description: 'Live goats', keywords: ['goat', 'goats', 'ihene', 'livestock'], cetRate: 25, unit: 'HEAD', requirements: VET },
  { code: '02013000', description: 'Meat of bovine animals, fresh or chilled, boneless', keywords: ['beef', 'meat', 'boneless beef'], cetRate: 35, unit: 'KG', requirements: VET },
  { code: '03028900', description: 'Fish, fresh or chilled, other (including tilapia)', keywords: ['fish', 'tilapia', 'sambaza', 'fresh fish'], cetRate: 35, unit: 'KG', requirements: VET },
  { code: '04012000', description: 'Milk and cream, not concentrated nor sweetened, fat content >1% but ≤6%', keywords: ['milk', 'fresh milk', 'uht milk', 'amata', 'dairy'], cetRate: 60, sensitive: true, unit: 'L', requirements: VET, note: 'EAC Sensitive List — dairy.' },
  { code: '04032000', description: 'Yogurt', keywords: ['yoghurt', 'yogurt', 'ikivuguto', 'dairy'], cetRate: 60, sensitive: true, unit: 'KG', requirements: VET },
  { code: '04051000', description: 'Butter', keywords: ['butter', 'dairy', 'ghee'], cetRate: 60, sensitive: true, unit: 'KG', requirements: VET },
  { code: '04069000', description: 'Cheese, other', keywords: ['cheese', 'gouda', 'dairy'], cetRate: 60, sensitive: true, unit: 'KG', requirements: VET },
  { code: '04090000', description: 'Natural honey', keywords: ['honey', 'ubuki', 'bee honey'], cetRate: 35, unit: 'KG', requirements: VET },
  { code: '41015000', description: 'Raw hides and skins of bovine animals, whole, weight > 16 kg', keywords: ['hides', 'raw hides', 'cattle hides', 'skins', 'leather raw'], cetRate: 10, unit: 'KG', requirements: VET, note: 'Raw hides attract an EAC export duty when leaving the Community; not applicable intra-EAC.' },
  { code: '41021000', description: 'Raw skins of sheep or lambs, with wool on', keywords: ['sheep skins', 'skins'], cetRate: 10, unit: 'KG', requirements: VET },

  // --- Chapter 06-14: vegetable products
  { code: '06031100', description: 'Cut flowers and flower buds, fresh: roses', keywords: ['roses', 'flowers', 'cut flowers', 'rose'], cetRate: 35, unit: 'STEM', requirements: PHYTO },
  { code: '06031900', description: 'Cut flowers and flower buds, fresh: other', keywords: ['flowers', 'cut flowers', 'summer flowers', 'hypericum', 'chrysanthemum'], cetRate: 35, unit: 'STEM', requirements: PHYTO },
  { code: '07019000', description: 'Potatoes, fresh or chilled, other than seed', keywords: ['potato', 'potatoes', 'irish potatoes', 'ibirayi'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07020000', description: 'Tomatoes, fresh or chilled', keywords: ['tomato', 'tomatoes', 'inyanya'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07031000', description: 'Onions and shallots, fresh or chilled', keywords: ['onion', 'onions', 'shallots', 'ibitunguru'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07082000', description: 'Beans (Vigna spp., Phaseolus spp.), fresh or chilled', keywords: ['french beans', 'green beans', 'fine beans', 'haricot vert', 'fresh beans'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07096000', description: 'Fruits of the genus Capsicum or Pimenta, fresh or chilled', keywords: ['chili', 'chilli', 'chillies', 'pepper', 'hot pepper', 'birds eye', 'urusenda', 'capsicum'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07133300', description: 'Kidney beans, including white pea beans, dried, shelled', keywords: ['beans', 'dry beans', 'dried beans', 'kidney beans', 'ibishyimbo', 'pulses'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07139000', description: 'Dried leguminous vegetables, shelled, other', keywords: ['peas', 'dried peas', 'pulses', 'lentils'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '07141000', description: 'Manioc (cassava), fresh, chilled, frozen or dried', keywords: ['cassava', 'manioc', 'imyumbati', 'cassava chips'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08026200', description: 'Macadamia nuts, shelled', keywords: ['macadamia', 'macadamia nuts', 'nuts', 'kernels'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08026100', description: 'Macadamia nuts, in shell', keywords: ['macadamia in shell', 'nut in shell', 'macadamia'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08039000', description: 'Bananas, fresh or dried (other than plantains)', keywords: ['banana', 'bananas', 'ibitoki', 'sweet banana'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08043000', description: 'Pineapples, fresh or dried', keywords: ['pineapple', 'pineapples', 'inanasi'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08044000', description: 'Avocados, fresh or dried', keywords: ['avocado', 'avocados', 'hass', 'fuerte', 'avoka'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08045000', description: 'Guavas, mangoes and mangosteens, fresh or dried', keywords: ['mango', 'mangoes', 'guava'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '08109000', description: 'Other fresh fruit (including passion fruit, tree tomato)', keywords: ['passion fruit', 'maracuja', 'tree tomato', 'tamarillo', 'fruit'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '09011100', description: 'Coffee, not roasted, not decaffeinated', keywords: ['coffee', 'green coffee', 'arabica', 'fully washed', 'parchment', 'ikawa', 'coffee beans', 'raw coffee'], cetRate: 35, unit: 'KG', requirements: ['NAEB_EXPORT', ...PHYTO] },
  { code: '09012100', description: 'Coffee, roasted, not decaffeinated', keywords: ['roasted coffee', 'ground coffee', 'coffee roasted', 'ikawa'], cetRate: 35, unit: 'KG', requirements: ['NAEB_EXPORT'] },
  { code: '09021000', description: 'Green tea (not fermented) in packings ≤ 3 kg', keywords: ['green tea', 'tea bags green'], cetRate: 35, unit: 'KG', requirements: ['NAEB_EXPORT'] },
  { code: '09023000', description: 'Black tea (fermented) in immediate packings ≤ 3 kg', keywords: ['tea', 'black tea', 'tea bags', 'packed tea', 'icyayi'], cetRate: 35, unit: 'KG', requirements: ['NAEB_EXPORT'] },
  { code: '09024000', description: 'Black tea (fermented), other (bulk)', keywords: ['tea', 'black tea', 'bulk tea', 'ctc', 'made tea', 'icyayi'], cetRate: 35, unit: 'KG', requirements: ['NAEB_EXPORT'] },
  { code: '09042100', description: 'Fruits of genus Capsicum, dried, neither crushed nor ground', keywords: ['dried chili', 'dried chilli', 'dry pepper', 'urusenda'], cetRate: 35, unit: 'KG', requirements: PHYTO },
  { code: '10059000', description: 'Maize (corn), other than seed', keywords: ['maize', 'corn', 'ibigori', 'grain'], cetRate: 50, sensitive: true, unit: 'KG', requirements: PHYTO, note: 'EAC Sensitive List — maize.' },
  { code: '10063000', description: 'Rice, semi-milled or wholly milled', keywords: ['rice', 'umuceri', 'milled rice'], cetRate: 75, sensitive: true, unit: 'KG', requirements: PHYTO, note: 'EAC Sensitive List — rice.' },
  { code: '10079000', description: 'Grain sorghum, other than seed', keywords: ['sorghum', 'amasaka'], cetRate: 50, sensitive: true, unit: 'KG', requirements: PHYTO },
  { code: '11010000', description: 'Wheat or meslin flour', keywords: ['wheat flour', 'flour', 'ifarini'], cetRate: 60, sensitive: true, unit: 'KG' },
  { code: '11022000', description: 'Maize (corn) flour', keywords: ['maize flour', 'corn flour', 'kawunga', 'posho', 'ugali flour'], cetRate: 50, sensitive: true, unit: 'KG' },
  { code: '11062000', description: 'Flour, meal and powder of sago or of roots/tubers (cassava flour)', keywords: ['cassava flour', 'ubugari', 'tapioca flour'], cetRate: 35, unit: 'KG' },
  { code: '12019000', description: 'Soya beans, other than seed', keywords: ['soya', 'soy', 'soybeans', 'soja'], cetRate: 10, unit: 'KG', requirements: PHYTO },
  { code: '13021400', description: 'Vegetable saps and extracts of pyrethrum or of the roots of plants containing rotenone', keywords: ['pyrethrum', 'pyrethrum extract', 'pyrethrin'], cetRate: 0, unit: 'KG' },

  // --- Chapter 15-24: prepared foodstuffs & beverages
  { code: '15121900', description: 'Sunflower-seed or safflower oil, refined', keywords: ['sunflower oil', 'cooking oil', 'vegetable oil', 'amavuta'], cetRate: 35, unit: 'L' },
  { code: '17019900', description: 'Cane or beet sugar, refined, solid', keywords: ['sugar', 'isukari', 'refined sugar'], cetRate: 100, sensitive: true, unit: 'KG', note: 'EAC Sensitive List — sugar.' },
  { code: '19059000', description: 'Bread, pastry, cakes, biscuits and other bakers’ wares', keywords: ['biscuits', 'bread', 'cakes', 'pastry', 'cookies'], cetRate: 35, unit: 'KG' },
  { code: '20079900', description: 'Jams, fruit jellies, marmalades, fruit purée and pastes, other', keywords: ['jam', 'fruit jam', 'marmalade', 'puree'], cetRate: 35, unit: 'KG' },
  { code: '20098900', description: 'Juice of any other single fruit or vegetable, unfermented', keywords: ['juice', 'passion juice', 'fruit juice', 'umutobe'], cetRate: 35, unit: 'L' },
  { code: '21039000', description: 'Sauces and preparations therefor; mixed condiments and seasonings', keywords: ['chili sauce', 'akabanga', 'pili pili oil', 'sauce', 'seasoning'], cetRate: 35, unit: 'KG' },
  { code: '22011000', description: 'Mineral waters and aerated waters, not sweetened', keywords: ['water', 'mineral water', 'bottled water', 'amazi'], cetRate: 35, unit: 'L' },
  { code: '22021000', description: 'Waters incl. mineral and aerated, with added sugar or flavour (soft drinks)', keywords: ['soda', 'soft drink', 'fanta', 'soft drinks'], cetRate: 35, unit: 'L' },
  { code: '22030000', description: 'Beer made from malt', keywords: ['beer', 'lager', 'inzoga', 'malt beer'], cetRate: 35, unit: 'L' },
  { code: '22060000', description: 'Other fermented beverages (e.g. banana beer, cider)', keywords: ['banana wine', 'urwagwa', 'banana beer', 'cider', 'fermented beverage'], cetRate: 35, unit: 'L' },
  { code: '23099000', description: 'Preparations of a kind used in animal feeding, other', keywords: ['animal feed', 'poultry feed', 'cattle feed', 'fish feed'], cetRate: 10, unit: 'KG' },

  // --- Chapter 25-27: mineral products
  { code: '25232900', description: 'Portland cement, other than white', keywords: ['cement', 'portland cement', 'sima'], cetRate: 25, unit: 'KG' },
  { code: '26090000', description: 'Tin ores and concentrates', keywords: ['cassiterite', 'tin ore', 'tin', 'gasegereti', '3t'], cetRate: 0, unit: 'KG', requirements: ['ICGLR_RCM', 'RMB_EXPORT'] },
  { code: '26110000', description: 'Tungsten ores and concentrates', keywords: ['wolfram', 'wolframite', 'tungsten', '3t'], cetRate: 0, unit: 'KG', requirements: ['ICGLR_RCM', 'RMB_EXPORT'] },
  { code: '26159000', description: 'Niobium, tantalum or vanadium ores and concentrates', keywords: ['coltan', 'tantalum', 'columbite', 'niobium', 'tantalite', '3t'], cetRate: 0, unit: 'KG', requirements: ['ICGLR_RCM', 'RMB_EXPORT'] },

  // --- Chapter 28-40: chemicals, plastics
  { code: '30049000', description: 'Medicaments, packaged for retail sale, other', keywords: ['medicine', 'medicines', 'pharmaceuticals', 'drugs', 'tablets'], cetRate: 0, unit: 'KG', requirements: ['KE_PPB_PERMIT'] },
  { code: '33012900', description: 'Essential oils, other than of citrus fruit', keywords: ['essential oil', 'geranium oil', 'patchouli', 'lemongrass oil'], cetRate: 10, unit: 'KG' },
  { code: '34011900', description: 'Soap and organic surface-active products in bars/cakes, other than toilet', keywords: ['soap', 'bar soap', 'laundry soap', 'isabune'], cetRate: 25, unit: 'KG' },
  { code: '32091000', description: 'Paints and varnishes based on acrylic or vinyl polymers, aqueous', keywords: ['paint', 'emulsion paint', 'varnish'], cetRate: 25, unit: 'L' },
  { code: '39232100', description: 'Sacks and bags of polymers of ethylene', keywords: ['plastic bags', 'polythene bags', 'sacks'], cetRate: 25, unit: 'KG', note: 'Rwanda restricts single-use plastics; confirm the product is permitted.' },
  { code: '39241000', description: 'Tableware and kitchenware of plastics', keywords: ['plastic plates', 'plastic cups', 'kitchenware'], cetRate: 35, unit: 'KG' },

  // --- Chapter 41-67: leather, wood, paper, textiles, footwear
  { code: '42022200', description: 'Handbags with outer surface of plastic sheeting or textile materials', keywords: ['handbags', 'bags', 'imigongo bags'], cetRate: 35, unit: 'PCS' },
  { code: '44071100', description: 'Wood sawn lengthwise, coniferous (pine)', keywords: ['timber', 'sawn wood', 'pine', 'planks'], cetRate: 25, unit: 'M' },
  { code: '46021900', description: 'Basketwork, wickerwork of other vegetable materials (handicrafts)', keywords: ['baskets', 'agaseke', 'peace basket', 'handicrafts', 'woven baskets', 'sisal baskets'], cetRate: 35, unit: 'PCS' },
  { code: '48191000', description: 'Cartons, boxes and cases, of corrugated paper or paperboard', keywords: ['cartons', 'boxes', 'corrugated boxes', 'packaging'], cetRate: 25, unit: 'KG' },
  { code: '61091000', description: 'T-shirts, singlets and other vests, knitted, of cotton', keywords: ['t-shirts', 'tshirts', 'tee shirts', 'vests', 'cotton shirts'], cetRate: 35, unit: 'PCS' },
  { code: '62034200', description: 'Men’s or boys’ trousers and shorts, of cotton', keywords: ['trousers', 'jeans', 'shorts', 'pants'], cetRate: 35, unit: 'PCS' },
  { code: '62044200', description: 'Women’s or girls’ dresses, of cotton', keywords: ['dresses', 'kitenge dresses', 'african print dress', 'dress'], cetRate: 35, unit: 'PCS' },
  { code: '63042000', description: 'Bed nets specified in Subheading Note 1 to Chapter 63', keywords: ['mosquito nets', 'bed nets', 'llin'], cetRate: 0, unit: 'PCS' },
  { code: '64039900', description: 'Footwear with outer soles of rubber/plastics/leather and uppers of leather, other', keywords: ['shoes', 'leather shoes', 'footwear', 'inkweto'], cetRate: 35, unit: 'PR' },

  // --- Chapter 71-83: precious metals, base metals
  { code: '71081200', description: 'Gold, non-monetary, other unwrought forms', keywords: ['gold', 'gold dore', 'gold bars', 'zahabu'], cetRate: 0, unit: 'KG', requirements: ['ICGLR_RCM', 'RMB_EXPORT'] },
  { code: '72142000', description: 'Bars and rods of iron or non-alloy steel, with indentations or ribs (rebar)', keywords: ['rebar', 'steel bars', 'iron bars', 'reinforcement bars', 'deformed bars'], cetRate: 35, unit: 'KG' },
  { code: '72107000', description: 'Flat-rolled iron/steel, painted, varnished or plastic-coated (roofing sheets)', keywords: ['roofing sheets', 'iron sheets', 'mabati', 'coated sheets'], cetRate: 35, unit: 'KG' },
  { code: '73269000', description: 'Other articles of iron or steel', keywords: ['metal articles', 'steel products', 'wire mesh'], cetRate: 25, unit: 'KG' },

  // --- Chapter 84-96: machinery, electronics, furniture
  { code: '84713000', description: 'Portable automatic data-processing machines ≤ 10 kg (laptops)', keywords: ['laptop', 'laptops', 'notebook computer', 'computer'], cetRate: 0, unit: 'PCS' },
  { code: '85171300', description: 'Smartphones', keywords: ['smartphone', 'smartphones', 'mobile phone', 'phones', 'mara phone'], cetRate: 0, unit: 'PCS' },
  { code: '85444900', description: 'Other electric conductors, for a voltage ≤ 1,000 V (cables)', keywords: ['cables', 'electric cables', 'wires'], cetRate: 25, unit: 'KG' },
  { code: '94036000', description: 'Other wooden furniture', keywords: ['furniture', 'wooden furniture', 'chairs', 'tables', 'beds', 'cabinets'], cetRate: 35, unit: 'PCS' },
  { code: '96190000', description: 'Sanitary towels (pads) and tampons, napkins and diapers', keywords: ['sanitary pads', 'diapers', 'nappies', 'pads'], cetRate: 25, unit: 'PCS' },
];

const BY_CODE = new Map(TARIFF_CATALOG.map((l) => [l.code, l]));

export function findTariffLine(code: string): TariffLine | undefined {
  return BY_CODE.get(code.replace(/\D/g, ''));
}
