import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, world, system, ItemStack, EnchantmentTypes, Potions } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";






// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
if (!globalThis.__sqlite_store_v2__) globalThis.__sqlite_store_v2__ = new Map();
if (!globalThis.__sqlite_owner_key_v2__) {
  globalThis.__sqlite_owner_key_v2__ = function(owner) {
    if (typeof owner === "string") return owner;
    if (!owner) return "world";
    if (owner.name) return String(owner.name).toLowerCase();
    if (owner.id !== undefined) return String(owner.id);
    return "world";
  };
}
if (!globalThis.__sqlite_get_prop_v2__) {
  globalThis.__sqlite_get_prop_v2__ = function(addon, owner, key) {
    if (!addon || owner === undefined || owner === null || key === undefined) return undefined;
    const addonStore = globalThis.__sqlite_store_v2__.get(String(addon));
    const ownerStore = addonStore ? addonStore.get(globalThis.__sqlite_owner_key_v2__(owner)) : undefined;
    return ownerStore ? ownerStore[key] : undefined;
  };
}
if (!globalThis.__sqlite_set_prop_v2__) {
  globalThis.__sqlite_set_prop_v2__ = function(addon, owner, key, value) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    const payload = { addon: addonKey, owner: ownerKey, key };
    if (value === undefined) { delete ownerStore[key]; payload.deleted = true; }
    else { ownerStore[key] = value; payload.deleted = false; payload.value = value; }
    try { console.warn("[SQLITE_SAVE_V1] " + JSON.stringify(payload)); } catch (e) {}
  };
}
if (!globalThis.__sqlite_rehydrate_v2__) {
  globalThis.__sqlite_rehydrate_v2__ = function(addon, owner, key, value, deleted) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    if (deleted === true) delete ownerStore[key];
    else ownerStore[key] = value;
  };
}
if (!globalThis.__sqlite_sync_complete_v2__) globalThis.__sqlite_sync_complete_v2__ = new Map();
if (!globalThis.__sqlite_sync_status_v3__) globalThis.__sqlite_sync_status_v3__ = new Map();
if (!globalThis.__sqlite_request_sync_v3__) {
  globalThis.__sqlite_request_sync_v3__ = function(addon, attempt) {
    const addonKey = String(addon || "");
    if (!addonKey) return;
    const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
    globalThis.__sqlite_sync_status_v3__.set(addonKey, {
      ...previous,
      requestedAt: Date.now(),
      attempt: Number(attempt || 0),
      complete: false,
      protocol: 0,
    });
    try { console.warn("[SQLITE_REQUEST_SYNC] " + JSON.stringify({ addon: addonKey, protocol: 3, attempt: Number(attempt || 0) })); } catch (e) {}
  };
}
try {
  const signal = system.afterEvents && system.afterEvents.scriptEventReceive;
  if (!globalThis.__sqlite_chunk_store_v2__) globalThis.__sqlite_chunk_store_v2__ = new Map();
  if (!globalThis.__sqlite_listener_callback_v3__) {
    const callback = function(event) {
    if (!event || (event.id !== "sqlite:load" && event.id !== "sqlite:sync" && event.id !== "sqlite:load_chunk" && event.id !== "sqlite:sync_complete")) return;
    try {
      const payload = JSON.parse(event.message || "{}");
      if (event.id === "sqlite:sync_complete") {
        if (payload.addon) {
          const addonKey = String(payload.addon);
          globalThis.__sqlite_sync_complete_v2__.set(addonKey, Date.now());
          const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
          globalThis.__sqlite_sync_status_v3__.set(addonKey, {
            ...previous,
            complete: true,
            completedAt: Date.now(),
            protocol: Number(payload.protocol || 0),
            entryCount: Number(payload.entryCount || 0),
          });
        }
        return;
      }
      if (event.id === "sqlite:load_chunk") {
        const count = Number(payload.chunkCount);
        const index = Number(payload.chunkIndex);
        if (!payload.addon || payload.key === undefined || !payload.chunkId || !Number.isInteger(count) || count < 1 || count > 128 || !Number.isInteger(index) || index < 0 || index >= count) return;
        const chunkKey = String(payload.chunkId);
        let state = globalThis.__sqlite_chunk_store_v2__.get(chunkKey);
        if (!state || state.count !== count) {
          state = { count: count, chunks: new Array(count) };
          globalThis.__sqlite_chunk_store_v2__.set(chunkKey, state);
        }
        state.chunks[index] = String(payload.valueChunk || "");
        for (let partIndex = 0; partIndex < state.count; partIndex++) {
          if (typeof state.chunks[partIndex] !== "string") return;
        }
        const value = JSON.parse(state.chunks.join(""));
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, value, false);
        globalThis.__sqlite_chunk_store_v2__.delete(chunkKey);
        return;
      }
      if (payload.addon && payload.key !== undefined) {
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, payload.value, payload.deleted === true);
      }
    } catch (e) {}
    };
    globalThis.__sqlite_listener_callback_v3__ = callback;
    if (signal && typeof signal.subscribe === "function") signal.subscribe(callback);
  }
} catch (e) {}
globalThis.__sqlite_sync_complete_v2__.delete("auction_house_addon");
globalThis.__sqlite_request_sync_v3__("auction_house_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("auction_house_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("auction_house_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
// BEGIN GENERATED VANILLA ES_MX CATALOG
// Generated from resource_packs/vanilla/texts/es_MX.lang.
// Do not edit manually; run tools/generate-auction-es-mx-catalog.sh.
const VANILLA_ITEM_NAMES_ES_MX = Object.freeze({
  "air": "Aire",
  "apple": "Manzana",
  "axolotlAdultBodySingle": "Ajolote %1$s adulto",
  "axolotlBabyBodySingle": "Ajolote %1$s bebé",
  "axolotlColorLucy": "Leucístico",
  "axolotlColorCyan": "Cian",
  "axolotlColorGold": "Oro",
  "axolotlColorWild": "Marrón",
  "axolotlColorBlue": "Azul",
  "golden_apple": "Manzana de oro",
  "appleEnchanted": "Manzana dorada encantada",
  "armadillo_scute": "Escama de armadillo",
  "armor_stand": "Soporte para armaduras",
  "arrow": "Flecha",
  "tipped_arrow": "Flecha con punta filosa",
  "bell": "Campana",
  "steak": "Filete",
  "beef": "Bistec crudo",
  "beetroot": "Betabel",
  "beetroot_soup": "Sopa de betabel",
  "blaze_powder": "Polvo de Blaze",
  "blaze_rod": "Vara de Blaze",
  "bone": "Hueso",
  "book": "Libro",
  "breeze_rod": "Vara de vorágine",
  "chainmail_boots": "Botas de cota de malla",
  "leather_boots": "Botas de cuero",
  "diamond_boots": "Botas de diamante",
  "golden_boots": "Botas de oro",
  "iron_boots": "Botas de hierro",
  "bow": "Arco",
  "bowl": "Tazón",
  "bread": "Pan",
  "brewing_stand": "Puesto de destilado",
  "brick": "Ladrillo",
  "bucket": "Cubeta",
  "bucketLava": "Cubeta con lava",
  "bucketWater": "Cubeta con agua",
  "bucketFish": "Cubeta con bacalao",
  "bucketSalmon": "Cubeta con salmón",
  "bucketTropical": "Cubeta con pez tropical",
  "bucketPuffer": "Cubeta con pez globo",
  "bucketCustomFish": "Cubeta de ",
  "bucketAxolotl": "Cubeta de ajolote",
  "tropicalColorWhite": "Blanco",
  "tropicalColorOrange": "Naranja",
  "tropicalColorMagenta": "Magenta",
  "tropicalColorSky": "Cielo",
  "tropicalColorYellow": "Amarillo",
  "tropicalColorLime": "Verde lima",
  "tropicalColorRose": "Rosa",
  "tropicalColorGray": "Gris",
  "tropicalColorSilver": "Plateado",
  "tropicalColorTeal": "Verde azulado",
  "tropicalColorPlum": "Ciruela",
  "tropicalColorBlue": "Azul",
  "tropicalColorBrown": "Marrón",
  "tropicalColorGreen": "Verde",
  "tropicalColorRed": "Rojo",
  "tropicalBodyKobSingle": "%1$s kob",
  "tropicalBodySunstreakSingle": "%1$s quemado por el sol",
  "tropicalBodySnooperSingle": "%1$s Snooper",
  "tropicalBodyDasherSingle": "%1$s alegre",
  "tropicalBodyBrinelySingle": "%1$s Brinely",
  "tropicalBodySpottySingle": "%1$s Puntos",
  "tropicalBodyFlopperSingle": "%1$s estafador",
  "tropicalBodyStripeySingle": "%1$s Franjas",
  "tropicalBodyGlitterSingle": "%1$s Brillo",
  "tropicalBodyBlockfishSingle": "%1$s pez bloque",
  "tropicalBodyBettySingle": "%1$s Betty",
  "tropicalBodyClayfishSingle": "%1$s pez de arcilla",
  "tropicalBodyKobMulti": "%1$s-%2$s kob",
  "tropicalBodySunstreakMulti": "%1$s-%2$s quemado por el sol",
  "tropicalBodySnooperMulti": "%1$s-%2$s Snooper",
  "tropicalBodyDasherMulti": "%1$s-%2$s alegre",
  "tropicalBodyBrinelyMulti": "%1$s-%2$s Brinely",
  "tropicalBodySpottyMulti": "%1$s-%2$s Puntos",
  "tropicalBodyFlopperMulti": "%1$s-%2$s estafador",
  "tropicalBodyStripeyMulti": "%1$s-%2$s Franjas",
  "tropicalBodyGlitterMulti": "%1$s-%2$s Brillo",
  "tropicalBodyBlockfishMulti": "%1$s-%2$s pez bloque",
  "tropicalBodyBettyMulti": "%1$s-%2$s Betty",
  "tropicalBodyClayfishMulti": "%1$s-%2$s pez de arcilla",
  "tropicalSchoolAnemone": "Anémona",
  "tropicalSchoolBlackTang": "Pez cirujano negro",
  "tropicalSchoolBlueDory": "Cirujano regal",
  "tropicalSchoolButterflyFish": "Pez mariposa",
  "tropicalSchoolCichlid": "Cíclido",
  "tropicalSchoolClownfish": "Pez payaso",
  "tropicalSchoolCottonCandyBetta": "Beta de algodón de azúcar",
  "tropicalSchoolDottyback": "Pseudochromidae",
  "tropicalSchoolEmperorRedSnapper": "Pargo imperial rojo",
  "tropicalSchoolGoatfish": "Salmonete",
  "tropicalSchoolMoorishIdol": "Ídolo moro",
  "tropicalSchoolOrnateButterfly": "Pez mariposa adornado",
  "tropicalSchoolParrotfish": "Pez loro",
  "tropicalSchoolQueenAngelFish": "Pez ángel reina",
  "tropicalSchoolRedCichlid": "Cíclido rojo",
  "tropicalSchoolRedLippedBlenny": "Blenio labios rojos",
  "tropicalSchoolRedSnapper": "Pargo rojo",
  "tropicalSchoolThreadfin": "Pez arcoíris de aleta filamentosa",
  "tropicalSchoolTomatoClown": "Payaso tomate",
  "tropicalSchoolTriggerfish": "Pez ballesta",
  "tropicalSchoolYellowTang": "Cirujano amarillo",
  "tropicalSchoolYellowtailParrot": "Loro de cola amarilla",
  "cake": "Pastel",
  "camera": "Cámara",
  "golden_carrot": "Zanahoria de oro",
  "carrotOnAStick": "Caña con zanahoria",
  "warped_fungus_on_a_stick": "Caña con hongo distorsionado",
  "carrot": "Zanahoria",
  "cauldron": "Caldero",
  "charcoal": "Carbón vegetal",
  "chainmail_chestplate": "Coraza de cota de malla",
  "leather_chestplate": "Túnica de cuero",
  "diamond_chestplate": "Coraza de diamante",
  "golden_chestplate": "Coraza de oro",
  "iron_chestplate": "Coraza de hierro",
  "chorus_fruit": "Fruta coral",
  "chorus_fruit_popped": "Fruta coral horneada",
  "cooked_beef": "Filete",
  "cooked_chicken": "Gallina cocinada",
  "cooked_porkchop": "Chuleta de cerdo cocinada",
  "chicken": "Gallina cruda",
  "clay_ball": "Bola de arcilla",
  "clock": "Reloj",
  "coal": "Carbón",
  "comparator": "Comparador de redstone",
  "compass": "Brújula",
  "lodestonecompass": "Brújula de magnetita",
  "cookie": "Galleta",
  "copper_door": "Puerta de cobre",
  "crossbow": "Ballesta",
  "diamond": "Diamante",
  "repeater": "Repetidor de redstone",
  "acacia_door": "Puerta de acacia",
  "birch_door": "Puerta de abedul",
  "dark_oak_door": "Puerta de roble oscuro",
  "iron_door": "Puerta de hierro",
  "jungle_door": "Puerta de jungla",
  "wooden_door": "Puerta de roble",
  "spruce_door": "Puerta de abeto",
  "crimson_door": "Puerta escarlata",
  "warped_door": "Puerta distorsionada",
  "dragon_breath": "Aliento de dragón",
  "glow_ink_sac": "Saco de tinta brillante",
  "glow_frame": "Marco de elemento brillante",
  "egg": "Huevo",
  "elytra": "Elytra",
  "emerald": "Esmeralda",
  "emptyMap": "Mapa vacío",
  "emptyLocatorMap": "Mapa localizador vacío",
  "enchanted_book": "Libro de encantamientos",
  "end_crystal": "Cristal del End",
  "end_rod": "Vara del End",
  "ender_eye": "Ojo de Ender",
  "ender_pearl": "Perla de Ender",
  "experience_bottle": "Botella de hechizo",
  "exposed_copper_door": "Puerta de cobre expuesto",
  "feather": "Pluma",
  "fermented_spider_eye": "Ojo de araña fermentado",
  "fireball": "Carga de fuego",
  "fireworks": "Cohete de fuegos artificiales",
  "fireworksCharge": "Estrella de fuegos artificiales",
  "clownfish": "Pez tropical",
  "cooked_fish": "Bacalao asado",
  "fish": "Bacalao crudo",
  "photo": "Foto",
  "pufferfish": "Pez globo",
  "cooked_salmon": "Salmón asado",
  "salmon": "Salmón crudo",
  "fishing_rod": "Caña de pescar",
  "flint": "Pedernal",
  "flint_and_steel": "Pedernal y acero",
  "flower_pot": "Maceta",
  "frame": "Marco",
  "ghast_tear": "Lágrima de Ghast",
  "glass_bottle": "Botella",
  "gold_nugget": "Pepita de oro",
  "iron_nugget": "Pepita de hierro",
  "diamond_axe": "Hacha de diamante",
  "golden_axe": "Hacha de oro",
  "iron_axe": "Hacha de hierro",
  "stone_axe": "Hacha de piedra",
  "wooden_axe": "Hacha de madera",
  "chainmail_helmet": "Casco de cota de malla",
  "leather_helmet": "Gorra de cuero",
  "diamond_helmet": "Casco de diamante",
  "golden_helmet": "Casco de oro",
  "iron_helmet": "Casco de hierro",
  "diamond_hoe": "Azadón de diamante",
  "golden_hoe": "Azadón de oro",
  "iron_hoe": "Azadón de hierro",
  "stone_hoe": "Azadón de piedra",
  "wooden_hoe": "Azada de madera",
  "honey_bottle": "Botella de miel",
  "honeycomb": "Panal",
  "netherite_horse_armor": "Armadura de netherita para caballo",
  "horsearmordiamond": "Armadura de diamante para caballo",
  "horsearmorgold": "Armadura dorada para caballo",
  "horsearmoriron": "Armadura de hierro para caballo",
  "copper_horse_armor": "Armadura de cobre para caballo",
  "horsearmorleather": "Armadura de cuero para caballo",
  "gold_ingot": "Lingote de oro",
  "iron_ingot": "Lingote de hierro",
  "netherite_ingot": "Lingote de Netherita",
  "netherite_scrap": "Fragmento de netherita",
  "netherite_sword": "Espada de netherita",
  "netherite_pickaxe": "Pico de Netherita",
  "netherite_axe": "Hacha de Netherita",
  "netherite_shovel": "Pala de Netherita",
  "netherite_hoe": "Azada de Netherita",
  "netherite_boots": "Botas de Netherita",
  "netherite_leggings": "Mallas de Netherita",
  "netherite_chestplate": "Pechera de Netherita",
  "netherite_helmet": "Casco de Netherita",
  "lead": "Correa",
  "leather": "Cuero",
  "leaves": "Hojas",
  "chainmail_leggings": "Musleras de cota de malla",
  "leather_leggings": "Pantalones de cuero",
  "diamond_leggings": "Musleras de diamante",
  "golden_leggings": "Mallas de oro",
  "iron_leggings": "Mallas de hierro",
  "nautilus_shell": "Caparazón de nautilo",
  "heart_of_the_sea": "Corazón del Mar",
  "mace": "Maza",
  "magma_cream": "Crema de magma",
  "map": "Mapa",
  "melon": "Rodaja de sandía",
  "milk": "Cubeta de leche",
  "minecart": "Vagón",
  "chest_minecart": "Vagón con cofre",
  "command_block_minecart": "Vagón con bloque de comandos",
  "minecartFurnace": "Vagón con horno",
  "hopper_minecart": "Vagoneta con tolva",
  "ominous_bottle": "Botella siniestra",
  "ominous_trial_key": "Llave de desafío siniestro",
  "oxidized_copper_door": "Puerta de cobre oxidado",
  "tnt_minecart": "Vagón con dinamita",
  "pitcher_pod": "Semilla jarra",
  "torchflower_seeds": "Semillas de anflorcha",
  "trident": "Tridente",
  "mushroom_stew": "Sopa de hongos",
  "muttonCooked": "Cordero asado",
  "muttonRaw": "Cordero crudo",
  "name_tag": "Etiqueta de nombre",
  "netherbrick": "Ladrillo del Nether",
  "quartz": "Cuarzo del Nether",
  "nether_wart": "Verruga del Nether",
  "netherStar": "Estrella del Nether",
  "painting": "Cuadro",
  "paper": "Papel",
  "diamond_pickaxe": "Pico de diamante",
  "golden_pickaxe": "Pico de oro",
  "iron_pickaxe": "Pico de hierro",
  "stone_pickaxe": "Pico de piedra",
  "wooden_pickaxe": "Pico de madera",
  "porkchop_cooked": "Chuleta de cerdo cocinada",
  "porkchop": "Chuleta de cerdo cruda",
  "portfolio": "Portafolio",
  "potato": "Papa",
  "baked_potato": "Papa horneada",
  "poisonous_potato": "Papa venenosa",
  "prismarine_crystals": "Cristales de prismarina",
  "prismarine_shard": "Fragmento de prismarina",
  "pumpkin_pie": "Pay de calabaza",
  "cooked_rabbit": "Conejo asado",
  "rabbit_foot": "Pata de conejo",
  "rabbit_hide": "Piel de conejo",
  "rabbit": "Conejo crudo",
  "rabbit_stew": "Estofado de conejo",
  "record": "Disco de música",
  "redstone": "Polvo de redstone",
  "reeds": "Caña de azúcar",
  "kelp": "Alga marina",
  "dried_kelp": "Algas secas",
  "rotten_flesh": "Carne podrida",
  "ruby": "Rubí",
  "saddle": "Silla de montar",
  "wheat_seeds": "Semillas de trigo",
  "beetroot_seeds": "Semillas de betabel",
  "melon_seeds": "Semillas de sandía",
  "pumpkin_seeds": "Semillas de calabaza",
  "shears": "Tijeras",
  "diamond_shovel": "Pala de diamante",
  "golden_shovel": "Pala de oro",
  "iron_shovel": "Pala de hierro",
  "stone_shovel": "Pala de piedra",
  "wooden_shovel": "Pala de madera",
  "sign": "Letrero de roble",
  "spruce_sign": "Letrero de abeto",
  "birch_sign": "Letrero de abedul",
  "jungle_sign": "Letrero de jungla",
  "acacia_sign": "Letrero de acacia",
  "darkoak_sign": "Letrero de roble oscuro",
  "crimson_sign": "Letrero carmesí",
  "warped_sign": "Letrero distorsionado",
  "slime_ball": "Bola de slime",
  "snowball": "Bola de nieve",
  "speckled_melon": "Rodaja de sandía resplandeciente",
  "spider_eye": "Ojo de araña",
  "stick": "Palo",
  "string": "Cuerda",
  "sugar": "Azúcar",
  "gunpowder": "Pólvora",
  "diamond_sword": "Espada de diamante",
  "golden_sword": "Espada de oro",
  "iron_sword": "Espada de hierro",
  "stone_sword": "Espada de piedra",
  "wooden_sword": "Espada de madera",
  "waxed_copper_door": "Puerta de cobre encerado",
  "waxed_exposed_copper_door": "Puerta de cobre expuesto encerado",
  "waxed_oxidized_copper_door": "Puerta de cobre oxidado encerado",
  "waxed_weathered_copper_door": "Puerta de cobre degradado encerado",
  "weathered_copper_door": "Puerta de cobre degradado",
  "wind_charge": "Carga de viento",
  "wheat": "Trigo",
  "wolf_armor": "Armadura para lobo",
  "writable_book": "Libro y pluma",
  "written_book": "Libro escrito",
  "glowstone_dust": "Polvo de piedra luminosa",
  "shulker_shell": "Coraza de Shulker",
  "totem": "Tótem de la inmortalidad",
  "trial_key": "llave de desafío",
  "turtle_helmet": "Caparazón de tortuga",
  "turtle_shell_piece": "Escama de tortuga",
  "phantom_membrane": "Membrana de fantasma",
  "sweet_berries": "Bayas dulces",
  "suspicious_stew": "Estofado sospechoso",
  "field_masoned_banner_pattern": "Patrón de estandarte mazonado de campo",
  "creeper_banner_pattern": "Diseño de estandarte: Estampado de Creeper",
  "flow_banner_pattern": "Diseño de estandarte: Flow",
  "flower_banner_pattern": "Patrón de estandarte de carga de flores",
  "globe_banner_pattern": "Patrón de estandarte de globo terráqueo",
  "guster_banner_pattern": "Diseño de estandarte: Torbellino",
  "piglin_banner_pattern": "Patrón de estandarte de trompa",
  "skull_banner_pattern": "Patrón de estandarte de carga de calaveras",
  "mojang_banner_pattern": "Patrón de estandarte de cosas",
  "bordure_indented_banner_pattern": "Diseño de estandarte: Bordura dentada",
  "banner_pattern": "Diseño de estandarte",
  "bucketPowderSnow": "Cubeta de nieve en polvo",
  "pale_oak_door": "Puerta de roble pálido",
  "pale_oak_hanging_sign": "Letrero colgante de roble pálido",
  "pale_oak_sign": "Letrero de roble pálido",
  "pale_oak_sapling": "Brote de roble pálido",
  "pale_oak_leaves": "Hojas de roble pálido",
  "resin_brick": "Bloque de resina",
  "shield": "Escudo",
  "goat_horn": "Cuerno de cabra",
  "sculk_sensor": "Sensor sculk",
  "sculk": "Sculk",
  "sculk_vein": "Vena de sculk",
  "sculk_catalyst": "Catalizador de sculk",
  "sculk_shrieker": "Aullador sculk",
  "reinforced_deepslate": "Pizarra profunda reforzada",
  "bucketTadpole": "Cubeta con renacuajo",
  "frog_spawn": "Huevas de rana",
  "pearlescent_froglight": "Ranaluz nacarada",
  "verdant_froglight": "Ranaluz verde",
  "ochre_froglight": "Foco de rana ocre",
  "mud": "Lodo",
  "packed_mud": "Barro empaquetado",
  "mud_bricks": "Ladrillos de barro",
  "mud_brick_slab": "Losa de ladrillos de barro",
  "mud_brick_double_slab": "Losa doble de ladrillos de barro",
  "mud_brick_stairs": "Escaleras de ladrillos de barro",
  "mud_brick_wall": "Pared de ladrillos de barro",
  "mangrove_leaves": "Hojas de manglar",
  "mangrove_propagule": "Propágulo de manglar",
  "mangrove_roots": "Raíces de manglar",
  "muddy_mangrove_roots": "Raíces de manglar fangosas",
  "mangrove_log": "Tronco de manglar",
  "stripped_mangrove_log": "Tronco de manglar pelado",
  "mangrove_planks": "Tablones de manglar",
  "mangrove_button": "Botón de manglar",
  "mangrove_stairs": "Escaleras de manglar",
  "mangrove_slab": "Losa de manglar",
  "mangrove_double_slab": "Losa doble de manglar",
  "mangrove_pressure_plate": "Placa de presión de manglar",
  "mangrove_fence": "Valla de manglar",
  "mangrove_fence_gate": "Puerta de valla de manglar",
  "mangrove_door": "Puerta de manglar",
  "mangrove_sign": "Letrero de manglar",
  "mangrove_standing_sign": "Letrero de manglar",
  "mangrove_wall_sign": "Letrero de pared de manglar",
  "mangrove_hanging_sign": "Letrero colgante de manglar",
  "mangrove_trapdoor": "Escotilla de manglar",
  "mangrove_wood": "Madera de manglar",
  "stripped_mangrove_wood": "Madera de manglar pelada",
  "echo_shard": "Fragmento resonante",
  "recovery_compass": "Brújula de recuperación",
  "disc_fragment": "Fragmento de disco",
  "acacia_hanging_sign": "Letrero colgante de acacia",
  "angler_pottery_sherd": "Fragmento de cerámica con pescador",
  "archer_pottery_sherd": "Fragmento de cerámica con arquero",
  "arms_up_pottery_sherd": "Fragmento de cerámica con brazos hacia arriba",
  "bamboo_door": "Puerta de bambú",
  "bamboo_hanging_sign": "Letrero colgante de bambú",
  "bamboo_sign": "Letrero de bambú",
  "birch_hanging_sign": "Letrero colgante de abedul",
  "blade_pottery_sherd": "Fragmento de cerámica con hoja",
  "brewer_pottery_sherd": "Fragmento de cerámica con destilería",
  "brush": "Pincel",
  "burn_pottery_sherd": "Fragmento de cerámica con quemadura",
  "cherry_door": "Puerta de cerezo",
  "cherry_hanging_sign": "Señal colgante de cerezo",
  "cherry_sign": "Letrero de cerezo",
  "crimson_hanging_sign": "Letrero colgante carmesí",
  "danger_pottery_sherd": "Fragmento de cerámica con peligro",
  "dark_oak_hanging_sign": "Letrero colgante de roble oscuro",
  "explorer_pottery_sherd": "Fragmento de cerámica con explorador",
  "flow_pottery_sherd": "Fragmento de cerámica con flujo",
  "friend_pottery_sherd": "Fragmento de cerámica con amigo",
  "guster_pottery_sherd": "Fragmento de cerámica con Guster",
  "heart_pottery_sherd": "Fragmento de cerámica con corazón",
  "heartbreak_pottery_sherd": "Fragmento de cerámica con corazón roto",
  "howl_pottery_sherd": "Fragmento de cerámica con aullido",
  "jungle_hanging_sign": "Letrero colgante de jungla",
  "miner_pottery_sherd": "Fragmento de cerámica con minero",
  "mourner_pottery_sherd": "Fragmento de cerámica con doliente",
  "oak_hanging_sign": "Letrero colgante de roble",
  "plenty_pottery_sherd": "Fragmento de cerámica con riquezas",
  "prize_pottery_sherd": "Fragmento de cerámica con tesoro",
  "scrape_pottery_sherd": "Fragmento de cerámica con arañazos",
  "sheaf_pottery_sherd": "Fragmento de cerámica con gavilla",
  "shelter_pottery_sherd": "Fragmento de cerámica con refugio",
  "skull_pottery_sherd": "Fragmento de cerámica con calavera",
  "smithing_template": "Plantilla de herrería",
  "netherite_upgrade_smithing_template": "Mejora de inframundita",
  "sentry_armor_trim_smithing_template": "Acabado de armadura de centinela",
  "vex_armor_trim_smithing_template": "Acabado de armadura de vex",
  "wild_armor_trim_smithing_template": "Acabado de armadura salvaje",
  "coast_armor_trim_smithing_template": "Acabado de armadura de costa",
  "dune_armor_trim_smithing_template": "Acabado de armadura de dunas",
  "wayfinder_armor_trim_smithing_template": "Acabado de armadura de buscador de caminos",
  "raiser_armor_trim_smithing_template": "Acabado de armadura de recolector",
  "shaper_armor_trim_smithing_template": "Acabado de armadura de modelador",
  "host_armor_trim_smithing_template": "Acabado de armadura de anfitrión",
  "ward_armor_trim_smithing_template": "Acabado de armadura de guardia",
  "silence_armor_trim_smithing_template": "Acabado de armadura de silencio",
  "tide_armor_trim_smithing_template": "Acabado de armadura de marea",
  "snout_armor_trim_smithing_template": "Acabado de armadura de trompa",
  "rib_armor_trim_smithing_template": "Acabado de armadura de costilla",
  "eye_armor_trim_smithing_template": "Acabado de armadura de ojo",
  "spire_armor_trim_smithing_template": "Acabado de armadura de torre",
  "flow_armor_trim_smithing_template": "Acabado de armadura de flujo",
  "bolt_armor_trim_smithing_template": "Acabado de armadura de rayo",
  "snort_pottery_sherd": "Fragmento de cerámica con bufido",
  "spruce_hanging_sign": "Letrero colgante de abeto",
  "warped_hanging_sign": "Letrero colgante distorsionado",
  "bamboo_block": "Bloque de bambú",
  "bamboo_button": "Botón de bambú",
  "bamboo_fence_gate": "Puerta de valla de bambú",
  "bamboo_fence": "Valla de bambú",
  "bamboo_mosaic_slab": "Losa de mosaico de bambú",
  "bamboo_mosaic_double_slab": "Losa doble de mosaico de bambú",
  "bamboo_mosaic_stairs": "Escaleras de mosaico de bambú",
  "bamboo_mosaic": "Mosaico de bambú",
  "bamboo_planks": "Tablones de bambú",
  "bamboo_pressure_plate": "Placa de presión de bambú",
  "bamboo_sapling": "Retoño de bambú",
  "bamboo_standing_sign": "Letrero de bambú",
  "bamboo_wall_sign": "Letrero de pared de bambú",
  "bamboo_slab": "Losa de bambú",
  "bamboo_double_slab": "Losa doble de bambú",
  "bamboo_stairs": "Escaleras de bambú",
  "bamboo_trapdoor": "Trampilla de bambú",
  "calibrated_sculk_sensor": "Sensor de sculk calibrado",
  "cherry_button": "Botón de cerezo",
  "cherry_double_slab": "Losa doble de cerezo",
  "cherry_fence_gate": "Puerta de valla de cerezo",
  "cherry_fence": "Valla de cerezo",
  "cherry_leaves": "Hojas de cerezo",
  "cherry_log": "Tronco de cerezo",
  "cherry_planks": "Tablones de cerezo",
  "cherry_pressure_plate": "Placa de presión de cerezo",
  "cherry_sapling": "Brote de cerezo",
  "cherry_standing_sign": "Letrero de cerezo",
  "cherry_wall_sign": "Letrero de pared de cerezo",
  "cherry_slab": "Losa de cerezo",
  "cherry_stairs": "Escaleras de cerezo",
  "cherry_trapdoor": "Trampilla de cerezo",
  "cherry_wood": "Leño de cerezo",
  "chiseled_bookshelf": "Estantería cincelada",
  "chiseled_tuff": "Toba grabada",
  "chiseled_tuff_bricks": "Ladrillos de toba grabados",
  "decorated_pot": "Jarrón",
  "pink_petals": "Pétalos rosas",
  "stripped_bamboo_block": "Bloque de bambú sin corteza",
  "stripped_cherry_log": "Tronco de cerezo sin corteza",
  "stripped_cherry_wood": "Leño de cerezo sin corteza",
  "suspicious_gravel": "Grava sospechosa",
  "suspicious_sand": "Arena sospechosa",
  "acaciaFence": "Valla de acacia",
  "acacia_fence_gate": "Puerta de valla de acacia",
  "activator_rail": "Riel activador",
  "allow": "Permitir",
  "unknown": "Desconocido",
  "deny": "Rechazar",
  "border_block": "Frontera",
  "anvil": "Yunque",
  "barrier": "Barrera",
  "beacon": "Faro",
  "beehive": "Apiario de abejas",
  "bee_nest": "Colmena de abejas",
  "target": "Objetivo",
  "bed": "Cama",
  "bedrock": "Roca madre",
  "conduit": "Conducto",
  "invisibleBedrock": "Piedra base invisible",
  "big_dripleaf": "Hoja de goteo grande",
  "small_dripleaf_block": "Hoja de goteo pequeña",
  "hanging_roots": "Raíces colgantes",
  "dirt_with_roots": "Tierra con raíces",
  "spore_blossom": "Flor de esporas",
  "azalea_leaves": "Hojas de azalea",
  "azalea_leaves_flowered": "Hojas de azalea en flor",
  "azalea": "Azalea",
  "flowering_azalea": "Azalea en flor",
  "cave_vines": "Enredaderas de cueva",
  "cave_vines_body_with_berries": "Enredaderas de cueva",
  "cave_vines_head_with_berries": "Enredaderas de cueva",
  "glow_berries": "Bayas brillantes",
  "moss_block": "Bloque de musgo",
  "moss_carpet": "Alfombra de musgo",
  "birchFence": "Valla de abedul",
  "birch_fence_gate": "Puerta de valla de abedul",
  "blast_furnace": "Alto horno",
  "lit_blast_furnace": "Alto horno encendido",
  "bone_block": "Bloque de huesos",
  "coal_block": "Bloque de carbón",
  "diamond_block": "Bloque de diamante",
  "emerald_block": "Bloque de esmeralda",
  "gold_block": "Bloque de oro",
  "iron_block": "Bloque de hierro",
  "lapis_block": "Bloque de lapislázuli",
  "redstone_block": "Bloque de redstone",
  "bookshelf": "Estantería",
  "brick_block": "Ladrillos",
  "brown_mushroom": "Hongo marrón",
  "wooden_button": "Botón de roble",
  "acacia_button": "Botón de acacia",
  "birch_button": "Botón de abedul",
  "dark_oak_button": "Botón de roble oscuro",
  "jungle_button": "Botón de jungla",
  "spruce_button": "Botón de abeto",
  "stone_button": "Botón de piedra",
  "cactus": "Cactus",
  "dried_kelp_block": "Bloque de algas secas",
  "carrots": "Zanahorias",
  "carved_pumpkin": "Calabaza tallada",
  "chalkboard": "Pizarrón",
  "chest": "Cofre",
  "ender_chest": "Cofre de Ender",
  "jigsaw": "Bloque rompecabezas",
  "heavy_core": "Núcleo pesado",
  "honey_block": "Bloque de miel",
  "honeycomb_block": "Bloque de panal",
  "lodestone": "Magnetita",
  "nether_sprouts": "Rastrojo del Nether",
  "crimson_stem": "Tallo escarlata",
  "warped_stem": "Tallo distorsionado",
  "stripped_crimson_stem": "Tallo escarlata sin corteza",
  "stripped_warped_stem": "Tallo distorsionado sin corteza",
  "crimson_hyphae": "Hifas carmesíes",
  "warped_hyphae": "Hifas distorsionadas",
  "stripped_crimson_hyphae": "Hifas carmesí sin corteza",
  "stripped_warped_hyphae": "Hifas distorsionadas sin corteza",
  "crimson_planks": "Tablones carmesí",
  "warped_planks": "Tablones distorsionados",
  "crimson_trapdoor": "Trampilla carmesí",
  "warped_trapdoor": "Trampilla distorsionada",
  "crimson_standing_sign": "Letrero carmesí",
  "warped_standing_sign": "Letrero distorsionado",
  "crimson_wall_sign": "Letrero carmesí",
  "warped_wall_sign": "Letrero distorsionado",
  "crimson_stairs": "Escaleras carmesí",
  "warped_stairs": "Escaleras distorsionadas",
  "crimson_fence": "Valla escarlata",
  "warped_fence": "Valla distorsionada",
  "crimson_fence_gate": "Puerta de valla escarlata",
  "warped_fence_gate": "Puerta de valla distorsionada",
  "crimson_button": "Botón escarlata",
  "warped_button": "Botón distorsionado",
  "crimson_pressure_plate": "Placa de presión carmesí",
  "warped_pressure_plate": "Placa de presión distorsionada",
  "crimson_slab": "Losa escarlata",
  "warped_slab": "Losa distorsionada",
  "crimson_double_slab": "Losa escarlata",
  "warped_double_slab": "Losa distorsionada",
  "shroomlight": "Hongo luminoso",
  "crimson_nylium": "Nilio carmesí",
  "warped_nylium": "Nilio distorsionado",
  "basalt": "Basalto",
  "polished_basalt": "Basalto pulido",
  "blackstone": "Piedra negra",
  "polished_blackstone_bricks": "Ladrillos de piedra negra pulida",
  "cracked_polished_blackstone_bricks": "Ladrillos de piedra negra pulida rota",
  "polished_blackstone_brick_stairs": "Escaleras de ladrillos de piedra negra pulida",
  "blackstone_stairs": "Escaleras de piedra negra",
  "blackstone_wall": "Pared de piedra negra",
  "polished_blackstone_brick_wall": "Pared de ladrillos de piedra negra pulida",
  "chiseled_polished_blackstone": "Piedra negra pulida grabada",
  "gilded_blackstone": "Piedra negra áurea",
  "blackstone_slab": "Losa de piedra negra",
  "blackstone_double_slab": "Losa doble de piedra negra",
  "polished_blackstone_brick_slab": "Losa de ladrillo de piedra negra pulida",
  "polished_blackstone_brick_double_slab": "Losa doble de ladrillo de piedra negra pulida",
  "chain": "Cadena",
  "soul_soil": "Tierra de almas",
  "soul_fire": "Fuego de almas",
  "polished_blackstone": "Piedra negra pulida",
  "polished_blackstone_stairs": "Escaleras de piedra negra pulida",
  "polished_blackstone_slab": "Losa de piedra negra pulida",
  "polished_blackstone_double_slab": "Losa doble de piedra negra pulida",
  "polished_blackstone_pressure_plate": "Placa de presión de piedra negra pulida",
  "polished_blackstone_button": "Botón de piedra negra pulida",
  "polished_blackstone_wall": "Pared de piedra negra pulida",
  "polished_tuff": "Toba pulida",
  "polished_tuff_slab": "Losa de toba pulida",
  "polished_tuff_double_slab": "Losa doble de toba pulida",
  "polished_tuff_stairs": "Escaleras de toba pulida",
  "polished_tuff_wall": "Pared de toba pulida",
  "soul_campfire": "Fogata de almas",
  "chiseled_nether_bricks": "Ladrillos del Nether grabados",
  "cracked_nether_bricks": "Ladrillos del Nether rotos",
  "quartz_bricks": "Ladrillos de cuarzo",
  "trapped_chest": "Cofre con trampa",
  "shulkerBoxWhite": "Caja de Shulker blanca",
  "shulkerBoxOrange": "Caja de Shulker naranja",
  "shulkerBoxMagenta": "Caja de Shulker magenta",
  "shulkerBoxLightBlue": "Caja de Shulker celeste",
  "shulkerBoxYellow": "Caja de Shulker amarilla",
  "shulkerBoxLime": "Caja de Shulker verde lima",
  "shulkerBoxPink": "Caja de Shulker rosa",
  "shulkerBoxGray": "Caja de Shulker gris",
  "shulkerBoxSilver": "Caja de Shulker gris claro",
  "shulkerBoxCyan": "Caja de Shulker cian",
  "shulkerBoxPurple": "Caja de Shulker morada",
  "shulkerBoxBlue": "Caja de Shulker azul",
  "shulkerBoxBrown": "Caja de Shulker marrón",
  "shulkerBoxGreen": "Caja de Shulker verde",
  "shulkerBoxRed": "Caja de Shulker roja",
  "shulkerBoxBlack": "Caja de Shulker negra",
  "shulkerBox": "Caja de Shulker",
  "chorus_flower": "Flor coral",
  "chorus_plant": "Planta coral",
  "clay": "Arcilla",
  "hardened_clay": "Terracota",
  "stained_hardened_clay": "Terracota",
  "structure_block": "Bloque estructural",
  "structure_void": "Vacío estructural",
  "trial_spawner": "Generador de desafío",
  "vault": "Bóveda",
  "wool": "Lana",
  "cocoa": "Cacao",
  "command_block": "Bloque de comandos",
  "composter": "Compostador",
  "light_block": "Claro",
  "repeating_command_block": "Bloque de comandos repetido",
  "chain_command_block": "Bloque de comandos en cadena",
  "darkOakFence": "Valla de roble oscuro",
  "dark_oak_fence_gate": "Puerta de valla de roble oscuro",
  "daylight_detector": "Sensor de luz solar",
  "daylight_detector_inverted": "Sensor de luz solar invertido",
  "deadbush": "Arbusto muerto",
  "detector_rail": "Riel detector",
  "dirt": "Tierra",
  "podzol": "Podsol",
  "dispenser": "Dispensador",
  "doorWood": "Puerta de madera",
  "double_plant": "Planta",
  "dragon_egg": "Huevo de dragón",
  "dropper": "Soltador",
  "enchanting_table": "Mesa de encantamientos",
  "enderChest": "Cofre de Ender",
  "end_gateway": "Nexo del End",
  "end_portal_frame": "Marco del portal del End",
  "end_portal": "Portal del End",
  "farmland": "Tierra de cultivo",
  "fletching_table": "Mesa de arquería",
  "fence": "Valla de roble",
  "fence_gate": "Puerta de valla de roble",
  "iron_bars": "Barras de hierro",
  "fire": "Fuego",
  "yellow_flower": "Flor",
  "red_flower": "Flor",
  "torchflower_crop": "Cultivo de anflorcha",
  "wither_rose": "Rosa del Wither",
  "furnace": "Horno",
  "lit_furnace": "Horno encendido",
  "glass": "Cristal",
  "golden_rail": "Riel propulsado",
  "grass": "Bloque de pasto",
  "grass_path": "Camino de tierra",
  "gravel": "Grava",
  "hay_block": "Paca de heno",
  "netherrack": "Infiedra",
  "soul_sand": "Arena de almas",
  "hopper": "Tolva",
  "ice": "Hielo",
  "packed_ice": "Hielo comprimido",
  "blue_ice": "Hielo azul",
  "frosted_ice": "Escarcha",
  "iron_trapdoor": "Trampilla de hierro",
  "jukebox": "Tocadiscos",
  "jungleFence": "Valla de jungla",
  "jungle_fence_gate": "Puerta de valla de jungla",
  "ladder": "Escalera",
  "flowing_lava": "Lava",
  "lava": "Lava",
  "lever": "Palanca",
  "glowstone": "Piedra luminosa",
  "glow_lichen": "Liquen luminoso",
  "lightning_rod": "Pararrayos",
  "exposed_lightning_rod": "Pararrayos expuesto",
  "weathered_lightning_rod": "Pararrayos erosionado",
  "oxidized_lightning_rod": "Pararrayos oxidado",
  "waxed_lightning_rod": "Pararrayos encerado",
  "waxed_exposed_lightning_rod": "Pararrayos expuesto y encerado",
  "waxed_weathered_lightning_rod": "Pararrayos erosionado y encerado",
  "waxed_oxidized_lightning_rod": "Pararrayos oxidado y encerado",
  "lit_pumpkin": "Calabaza iluminada",
  "lockedchest": "Cofre cerrado",
  "log": "Leño",
  "magma": "Bloque de magma",
  "melon_block": "Sandía",
  "melon_stem": "Tallo de sandía",
  "mob_spawner": "Generador de monstruos",
  "monster_egg": "Piedra infestada",
  "mushroom": "Hongo",
  "noteblock": "Bloque de nota",
  "mycelium": "Micelio",
  "nether_brick": "Ladrillos del Nether",
  "red_nether_brick": "Ladrillos del Nether rojos",
  "nether_brick_fence": "Valla de ladrillos del Nether",
  "quartz_ore": "Mineral de cuarzo del Nether",
  "netherreactor": "Núcleo del reactor del Nether",
  "nether_wart_block": "Bloque de verrugas del Nether",
  "warped_wart_block": "Bloque de verrugas distorsionadas",
  "unlit_redstone_torch": "Antorcha de redstone",
  "redstone_torch": "Antorcha de redstone",
  "soul_torch": "Antorcha de alma",
  "obsidian": "Obsidiana",
  "glowingobsidian": "Obsidiana brillante",
  "coal_ore": "Mineral de carbón",
  "diamond_ore": "Mineral de diamante",
  "emerald_ore": "Mineral de esmeralda",
  "gold_ore": "Mineral de oro",
  "iron_ore": "Mineral de hierro",
  "copper_ore": "Mineral de cobre",
  "lapis_ore": "Mineral de lapislázuli",
  "redstone_ore": "Mineral de redstone",
  "lit_redstone_ore": "Mineral de redstone encendida",
  "oreRuby": "Mineral de rubí",
  "observer": "Observador",
  "piston": "Pistón",
  "sticky_piston": "Pistón adhesivo",
  "piston_arm_collision": "Colisión de brazo de pistón",
  "sticky_piston_arm_collision": "Colisión de brazo de pistón pegajoso",
  "unpowered_comparator": "Comparador sin energía",
  "powered_comparator": "Comparador con energía",
  "unpowered_repeater": "Repetidor sin energía",
  "powered_repeater": "Repetidor con energía",
  "portal": "Portal",
  "potatoes": "Papas",
  "stone_pressure_plate": "Placa de presión de piedra",
  "wooden_pressure_plate": "Placa de presión de roble",
  "acacia_pressure_plate": "Placa de presión de acacia",
  "birch_pressure_plate": "Placa de presión de abedul",
  "dark_oak_pressure_plate": "Placa de presión de roble oscuro",
  "jungle_pressure_plate": "Placa de presión de jungla",
  "spruce_pressure_plate": "Placa de presión de abeto",
  "pumpkin": "Calabaza",
  "pumpkin_stem": "Tallo de calabaza",
  "quartz_block": "Bloque de cuarzo",
  "rail": "Riel",
  "red_mushroom": "Hongo rojo",
  "crimson_fungus": "Hongo carmesí",
  "warped_fungus": "Hongo distorsionado",
  "red_mushroom_block": "Bloque de hongo rojo",
  "red_sandstone": "Arenisca roja",
  "redstone_wire": "Polvo de redstone",
  "redstone_lamp": "Lámpara de redstone",
  "lit_redstone_lamp": "Lámpara de redstone encendida",
  "sand": "Arena",
  "sandstone": "Arenisca",
  "seaLantern": "Linterna marina",
  "standing_sign": "Letrero",
  "wall_sign": "Cartel de pared",
  "spruce_standing_sign": "Letrero de abeto",
  "spruce_wall_sign": "Cartel de pared de abeto",
  "birch_standing_sign": "Letrero de abedul",
  "birch_wall_sign": "Letrero de pared de abedul",
  "jungle_standing_sign": "Letrero de jungla",
  "jungle_wall_sign": "Letrero de pared de la jungla",
  "acacia_standing_sign": "Letrero de acacia",
  "acacia_wall_sign": "Letrero de pared de acacia",
  "darkoak_standing_sign": "Letrero de roble oscuro",
  "darkoak_wall_sign": "Letrero de pared de roble oscuro",
  "slime": "Bloque de slime",
  "snow": "Bloque de nieve",
  "spruceFence": "Valla de abeto",
  "spruce_fence_gate": "Puerta de valla de abeto",
  "brick_stairs": "Escaleras de ladrillos",
  "nether_brick_stairs": "Escaleras de ladrillos del Nether",
  "quartz_stairs": "Escaleras de cuarzo",
  "smooth_quartz_stairs": "Escaleras de cuarzo liso",
  "red_sandstone_stairs": "Escaleras de arenisca roja",
  "sandstone_stairs": "Escaleras de arenisca",
  "stone_stairs": "Escaleras de adoquines",
  "normal_stone_stairs": "Escaleras de piedra",
  "stone_brick_stairs": "Escaleras de ladrillos de piedra",
  "oak_stairs": "Escaleras de roble",
  "acacia_stairs": "Escaleras de acacia",
  "birch_stairs": "Escaleras de abedul",
  "dark_oak_stairs": "Escaleras de roble oscuro",
  "jungle_stairs": "Escaleras de la jungla",
  "spruce_stairs": "Escaleras de abeto",
  "purpur_stairs": "Escaleras de purpur",
  "prismarine_stairs": "Escaleras de prismarina",
  "dark_prismarine_stairs": "Escaleras de prismarina oscura",
  "prismarine_bricks_stairs": "Escaleras de ladrillos de prismarina",
  "granite_stairs": "Escaleras de granito",
  "diorite_stairs": "Escaleras de diorita",
  "andesite_stairs": "Escaleras de andesita",
  "polished_granite_stairs": "Escaleras de granito pulido",
  "polished_diorite_stairs": "Escaleras de diorita pulida",
  "polished_andesite_stairs": "Escaleras de andesita pulida",
  "mossy_stone_brick_stairs": "Escaleras de ladrillos de piedra musgosa",
  "smooth_red_sandstone_stairs": "Escaleras de arenisca roja lisa",
  "smooth_sandstone_stairs": "Escaleras de arenisca lisa",
  "end_brick_stairs": "Escaleras de ladrillos de piedra del End",
  "mossy_cobblestone_stairs": "Escaleras de piedra labrada musgosa",
  "red_nether_brick_stairs": "Escaleras de ladrillos del Nether rojos",
  "smooth_stone": "Piedra lisa",
  "standing_banner": "Estandarte",
  "wall_banner": "Estandarte de muro",
  "cobblestone": "Adoquín",
  "stonebrick": "Ladrillos de piedra",
  "stonecutter": "Cortapiedras",
  "stonecutter_block": "Cortapiedras",
  "mossy_cobblestone": "Piedra labrada musgosa",
  "double_stone_slab": "Losa de piedra",
  "stone_slab": "Losa de piedra",
  "tallgrass": "Pasto corto",
  "tuff_brick_slab": "Losa de ladrillos de toba",
  "tuff_brick_double_slab": "Losa doble de ladrillo de toba",
  "tuff_brick_stairs": "Escaleras de ladrillos de toba",
  "tuff_brick_wall": "Pared de ladrillos de toba",
  "tuff_bricks": "Ladrillos de toba",
  "tuff_slab": "Losa de toba",
  "tuff_double_slab": "Losa doble de toba",
  "tuff_stairs": "Escaleras de toba",
  "tuff_wall": "Pared de toba",
  "sea_pickle": "Pepinillo de mar",
  "turtle_egg": "Huevo de tortuga",
  "bubble_column": "Columna de burbujas",
  "dead_bubble_coral_wall_fan": "Ventilador de pared de coral de burbuja muerto",
  "dead_horn_coral_wall_fan": "Ventilador de pared de coral de cuerno muerto",
  "dead_fire_coral_wall_fan": "Ventilador de pared de coral de fuego muerto",
  "tube_coral_wall_fan": "Ventilador de pared de coral de tubo",
  "dead_brain_coral_wall_fan": "Ventilador de pared de coral de cerebro muerto",
  "brain_coral_wall_fan": "Ventilador de pared de coral de cerebro",
  "horn_coral_wall_fan": "Ventilador de pared de coral de cuerno",
  "fire_coral_wall_fan": "Ventilador de pared de coral de fuego",
  "bubble_coral_wall_fan": "Ventilador de pared de coral de burbuja",
  "dead_tube_coral_wall_fan": "Ventilador de pared de coral de tubo muerto",
  "glass_pane": "Panel de cristal",
  "tnt": "Dinamita",
  "snow_layer": "Nieve",
  "torch": "Antorcha",
  "trapdoor": "Trampilla de roble",
  "acacia_trapdoor": "Trampilla de acacia",
  "birch_trapdoor": "Trampilla de abedul",
  "dark_oak_trapdoor": "Trampilla de roble oscuro",
  "jungle_trapdoor": "Trampilla de jungla",
  "spruce_trapdoor": "Trampilla de abeto",
  "tripWire": "Hilo de activación",
  "tripwire_hook": "Gancho de hilo de activación",
  "vine": "Lianas",
  "weeping_vines": "Enredaderas lloronas",
  "twisting_vines": "Lianas retorcidas",
  "flowing_water": "Agua",
  "water": "Agua",
  "waterlily": "Nenúfar",
  "web": "Telaraña",
  "heavy_weighted_pressure_plate": "Placa de presión para peso elevado",
  "light_weighted_pressure_plate": "Placa de presión para peso liviano",
  "end_stone": "Piedra del End",
  "end_bricks": "Ladrillos de piedra del End",
  "planks": "Tablones de madera",
  "wooden_slab": "Losa de madera",
  "carpet": "Alfombra",
  "crafter": "Fabricador",
  "crafting_table": "Mesa de trabajo",
  "pale_oak_button": "Botón de roble pálido",
  "pale_oak_double_slab": "Losa doble de roble pálido",
  "pale_oak_fence": "Valla de roble pálido",
  "pale_oak_fence_gate": "Puerta de valla de roble pálido",
  "pale_oak_log": "Tronco de roble pálido",
  "pale_oak_planks": "Tablones de roble pálido",
  "pale_oak_pressure_plate": "Placa de presión de roble pálido",
  "pale_oak_standing_sign": "Letrero de roble pálido",
  "pale_oak_wall_sign": "Letrero de pared de roble pálido",
  "pale_oak_slab": "Losa de roble pálido",
  "pale_oak_stairs": "Escaleras de roble pálido",
  "pale_oak_trapdoor": "Trampilla de roble pálido",
  "pale_oak_wood": "Leño de roble pálido",
  "stripped_pale_oak_log": "Tronco de roble pálido sin corteza",
  "stripped_pale_oak_wood": "Leño de roble pálido sin corteza",
  "pale_hanging_moss": "Musgo pálido colgante",
  "pale_moss_block": "Bloque de musgo pálido",
  "pale_moss_carpet": "Alfombra de musgo pálido",
  "creaking_heart": "Corazón de crepitante",
  "open_eyeblossom": "Miraflor abierta",
  "closed_eyeblossom": "Miraflor cerrada",
  "resin_bricks": "Ladrillos de resina",
  "resin_brick_double_slab": "Losa doble de ladrillo de resina",
  "resin_brick_slab": "Losa de ladrillos de resina",
  "resin_brick_stairs": "Escaleras de ladrillos de resina",
  "resin_brick_wall": "Pared de ladrillos de resina",
  "chiseled_resin_bricks": "Ladrillos de resina grabados",
  "resin_block": "Bloque de resina",
  "resin_clump": "Grumo de resina",
  "glazedTerracottaWhite": "Azulejo blanco",
  "glazedTerracottaOrange": "Azulejo naranja",
  "glazedTerracottaMagenta": "Azulejo magenta",
  "glazedTerracottaLightBlue": "Azulejo azul claro",
  "glazedTerracottaYellow": "Azulejo amarillo",
  "glazedTerracottaLime": "Azulejo verde lima",
  "glazedTerracottaPink": "Azulejo rosa",
  "glazedTerracottaGray": "Azulejo gris",
  "glazedTerracottaSilver": "Azulejo gris claro",
  "glazedTerracottaCyan": "Azulejo cian",
  "glazedTerracottaPurple": "Azulejo morado",
  "glazedTerracottaBlue": "Azulejo azul",
  "glazedTerracottaBrown": "Azulejo café",
  "glazedTerracottaGreen": "Azulejo verde",
  "glazedTerracottaRed": "Azulejo rojo",
  "glazedTerracottaBlack": "Azulejo negro",
  "stripped_spruce_log": "Tronco de abeto descortezado",
  "stripped_dark_oak_log": "Tronco de roble oscuro descortezado",
  "stripped_birch_log": "Tronco de abedul descortezado",
  "stripped_jungle_log": "Tronco de la jungla sin corteza",
  "stripped_oak_log": "Tronco de roble descortezado",
  "stripped_acacia_log": "Tronco de acacia descortezado",
  "bamboo": "Bambú",
  "scaffolding": "Andamios",
  "grindstone": "Afiladora",
  "cartography_table": "Mesa de cartografía",
  "lantern": "Farol",
  "soul_lantern": "Farol de almas",
  "smoker": "Ahumador",
  "lit_smoker": "Ahumador encendido",
  "smithing_table": "Mesa de herrería",
  "barrel": "Barril",
  "campfire": "Fogata",
  "loom": "Telar",
  "lectern": "Atril",
  "sweet_berry_bush": "Arbusto de bayas dulces",
  "netherite_block": "Bloque de netherita",
  "ancient_debris": "Escombros ancestrales",
  "nether_gold_ore": "Mineral de oro del Nether",
  "respawn_anchor": "Nexo de reaparición",
  "crying_obsidian": "Obsidiana llorosa",
  "powder_snow": "Nieve en polvo",
  "deepslate": "Pizarra profunda",
  "infested_deepslate": "Pizarra profunda infestada",
  "cobbled_deepslate": "Pizarra abismal empedrada",
  "dripstone_block": "Bloque de espeleotema",
  "pointed_dripstone": "Espeleotema puntiaguda",
  "cobbled_deepslate_slab": "Losa de pizarra abismal empedrada",
  "cobbled_deepslate_stairs": "Escaleras de pizarra abismal empedrada",
  "cobbled_deepslate_wall": "Pared de pizarra abismal empedrada",
  "polished_deepslate": "Pizarra abismal pulida",
  "polished_deepslate_slab": "Losa de pizarra abismal pulida",
  "polished_deepslate_stairs": "Escaleras de pizarra abismal pulida",
  "polished_deepslate_wall": "Pared de pizarra abismal pulida",
  "deepslate_tiles": "Mosaicos de pizarra abismal",
  "deepslate_tile_slab": "Losa de mosaico de pizarra abismal",
  "deepslate_tile_stairs": "Escaleras de mosaico de pizarra abismal",
  "deepslate_tile_wall": "Pared de mosaico de pizarra abismal",
  "deepslate_bricks": "Ladrillos de pizarra abismal",
  "deepslate_brick_slab": "Losa de ladrillos de pizarra abismal",
  "deepslate_brick_stairs": "Escaleras de ladrillos de pizarra abismal",
  "deepslate_brick_wall": "Pared de ladrillos de pizarra abismal",
  "chiseled_deepslate": "Pizarra abismal cincelada",
  "cobbled_deepslate_double_slab": "Losa doble de pizarra abismal empedrada",
  "polished_deepslate_double_slab": "Losa doble de pizarra abismal pulida",
  "deepslate_tile_double_slab": "Losa doble de baldosas de pizarra abismal",
  "deepslate_brick_double_slab": "Losa doble de ladrillos de pizarra abismal",
  "deepslate_lapis_ore": "Mineral de lapislázuli de pizarra profunda",
  "deepslate_iron_ore": "Mineral de hierro de pizarra profunda",
  "deepslate_gold_ore": "Mineral de oro de pizarra profunda",
  "deepslate_redstone_ore": "Mineral de redstone de pizarra profunda",
  "lit_deepslate_redstone_ore": "Mineral de redstone de pizarra profunda encendida",
  "deepslate_diamond_ore": "Mineral de diamante de pizarra abismal",
  "deepslate_coal_ore": "Mineral de carbón de pizarra abismal",
  "deepslate_emerald_ore": "Mineral de esmeralda de pizarra abismal",
  "deepslate_copper_ore": "Mineral de cobre de pizarra abismal",
  "cracked_deepslate_tiles": "Mosaicos de pizarra abismal agrietadas",
  "cracked_deepslate_bricks": "Ladrillos de pizarra abismal agrietados",
  "pitcher_plant": "Planta jarra",
  "pitcher_crop": "Cultivo de jarra",
  "sniffer_egg": "Huevo de rastreador",
  "torchflower": "Anflorcha",
  "copper_ingot": "Lingote de cobre",
  "raw_copper": "Cobre crudo",
  "raw_iron": "Hierro crudo",
  "raw_gold": "Oro crudo",
  "copper_block": "Bloque de cobre",
  "exposed_copper": "Cobre expuesto",
  "weathered_copper": "Cobre degradado",
  "oxidized_copper": "Cobre oxidado",
  "waxed_copper": "Bloque de cobre encerado",
  "waxed_exposed_copper": "Cobre expuesto encerado",
  "waxed_weathered_copper": "Cobre desgastado encerado",
  "waxed_oxidized_copper": "Cobre oxidado encerado",
  "cut_copper": "Cobre cortado",
  "exposed_cut_copper": "Cobre cortado expuesto",
  "weathered_cut_copper": "Cobre cortado desgastado",
  "oxidized_cut_copper": "Cobre cortado oxidado",
  "waxed_cut_copper": "Cobre cortado encerado",
  "waxed_exposed_cut_copper": "Cobre cortado, expuesto y encerado",
  "waxed_weathered_cut_copper": "Cobre cortado, desgastado y encerado",
  "waxed_oxidized_cut_copper": "Cobre cortado, oxidado y encerado",
  "cut_copper_stairs": "Escaleras de cobre cortado",
  "exposed_cut_copper_stairs": "Escaleras de cobre cortado expuesto",
  "weathered_cut_copper_stairs": "Escaleras de cobre cortado desgastado",
  "oxidized_cut_copper_stairs": "Escaleras de cobre cortado oxidado",
  "waxed_cut_copper_stairs": "Escaleras de cobre cortado encerado",
  "waxed_exposed_cut_copper_stairs": "Escaleras de cobre cortado, expuesto y encerado",
  "waxed_weathered_cut_copper_stairs": "Escaleras de cobre cortado, desgastado y encerado",
  "waxed_oxidized_cut_copper_stairs": "Escaleras de cobre cortado, oxidado y encerado",
  "cut_copper_slab": "Losa de cobre cortado",
  "double_cut_copper_slab": "Losa doble de cobre cortado",
  "exposed_cut_copper_slab": "Losa de cobre cortado expuesto",
  "exposed_double_cut_copper_slab": "Losa doble de cobre cortado expuesto",
  "weathered_cut_copper_slab": "Losa de cobre cortado erosionado",
  "weathered_double_cut_copper_slab": "Losa doble de cobre cortado degradado",
  "oxidized_cut_copper_slab": "Losa de cobre cortado oxidado",
  "oxidized_double_cut_copper_slab": "Losa doble de cobre cortado oxidado",
  "waxed_cut_copper_slab": "Losa de cobre cortado encerado",
  "waxed_double_cut_copper_slab": "Losa doble  de cobre cortado encerado",
  "waxed_exposed_cut_copper_slab": "Losa de cobre cortado, expuesto y encerado",
  "waxed_exposed_double_cut_copper_slab": "Losa doble de cobre cortado, expuesto y encerado",
  "waxed_weathered_cut_copper_slab": "Losa de cobre cortado, desgastado y encerado",
  "waxed_weathered_double_cut_copper_slab": "Losa doble de cobre cortado, erosionado y encerado",
  "waxed_oxidized_cut_copper_slab": "Losa de cobre cortado, oxidado y encerado",
  "waxed_oxidized_double_cut_copper_slab": "Losa doble de cobre cortado, oxidado y encerado",
  "chiseled_copper": "Cobre cincelado",
  "exposed_chiseled_copper": "Cobre cincelado expuesto",
  "oxidized_chiseled_copper": "Cobre cincelado oxidado",
  "waxed_chiseled_copper": "Cobre cincelado encerado",
  "waxed_exposed_chiseled_copper": "Cobre cincelado, expuesto y encerado",
  "waxed_oxidized_chiseled_copper": "Cobre cincelado, oxidado y encerado",
  "waxed_weathered_chiseled_copper": "Cobre grabado degradado encerado",
  "weathered_chiseled_copper": "Cobre grabado degradado",
  "copper_bulb": "Bombilla de cobre",
  "exposed_copper_bulb": "Bombilla de cobre expuesto",
  "oxidized_copper_bulb": "Bombilla de cobre oxidado",
  "waxed_copper_bulb": "Bombilla de cobre encerado",
  "waxed_exposed_copper_bulb": "Bombilla de cobre expuesto encerado",
  "waxed_oxidized_copper_bulb": "Bombilla de cobre oxidado encerado",
  "waxed_weathered_copper_bulb": "Bombilla de cobre degradado encerado",
  "weathered_copper_bulb": "Bombilla de cobre degradado",
  "copper_grate": "Rejilla de cobre",
  "exposed_copper_grate": "Rejilla de cobre expuesto",
  "oxidized_copper_grate": "Rejilla de cobre oxidado",
  "waxed_copper_grate": "Rejilla de cobre encerado",
  "waxed_exposed_copper_grate": "Rejilla de cobre expuesto encerado",
  "waxed_oxidized_copper_grate": "Rejilla de cobre oxidado encerado",
  "waxed_weathered_copper_grate": "Rejilla de cobre degradado encerado",
  "weathered_copper_grate": "Rejilla de cobre degradado",
  "copper_trapdoor": "Trampilla de cobre",
  "exposed_copper_trapdoor": "Trampilla de cobre expuesto",
  "oxidized_copper_trapdoor": "Trampilla de cobre oxidado",
  "waxed_copper_trapdoor": "Trampilla de cobre encerado",
  "waxed_exposed_copper_trapdoor": "Trampilla de cobre expuesto encerado",
  "waxed_oxidized_copper_trapdoor": "Trampilla de cobre oxidado encerado",
  "waxed_weathered_copper_trapdoor": "Trampilla de cobre degradado encerado",
  "weathered_copper_trapdoor": "Trampilla de cobre degradado",
  "raw_copper_block": "Bloque de cobre crudo",
  "raw_iron_block": "Bloque de hierro crudo",
  "raw_gold_block": "Bloque de oro crudo",
  "candle": "Vela",
  "white_candle": "Vela blanca",
  "orange_candle": "Vela naranja",
  "magenta_candle": "Vela magenta",
  "light_blue_candle": "Vela celeste",
  "yellow_candle": "Vela amarilla",
  "lime_candle": "Vela verde lima",
  "pink_candle": "Vela rosa",
  "gray_candle": "Vela gris",
  "light_gray_candle": "Vela gris claro",
  "cyan_candle": "Vela cian",
  "purple_candle": "Vela morada",
  "blue_candle": "Vela azul",
  "brown_candle": "Vela marrón",
  "green_candle": "Vela verde",
  "red_candle": "Vela roja",
  "black_candle": "Vela negra",
  "candle_cake": "Pastel con vela",
  "white_candle_cake": "Pastel con vela blanca",
  "orange_candle_cake": "Pastel con vela naranja",
  "magenta_candle_cake": "Pastel con vela magenta",
  "light_blue_candle_cake": "Pastel con vela azul claro",
  "yellow_candle_cake": "Pastel con vela amarilla",
  "lime_candle_cake": "Pastel con vela verde lima",
  "pink_candle_cake": "Pastel con vela rosa",
  "gray_candle_cake": "Pastel con vela gris",
  "light_gray_candle_cake": "Pastel con vela gris claro",
  "cyan_candle_cake": "Pastel con vela cian",
  "purple_candle_cake": "Pastel con vela morada",
  "blue_candle_cake": "Pastel con vela azul",
  "brown_candle_cake": "Pastel con vela café",
  "green_candle_cake": "Pastel con vela verde",
  "red_candle_cake": "Pastel con vela roja",
  "black_candle_cake": "Pastel con vela negra",
  "spyglass": "Catalejo",
  "amethyst_shard": "Fragmento de amatista",
  "amethyst_block": "Bloque de amatista",
  "budding_amethyst": "Germinador de amatista",
  "amethyst_cluster": "Racimo de amatista",
  "large_amethyst_bud": "Capullo de amatista grande",
  "medium_amethyst_bud": "Capullo de amatista mediano",
  "small_amethyst_bud": "Capullo de amatista pequeño",
  "tuff": "Toba volcánica",
  "calcite": "Calcita",
  "tinted_glass": "Cristal entintado",
  "smooth_basalt": "Basalto liso",
  "wildflowers": "Flores silvestres",
  "firefly_bush": "Arbusto de luciérnagas",
  "bush": "Arbusto",
  "leaf_litter": "Hojas secas",
  "cactus_flower": "Flor de cactus",
  "brown_egg": "Huevo marrón",
  "blue_egg": "Huevo azul",
  "short_dry_grass": "Hierba seca corta",
  "tall_dry_grass": "Hierba seca alta",
  "dried_ghast": "Ghast seco",
  "black_harness": "Arnés negro",
  "blue_harness": "Arnés azul",
  "brown_harness": "Arnés marrón",
  "cyan_harness": "Arnés cian",
  "gray_harness": "Arnés gris",
  "green_harness": "Arnés verde",
  "light_blue_harness": "Arnés azul claro",
  "light_gray_harness": "Arnés gris claro",
  "lime_harness": "Arnés verde lima",
  "magenta_harness": "Arnés magenta",
  "orange_harness": "Arnés naranja",
  "pink_harness": "Arnés rosa",
  "purple_harness": "Arnés morado",
  "red_harness": "Arnés rojo",
  "white_harness": "Arnés blanco",
  "yellow_harness": "Arnés amarillo",
  "copper_nugget": "Pepita de cobre",
  "copper_sword": "Espada de cobre",
  "copper_pickaxe": "Pico de cobre",
  "copper_axe": "Hacha de cobre",
  "copper_shovel": "Pala de cobre",
  "copper_hoe": "Azada de cobre",
  "copper_boots": "Botas de cobre",
  "copper_leggings": "Grebas de cobre",
  "copper_chestplate": "Pechera de cobre",
  "copper_helmet": "Yelmo de cobre",
  "copper_chest": "Cofre de cobre",
  "exposed_copper_chest": "Cofre de cobre expuesto",
  "weathered_copper_chest": "Cofre de cobre degradado",
  "oxidized_copper_chest": "Cofre de cobre oxidado",
  "waxed_copper_chest": "Cofre de cobre encerado",
  "waxed_exposed_copper_chest": "Cofre de cobre expuesto encerado",
  "waxed_weathered_copper_chest": "Cofre de cobre degradado encerado",
  "waxed_oxidized_copper_chest": "Cofre de cobre oxidado encerado",
  "acacia_shelf": "Repisa de acacia",
  "bamboo_shelf": "Repisa de bambú",
  "birch_shelf": "Repisa de abedul",
  "cherry_shelf": "Repisa de cerezo",
  "crimson_shelf": "Repisa carmesí",
  "dark_oak_shelf": "Repisa de roble oscuro",
  "jungle_shelf": "Repisa de jungla",
  "mangrove_shelf": "Repisa de manglar",
  "oak_shelf": "Repisa de roble",
  "pale_oak_shelf": "Repisa de roble pálido",
  "spruce_shelf": "Repisa de abeto",
  "warped_shelf": "Repisa deformada",
  "copper_golem_statue": "Estatua de gólem de cobre",
  "exposed_copper_golem_statue": "Estatua de gólem de cobre expuesto",
  "weathered_copper_golem_statue": "Estatua de gólem de cobre erosionado",
  "oxidized_copper_golem_statue": "Estatua de gólem de cobre oxidado",
  "waxed_copper_golem_statue": "Estatua de gólem de cobre encerado",
  "waxed_exposed_copper_golem_statue": "Estatua de gólem de cobre expuesto encerado",
  "waxed_weathered_copper_golem_statue": "Estatua de gólem de cobre erosionado encerado",
  "waxed_oxidized_copper_golem_statue": "Estatua de gólem de cobre oxidado encerado",
  "copper_chain": "Cadena de cobre",
  "exposed_copper_chain": "Cadena de cobre expuesto",
  "weathered_copper_chain": "Cadena de cobre erosionado",
  "oxidized_copper_chain": "Cadena de cobre oxidado",
  "waxed_copper_chain": "Cadena de cobre encerado",
  "waxed_exposed_copper_chain": "Cadena de cobre expuesto encerado",
  "waxed_weathered_copper_chain": "Cadena de cobre erosionado encerado",
  "waxed_oxidized_copper_chain": "Cadena de cobre oxidado encerado",
  "copper_bars": "Barrotes de cobre",
  "exposed_copper_bars": "Barrotes de cobre expuesto",
  "weathered_copper_bars": "Barrotes de cobre erosionado",
  "oxidized_copper_bars": "Barrotes de cobre oxidado",
  "waxed_copper_bars": "Barrotes de cobre encerado",
  "waxed_exposed_copper_bars": "Barrotes de cobre expuesto encerado",
  "waxed_weathered_copper_bars": "Barrotes de cobre erosionado encerado",
  "waxed_oxidized_copper_bars": "Barrotes de cobre oxidado encerado",
  "copper_lantern": "Farol de cobre",
  "exposed_copper_lantern": "Farol de cobre expuesto",
  "weathered_copper_lantern": "Farol de cobre erosionado",
  "oxidized_copper_lantern": "Farol de cobre oxidado",
  "waxed_copper_lantern": "Farol de cobre encerado",
  "waxed_exposed_copper_lantern": "Farol de cobre expuesto encerado",
  "waxed_weathered_copper_lantern": "Farol de cobre erosionado encerado",
  "waxed_oxidized_copper_lantern": "Farol de cobre oxidado encerado",
  "copper_torch": "Antorcha de cobre",
  "iron_chain": "Cadena de hierro",
  "golden_dandelion": "Diente de león dorado",
  "bucketSulfurCube": "Cubeta con cubo de azufre",
  "sulfur": "Azufre",
  "sulfur_slab": "Losa de azufre",
  "sulfur_double_slab": "Losa doble de azufre",
  "sulfur_stairs": "Escaleras de azufre",
  "sulfur_wall": "Pared de azufre",
  "polished_sulfur": "Azufre pulido",
  "polished_sulfur_slab": "Losa de azufre pulido",
  "polished_sulfur_double_slab": "Losa doble de azufre pulido",
  "polished_sulfur_stairs": "Escaleras de azufre pulido",
  "polished_sulfur_wall": "Pared de azufre pulido",
  "sulfur_bricks": "Ladrillos de azufre",
  "sulfur_brick_slab": "Losa de ladrillos de azufre",
  "sulfur_brick_double_slab": "Losa doble de ladrillos de azufre",
  "sulfur_brick_stairs": "Escaleras de ladrillos de azufre",
  "sulfur_brick_wall": "Muro de ladrillos de azufre",
  "chiseled_sulfur": "Azufre grabado",
  "potent_sulfur": "Azufre potente",
  "cinnabar": "Cinabrio",
  "cinnabar_slab": "Losa de cinabrio",
  "cinnabar_double_slab": "Losa doble de cinabrio",
  "cinnabar_stairs": "Escaleras de cinabrio",
  "cinnabar_wall": "Pared de cinabrio",
  "polished_cinnabar": "Cinabrio pulido",
  "polished_cinnabar_slab": "Losa de cinabrio pulido",
  "polished_cinnabar_double_slab": "Losa doble de cinabrio pulido",
  "polished_cinnabar_stairs": "Escaleras de cinabrio pulido",
  "polished_cinnabar_wall": "Pared de cinabrio pulido",
  "cinnabar_bricks": "Ladrillos de cinabrio",
  "cinnabar_brick_slab": "Losa de ladrillos de cinabrio",
  "cinnabar_brick_double_slab": "Losa doble de ladrillos de cinabrio",
  "cinnabar_brick_stairs": "Escaleras de ladrillos de cinabrio",
  "cinnabar_brick_wall": "Pared de ladrillos de cinabrio",
  "chiseled_cinnabar": "Cinabrio grabado",
  "sulfur_spike": "Púa de azufre",
  "wooden_spear": "Lanza de madera",
  "stone_spear": "Lanza de piedra",
  "copper_spear": "Lanza de cobre",
  "iron_spear": "Lanza de hierro",
  "golden_spear": "Lanza de oro",
  "diamond_spear": "Lanza de diamante",
  "netherite_spear": "Lanza de netherita",
  "copper_nautilus_armor": "Armadura de nautilo de cobre",
  "iron_nautilus_armor": "Armadura de nautilo de hierro",
  "golden_nautilus_armor": "Armadura de nautilo de oro",
  "diamond_nautilus_armor": "Armadura de nautilo de diamante",
  "netherite_nautilus_armor": "Armadura de nautilo de netherita",
});
// END GENERATED VANILLA ES_MX CATALOG

// Catálogo vanilla local en español de México: cubre objetos y bloques comunes.
const ITEM_NAMES_ES_MX = Object.freeze({
  "air": "Aire",
  "apple": "Manzana",
  "golden_apple": "Manzana de oro",
  "armadillo_scute": "Escama de armadillo",
  "armor_stand": "Soporte para armaduras",
  "arrow": "Flecha",
  "tipped_arrow": "Flecha con punta filosa",
  "bell": "Campana",
  "steak": "Filete",
  "beef": "Bistec crudo",
  "beetroot": "Betabel",
  "beetroot_soup": "Sopa de betabel",
  "blaze_powder": "Polvo de Blaze",
  "blaze_rod": "Vara de Blaze",
  "bone": "Hueso",
  "book": "Libro",
  "breeze_rod": "Vara de vorágine",
  "chainmail_boots": "Botas de cota de malla",
  "leather_boots": "Botas de cuero",
  "diamond_boots": "Botas de diamante",
  "golden_boots": "Botas de oro",
  "iron_boots": "Botas de hierro",
  "bow": "Arco",
  "bowl": "Tazón",
  "bread": "Pan",
  "brewing_stand": "Puesto de destilado",
  "brick": "Ladrillo",
  "bucket": "Cubeta",
  "cake": "Pastel",
  "camera": "Cámara",
  "golden_carrot": "Zanahoria de oro",
  "warped_fungus_on_a_stick": "Caña con hongo distorsionado",
  "carrot": "Zanahoria",
  "cauldron": "Caldero",
  "charcoal": "Carbón vegetal",
  "chainmail_chestplate": "Coraza de cota de malla",
  "leather_chestplate": "Túnica de cuero",
  "diamond_chestplate": "Coraza de diamante",
  "golden_chestplate": "Coraza de oro",
  "iron_chestplate": "Coraza de hierro",
  "chorus_fruit": "Fruta coral",
  "chorus_fruit_popped": "Fruta coral horneada",
  "cooked_beef": "Filete",
  "cooked_chicken": "Gallina cocinada",
  "cooked_porkchop": "Chuleta de cerdo cocinada",
  "chicken": "Gallina cruda",
  "clay_ball": "Bola de arcilla",
  "clock": "Reloj",
  "coal": "Carbón",
  "comparator": "Comparador de redstone",
  "compass": "Brújula",
  "lodestonecompass": "Brújula de magnetita",
  "cookie": "Galleta",
  "copper_door": "Puerta de cobre",
  "crossbow": "Ballesta",
  "diamond": "Diamante",
  "repeater": "Repetidor de redstone",
  "acacia_door": "Puerta de acacia",
  "birch_door": "Puerta de abedul",
  "dark_oak_door": "Puerta de roble oscuro",
  "iron_door": "Puerta de hierro",
  "jungle_door": "Puerta de jungla",
  "wooden_door": "Puerta de roble",
  "spruce_door": "Puerta de abeto",
  "crimson_door": "Puerta escarlata",
  "warped_door": "Puerta distorsionada",
  "dragon_breath": "Aliento de dragón",
  "glow_ink_sac": "Saco de tinta brillante",
  "glow_frame": "Marco de elemento brillante",
  "egg": "Huevo",
  "elytra": "Elytra",
  "emerald": "Esmeralda",
  "enchanted_book": "Libro de encantamientos",
  "end_crystal": "Cristal del End",
  "end_rod": "Vara del End",
  "ender_eye": "Ojo de Ender",
  "ender_pearl": "Perla de Ender",
  "experience_bottle": "Botella de hechizo",
  "exposed_copper_door": "Puerta de cobre expuesto",
  "feather": "Pluma",
  "fermented_spider_eye": "Ojo de araña fermentado",
  "fireball": "Carga de fuego",
  "fireworks": "Cohete de fuegos artificiales",
  "clownfish": "Pez tropical",
  "cooked_fish": "Bacalao asado",
  "fish": "Bacalao crudo",
  "photo": "Foto",
  "pufferfish": "Pez globo",
  "cooked_salmon": "Salmón asado",
  "salmon": "Salmón crudo",
  "fishing_rod": "Caña de pescar",
  "flint": "Pedernal",
  "flint_and_steel": "Pedernal y acero",
  "flower_pot": "Maceta",
  "frame": "Marco",
  "ghast_tear": "Lágrima de Ghast",
  "glass_bottle": "Botella",
  "gold_nugget": "Pepita de oro",
  "iron_nugget": "Pepita de hierro",
  "diamond_axe": "Hacha de diamante",
  "golden_axe": "Hacha de oro",
  "iron_axe": "Hacha de hierro",
  "stone_axe": "Hacha de piedra",
  "wooden_axe": "Hacha de madera",
  "chainmail_helmet": "Casco de cota de malla",
  "leather_helmet": "Gorra de cuero",
  "diamond_helmet": "Casco de diamante",
  "golden_helmet": "Casco de oro",
  "iron_helmet": "Casco de hierro",
  "diamond_hoe": "Azadón de diamante",
  "golden_hoe": "Azadón de oro",
  "iron_hoe": "Azadón de hierro",
  "stone_hoe": "Azadón de piedra",
  "wooden_hoe": "Azada de madera",
  "honey_bottle": "Botella de miel",
  "honeycomb": "Panal",
  "netherite_horse_armor": "Armadura de netherita para caballo",
  "horsearmordiamond": "Armadura de diamante para caballo",
  "horsearmorgold": "Armadura dorada para caballo",
  "horsearmoriron": "Armadura de hierro para caballo",
  "copper_horse_armor": "Armadura de cobre para caballo",
  "horsearmorleather": "Armadura de cuero para caballo",
  "gold_ingot": "Lingote de oro",
  "iron_ingot": "Lingote de hierro",
  "netherite_ingot": "Lingote de Netherita",
  "netherite_scrap": "Fragmento de netherita",
  "netherite_sword": "Espada de netherita",
  "netherite_pickaxe": "Pico de Netherita",
  "netherite_axe": "Hacha de Netherita",
  "netherite_shovel": "Pala de Netherita",
  "netherite_hoe": "Azada de Netherita",
  "netherite_boots": "Botas de Netherita",
  "netherite_leggings": "Mallas de Netherita",
  "netherite_chestplate": "Pechera de Netherita",
  "netherite_helmet": "Casco de Netherita",
  "lead": "Correa",
  "leather": "Cuero",
  "leaves": "Hojas",
  "chainmail_leggings": "Musleras de cota de malla",
  "leather_leggings": "Pantalones de cuero",
  "diamond_leggings": "Musleras de diamante",
  "golden_leggings": "Mallas de oro",
  "iron_leggings": "Mallas de hierro",
  "nautilus_shell": "Caparazón de nautilo",
  "heart_of_the_sea": "Corazón del Mar",
  "mace": "Maza",
  "magma_cream": "Crema de magma",
  "map": "Mapa",
  "melon": "Rodaja de sandía",
  "milk": "Cubeta de leche",
  "minecart": "Vagón",
  "chest_minecart": "Vagón con cofre",
  "command_block_minecart": "Vagón con bloque de comandos",
  "hopper_minecart": "Vagoneta con tolva",
  "ominous_bottle": "Botella siniestra",
  "ominous_trial_key": "Llave de desafío siniestro",
  "oxidized_copper_door": "Puerta de cobre oxidado",
  "tnt_minecart": "Vagón con dinamita",
  "pitcher_pod": "Semilla jarra",
  "torchflower_seeds": "Semillas de anflorcha",
  "trident": "Tridente",
  "mushroom_stew": "Sopa de hongos",
  "name_tag": "Etiqueta de nombre",
  "netherbrick": "Ladrillo del Nether",
  "quartz": "Cuarzo del Nether",
  "nether_wart": "Verruga del Nether",
  "painting": "Cuadro",
  "paper": "Papel",
  "diamond_pickaxe": "Pico de diamante",
  "golden_pickaxe": "Pico de oro",
  "iron_pickaxe": "Pico de hierro",
  "stone_pickaxe": "Pico de piedra",
  "wooden_pickaxe": "Pico de madera",
  "porkchop_cooked": "Chuleta de cerdo cocinada",
  "porkchop": "Chuleta de cerdo cruda",
  "portfolio": "Portafolio",
  "potato": "Papa",
  "baked_potato": "Papa horneada",
  "poisonous_potato": "Papa venenosa",
  "prismarine_crystals": "Cristales de prismarina",
  "prismarine_shard": "Fragmento de prismarina",
  "pumpkin_pie": "Pay de calabaza",
  "cooked_rabbit": "Conejo asado",
  "rabbit_foot": "Pata de conejo",
  "rabbit_hide": "Piel de conejo",
  "rabbit": "Conejo crudo",
  "rabbit_stew": "Estofado de conejo",
  "record": "Disco de música",
  "redstone": "Polvo de redstone",
  "reeds": "Caña de azúcar",
  "kelp": "Alga marina",
  "dried_kelp": "Algas secas",
  "rotten_flesh": "Carne podrida",
  "ruby": "Rubí",
  "saddle": "Silla de montar",
  "wheat_seeds": "Semillas de trigo",
  "beetroot_seeds": "Semillas de betabel",
  "melon_seeds": "Semillas de sandía",
  "pumpkin_seeds": "Semillas de calabaza",
  "shears": "Tijeras",
  "diamond_shovel": "Pala de diamante",
  "golden_shovel": "Pala de oro",
  "iron_shovel": "Pala de hierro",
  "stone_shovel": "Pala de piedra",
  "wooden_shovel": "Pala de madera",
  "sign": "Letrero de roble",
  "spruce_sign": "Letrero de abeto",
  "birch_sign": "Letrero de abedul",
  "jungle_sign": "Letrero de jungla",
  "acacia_sign": "Letrero de acacia",
  "darkoak_sign": "Letrero de roble oscuro",
  "crimson_sign": "Letrero carmesí",
  "warped_sign": "Letrero distorsionado",
  "slime_ball": "Bola de slime",
  "snowball": "Bola de nieve",
  "speckled_melon": "Rodaja de sandía resplandeciente",
  "spider_eye": "Ojo de araña",
  "stick": "Palo",
  "string": "Cuerda",
  "sugar": "Azúcar",
  "gunpowder": "Pólvora",
  "diamond_sword": "Espada de diamante",
  "golden_sword": "Espada de oro",
  "iron_sword": "Espada de hierro",
  "stone_sword": "Espada de piedra",
  "wooden_sword": "Espada de madera",
  "waxed_copper_door": "Puerta de cobre encerado",
  "waxed_exposed_copper_door": "Puerta de cobre expuesto encerado",
  "waxed_oxidized_copper_door": "Puerta de cobre oxidado encerado",
  "waxed_weathered_copper_door": "Puerta de cobre degradado encerado",
  "weathered_copper_door": "Puerta de cobre degradado",
  "wind_charge": "Carga de viento",
  "wheat": "Trigo",
  "wolf_armor": "Armadura para lobo",
  "writable_book": "Libro y pluma",
  "written_book": "Libro escrito",
  "glowstone_dust": "Polvo de piedra luminosa",
  "shulker_shell": "Coraza de Shulker",
  "totem": "Tótem de la inmortalidad",
  "trial_key": "llave de desafío",
  "turtle_helmet": "Caparazón de tortuga",
  "turtle_shell_piece": "Escama de tortuga",
  "phantom_membrane": "Membrana de fantasma",
  "sweet_berries": "Bayas dulces",
  "suspicious_stew": "Estofado sospechoso",
  "field_masoned_banner_pattern": "Patrón de estandarte mazonado de campo",
  "creeper_banner_pattern": "Diseño de estandarte: Estampado de Creeper",
  "flow_banner_pattern": "Diseño de estandarte: Flow",
  "flower_banner_pattern": "Patrón de estandarte de carga de flores",
  "globe_banner_pattern": "Patrón de estandarte de globo terráqueo",
  "guster_banner_pattern": "Diseño de estandarte: Torbellino",
  "piglin_banner_pattern": "Patrón de estandarte de trompa",
  "skull_banner_pattern": "Patrón de estandarte de carga de calaveras",
  "mojang_banner_pattern": "Patrón de estandarte de cosas",
  "bordure_indented_banner_pattern": "Diseño de estandarte: Bordura dentada",
  "banner_pattern": "Diseño de estandarte",
  "pale_oak_door": "Puerta de roble pálido",
  "pale_oak_hanging_sign": "Letrero colgante de roble pálido",
  "pale_oak_sign": "Letrero de roble pálido",
  "pale_oak_sapling": "Brote de roble pálido",
  "pale_oak_leaves": "Hojas de roble pálido",
  "resin_brick": "Bloque de resina",
  "shield": "Escudo",
  "goat_horn": "Cuerno de cabra",
  "sculk_sensor": "Sensor sculk",
  "sculk": "Sculk",
  "sculk_vein": "Vena de sculk",
  "sculk_catalyst": "Catalizador de sculk",
  "sculk_shrieker": "Aullador sculk",
  "reinforced_deepslate": "Pizarra profunda reforzada",
  "frog_spawn": "Huevas de rana",
  "pearlescent_froglight": "Ranaluz nacarada",
  "verdant_froglight": "Ranaluz verde",
  "ochre_froglight": "Foco de rana ocre",
  "mud": "Lodo",
  "packed_mud": "Barro empaquetado",
  "mud_bricks": "Ladrillos de barro",
  "mud_brick_slab": "Losa de ladrillos de barro",
  "mud_brick_double_slab": "Losa doble de ladrillos de barro",
  "mud_brick_stairs": "Escaleras de ladrillos de barro",
  "mud_brick_wall": "Pared de ladrillos de barro",
  "mangrove_leaves": "Hojas de manglar",
  "mangrove_propagule": "Propágulo de manglar",
  "mangrove_roots": "Raíces de manglar",
  "muddy_mangrove_roots": "Raíces de manglar fangosas",
  "mangrove_log": "Tronco de manglar",
  "stripped_mangrove_log": "Tronco de manglar pelado",
  "mangrove_planks": "Tablones de manglar",
  "mangrove_button": "Botón de manglar",
  "mangrove_stairs": "Escaleras de manglar",
  "mangrove_slab": "Losa de manglar",
  "mangrove_double_slab": "Losa doble de manglar",
  "mangrove_pressure_plate": "Placa de presión de manglar",
  "mangrove_fence": "Valla de manglar",
  "mangrove_fence_gate": "Puerta de valla de manglar",
  "mangrove_door": "Puerta de manglar",
  "mangrove_sign": "Letrero de manglar",
  "mangrove_standing_sign": "Letrero de manglar",
  "mangrove_wall_sign": "Letrero de pared de manglar",
  "mangrove_hanging_sign": "Letrero colgante de manglar",
  "mangrove_trapdoor": "Escotilla de manglar",
  "mangrove_wood": "Madera de manglar",
  "stripped_mangrove_wood": "Madera de manglar pelada",
  "echo_shard": "Fragmento resonante",
  "recovery_compass": "Brújula de recuperación",
  "disc_fragment": "Fragmento de disco",
  "acacia_hanging_sign": "Letrero colgante de acacia",
  "angler_pottery_sherd": "Fragmento de cerámica con pescador",
  "archer_pottery_sherd": "Fragmento de cerámica con arquero",
  "arms_up_pottery_sherd": "Fragmento de cerámica con brazos hacia arriba",
  "bamboo_door": "Puerta de bambú",
  "bamboo_hanging_sign": "Letrero colgante de bambú",
  "bamboo_sign": "Letrero de bambú",
  "birch_hanging_sign": "Letrero colgante de abedul",
  "blade_pottery_sherd": "Fragmento de cerámica con hoja",
  "brewer_pottery_sherd": "Fragmento de cerámica con destilería",
  "brush": "Pincel",
  "burn_pottery_sherd": "Fragmento de cerámica con quemadura",
  "cherry_door": "Puerta de cerezo",
  "cherry_hanging_sign": "Señal colgante de cerezo",
  "cherry_sign": "Letrero de cerezo",
  "crimson_hanging_sign": "Letrero colgante carmesí",
  "danger_pottery_sherd": "Fragmento de cerámica con peligro",
  "dark_oak_hanging_sign": "Letrero colgante de roble oscuro",
  "explorer_pottery_sherd": "Fragmento de cerámica con explorador",
  "flow_pottery_sherd": "Fragmento de cerámica con flujo",
  "friend_pottery_sherd": "Fragmento de cerámica con amigo",
  "guster_pottery_sherd": "Fragmento de cerámica con Guster",
  "heart_pottery_sherd": "Fragmento de cerámica con corazón",
  "heartbreak_pottery_sherd": "Fragmento de cerámica con corazón roto",
  "howl_pottery_sherd": "Fragmento de cerámica con aullido",
  "jungle_hanging_sign": "Letrero colgante de jungla",
  "miner_pottery_sherd": "Fragmento de cerámica con minero",
  "mourner_pottery_sherd": "Fragmento de cerámica con doliente",
  "oak_hanging_sign": "Letrero colgante de roble",
  "plenty_pottery_sherd": "Fragmento de cerámica con riquezas",
  "prize_pottery_sherd": "Fragmento de cerámica con tesoro",
  "scrape_pottery_sherd": "Fragmento de cerámica con arañazos",
  "sheaf_pottery_sherd": "Fragmento de cerámica con gavilla",
  "shelter_pottery_sherd": "Fragmento de cerámica con refugio",
  "skull_pottery_sherd": "Fragmento de cerámica con calavera",
  "smithing_template": "Plantilla de herrería",
  "netherite_upgrade_smithing_template": "Mejora de inframundita",
  "sentry_armor_trim_smithing_template": "Acabado de armadura de centinela",
  "vex_armor_trim_smithing_template": "Acabado de armadura de vex",
  "wild_armor_trim_smithing_template": "Acabado de armadura salvaje",
  "coast_armor_trim_smithing_template": "Acabado de armadura de costa",
  "dune_armor_trim_smithing_template": "Acabado de armadura de dunas",
  "wayfinder_armor_trim_smithing_template": "Acabado de armadura de buscador de caminos",
  "raiser_armor_trim_smithing_template": "Acabado de armadura de recolector",
  "shaper_armor_trim_smithing_template": "Acabado de armadura de modelador",
  "host_armor_trim_smithing_template": "Acabado de armadura de anfitrión",
  "ward_armor_trim_smithing_template": "Acabado de armadura de guardia",
  "silence_armor_trim_smithing_template": "Acabado de armadura de silencio",
  "tide_armor_trim_smithing_template": "Acabado de armadura de marea",
  "snout_armor_trim_smithing_template": "Acabado de armadura de trompa",
  "rib_armor_trim_smithing_template": "Acabado de armadura de costilla",
  "eye_armor_trim_smithing_template": "Acabado de armadura de ojo",
  "spire_armor_trim_smithing_template": "Acabado de armadura de torre",
  "flow_armor_trim_smithing_template": "Acabado de armadura de flujo",
  "bolt_armor_trim_smithing_template": "Acabado de armadura de rayo",
  "snort_pottery_sherd": "Fragmento de cerámica con bufido",
  "spruce_hanging_sign": "Letrero colgante de abeto",
  "warped_hanging_sign": "Letrero colgante distorsionado",
  "bamboo_block": "Bloque de bambú",
  "bamboo_button": "Botón de bambú",
  "bamboo_fence_gate": "Puerta de valla de bambú",
  "bamboo_fence": "Valla de bambú",
  "bamboo_mosaic_slab": "Losa de mosaico de bambú",
  "bamboo_mosaic_double_slab": "Losa doble de mosaico de bambú",
  "bamboo_mosaic_stairs": "Escaleras de mosaico de bambú",
  "bamboo_mosaic": "Mosaico de bambú",
  "bamboo_planks": "Tablones de bambú",
  "bamboo_pressure_plate": "Placa de presión de bambú",
  "bamboo_sapling": "Retoño de bambú",
  "bamboo_standing_sign": "Letrero de bambú",
  "bamboo_wall_sign": "Letrero de pared de bambú",
  "bamboo_slab": "Losa de bambú",
  "bamboo_double_slab": "Losa doble de bambú",
  "bamboo_stairs": "Escaleras de bambú",
  "bamboo_trapdoor": "Trampilla de bambú",
  "calibrated_sculk_sensor": "Sensor de sculk calibrado",
  "cherry_button": "Botón de cerezo",
  "cherry_double_slab": "Losa doble de cerezo",
  "cherry_fence_gate": "Puerta de valla de cerezo",
  "cherry_fence": "Valla de cerezo",
  "cherry_leaves": "Hojas de cerezo",
  "cherry_log": "Tronco de cerezo",
  "cherry_planks": "Tablones de cerezo",
  "cherry_pressure_plate": "Placa de presión de cerezo",
  "cherry_sapling": "Brote de cerezo",
  "cherry_standing_sign": "Letrero de cerezo",
  "cherry_wall_sign": "Letrero de pared de cerezo",
  "cherry_slab": "Losa de cerezo",
  "cherry_stairs": "Escaleras de cerezo",
  "cherry_trapdoor": "Trampilla de cerezo",
  "cherry_wood": "Leño de cerezo",
  "chiseled_bookshelf": "Estantería cincelada",
  "chiseled_tuff": "Toba grabada",
  "chiseled_tuff_bricks": "Ladrillos de toba grabados",
  "decorated_pot": "Jarrón",
  "pink_petals": "Pétalos rosas",
  "stripped_bamboo_block": "Bloque de bambú sin corteza",
  "stripped_cherry_log": "Tronco de cerezo sin corteza",
  "stripped_cherry_wood": "Leño de cerezo sin corteza",
  "suspicious_gravel": "Grava sospechosa",
  "suspicious_sand": "Arena sospechosa",
  "acacia_fence_gate": "Puerta de valla de acacia",
  "activator_rail": "Riel activador",
  "allow": "Permitir",
  "unknown": "Desconocido",
  "deny": "Rechazar",
  "border_block": "Frontera",
  "anvil": "Yunque",
  "barrier": "Barrera",
  "beacon": "Faro",
  "beehive": "Apiario de abejas",
  "bee_nest": "Colmena de abejas",
  "target": "Objetivo",
  "bed": "Cama",
  "bedrock": "Roca madre",
  "conduit": "Conducto",
  "big_dripleaf": "Hoja de goteo grande",
  "small_dripleaf_block": "Hoja de goteo pequeña",
  "hanging_roots": "Raíces colgantes",
  "dirt_with_roots": "Tierra con raíces",
  "spore_blossom": "Flor de esporas",
  "azalea_leaves": "Hojas de azalea",
  "azalea_leaves_flowered": "Hojas de azalea en flor",
  "azalea": "Azalea",
  "flowering_azalea": "Azalea en flor",
  "cave_vines": "Enredaderas de cueva",
  "cave_vines_body_with_berries": "Enredaderas de cueva",
  "cave_vines_head_with_berries": "Enredaderas de cueva",
  "glow_berries": "Bayas brillantes",
  "moss_block": "Bloque de musgo",
  "moss_carpet": "Alfombra de musgo",
  "birch_fence_gate": "Puerta de valla de abedul",
  "blast_furnace": "Alto horno",
  "lit_blast_furnace": "Alto horno encendido",
  "bone_block": "Bloque de huesos",
  "coal_block": "Bloque de carbón",
  "diamond_block": "Bloque de diamante",
  "emerald_block": "Bloque de esmeralda",
  "gold_block": "Bloque de oro",
  "iron_block": "Bloque de hierro",
  "lapis_block": "Bloque de lapislázuli",
  "redstone_block": "Bloque de redstone",
  "bookshelf": "Estantería",
  "brick_block": "Ladrillos",
  "brown_mushroom": "Hongo marrón",
  "wooden_button": "Botón de roble",
  "acacia_button": "Botón de acacia",
  "birch_button": "Botón de abedul",
  "dark_oak_button": "Botón de roble oscuro",
  "jungle_button": "Botón de jungla",
  "spruce_button": "Botón de abeto",
  "stone_button": "Botón de piedra",
  "cactus": "Cactus",
  "dried_kelp_block": "Bloque de algas secas",
  "carrots": "Zanahorias",
  "carved_pumpkin": "Calabaza tallada",
  "chalkboard": "Pizarrón",
  "chest": "Cofre",
  "ender_chest": "Cofre de Ender",
  "jigsaw": "Bloque rompecabezas",
  "heavy_core": "Núcleo pesado",
  "honey_block": "Bloque de miel",
  "honeycomb_block": "Bloque de panal",
  "lodestone": "Magnetita",
  "nether_sprouts": "Rastrojo del Nether",
  "crimson_stem": "Tallo escarlata",
  "warped_stem": "Tallo distorsionado",
  "stripped_crimson_stem": "Tallo escarlata sin corteza",
  "stripped_warped_stem": "Tallo distorsionado sin corteza",
  "crimson_hyphae": "Hifas carmesíes",
  "warped_hyphae": "Hifas distorsionadas",
  "stripped_crimson_hyphae": "Hifas carmesí sin corteza",
  "stripped_warped_hyphae": "Hifas distorsionadas sin corteza",
  "crimson_planks": "Tablones carmesí",
  "warped_planks": "Tablones distorsionados",
  "crimson_trapdoor": "Trampilla carmesí",
  "warped_trapdoor": "Trampilla distorsionada",
  "crimson_standing_sign": "Letrero carmesí",
  "warped_standing_sign": "Letrero distorsionado",
  "crimson_wall_sign": "Letrero carmesí",
  "warped_wall_sign": "Letrero distorsionado",
  "crimson_stairs": "Escaleras carmesí",
  "warped_stairs": "Escaleras distorsionadas",
  "crimson_fence": "Valla escarlata",
  "warped_fence": "Valla distorsionada",
  "crimson_fence_gate": "Puerta de valla escarlata",
  "warped_fence_gate": "Puerta de valla distorsionada",
  "crimson_button": "Botón escarlata",
  "warped_button": "Botón distorsionado",
  "crimson_pressure_plate": "Placa de presión carmesí",
  "warped_pressure_plate": "Placa de presión distorsionada",
  "crimson_slab": "Losa escarlata",
  "warped_slab": "Losa distorsionada",
  "crimson_double_slab": "Losa escarlata",
  "warped_double_slab": "Losa distorsionada",
  "shroomlight": "Hongo luminoso",
  "crimson_nylium": "Nilio carmesí",
  "warped_nylium": "Nilio distorsionado",
  "basalt": "Basalto",
  "polished_basalt": "Basalto pulido",
  "blackstone": "Piedra negra",
  "polished_blackstone_bricks": "Ladrillos de piedra negra pulida",
  "cracked_polished_blackstone_bricks": "Ladrillos de piedra negra pulida rota",
  "polished_blackstone_brick_stairs": "Escaleras de ladrillos de piedra negra pulida",
  "blackstone_stairs": "Escaleras de piedra negra",
  "blackstone_wall": "Pared de piedra negra",
  "polished_blackstone_brick_wall": "Pared de ladrillos de piedra negra pulida",
  "chiseled_polished_blackstone": "Piedra negra pulida grabada",
  "gilded_blackstone": "Piedra negra áurea",
  "blackstone_slab": "Losa de piedra negra",
  "blackstone_double_slab": "Losa doble de piedra negra",
  "polished_blackstone_brick_slab": "Losa de ladrillo de piedra negra pulida",
  "polished_blackstone_brick_double_slab": "Losa doble de ladrillo de piedra negra pulida",
  "chain": "Cadena",
  "soul_soil": "Tierra de almas",
  "soul_fire": "Fuego de almas",
  "polished_blackstone": "Piedra negra pulida",
  "polished_blackstone_stairs": "Escaleras de piedra negra pulida",
  "polished_blackstone_slab": "Losa de piedra negra pulida",
  "polished_blackstone_double_slab": "Losa doble de piedra negra pulida",
  "polished_blackstone_pressure_plate": "Placa de presión de piedra negra pulida",
  "polished_blackstone_button": "Botón de piedra negra pulida",
  "polished_blackstone_wall": "Pared de piedra negra pulida",
  "polished_tuff": "Toba pulida",
  "polished_tuff_slab": "Losa de toba pulida",
  "polished_tuff_double_slab": "Losa doble de toba pulida",
  "polished_tuff_stairs": "Escaleras de toba pulida",
  "polished_tuff_wall": "Pared de toba pulida",
  "soul_campfire": "Fogata de almas",
  "chiseled_nether_bricks": "Ladrillos del Nether grabados",
  "cracked_nether_bricks": "Ladrillos del Nether rotos",
  "quartz_bricks": "Ladrillos de cuarzo",
  "trapped_chest": "Cofre con trampa",
  "chorus_flower": "Flor coral",
  "chorus_plant": "Planta coral",
  "clay": "Arcilla",
  "hardened_clay": "Terracota",
  "stained_hardened_clay": "Terracota",
  "structure_block": "Bloque estructural",
  "structure_void": "Vacío estructural",
  "trial_spawner": "Generador de desafío",
  "vault": "Bóveda",
  "wool": "Lana",
  "cocoa": "Cacao",
  "command_block": "Bloque de comandos",
  "composter": "Compostador",
  "light_block": "Claro",
  "repeating_command_block": "Bloque de comandos repetido",
  "chain_command_block": "Bloque de comandos en cadena",
  "dark_oak_fence_gate": "Puerta de valla de roble oscuro",
  "daylight_detector": "Sensor de luz solar",
  "daylight_detector_inverted": "Sensor de luz solar invertido",
  "deadbush": "Arbusto muerto",
  "detector_rail": "Riel detector",
  "dirt": "Tierra",
  "podzol": "Podsol",
  "dispenser": "Dispensador",
  "double_plant": "Planta",
  "dragon_egg": "Huevo de dragón",
  "dropper": "Soltador",
  "enchanting_table": "Mesa de encantamientos",
  "end_gateway": "Nexo del End",
  "end_portal_frame": "Marco del portal del End",
  "end_portal": "Portal del End",
  "farmland": "Tierra de cultivo",
  "fletching_table": "Mesa de arquería",
  "fence": "Valla de roble",
  "fence_gate": "Puerta de valla de roble",
  "iron_bars": "Barras de hierro",
  "fire": "Fuego",
  "yellow_flower": "Flor",
  "red_flower": "Flor",
  "torchflower_crop": "Cultivo de anflorcha",
  "wither_rose": "Rosa del Wither",
  "furnace": "Horno",
  "lit_furnace": "Horno encendido",
  "glass": "Cristal",
  "golden_rail": "Riel propulsado",
  "grass": "Bloque de pasto",
  "grass_path": "Camino de tierra",
  "gravel": "Grava",
  "hay_block": "Paca de heno",
  "netherrack": "Infiedra",
  "soul_sand": "Arena de almas",
  "hopper": "Tolva",
  "ice": "Hielo",
  "packed_ice": "Hielo comprimido",
  "blue_ice": "Hielo azul",
  "frosted_ice": "Escarcha",
  "iron_trapdoor": "Trampilla de hierro",
  "jukebox": "Tocadiscos",
  "jungle_fence_gate": "Puerta de valla de jungla",
  "ladder": "Escalera",
  "flowing_lava": "Lava",
  "lava": "Lava",
  "lever": "Palanca",
  "glowstone": "Piedra luminosa",
  "glow_lichen": "Liquen luminoso",
  "lightning_rod": "Pararrayos",
  "exposed_lightning_rod": "Pararrayos expuesto",
  "weathered_lightning_rod": "Pararrayos erosionado",
  "oxidized_lightning_rod": "Pararrayos oxidado",
  "waxed_lightning_rod": "Pararrayos encerado",
  "waxed_exposed_lightning_rod": "Pararrayos expuesto y encerado",
  "waxed_weathered_lightning_rod": "Pararrayos erosionado y encerado",
  "waxed_oxidized_lightning_rod": "Pararrayos oxidado y encerado",
  "lit_pumpkin": "Calabaza iluminada",
  "lockedchest": "Cofre cerrado",
  "log": "Leño",
  "magma": "Bloque de magma",
  "melon_block": "Sandía",
  "melon_stem": "Tallo de sandía",
  "mob_spawner": "Generador de monstruos",
  "monster_egg": "Piedra infestada",
  "mushroom": "Hongo",
  "noteblock": "Bloque de nota",
  "mycelium": "Micelio",
  "nether_brick": "Ladrillos del Nether",
  "red_nether_brick": "Ladrillos del Nether rojos",
  "nether_brick_fence": "Valla de ladrillos del Nether",
  "quartz_ore": "Mineral de cuarzo del Nether",
  "netherreactor": "Núcleo del reactor del Nether",
  "nether_wart_block": "Bloque de verrugas del Nether",
  "warped_wart_block": "Bloque de verrugas distorsionadas",
  "unlit_redstone_torch": "Antorcha de redstone",
  "redstone_torch": "Antorcha de redstone",
  "soul_torch": "Antorcha de alma",
  "obsidian": "Obsidiana",
  "glowingobsidian": "Obsidiana brillante",
  "coal_ore": "Mineral de carbón",
  "diamond_ore": "Mineral de diamante",
  "emerald_ore": "Mineral de esmeralda",
  "gold_ore": "Mineral de oro",
  "iron_ore": "Mineral de hierro",
  "copper_ore": "Mineral de cobre",
  "lapis_ore": "Mineral de lapislázuli",
  "redstone_ore": "Mineral de redstone",
  "lit_redstone_ore": "Mineral de redstone encendida",
  "observer": "Observador",
  "piston": "Pistón",
  "sticky_piston": "Pistón adhesivo",
  "piston_arm_collision": "Colisión de brazo de pistón",
  "sticky_piston_arm_collision": "Colisión de brazo de pistón pegajoso",
  "unpowered_comparator": "Comparador sin energía",
  "powered_comparator": "Comparador con energía",
  "unpowered_repeater": "Repetidor sin energía",
  "powered_repeater": "Repetidor con energía",
  "portal": "Portal",
  "potatoes": "Papas",
  "stone_pressure_plate": "Placa de presión de piedra",
  "wooden_pressure_plate": "Placa de presión de roble",
  "acacia_pressure_plate": "Placa de presión de acacia",
  "birch_pressure_plate": "Placa de presión de abedul",
  "dark_oak_pressure_plate": "Placa de presión de roble oscuro",
  "jungle_pressure_plate": "Placa de presión de jungla",
  "spruce_pressure_plate": "Placa de presión de abeto",
  "pumpkin": "Calabaza",
  "pumpkin_stem": "Tallo de calabaza",
  "quartz_block": "Bloque de cuarzo",
  "rail": "Riel",
  "red_mushroom": "Hongo rojo",
  "crimson_fungus": "Hongo carmesí",
  "warped_fungus": "Hongo distorsionado",
  "red_mushroom_block": "Bloque de hongo rojo",
  "red_sandstone": "Arenisca roja",
  "redstone_wire": "Polvo de redstone",
  "redstone_lamp": "Lámpara de redstone",
  "lit_redstone_lamp": "Lámpara de redstone encendida",
  "sand": "Arena",
  "sandstone": "Arenisca",
  "standing_sign": "Letrero",
  "wall_sign": "Cartel de pared",
  "spruce_standing_sign": "Letrero de abeto",
  "spruce_wall_sign": "Cartel de pared de abeto",
  "birch_standing_sign": "Letrero de abedul",
  "birch_wall_sign": "Letrero de pared de abedul",
  "jungle_standing_sign": "Letrero de jungla",
  "jungle_wall_sign": "Letrero de pared de la jungla",
  "acacia_standing_sign": "Letrero de acacia",
  "acacia_wall_sign": "Letrero de pared de acacia",
  "darkoak_standing_sign": "Letrero de roble oscuro",
  "darkoak_wall_sign": "Letrero de pared de roble oscuro",
  "slime": "Bloque de slime",
  "snow": "Bloque de nieve",
  "spruce_fence_gate": "Puerta de valla de abeto",
  "brick_stairs": "Escaleras de ladrillos",
  "nether_brick_stairs": "Escaleras de ladrillos del Nether",
  "quartz_stairs": "Escaleras de cuarzo",
  "smooth_quartz_stairs": "Escaleras de cuarzo liso",
  "red_sandstone_stairs": "Escaleras de arenisca roja",
  "sandstone_stairs": "Escaleras de arenisca",
  "stone_stairs": "Escaleras de adoquines",
  "normal_stone_stairs": "Escaleras de piedra",
  "stone_brick_stairs": "Escaleras de ladrillos de piedra",
  "oak_stairs": "Escaleras de roble",
  "acacia_stairs": "Escaleras de acacia",
  "birch_stairs": "Escaleras de abedul",
  "dark_oak_stairs": "Escaleras de roble oscuro",
  "jungle_stairs": "Escaleras de la jungla",
  "spruce_stairs": "Escaleras de abeto",
  "purpur_stairs": "Escaleras de purpur",
  "prismarine_stairs": "Escaleras de prismarina",
  "dark_prismarine_stairs": "Escaleras de prismarina oscura",
  "prismarine_bricks_stairs": "Escaleras de ladrillos de prismarina",
  "granite_stairs": "Escaleras de granito",
  "diorite_stairs": "Escaleras de diorita",
  "andesite_stairs": "Escaleras de andesita",
  "polished_granite_stairs": "Escaleras de granito pulido",
  "polished_diorite_stairs": "Escaleras de diorita pulida",
  "polished_andesite_stairs": "Escaleras de andesita pulida",
  "mossy_stone_brick_stairs": "Escaleras de ladrillos de piedra musgosa",
  "smooth_red_sandstone_stairs": "Escaleras de arenisca roja lisa",
  "smooth_sandstone_stairs": "Escaleras de arenisca lisa",
  "end_brick_stairs": "Escaleras de ladrillos de piedra del End",
  "mossy_cobblestone_stairs": "Escaleras de piedra labrada musgosa",
  "red_nether_brick_stairs": "Escaleras de ladrillos del Nether rojos",
  "smooth_stone": "Piedra lisa",
  "standing_banner": "Estandarte",
  "wall_banner": "Estandarte de muro",
  "cobblestone": "Adoquín",
  "stonebrick": "Ladrillos de piedra",
  "stonecutter": "Cortapiedras",
  "stonecutter_block": "Cortapiedras",
  "mossy_cobblestone": "Piedra labrada musgosa",
  "double_stone_slab": "Losa de piedra",
  "stone_slab": "Losa de piedra",
  "tallgrass": "Pasto corto",
  "tuff_brick_slab": "Losa de ladrillos de toba",
  "tuff_brick_double_slab": "Losa doble de ladrillo de toba",
  "tuff_brick_stairs": "Escaleras de ladrillos de toba",
  "tuff_brick_wall": "Pared de ladrillos de toba",
  "tuff_bricks": "Ladrillos de toba",
  "tuff_slab": "Losa de toba",
  "tuff_double_slab": "Losa doble de toba",
  "tuff_stairs": "Escaleras de toba",
  "tuff_wall": "Pared de toba",
  "sea_pickle": "Pepinillo de mar",
  "turtle_egg": "Huevo de tortuga",
  "bubble_column": "Columna de burbujas",
  "dead_bubble_coral_wall_fan": "Ventilador de pared de coral de burbuja muerto",
  "dead_horn_coral_wall_fan": "Ventilador de pared de coral de cuerno muerto",
  "dead_fire_coral_wall_fan": "Ventilador de pared de coral de fuego muerto",
  "tube_coral_wall_fan": "Ventilador de pared de coral de tubo",
  "dead_brain_coral_wall_fan": "Ventilador de pared de coral de cerebro muerto",
  "brain_coral_wall_fan": "Ventilador de pared de coral de cerebro",
  "horn_coral_wall_fan": "Ventilador de pared de coral de cuerno",
  "fire_coral_wall_fan": "Ventilador de pared de coral de fuego",
  "bubble_coral_wall_fan": "Ventilador de pared de coral de burbuja",
  "dead_tube_coral_wall_fan": "Ventilador de pared de coral de tubo muerto",
  "glass_pane": "Panel de cristal",
  "tnt": "Dinamita",
  "snow_layer": "Nieve",
  "torch": "Antorcha",
  "trapdoor": "Trampilla de roble",
  "acacia_trapdoor": "Trampilla de acacia",
  "birch_trapdoor": "Trampilla de abedul",
  "dark_oak_trapdoor": "Trampilla de roble oscuro",
  "jungle_trapdoor": "Trampilla de jungla",
  "spruce_trapdoor": "Trampilla de abeto",
  "tripwire_hook": "Gancho de hilo de activación",
  "vine": "Lianas",
  "weeping_vines": "Enredaderas lloronas",
  "twisting_vines": "Lianas retorcidas",
  "flowing_water": "Agua",
  "water": "Agua",
  "waterlily": "Nenúfar",
  "web": "Telaraña",
  "heavy_weighted_pressure_plate": "Placa de presión para peso elevado",
  "light_weighted_pressure_plate": "Placa de presión para peso liviano",
  "end_stone": "Piedra del End",
  "end_bricks": "Ladrillos de piedra del End",
  "planks": "Tablones de madera",
  "wooden_slab": "Losa de madera",
  "carpet": "Alfombra",
  "crafter": "Fabricador",
  "crafting_table": "Mesa de trabajo",
  "pale_oak_button": "Botón de roble pálido",
  "pale_oak_double_slab": "Losa doble de roble pálido",
  "pale_oak_fence": "Valla de roble pálido",
  "pale_oak_fence_gate": "Puerta de valla de roble pálido",
  "pale_oak_log": "Tronco de roble pálido",
  "pale_oak_planks": "Tablones de roble pálido",
  "pale_oak_pressure_plate": "Placa de presión de roble pálido",
  "pale_oak_standing_sign": "Letrero de roble pálido",
  "pale_oak_wall_sign": "Letrero de pared de roble pálido",
  "pale_oak_slab": "Losa de roble pálido",
  "pale_oak_stairs": "Escaleras de roble pálido",
  "pale_oak_trapdoor": "Trampilla de roble pálido",
  "pale_oak_wood": "Leño de roble pálido",
  "stripped_pale_oak_log": "Tronco de roble pálido sin corteza",
  "stripped_pale_oak_wood": "Leño de roble pálido sin corteza",
  "pale_hanging_moss": "Musgo pálido colgante",
  "pale_moss_block": "Bloque de musgo pálido",
  "pale_moss_carpet": "Alfombra de musgo pálido",
  "creaking_heart": "Corazón de crepitante",
  "open_eyeblossom": "Miraflor abierta",
  "closed_eyeblossom": "Miraflor cerrada",
  "resin_bricks": "Ladrillos de resina",
  "resin_brick_double_slab": "Losa doble de ladrillo de resina",
  "resin_brick_slab": "Losa de ladrillos de resina",
  "resin_brick_stairs": "Escaleras de ladrillos de resina",
  "resin_brick_wall": "Pared de ladrillos de resina",
  "chiseled_resin_bricks": "Ladrillos de resina grabados",
  "resin_block": "Bloque de resina",
  "resin_clump": "Grumo de resina",
  "stripped_spruce_log": "Tronco de abeto descortezado",
  "stripped_dark_oak_log": "Tronco de roble oscuro descortezado",
  "stripped_birch_log": "Tronco de abedul descortezado",
  "stripped_jungle_log": "Tronco de la jungla sin corteza",
  "stripped_oak_log": "Tronco de roble descortezado",
  "stripped_acacia_log": "Tronco de acacia descortezado",
  "bamboo": "Bambú",
  "scaffolding": "Andamios",
  "grindstone": "Afiladora",
  "cartography_table": "Mesa de cartografía",
  "lantern": "Farol",
  "soul_lantern": "Farol de almas",
  "smoker": "Ahumador",
  "lit_smoker": "Ahumador encendido",
  "smithing_table": "Mesa de herrería",
  "barrel": "Barril",
  "campfire": "Fogata",
  "loom": "Telar",
  "lectern": "Atril",
  "sweet_berry_bush": "Arbusto de bayas dulces",
  "netherite_block": "Bloque de netherita",
  "ancient_debris": "Escombros ancestrales",
  "nether_gold_ore": "Mineral de oro del Nether",
  "respawn_anchor": "Nexo de reaparición",
  "crying_obsidian": "Obsidiana llorosa",
  "powder_snow": "Nieve en polvo",
  "deepslate": "Pizarra profunda",
  "infested_deepslate": "Pizarra profunda infestada",
  "cobbled_deepslate": "Pizarra abismal empedrada",
  "dripstone_block": "Bloque de espeleotema",
  "pointed_dripstone": "Espeleotema puntiaguda",
  "cobbled_deepslate_slab": "Losa de pizarra abismal empedrada",
  "cobbled_deepslate_stairs": "Escaleras de pizarra abismal empedrada",
  "cobbled_deepslate_wall": "Pared de pizarra abismal empedrada",
  "polished_deepslate": "Pizarra abismal pulida",
  "polished_deepslate_slab": "Losa de pizarra abismal pulida",
  "polished_deepslate_stairs": "Escaleras de pizarra abismal pulida",
  "polished_deepslate_wall": "Pared de pizarra abismal pulida",
  "deepslate_tiles": "Mosaicos de pizarra abismal",
  "deepslate_tile_slab": "Losa de mosaico de pizarra abismal",
  "deepslate_tile_stairs": "Escaleras de mosaico de pizarra abismal",
  "deepslate_tile_wall": "Pared de mosaico de pizarra abismal",
  "deepslate_bricks": "Ladrillos de pizarra abismal",
  "deepslate_brick_slab": "Losa de ladrillos de pizarra abismal",
  "deepslate_brick_stairs": "Escaleras de ladrillos de pizarra abismal",
  "deepslate_brick_wall": "Pared de ladrillos de pizarra abismal",
  "chiseled_deepslate": "Pizarra abismal cincelada",
  "cobbled_deepslate_double_slab": "Losa doble de pizarra abismal empedrada",
  "polished_deepslate_double_slab": "Losa doble de pizarra abismal pulida",
  "deepslate_tile_double_slab": "Losa doble de baldosas de pizarra abismal",
  "deepslate_brick_double_slab": "Losa doble de ladrillos de pizarra abismal",
  "deepslate_lapis_ore": "Mineral de lapislázuli de pizarra profunda",
  "deepslate_iron_ore": "Mineral de hierro de pizarra profunda",
  "deepslate_gold_ore": "Mineral de oro de pizarra profunda",
  "deepslate_redstone_ore": "Mineral de redstone de pizarra profunda",
  "lit_deepslate_redstone_ore": "Mineral de redstone de pizarra profunda encendida",
  "deepslate_diamond_ore": "Mineral de diamante de pizarra abismal",
  "deepslate_coal_ore": "Mineral de carbón de pizarra abismal",
  "deepslate_emerald_ore": "Mineral de esmeralda de pizarra abismal",
  "deepslate_copper_ore": "Mineral de cobre de pizarra abismal",
  "cracked_deepslate_tiles": "Mosaicos de pizarra abismal agrietadas",
  "cracked_deepslate_bricks": "Ladrillos de pizarra abismal agrietados",
  "pitcher_plant": "Planta jarra",
  "pitcher_crop": "Cultivo de jarra",
  "sniffer_egg": "Huevo de rastreador",
  "torchflower": "Anflorcha",
  "copper_ingot": "Lingote de cobre",
  "raw_copper": "Cobre crudo",
  "raw_iron": "Hierro crudo",
  "raw_gold": "Oro crudo",
  "copper_block": "Bloque de cobre",
  "exposed_copper": "Cobre expuesto",
  "weathered_copper": "Cobre degradado",
  "oxidized_copper": "Cobre oxidado",
  "waxed_copper": "Bloque de cobre encerado",
  "waxed_exposed_copper": "Cobre expuesto encerado",
  "waxed_weathered_copper": "Cobre desgastado encerado",
  "waxed_oxidized_copper": "Cobre oxidado encerado",
  "cut_copper": "Cobre cortado",
  "exposed_cut_copper": "Cobre cortado expuesto",
  "weathered_cut_copper": "Cobre cortado desgastado",
  "oxidized_cut_copper": "Cobre cortado oxidado",
  "waxed_cut_copper": "Cobre cortado encerado",
  "waxed_exposed_cut_copper": "Cobre cortado, expuesto y encerado",
  "waxed_weathered_cut_copper": "Cobre cortado, desgastado y encerado",
  "waxed_oxidized_cut_copper": "Cobre cortado, oxidado y encerado",
  "cut_copper_stairs": "Escaleras de cobre cortado",
  "exposed_cut_copper_stairs": "Escaleras de cobre cortado expuesto",
  "weathered_cut_copper_stairs": "Escaleras de cobre cortado desgastado",
  "oxidized_cut_copper_stairs": "Escaleras de cobre cortado oxidado",
  "waxed_cut_copper_stairs": "Escaleras de cobre cortado encerado",
  "waxed_exposed_cut_copper_stairs": "Escaleras de cobre cortado, expuesto y encerado",
  "waxed_weathered_cut_copper_stairs": "Escaleras de cobre cortado, desgastado y encerado",
  "waxed_oxidized_cut_copper_stairs": "Escaleras de cobre cortado, oxidado y encerado",
  "cut_copper_slab": "Losa de cobre cortado",
  "double_cut_copper_slab": "Losa doble de cobre cortado",
  "exposed_cut_copper_slab": "Losa de cobre cortado expuesto",
  "exposed_double_cut_copper_slab": "Losa doble de cobre cortado expuesto",
  "weathered_cut_copper_slab": "Losa de cobre cortado erosionado",
  "weathered_double_cut_copper_slab": "Losa doble de cobre cortado degradado",
  "oxidized_cut_copper_slab": "Losa de cobre cortado oxidado",
  "oxidized_double_cut_copper_slab": "Losa doble de cobre cortado oxidado",
  "waxed_cut_copper_slab": "Losa de cobre cortado encerado",
  "waxed_double_cut_copper_slab": "Losa doble  de cobre cortado encerado",
  "waxed_exposed_cut_copper_slab": "Losa de cobre cortado, expuesto y encerado",
  "waxed_exposed_double_cut_copper_slab": "Losa doble de cobre cortado, expuesto y encerado",
  "waxed_weathered_cut_copper_slab": "Losa de cobre cortado, desgastado y encerado",
  "waxed_weathered_double_cut_copper_slab": "Losa doble de cobre cortado, erosionado y encerado",
  "waxed_oxidized_cut_copper_slab": "Losa de cobre cortado, oxidado y encerado",
  "waxed_oxidized_double_cut_copper_slab": "Losa doble de cobre cortado, oxidado y encerado",
  "chiseled_copper": "Cobre cincelado",
  "exposed_chiseled_copper": "Cobre cincelado expuesto",
  "oxidized_chiseled_copper": "Cobre cincelado oxidado",
  "waxed_chiseled_copper": "Cobre cincelado encerado",
  "waxed_exposed_chiseled_copper": "Cobre cincelado, expuesto y encerado",
  "waxed_oxidized_chiseled_copper": "Cobre cincelado, oxidado y encerado",
  "waxed_weathered_chiseled_copper": "Cobre grabado degradado encerado",
  "weathered_chiseled_copper": "Cobre grabado degradado",
  "copper_bulb": "Bombilla de cobre",
  "exposed_copper_bulb": "Bombilla de cobre expuesto",
  "oxidized_copper_bulb": "Bombilla de cobre oxidado",
  "waxed_copper_bulb": "Bombilla de cobre encerado",
  "waxed_exposed_copper_bulb": "Bombilla de cobre expuesto encerado",
  "waxed_oxidized_copper_bulb": "Bombilla de cobre oxidado encerado",
  "waxed_weathered_copper_bulb": "Bombilla de cobre degradado encerado",
  "weathered_copper_bulb": "Bombilla de cobre degradado",
  "copper_grate": "Rejilla de cobre",
  "exposed_copper_grate": "Rejilla de cobre expuesto",
  "oxidized_copper_grate": "Rejilla de cobre oxidado",
  "waxed_copper_grate": "Rejilla de cobre encerado",
  "waxed_exposed_copper_grate": "Rejilla de cobre expuesto encerado",
  "waxed_oxidized_copper_grate": "Rejilla de cobre oxidado encerado",
  "waxed_weathered_copper_grate": "Rejilla de cobre degradado encerado",
  "weathered_copper_grate": "Rejilla de cobre degradado",
  "copper_trapdoor": "Trampilla de cobre",
  "exposed_copper_trapdoor": "Trampilla de cobre expuesto",
  "oxidized_copper_trapdoor": "Trampilla de cobre oxidado",
  "waxed_copper_trapdoor": "Trampilla de cobre encerado",
  "waxed_exposed_copper_trapdoor": "Trampilla de cobre expuesto encerado",
  "waxed_oxidized_copper_trapdoor": "Trampilla de cobre oxidado encerado",
  "waxed_weathered_copper_trapdoor": "Trampilla de cobre degradado encerado",
  "weathered_copper_trapdoor": "Trampilla de cobre degradado",
  "raw_copper_block": "Bloque de cobre crudo",
  "raw_iron_block": "Bloque de hierro crudo",
  "raw_gold_block": "Bloque de oro crudo",
  "candle": "Vela",
  "white_candle": "Vela blanca",
  "orange_candle": "Vela naranja",
  "magenta_candle": "Vela magenta",
  "light_blue_candle": "Vela celeste",
  "yellow_candle": "Vela amarilla",
  "lime_candle": "Vela verde lima",
  "pink_candle": "Vela rosa",
  "gray_candle": "Vela gris",
  "light_gray_candle": "Vela gris claro",
  "cyan_candle": "Vela cian",
  "purple_candle": "Vela morada",
  "blue_candle": "Vela azul",
  "brown_candle": "Vela marrón",
  "green_candle": "Vela verde",
  "red_candle": "Vela roja",
  "black_candle": "Vela negra",
  "candle_cake": "Pastel con vela",
  "white_candle_cake": "Pastel con vela blanca",
  "orange_candle_cake": "Pastel con vela naranja",
  "magenta_candle_cake": "Pastel con vela magenta",
  "light_blue_candle_cake": "Pastel con vela azul claro",
  "yellow_candle_cake": "Pastel con vela amarilla",
  "lime_candle_cake": "Pastel con vela verde lima",
  "pink_candle_cake": "Pastel con vela rosa",
  "gray_candle_cake": "Pastel con vela gris",
  "light_gray_candle_cake": "Pastel con vela gris claro",
  "cyan_candle_cake": "Pastel con vela cian",
  "purple_candle_cake": "Pastel con vela morada",
  "blue_candle_cake": "Pastel con vela azul",
  "brown_candle_cake": "Pastel con vela café",
  "green_candle_cake": "Pastel con vela verde",
  "red_candle_cake": "Pastel con vela roja",
  "black_candle_cake": "Pastel con vela negra",
  "spyglass": "Catalejo",
  "amethyst_shard": "Fragmento de amatista",
  "amethyst_block": "Bloque de amatista",
  "budding_amethyst": "Germinador de amatista",
  "amethyst_cluster": "Racimo de amatista",
  "large_amethyst_bud": "Capullo de amatista grande",
  "medium_amethyst_bud": "Capullo de amatista mediano",
  "small_amethyst_bud": "Capullo de amatista pequeño",
  "tuff": "Toba volcánica",
  "calcite": "Calcita",
  "tinted_glass": "Cristal entintado",
  "smooth_basalt": "Basalto liso",
  "wildflowers": "Flores silvestres",
  "firefly_bush": "Arbusto de luciérnagas",
  "bush": "Arbusto",
  "leaf_litter": "Hojas secas",
  "cactus_flower": "Flor de cactus",
  "brown_egg": "Huevo marrón",
  "blue_egg": "Huevo azul",
  "short_dry_grass": "Hierba seca corta",
  "tall_dry_grass": "Hierba seca alta",
  "dried_ghast": "Ghast seco",
  "black_harness": "Arnés negro",
  "blue_harness": "Arnés azul",
  "brown_harness": "Arnés marrón",
  "cyan_harness": "Arnés cian",
  "gray_harness": "Arnés gris",
  "green_harness": "Arnés verde",
  "light_blue_harness": "Arnés azul claro",
  "light_gray_harness": "Arnés gris claro",
  "lime_harness": "Arnés verde lima",
  "magenta_harness": "Arnés magenta",
  "orange_harness": "Arnés naranja",
  "pink_harness": "Arnés rosa",
  "purple_harness": "Arnés morado",
  "red_harness": "Arnés rojo",
  "white_harness": "Arnés blanco",
  "yellow_harness": "Arnés amarillo",
  "copper_nugget": "Pepita de cobre",
  "copper_sword": "Espada de cobre",
  "copper_pickaxe": "Pico de cobre",
  "copper_axe": "Hacha de cobre",
  "copper_shovel": "Pala de cobre",
  "copper_hoe": "Azada de cobre",
  "copper_boots": "Botas de cobre",
  "copper_leggings": "Grebas de cobre",
  "copper_chestplate": "Pechera de cobre",
  "copper_helmet": "Yelmo de cobre",
  "copper_chest": "Cofre de cobre",
  "exposed_copper_chest": "Cofre de cobre expuesto",
  "weathered_copper_chest": "Cofre de cobre degradado",
  "oxidized_copper_chest": "Cofre de cobre oxidado",
  "waxed_copper_chest": "Cofre de cobre encerado",
  "waxed_exposed_copper_chest": "Cofre de cobre expuesto encerado",
  "waxed_weathered_copper_chest": "Cofre de cobre degradado encerado",
  "waxed_oxidized_copper_chest": "Cofre de cobre oxidado encerado",
  "acacia_shelf": "Repisa de acacia",
  "bamboo_shelf": "Repisa de bambú",
  "birch_shelf": "Repisa de abedul",
  "cherry_shelf": "Repisa de cerezo",
  "crimson_shelf": "Repisa carmesí",
  "dark_oak_shelf": "Repisa de roble oscuro",
  "jungle_shelf": "Repisa de jungla",
  "mangrove_shelf": "Repisa de manglar",
  "oak_shelf": "Repisa de roble",
  "pale_oak_shelf": "Repisa de roble pálido",
  "spruce_shelf": "Repisa de abeto",
  "warped_shelf": "Repisa deformada",
  "copper_golem_statue": "Estatua de gólem de cobre",
  "exposed_copper_golem_statue": "Estatua de gólem de cobre expuesto",
  "weathered_copper_golem_statue": "Estatua de gólem de cobre erosionado",
  "oxidized_copper_golem_statue": "Estatua de gólem de cobre oxidado",
  "waxed_copper_golem_statue": "Estatua de gólem de cobre encerado",
  "waxed_exposed_copper_golem_statue": "Estatua de gólem de cobre expuesto encerado",
  "waxed_weathered_copper_golem_statue": "Estatua de gólem de cobre erosionado encerado",
  "waxed_oxidized_copper_golem_statue": "Estatua de gólem de cobre oxidado encerado",
  "copper_chain": "Cadena de cobre",
  "exposed_copper_chain": "Cadena de cobre expuesto",
  "weathered_copper_chain": "Cadena de cobre erosionado",
  "oxidized_copper_chain": "Cadena de cobre oxidado",
  "waxed_copper_chain": "Cadena de cobre encerado",
  "waxed_exposed_copper_chain": "Cadena de cobre expuesto encerado",
  "waxed_weathered_copper_chain": "Cadena de cobre erosionado encerado",
  "waxed_oxidized_copper_chain": "Cadena de cobre oxidado encerado",
  "copper_bars": "Barrotes de cobre",
  "exposed_copper_bars": "Barrotes de cobre expuesto",
  "weathered_copper_bars": "Barrotes de cobre erosionado",
  "oxidized_copper_bars": "Barrotes de cobre oxidado",
  "waxed_copper_bars": "Barrotes de cobre encerado",
  "waxed_exposed_copper_bars": "Barrotes de cobre expuesto encerado",
  "waxed_weathered_copper_bars": "Barrotes de cobre erosionado encerado",
  "waxed_oxidized_copper_bars": "Barrotes de cobre oxidado encerado",
  "copper_lantern": "Farol de cobre",
  "exposed_copper_lantern": "Farol de cobre expuesto",
  "weathered_copper_lantern": "Farol de cobre erosionado",
  "oxidized_copper_lantern": "Farol de cobre oxidado",
  "waxed_copper_lantern": "Farol de cobre encerado",
  "waxed_exposed_copper_lantern": "Farol de cobre expuesto encerado",
  "waxed_weathered_copper_lantern": "Farol de cobre erosionado encerado",
  "waxed_oxidized_copper_lantern": "Farol de cobre oxidado encerado",
  "copper_torch": "Antorcha de cobre",
  "iron_chain": "Cadena de hierro",
  "golden_dandelion": "Diente de león dorado",
  "sulfur": "Azufre",
  "sulfur_slab": "Losa de azufre",
  "sulfur_double_slab": "Losa doble de azufre",
  "sulfur_stairs": "Escaleras de azufre",
  "sulfur_wall": "Pared de azufre",
  "polished_sulfur": "Azufre pulido",
  "polished_sulfur_slab": "Losa de azufre pulido",
  "polished_sulfur_double_slab": "Losa doble de azufre pulido",
  "polished_sulfur_stairs": "Escaleras de azufre pulido",
  "polished_sulfur_wall": "Pared de azufre pulido",
  "sulfur_bricks": "Ladrillos de azufre",
  "sulfur_brick_slab": "Losa de ladrillos de azufre",
  "sulfur_brick_double_slab": "Losa doble de ladrillos de azufre",
  "sulfur_brick_stairs": "Escaleras de ladrillos de azufre",
  "sulfur_brick_wall": "Muro de ladrillos de azufre",
  "chiseled_sulfur": "Azufre grabado",
  "potent_sulfur": "Azufre potente",
  "cinnabar": "Cinabrio",
  "cinnabar_slab": "Losa de cinabrio",
  "cinnabar_double_slab": "Losa doble de cinabrio",
  "cinnabar_stairs": "Escaleras de cinabrio",
  "cinnabar_wall": "Pared de cinabrio",
  "polished_cinnabar": "Cinabrio pulido",
  "polished_cinnabar_slab": "Losa de cinabrio pulido",
  "polished_cinnabar_double_slab": "Losa doble de cinabrio pulido",
  "polished_cinnabar_stairs": "Escaleras de cinabrio pulido",
  "polished_cinnabar_wall": "Pared de cinabrio pulido",
  "cinnabar_bricks": "Ladrillos de cinabrio",
  "cinnabar_brick_slab": "Losa de ladrillos de cinabrio",
  "cinnabar_brick_double_slab": "Losa doble de ladrillos de cinabrio",
  "cinnabar_brick_stairs": "Escaleras de ladrillos de cinabrio",
  "cinnabar_brick_wall": "Pared de ladrillos de cinabrio",
  "chiseled_cinnabar": "Cinabrio grabado",
  "sulfur_spike": "Púa de azufre",
  "wooden_spear": "Lanza de madera",
  "stone_spear": "Lanza de piedra",
  "copper_spear": "Lanza de cobre",
  "iron_spear": "Lanza de hierro",
  "golden_spear": "Lanza de oro",
  "diamond_spear": "Lanza de diamante",
  "netherite_spear": "Lanza de netherita",
  "copper_nautilus_armor": "Armadura de nautilo de cobre",
  "iron_nautilus_armor": "Armadura de nautilo de hierro",
  "golden_nautilus_armor": "Armadura de nautilo de oro",
  "diamond_nautilus_armor": "Armadura de nautilo de diamante",
  "netherite_nautilus_armor": "Armadura de nautilo de netherita"
});

console.warn("Auction House Addon iniciado.");
system.runTimeout(() => { try { const entries = [].map((id) => { const value = globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", id); return { id, size: typeof value === "string" ? value.length : value === undefined ? 0 : String(value).length }; }).sort((a, b) => b.size - a.size); console.warn(`[DP_AUDIT_AUCTION_V1] total_chars=${entries.reduce((sum, entry) => sum + entry.size, 0)} largest=${JSON.stringify(entries.slice(0, 12))}`); } catch (e) { console.warn(`[DP_AUDIT_AUCTION_V1] failed=${String(e?.message || e)}`); } }, 100);
const COMMAND_NAMESPACE = "s";
const LISTING_FEE_RATE = 0.02;
const SALE_FEE_RATE = 0.05;
const MAX_MONEY = 2147483647;
const MAX_OPERATIONAL_BALANCE = 100000000;
// El mercado no impone un tope artificial inferior al límite real de la
// economía. Las validaciones de saldo siguen evitando sobreflujos.
const MAX_AUCTION_PRICE = MAX_OPERATIONAL_BALANCE;
const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000;
const auctionLocks = new Set();
const auctionPlayerLocks = new Set();
let subastasDataAvailable = true;
const AUCTION_ID_SEQUENCE_KEY = "auction_id_sequence_v1";
const AUCTION_PENDING_PROCEEDS_KEY = "auction_pending_proceeds_v1";

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Auxiliar robusto para abrir formularios evitando conflictos de pantallas
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) {
        system.run(() => {
          onCancel(response);
        });
      }
      return;
    }
    system.run(() => {
      onSelect(response);
    });
  }).catch((err) => {
    console.warn(`[Subastas] Error en safeOpenForm: ${err}`);
  });
}

// Cargar y guardar base de datos
function loadSubastas() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "subastas_db");
    if (!raw) {
      subastasDataAvailable = true;
      return [];
    }
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) throw new Error("subastas_db no contiene una lista");
    subastasDataAvailable = true;
    return parsed;
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    subastasDataAvailable = false;
    console.warn("Error al cargar subastas: " + e);
    return [];
  }
}

function saveSubastas(data) {
  if (!subastasDataAvailable || !Array.isArray(data)) {
    console.warn("[Subastas] Escritura rechazada: la base de datos no está disponible o no es una lista válida.");
    return false;
  }
  try {
    const serialized = JSON.stringify(data);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "subastas_db", serialized);
    return String(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "subastas_db") || "") === serialized;
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al guardar subastas: " + e);
    return false;
  }
}

function allocateAuctionId() {
  try {
    const previous = Number(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", AUCTION_ID_SEQUENCE_KEY) ?? 0);
    if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) return "";
    const next = previous + 1;
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", AUCTION_ID_SEQUENCE_KEY, next);
    if (globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", AUCTION_ID_SEQUENCE_KEY) !== next) return "";
    return `${Date.now()}_${next}`;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "allocateAuctionId", category: "persistence" });
    return "";
  }
}

function depositAuctionTaxToBank(amount, type = "Comisión Subastas", actor = "Subastas", details = "Comisión de mercado") {
  if (!amount || amount <= 0) return;
  try {
    const centralVault = Math.floor(amount * 0.40);
    const construction = Math.floor(amount * 0.25);
    const events = Math.floor(amount * 0.15);
    const reserve = Math.floor(amount * 0.10);
    const social = amount - (centralVault + construction + events + reserve);

    const currentVault = Number(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "bank_vault_funds") ?? 0);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "bank_vault_funds", currentVault + centralVault);

    const currentConst = Number(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "bank_fund_construction") ?? 0);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "bank_fund_construction", currentConst + construction);

    const currentEv = Number(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "bank_fund_events") ?? 0);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "bank_fund_events", currentEv + events);

    const currentRes = Number(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "bank_fund_reserve") ?? 0);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "bank_fund_reserve", currentRes + reserve);

    const currentSoc = Number(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "bank_fund_social") ?? 0);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "bank_fund_social", currentSoc + social);

    try {
      const rawLedger = globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", "bank_public_ledger_v1");
      let ledger = [];
      if (rawLedger) ledger = JSON.parse(rawLedger);
      ledger.unshift({
        type,
        amount,
        actor,
        details,
        timestamp: Date.now()
      });
      if (ledger.length > 50) ledger = ledger.slice(0, 50);
      globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", "bank_public_ledger_v1", JSON.stringify(ledger));
    } catch (e) {}
  } catch (e) {
    console.warn("[Subastas] Error depositando comisión bancaria: " + e);
  }
}

// Economía Scoreboard
function getScoreboardObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function getScoreboardParticipant(playerOrName) {
  if (!playerOrName) return undefined;

  if (typeof playerOrName === "object") {
    try {
      if (playerOrName.scoreboardIdentity) return playerOrName.scoreboardIdentity;
    } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    try {
      if (playerOrName.isValid?.()) return playerOrName;
    } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }

  const lookupName = String(
    typeof playerOrName === "string" ? playerOrName : playerOrName?.name || ""
  ).trim().toLowerCase();
  if (!lookupName) return undefined;

  const onlinePlayer = world.getAllPlayers().find((player) => player.name.toLowerCase() === lookupName);
  if (onlinePlayer) {
    try {
      if (onlinePlayer.scoreboardIdentity) return onlinePlayer.scoreboardIdentity;
    } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    return onlinePlayer;
  }

  try {
    const objective = getScoreboardObjective();
    const participants = objective?.getParticipants?.() ?? [];
    return participants.find((participant) => {
      const displayName = String(participant.displayName || "").trim().toLowerCase();
      return displayName === lookupName;
    });
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  return undefined;
}

function getBalance(player) {
  const obj = getScoreboardObjective();
  if (!obj) return 0;
  try {
    const participant = getScoreboardParticipant(player);
    if (!participant) return 0;
    return obj.getScore(participant) ?? 0;
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return 0;
  }
}

function setBalance(playerOrName, amount) {
  const obj = getScoreboardObjective();
  if (!obj) return false;
  const participant = getScoreboardParticipant(playerOrName);
  if (!participant) {
    console.warn(`Error al modificar saldo para ${playerOrName}: identidad no resuelta.`);
    return false;
  }
  try {
    const normalizedAmount = Number(amount);
    if (!Number.isSafeInteger(normalizedAmount) || normalizedAmount < 0 || normalizedAmount > MAX_MONEY) {
      console.warn(`[ECONOMY_TX] REJECT invalid_balance player=${typeof playerOrName === "string" ? playerOrName : playerOrName?.name || "unknown"} amount=${amount} reason=auction_balance_write`);
      return false;
    }
    obj.setScore(participant, normalizedAmount);
    return (obj.getScore(participant) ?? -1) === normalizedAmount;
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`Error al modificar saldo para ${playerOrName}: ${e}`);
    return false;
  }
}

function addBalance(playerOrName, amount) {
  const current = getBalance(playerOrName);
  const delta = Math.floor(Number(amount) || 0);
  if (delta < 0 && current < -delta) return false;
  if (delta > 0 && current > MAX_MONEY - delta) return false;
  return setBalance(playerOrName, current + delta);
}

function normalizedAuctionAccountName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function loadPendingAuctionProceeds() {
  try {
    const raw = String(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", AUCTION_PENDING_PROCEEDS_KEY) || "");
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result = {};
    for (const [key, entry] of Object.entries(parsed)) {
      const name = String(entry?.name || "").trim();
      const amount = Number(entry?.amount);
      if (normalizedAuctionAccountName(key) && name && Number.isSafeInteger(amount) && amount > 0) {
        result[normalizedAuctionAccountName(key)] = { name, amount };
      }
    }
    return result;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "loadPendingAuctionProceeds", category: "runtime" });
    return {};
  }
}

function savePendingAuctionProceeds(proceeds) {
  try {
    const serialized = JSON.stringify(proceeds);
    globalThis.__sqlite_set_prop_v2__("auction_house_addon", "world", AUCTION_PENDING_PROCEEDS_KEY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("auction_house_addon", "world", AUCTION_PENDING_PROCEEDS_KEY) || "") === serialized;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "savePendingAuctionProceeds", category: "runtime" });
    return false;
  }
}

function queueAuctionProceeds(sellerName, amount) {
  const key = normalizedAuctionAccountName(sellerName);
  const delta = Math.floor(Number(amount) || 0);
  if (!key || delta <= 0 || !Number.isSafeInteger(delta)) return false;
  const proceeds = loadPendingAuctionProceeds();
  const current = Number(proceeds[key]?.amount || 0);
  if (!Number.isSafeInteger(current) || current > MAX_MONEY - delta) return false;
  proceeds[key] = { name: String(sellerName).trim(), amount: current + delta };
  return savePendingAuctionProceeds(proceeds);
}

function rollbackQueuedAuctionProceeds(sellerName, amount) {
  const key = normalizedAuctionAccountName(sellerName);
  const delta = Math.floor(Number(amount) || 0);
  if (!key || delta <= 0) return false;
  const proceeds = loadPendingAuctionProceeds();
  const current = Number(proceeds[key]?.amount || 0);
  if (!Number.isSafeInteger(current) || current < delta) return false;
  if (current === delta) delete proceeds[key];
  else proceeds[key].amount = current - delta;
  return savePendingAuctionProceeds(proceeds);
}

function creditAuctionSeller(sellerName, sellerPlayer, amount) {
  const proceeds = Math.floor(Number(amount) || 0);
  if (proceeds <= 0 || !Number.isSafeInteger(proceeds)) return { ok: false };
  if (!sellerPlayer) {
    return queueAuctionProceeds(sellerName, proceeds)
      ? { ok: true, mode: "pending", sellerName, amount: proceeds }
      : { ok: false };
  }
  const previousBalance = getBalance(sellerPlayer);
  if (previousBalance > MAX_MONEY - proceeds || previousBalance + proceeds > MAX_OPERATIONAL_BALANCE) return { ok: false };
  return setBalance(sellerPlayer, previousBalance + proceeds)
    ? { ok: true, mode: "scoreboard", sellerPlayer, previousBalance, amount: proceeds }
    : { ok: false };
}

function rollbackAuctionSellerCredit(payment) {
  if (!payment?.ok) return false;
  if (payment.mode === "pending") return rollbackQueuedAuctionProceeds(payment.sellerName, payment.amount);
  if (payment.mode === "scoreboard") return setBalance(payment.sellerPlayer, payment.previousBalance);
  return false;
}

function deliverPendingAuctionProceeds(player) {
  const key = normalizedAuctionAccountName(player?.name);
  if (!key) return;
  const proceeds = loadPendingAuctionProceeds();
  const entry = proceeds[key];
  if (!entry) return;
  const current = getBalance(player);
  if (current > MAX_MONEY - entry.amount || current + entry.amount > MAX_OPERATIONAL_BALANCE) {
    player.sendMessage("§b§l[§3Subastas§b§l]§r §eTienes ganancias pendientes de subastas; libera saldo para recibirlas.");
    return;
  }
  if (!setBalance(player, current + entry.amount)) return;
  delete proceeds[key];
  if (!savePendingAuctionProceeds(proceeds)) {
    setBalance(player, current);
    return;
  }
  player.sendMessage(`§b§l[§3Subastas§b§l]§r §aRecibiste §6$${entry.amount} §ade ganancias pendientes de subastas.`);
}

function getItemLore(item) {
  try {
    return typeof item?.getLore === "function" ? item.getLore() ?? [] : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function getEnchantCount(item) {
  try {
    const enchantable = item?.getComponent?.("minecraft:enchantable");
    const enchantments = enchantable?.getEnchantments?.() ?? [];
    return enchantments.length;
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return 0;
  }
}

// Las pociones comparten typeId aunque tengan efectos distintos. Guardamos la
// variante oficial del componente y la reconstruimos con Potions.resolve al
// entregar la compra, para no transformar una poción en otra.
function getPotionDescriptor(item) {
  try {
    const potion = item?.getComponent?.("minecraft:potion");
    const effectId = potion?.potionEffectType?.id;
    const deliveryId = potion?.potionDeliveryType?.id;
    if (!effectId || !deliveryId) return undefined;
    return { effectId: String(effectId), deliveryId: String(deliveryId) };
  } catch (error) {
    ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "getPotionDescriptor", category: "runtime" });
    return undefined;
  }
}

// BDS representa las flechas con punta legacy como minecraft:arrow + data y
// no expone esa data a Script API. Potions tampoco registra una entrega Arrow,
// así que la única reconstrucción fiel es el comando nativo /give con data.
// Se consulta exclusivamente la mano principal para asociar el dato al objeto
// que se está publicando, no a otra pila del inventario.
const LEGACY_ARROW_DATA_MAX = 63;
const LEGACY_ARROW_DISPLAY_NAMES = Object.freeze({
  0: "Flecha",
  1: "Flecha mundana",
  2: "Flecha mundana",
  3: "Flecha mundana prolongada",
  4: "Flecha espesa",
  5: "Flecha rara",
  6: "Flecha de visión nocturna",
  7: "Flecha de visión nocturna prolongada",
  8: "Flecha de invisibilidad",
  9: "Flecha de invisibilidad prolongada",
  10: "Flecha de salto",
  11: "Flecha de salto prolongada",
  12: "Flecha de salto II",
  13: "Flecha de resistencia al fuego",
  14: "Flecha de resistencia al fuego prolongada",
  15: "Flecha de rapidez",
  16: "Flecha de rapidez prolongada",
  17: "Flecha de rapidez II",
  18: "Flecha de lentitud",
  19: "Flecha de lentitud prolongada",
  20: "Flecha de respiración acuática",
  21: "Flecha de respiración acuática prolongada",
  22: "Flecha de curación",
  23: "Flecha de curación II",
  24: "Flecha de daño instantáneo",
  25: "Flecha de daño instantáneo II",
  26: "Flecha de veneno",
  27: "Flecha de veneno prolongado",
  28: "Flecha de veneno II",
  29: "Flecha de regeneración",
  30: "Flecha de regeneración prolongada",
  31: "Flecha de regeneración II",
  32: "Flecha de fuerza",
  33: "Flecha de fuerza prolongada",
  34: "Flecha de fuerza II",
  35: "Flecha de debilidad",
  36: "Flecha de debilidad prolongada",
  37: "Flecha de descomposición",
  38: "Flecha de maestro tortuga",
  39: "Flecha de maestro tortuga prolongada",
  40: "Flecha de maestro tortuga II",
  41: "Flecha de caída lenta",
  42: "Flecha de caída lenta prolongada",
  43: "Flecha de lentitud II",
  44: "Flecha de carga de viento",
  45: "Flecha de tejido",
  46: "Flecha de rezumar",
  47: "Flecha de infestación"
});

function getLegacyArrowDescriptor(player, item) {
  if (String(item?.typeId || "").toLowerCase() !== "minecraft:arrow") return undefined;
  for (let data = 0; data <= LEGACY_ARROW_DATA_MAX; data++) {
    try {
      const probe = player.runCommand(`testfor @s[hasitem={item=arrow,location=slot.weapon.mainhand,data=${data},quantity=1..}]`);
      if (Number(probe?.successCount || 0) >= 1) return { data };
    } catch (error) {
      ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "getLegacyArrowDescriptor", category: "runtime" });
      return undefined;
    }
  }
  return undefined;
}

function hasLegacyArrowData(value) {
  return Number.isInteger(value) && value >= 0 && value <= LEGACY_ARROW_DATA_MAX;
}

function isPotionVariant(typeId) {
  return new Set([
    "minecraft:potion",
    "minecraft:splash_potion",
    "minecraft:lingering_potion",
    "minecraft:tipped_arrow"
  ]).has(String(typeId || "").toLowerCase());
}

function hasPotionDescriptor(potion) {
  return Boolean(potion?.effectId && potion?.deliveryId);
}

function createAuctionItem(typeId, amount, potion) {
  if (isPotionVariant(typeId) && !hasPotionDescriptor(potion)) {
    throw new Error("La variante de poción no tiene un efecto serializado.");
  }
  if (!potion) return new ItemStack(typeId, amount);
  const item = Potions.resolve(potion.effectId, potion.deliveryId);
  if (!item || item.typeId !== typeId) {
    throw new Error("La variante de poción no coincide con la publicación.");
  }
  item.amount = amount;
  return item;
}

function isBlockedAuctionItem(item) {
  const typeId = String(item?.typeId || "").toLowerCase();
  if (!typeId) return true;
  // No hay lista arbitraria de objetos prohibidos: cualquier objeto que pueda
  // serializarse y reconstruirse fielmente se puede vender.
  const blockedExact = new Set([
    "minecraft:command_block",
    "minecraft:barrier",
    "minecraft:bedrock",
    "minecraft:structure_block"
  ]);

  return blockedExact.has(typeId);
}

function hasUnsupportedAuctionMetadata(item) {
  try {
    if (!item?.typeId) return true;
    if (item.keepOnDeath === true || String(item.lockMode || "none") !== "none") return true;
    const durability = item.getComponent?.("minecraft:durability");
    if (durability && Number(durability.damage || 0) !== 0) return true;
    const container = item.getComponent?.("minecraft:inventory")?.container;
    if (container) return true;
    if ((item.getCanDestroy?.() ?? []).length > 0 || (item.getCanPlaceOn?.() ?? []).length > 0) return true;
    return false;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "metadata_validation", category: "runtime" });
    return true;
  }
}

function getPlainItemFingerprint(item) {
  if (!item || hasUnsupportedAuctionMetadata(item)) return "";
  return JSON.stringify({
    typeId: item.typeId,
    amount: Number(item.amount || 0),
    potion: getPotionDescriptor(item) || null
  });
}

function isPurchasableListing(listing) {
  if (!Number.isInteger(listing?.price) || listing.price <= 0 || listing.price > MAX_AUCTION_PRICE) return false;
  if (!listing || (listing.status && listing.status !== "active")) return false;
  // Las publicaciones antiguas de flechas con punta que no conservaron el
  // componente de poción no se venden como flechas normales. No podemos
  // inventar un efecto que ya no está en la base de datos.
  if (isPotionVariant(listing.typeId) && !hasPotionDescriptor(listing.potion)) return false;
  if (isListingExpired(listing)) return false;
  if (listing.status === "active") return true;
  // Los anuncios anteriores no almacenaban daño. Se ponen en cuarentena si
  // reconstruirlos podría reparar o transformar silenciosamente el objeto.
  try {
    const template = createAuctionItem(listing.typeId, 1, listing.potion);
    if (isBlockedAuctionItem(template)) return false;
    if (template.getComponent?.("minecraft:durability")) return false;
    if (template.getComponent?.("minecraft:inventory")?.container) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function getListingExpiresAt(listing, fallbackNow = Date.now()) {
  const explicitExpiry = Number(listing?.expiresAt);
  if (Number.isSafeInteger(explicitExpiry) && explicitExpiry > 0) return explicitExpiry;
  const createdAt = Number(listing?.createdAt);
  return Number.isSafeInteger(createdAt) && createdAt > 0
    ? createdAt + AUCTION_DURATION_MS
    : fallbackNow + AUCTION_DURATION_MS;
}

function isListingExpired(listing, now = Date.now()) {
  return now >= getListingExpiresAt(listing, now);
}

// Migra las publicaciones existentes y retira del mercado las vencidas. Los
// objetos no se eliminan: quedan en estado "expired" hasta que el vendedor
// los reclame con /s:reclamarsubastas.
function expireAuctionListings(db, now = Date.now()) {
  let changed = false;
  for (const listing of db) {
    if (!listing || typeof listing !== "object") continue;
    const expiresAt = getListingExpiresAt(listing, now);
    if (listing.expiresAt !== expiresAt) {
      listing.expiresAt = expiresAt;
      changed = true;
    }
    if (listing.status === "active" && now >= expiresAt) {
      listing.status = "expired";
      listing.expiredAt = now;
      changed = true;
    }
  }
  return changed;
}

function canFullyReceiveItem(player, typeId, amount, nameTag = "", lore = [], potion, legacyArrowData) {
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    // /give entrega las flechas legacy como pilas de hasta 64. Exigimos huecos
    // vacíos suficientes: es conservador, pero garantiza que nunca caigan al
    // suelo ni se pierda una compra por falta de espacio.
    if (hasLegacyArrowData(legacyArrowData)) {
      let emptyCapacity = 0;
      for (let i = 0; i < inventory.size; i++) {
        if (!inventory.getItem(i)) emptyCapacity += 64;
      }
      return emptyCapacity >= amount;
    }

    const template = createAuctionItem(typeId, 1, potion);
    if (nameTag) template.nameTag = nameTag;
    if (lore?.length) template.setLore(lore);
    const maxStack = Math.max(1, template.maxAmount || 64);

    let capacity = 0;
    for (let i = 0; i < inventory.size; i++) {
      const slotItem = inventory.getItem(i);
      if (!slotItem) {
        capacity += maxStack;
        continue;
      }
      if (slotItem.typeId !== template.typeId) continue;
      if (typeof slotItem.isStackableWith === "function" && !slotItem.isStackableWith(template)) continue;
      capacity += Math.max(0, maxStack - (slotItem.amount || 0));
    }

    return capacity >= amount;
  } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return false;
  }
}

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") return;
  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    const register = typeof registry?.registerCommand === "function"
      ? registry.registerCommand.bind(registry)
      : typeof registry?.register === "function"
        ? registry.register.bind(registry)
        : undefined;
    if (!register) return;
    try {
      for (const name of ["subastas", "ah"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre subastas", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openSubastasMenu(sender));
          return commandOk("Abriendo subastas.");
        });
      }
      register({
        name: `${COMMAND_NAMESPACE}:vender`,
        description: "Publica el item en mano en subasta",
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [{ name: "precio", type: CustomCommandParamType.Integer }],
      }, (origin, precio) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => handleVenderCommand(sender, String(precio)));
        return commandOk("Procesando venta.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Subastas] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();
try { globalThis.openSubastasMenu = openSubastasMenu; } catch (e) {}

try {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    system.run(() => deliverPendingAuctionProceeds(event.player));
  });
} catch (error) {
  ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "deliverPendingAuctionProceedsOnSpawn", category: "runtime" });
}

if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    const id = event.id.toLowerCase();
    if (id === "subastas:open" || id === "cmd:subastas" || id === "cmd:ah") {
      const player = event.sourceEntity;
      if (player) {
        system.run(() => openSubastasMenu(player));
      }
    }
  });
}

// Dar item de forma segura (respetando maxStackSize)
function giveItemSafely(player, typeId, amount, nameTag, lore, enchants, potion, legacyArrowData) {
  try {
    if (hasLegacyArrowData(legacyArrowData)) {
      let remaining = amount;
      while (remaining > 0) {
        const currentBatch = Math.min(remaining, 64);
        const result = player.runCommand(`give @s minecraft:arrow ${currentBatch} ${legacyArrowData}`);
        if (Number(result?.successCount || 0) < 1) return false;
        remaining -= currentBatch;
      }
      return true;
    }
    const tempItem = createAuctionItem(typeId, 1, potion);
    const maxStack = tempItem.maxAmount || 64;
    let remaining = amount;

    while (remaining > 0) {
      const currentBatch = Math.min(remaining, maxStack);
      const itemStack = createAuctionItem(typeId, currentBatch, potion);
      if (nameTag) itemStack.nameTag = nameTag;
      if (lore) itemStack.setLore(lore);
      if (enchants && enchants.length > 0) {
        const enchantable = itemStack.getComponent("minecraft:enchantable");
        if (enchantable) {
          for (const e of enchants) {
             try {
                let type = EnchantmentTypes.get(e.type);
                if (!type) type = EnchantmentTypes.get(String(e.type).replace("minecraft:", ""));
                if (!type && !String(e.type).startsWith("minecraft:")) type = EnchantmentTypes.get(`minecraft:${e.type}`);
                if (type) enchantable.addEnchantment({ type: type, level: e.level });
             } catch (err) { ErrorReporter.report(err, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
          }
        }
      }

      const leftover = player.getComponent("minecraft:inventory").container.addItem(itemStack);
      if (leftover) {
        return false;
      }
      remaining -= currentBatch;
    }
    return true;
  } catch (err) { ErrorReporter.report(err, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`Error en giveItemSafely: ${err}`);
    return false;
  }
}

// Publicar objeto en subasta
function handleVenderCommand(player, precioStr) {
  if (!precioStr) {
    player.sendMessage("§b§l[§3Subastas§b§l]§r §cUso: /s:vender <precio>");
    return;
  }

  const price = parseInt(precioStr);
  if (isNaN(price) || price <= 0 || price > MAX_AUCTION_PRICE) {
    player.sendMessage(`§b§l[§3Subastas§b§l]§r §cEl precio debe ser un entero entre $1 y $${MAX_AUCTION_PRICE}.`);
    return;
  }

  try {
    const inventory = player.getComponent("minecraft:inventory").container;
    const selectedSlot = player.selectedSlotIndex;
    const item = inventory.getItem(selectedSlot);

    if (!item || !item.typeId) {
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cDebes sostener un objeto en tu mano principal para venderlo.");
      return;
    }

    if (isBlockedAuctionItem(item)) {
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cEse objeto no se puede publicar en subastas por seguridad.");
      return;
    }

    if (hasUnsupportedAuctionMetadata(item)) {
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cEse objeto tiene encantamientos, nombre o metadata especial. Aún no es seguro venderlo por subastas.");
      return;
    }

    const playerKey = player.name.toLowerCase();
    if (auctionPlayerLocks.has(playerKey)) {
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cYa tienes una operación de subasta en curso.");
      return;
    }
    auctionPlayerLocks.add(playerKey);

    const typeId = item.typeId;
    const amount = item.amount;
    const nameTag = item.nameTag || "";
    const lore = item.getLore() || [];
    const potion = getPotionDescriptor(item);
    const legacyArrow = getLegacyArrowDescriptor(player, item);
    const legacyArrowData = legacyArrow?.data;

    if (isPotionVariant(typeId) && !hasPotionDescriptor(potion)) {
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo leer el efecto de esta flecha/poción. No se publicó ni se retiró el objeto.");
      return;
    }
    if (typeId === "minecraft:arrow" && !hasLegacyArrowData(legacyArrowData)) {
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo leer el dato de esta flecha. No se publicó ni se retiró el objeto.");
      return;
    }
    
    let enchants = [];
    try {
      const enchantable = item.getComponent("minecraft:enchantable");
      if (enchantable) {
         for (const e of enchantable.getEnchantments()) {
            enchants.push({ type: e.type.id, level: e.level });
         }
      }
    } catch (err) { ErrorReporter.report(err, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

    const itemFingerprint = getPlainItemFingerprint(item);
    const listingFee = Math.max(1, Math.ceil(price * LISTING_FEE_RATE));
    const originalBalance = getBalance(player);
    if (originalBalance < listingFee) {
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage(`§b§l[§3Subastas§b§l]§r §cNecesitas §a$${listingFee} §cpara pagar la comisión de publicación del 2%.`);
      return;
    }

    const db = loadSubastas();
    const listingId = allocateAuctionId();
    if (!listingId || db.some((entry) => entry.id === listingId)) {
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo reservar un identificador único. No se cobró ni retiró el objeto.");
      return;
    }
    const newListing = {
      id: listingId,
      seller: player.name,
      typeId: typeId,
      amount: amount,
      price: price,
      nameTag: nameTag,
      lore: lore,
      enchants: enchants,
      potion,
      legacyArrowData,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + AUCTION_DURATION_MS,
      listingFee
    };

    db.push(newListing);
    if (!saveSubastas(db) || !setBalance(player, originalBalance - listingFee)) {
      const rollbackDb = loadSubastas().filter((entry) => entry.id !== newListing.id);
      saveSubastas(rollbackDb);
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo registrar ni cobrar la publicación.");
      return;
    }

    depositAuctionTaxToBank(listingFee, "Comisión Publicación Subasta", player.name, `Comisión del 2% por publicar subasta ($${price})`);

    const currentItem = inventory.getItem(selectedSlot);
    if (!currentItem || getPlainItemFingerprint(currentItem) !== itemFingerprint) {
      setBalance(player, originalBalance);
      saveSubastas(loadSubastas().filter((entry) => entry.id !== newListing.id));
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cEl objeto cambió durante la publicación. No se realizó ningún cobro.");
      return;
    }

    inventory.setItem(selectedSlot, undefined);
    newListing.status = "active";
    const activeDb = loadSubastas();
    const pendingIdx = activeDb.findIndex((entry) => entry.id === newListing.id && entry.status === "pending");
    if (pendingIdx === -1) {
      inventory.setItem(selectedSlot, currentItem);
      setBalance(player, originalBalance);
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cLa publicación perdió su estado. El objeto y la comisión fueron devueltos.");
      return;
    }
    activeDb[pendingIdx] = newListing;
    if (!saveSubastas(activeDb)) {
      inventory.setItem(selectedSlot, currentItem);
      setBalance(player, originalBalance);
      saveSubastas(activeDb.filter((entry) => entry.id !== newListing.id));
      auctionPlayerLocks.delete(playerKey);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo activar la publicación. El objeto y la comisión fueron devueltos.");
      return;
    }
    auctionPlayerLocks.delete(playerKey);

    const displayName = getAuctionItemDisplayName(newListing);
    player.sendMessage(`§b§l[§3Subastas§b§l]§r §aHas publicado §e${amount}x ${displayName} §apor §6$${price}§a. Comisión cobrada: §6$${listingFee}§a.`);
    world.sendMessage(`§b§l[§3Subastas§b§l]§r §e${player.name} §aha publicado §b${amount}x ${displayName} §apor §a$${price}§r. Usa §e/s:subastas §rpara comprar.`);
  } catch (err) { ErrorReporter.report(err, { addonId: "auction_house_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    auctionPlayerLocks.delete(player.name.toLowerCase());
    player.sendMessage("§b§l[§3Subastas§b§l]§r §cOcurrió un error al intentar vender el objeto.");
    console.warn(`[Subastas] Error vendiendo objeto: ${err}`);
  }
}

const ITEM_NAMES_ES = {
  "diamond_sword": "Espada de Diamante",
  "netherite_sword": "Espada de Netherita",
  "iron_sword": "Espada de Hierro",
  "golden_sword": "Espada de Oro",
  "stone_sword": "Espada de Piedra",
  "wooden_sword": "Espada de Madera",
  "diamond_pickaxe": "Pico de Diamante",
  "netherite_pickaxe": "Pico de Netherita",
  "iron_pickaxe": "Pico de Hierro",
  "golden_pickaxe": "Pico de Oro",
  "stone_pickaxe": "Pico de Piedra",
  "wooden_pickaxe": "Pico de Madera",
  "diamond_axe": "Hacha de Diamante",
  "netherite_axe": "Hacha de Netherita",
  "iron_axe": "Hacha de Hierro",
  "diamond_shovel": "Pala de Diamante",
  "netherite_shovel": "Pala de Netherita",
  "diamond_hoe": "Azada de Diamante",
  "netherite_hoe": "Azada de Netherita",
  "diamond_helmet": "Casco de Diamante",
  "netherite_helmet": "Casco de Netherita",
  "iron_helmet": "Casco de Hierro",
  "golden_helmet": "Casco de Oro",
  "chainmail_helmet": "Casco de Malla",
  "leather_helmet": "Gorro de Cuero",
  "diamond_chestplate": "Pechera de Diamante",
  "netherite_chestplate": "Pechera de Netherita",
  "iron_chestplate": "Pechera de Hierro",
  "golden_chestplate": "Pechera de Oro",
  "chainmail_chestplate": "Pechera de Malla",
  "leather_chestplate": "Túnica de Cuero",
  "diamond_leggings": "Pantalones de Diamante",
  "netherite_leggings": "Pantalones de Netherita",
  "iron_leggings": "Pantalones de Hierro",
  "golden_leggings": "Pantalones de Oro",
  "chainmail_leggings": "Pantalones de Malla",
  "leather_leggings": "Pantalones de Cuero",
  "diamond_boots": "Botas de Diamante",
  "netherite_boots": "Botas de Netherita",
  "iron_boots": "Botas de Hierro",
  "golden_boots": "Botas de Oro",
  "chainmail_boots": "Botas de Malla",
  "leather_boots": "Botas de Cuero",
  "elytra": "Élitros",
  "shield": "Escudo",
  "bow": "Arco",
  "crossbow": "Ballesta",
  "trident": "Tridente",
  "mace": "Maza",
  "diamond": "Diamante",
  "netherite_ingot": "Ingote de Netherita",
  "gold_ingot": "Ingote de Oro",
  "iron_ingot": "Ingote de Hierro",
  "copper_ingot": "Ingote de Cobre",
  "coal": "Carbón",
  "emerald": "Esmeralda",
  "lapis_lazuli": "Lapislázuli",
  "redstone": "Redstone",
  "quartz": "Cuarzo del Nether",
  "amethyst_shard": "Fragmento de Amatista",
  "golden_apple": "Manzana Dorada",
  "enchanted_golden_apple": "Manzana Dorada Encantada",
  "apple": "Manzana",
  "bread": "Pan",
  "cooked_beef": "Filete Cocinado",
  "cooked_porkchop": "Chuleta Cocinada",
  "cooked_chicken": "Pollo Cocinado",
  "golden_carrot": "Zanahoria Dorada",
  "totem_of_undying": "Tótem de la Inmortalidad",
  "experience_bottle": "Frasco con Experiencia",
  "ender_pearl": "Perla de Ender",
  "obsidian": "Obsidiana",
  "crying_obsidian": "Obsidiana Llorosa",
  "beacon": "Faro",
  "nether_star": "Estrella del Nether",
  "shulker_shell": "Caparazón de Shulker",
  "wind_charge": "Carga de Viento",
  "breeze_rod": "Vara de Breeze",
  "blaze_rod": "Vara de Blaze",
  "heavy_core": "Núcleo Pesado",
  "pearlescent_froglight": "Luz de Rana Perlada",
  "verdant_froglight": "Luz de Rana Verdeante",
  "ochre_froglight": "Luz de Rana Ocre"
};

const ENCHANT_NAMES_ES = {
  "sharpness": "Afilado",
  "smite": "Golpeo",
  "bane_of_arthropods": "Perdición de los Artrópodos",
  "knockback": "Empuje",
  "fire_aspect": "Aspecto Ígneo",
  "looting": "Saqueo",
  "efficiency": "Eficiencia",
  "silk_touch": "Toque de Seda",
  "unbreaking": "Irrompibilidad",
  "fortune": "Fortuna",
  "power": "Poder",
  "punch": "Impacto",
  "flame": "Llama",
  "infinity": "Infinidad",
  "luck_of_the_sea": "Suerte Marina",
  "lure": "Atracción",
  "loyalty": "Lealtad",
  "impaling": "Empalamiento",
  "riptide": "Propulsión Acuática",
  "channeling": "Conductividad",
  "multishot": "Multidisparo",
  "quick_charge": "Carga Rápida",
  "piercing": "Perforación",
  "mending": "Reparación",
  "protection": "Protección",
  "fire_protection": "Protección contra el Fuego",
  "feather_falling": "Caída de Pluma",
  "blast_protection": "Protección contra Explosiones",
  "projectile_protection": "Protección contra Proyectiles",
  "respiration": "Respiración",
  "aqua_affinity": "Afinidad Acuática",
  "thorns": "Espinas",
  "depth_strider": "Paso Ágil",
  "frost_walker": "Paso Helado",
  "soul_speed": "Velocidad del Alma",
  "swift_sneak": "Sigilo Rapido",
  "density": "Densidad",
  "breach": "Brecha",
  "wind_burst": "Ráfaga de Viento"
};

// Nombres oficiales/usuales en español de México para artículos que se venden
// mucho. Los demás pasan por el normalizador de abajo: nunca se muestra el ID.
const ITEM_NAME_ALIASES_ES_MX = {
  "pearlescent_froglight": "Ranaluz nacarada",
  "verdant_froglight": "Ranaluz verde",
  "ochre_froglight": "Foco de rana ocre",
  "experience_bottle": "Botella de hechizo",
  "ominous_bottle": "Botella siniestra",
  "cooked_beef": "Filete",
  "beef": "Bistec crudo",
  "netherite_ingot": "Lingote de netherita",
  "totem_of_undying": "Tótem de la inmortalidad",
  "elytra": "Elytra",
  "diamond_hoe": "Azadón de diamante",
  "netherite_hoe": "Azadón de netherita",
  "diamond_chestplate": "Coraza de diamante",
  "netherite_chestplate": "Coraza de netherita",
  "chainmail_chestplate": "Coraza de cota de malla",
  "golden_apple": "Manzana de oro",
  "enchanted_golden_apple": "Manzana dorada encantada",
  "ender_pearl": "Perla de Ender",
  "blaze_rod": "Vara de blaze",
  "breeze_rod": "Vara de vorágine"
};

const ITEM_TOKENS_ES_MX = {
  oak: "roble", spruce: "abeto", birch: "abedul", jungle: "jungla", acacia: "acacia", dark: "oscuro",
  mangrove: "mangle", cherry: "cerezo", pale: "pálido", crimson: "carmesí", warped: "distorsionado",
  bamboo: "bambú", diamond: "diamante", netherite: "netherita", iron: "hierro", gold: "oro", golden: "oro",
  copper: "cobre", stone: "piedra", cobblestone: "adoquín", deepslate: "pizarra profunda", redstone: "redstone",
  lapis: "lapislázuli", emerald: "esmeralda", coal: "carbón", quartz: "cuarzo", amethyst: "amatista",
  obsidian: "obsidiana", prismarine: "prismarina", sandstone: "arenisca", terracotta: "terracota",
  brick: "ladrillo", bricks: "ladrillos", mossy: "musgoso", polished: "pulido", smooth: "liso",
  white: "blanco", orange: "naranja", magenta: "magenta", light: "claro", blue: "azul", yellow: "amarillo",
  lime: "verde limón", pink: "rosa", gray: "gris", silver: "gris claro", cyan: "cian", purple: "morado",
  brown: "café", green: "verde", red: "rojo", black: "negro", raw: "en bruto", ancient: "ancestral",
  nether: "Nether", end: "End", soul: "alma", glow: "brillante", sea: "marino", turtle: "tortuga", wooden: "madera"
};

function capitalizeEsMx(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Objeto";
}

function formatItemIdEsMx(rawId) {
  const words = String(rawId || "item").split("_").filter(Boolean);
  const translated = words.map(word => ITEM_TOKENS_ES_MX[word] || word).join(" ");
  const materialWords = words.slice(0, -1).map(word => ITEM_TOKENS_ES_MX[word] || word);
  if (["oscuro", "pálido", "claro"].includes(materialWords[0]) && materialWords.length > 1) {
    materialWords.push(materialWords.shift());
  }
  const material = materialWords.join(" ");
  const suffix = words[words.length - 1];
  const labels = {
    log: "Tronco", wood: "Madera", planks: "Tablones", leaves: "Hojas", sapling: "Retoño",
    slab: "Losa", stairs: "Escaleras", fence: "Valla", gate: "Puerta de valla", door: "Puerta",
    trapdoor: "Trampilla", button: "Botón", sign: "Letrero", ore: "Mineral", block: "Bloque",
    ingot: "Lingote", nugget: "Pepita", sword: "Espada", pickaxe: "Pico", axe: "Hacha",
    shovel: "Pala", hoe: "Azadón", helmet: "Casco", chestplate: "Coraza", leggings: "Pantalones", boots: "Botas"
  };
  if (labels[suffix] && material) return `${labels[suffix]} de ${material}`;
  return capitalizeEsMx(translated);
}

function getAuctionItemDisplayName(list) {
  if (list.nameTag && String(list.nameTag).trim() !== "") {
    return list.nameTag;
  }

  const rawId = list.typeId ? list.typeId.split(":")[1] : "item";
  // Fuente principal: el paquete vanilla es_MX de la misma versión de BDS.
  // Las tablas antiguas quedan únicamente como compatibilidad para IDs legacy.
  let baseName = VANILLA_ITEM_NAMES_ES_MX[rawId] || ITEM_NAME_ALIASES_ES_MX[rawId] || ITEM_NAMES_ES_MX[rawId] || ITEM_NAMES_ES[rawId];

  if (!baseName) {
    baseName = formatItemIdEsMx(rawId);
  }

  if (list.typeId === "minecraft:enchanted_book") {
    baseName = "Libro Encantado";
  }

  if (list.typeId === "minecraft:arrow" && hasLegacyArrowData(list.legacyArrowData)) {
    baseName = LEGACY_ARROW_DISPLAY_NAMES[list.legacyArrowData]
      || `Flecha con efecto (variante ${list.legacyArrowData})`;
  }

  if (list.potion?.effectId && list.potion?.deliveryId) {
    const effect = String(list.potion.effectId).replace("minecraft:", "").replace(/_/g, " ");
    const delivery = String(list.potion.deliveryId).replace("minecraft:", "").replace(/_/g, " ");
    baseName = `Poción de ${effect} (${delivery})`;
  }

  if (list.enchants && list.enchants.length > 0) {
    const enchantNames = list.enchants.map(e => {
      const eRaw = String(e.type).replace("minecraft:", "");
      const eName = ENCHANT_NAMES_ES[eRaw] || eRaw.replace(/_/g, " ");
      return `${eName} ${e.level}`;
    }).join(", ");
    return `✨ ${baseName} (§b${enchantNames}§r)`;
  }

  return baseName;
}

// Abrir menú visual
function openSubastasMenu(player) {
  const db = loadSubastas();
  if (expireAuctionListings(db)) saveSubastas(db);
  const form = new ActionFormData()
    .title("§d§lMercado de Subastas")
    .body("§7Selecciona un objeto para comprarlo o ver sus detalles:\n§8Las publicaciones vencen tras 24 horas.");

  // Botón de ayuda/tutorial siempre disponible
  form.button("❔ ¿Cómo funciona? / Guía");
  form.button("⏳ Mis publicaciones vencidas");

  db.filter(isPurchasableListing).forEach((list) => {
    const displayName = getAuctionItemDisplayName(list);
    form.button(`📦 ${list.amount}x ${displayName}\nPrecio: $${list.price} | Vendedor: ${list.seller}`);
  });

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;

    if (idx === 0) {
      openAuctionTutorial(player);
      return;
    }
    if (idx === 1) {
      openExpiredAuctionsMenu(player);
      return;
    }

    const visibleListings = db.filter(isPurchasableListing);
    const listingIdx = idx - 2;
    if (listingIdx >= 0 && listingIdx < visibleListings.length) {
      openConfirmBuy(player, visibleListings[listingIdx]);
    }
  });
}

function openAuctionTutorial(player) {
  const form = new ActionFormData()
    .title("❔ Guía de Subastas")
    .body("§e¿Cómo funciona el Mercado de Subastas?\n\n" +
          "§a1. Vender un objeto:\n" +
          "§7- Sostén el objeto que quieres vender en tu mano principal.\n" +
          "§7- Usa §e/s:vender <precio> §7(ej: §e/s:vender 1500§7).\n" +
          "§7- Se cobra una comisión de publicación del 2%.\n" +
          "§7- Tu objeto desaparecerá de tu inventario y se listará aquí durante 24 horas.\n" +
          "§7- Si vence sin venderse, usa el botón §eMis publicaciones vencidas §7para recuperarlo.\n\n" +
          "§a2. Comprar un objeto:\n" +
          "§7- Selecciona cualquier objeto de la lista principal.\n" +
          "§7- Confirma la compra. El dinero se restará de tu saldo y el objeto se te entregará.\n\n" +
          "§a3. Cobrar tus ganancias:\n" +
          "§7- Cuando alguien compre tu objeto, recibirás el precio menos una comisión de venta del 5%, incluso si estabas desconectado.")
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openSubastasMenu(player);
  });
}

function openExpiredAuctionsMenu(player) {
  const db = loadSubastas();
  if (expireAuctionListings(db)) saveSubastas(db);
  const mine = db.filter((listing) => listing?.status === "expired" && String(listing.seller).toLowerCase() === player.name.toLowerCase());
  if (mine.length === 0) {
    player.sendMessage("§b§l[§3Subastas§b§l]§r §7No tienes publicaciones vencidas para reclamar.");
    return;
  }

  const form = new ActionFormData()
    .title("§6Subastas vencidas")
    .body("§7Selecciona un objeto para devolverlo a tu inventario:");
  for (const listing of mine) {
    form.button(`📦 Reclamar ${listing.amount}x ${getAuctionItemDisplayName(listing)}`);
  }
  form.button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    const index = response.selection;
    if (index === undefined) return;
    if (index >= mine.length) {
      openSubastasMenu(player);
      return;
    }
    claimExpiredAuction(player, mine[index].id);
  });
}

function claimExpiredAuction(player, listingId) {
  const listingLock = String(listingId);
  const playerLock = player.name.toLowerCase();
  if (auctionLocks.has(listingLock) || auctionPlayerLocks.has(playerLock)) {
    player.sendMessage("§b§l[§3Subastas§b§l]§r §cEsta operación ya se está procesando.");
    return;
  }
  auctionLocks.add(listingLock);
  auctionPlayerLocks.add(playerLock);
  try {
    const db = loadSubastas();
    if (expireAuctionListings(db)) saveSubastas(db);
    const index = db.findIndex((listing) => listing?.id === listingId && listing.status === "expired" && String(listing.seller).toLowerCase() === playerLock);
    if (index === -1) {
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cEsta publicación ya no está disponible para reclamar.");
      return;
    }
    const listing = db[index];
    if (!canFullyReceiveItem(player, listing.typeId, listing.amount, listing.nameTag, listing.lore, listing.potion, listing.legacyArrowData)) {
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNecesitas espacio suficiente para reclamar este objeto.");
      return;
    }
    listing.status = "claiming";
    if (!saveSubastas(db)) {
      listing.status = "expired";
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo reservar la devolución. Intenta de nuevo.");
      return;
    }
    if (!giveItemSafely(player, listing.typeId, listing.amount, listing.nameTag, listing.lore, listing.enchants, listing.potion, listing.legacyArrowData)) {
      listing.status = "expired";
      saveSubastas(db);
      player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo devolver el objeto. Intenta de nuevo.");
      return;
    }
    db.splice(index, 1);
    if (!saveSubastas(db)) {
      // El objeto ya fue entregado: se deja una marca no reclamable para impedir
      // una segunda entrega si falla la limpieza de la base.
      listing.status = "claimed";
      listing.claimedAt = Date.now();
      db.splice(index, 0, listing);
      saveSubastas(db);
      console.warn(`[Subastas] La publicación vencida ${listing.id} fue entregada, pero requiere limpieza administrativa.`);
    }
    player.sendMessage(`§b§l[§3Subastas§b§l]§r §aHas recuperado §e${listing.amount}x ${getAuctionItemDisplayName(listing)}§a.`);
  } catch (error) {
    ErrorReporter.report(error, { addonId: "auction_house_addon", moduleId: "main.js", operation: "claimExpiredAuction", category: "runtime" });
    player.sendMessage("§b§l[§3Subastas§b§l]§r §cOcurrió un error al reclamar la publicación.");
  } finally {
    auctionLocks.delete(listingLock);
    auctionPlayerLocks.delete(playerLock);
  }
}

// Confirmar compra
function openConfirmBuy(player, listing) {
  const bal = getBalance(player);
  const displayName = getAuctionItemDisplayName(listing);

  const form = new ActionFormData()
    .title("§6Confirmar Compra")
    .body(`¿Deseas comprar este objeto?\n\n§7Objeto: §e${listing.amount}x ${displayName}\n§7Precio: §a$${listing.price}\n§7Vendedor: §b${listing.seller}\n§7Tu saldo: §a$${bal}`)
    .button("🛒 Comprar ahora")
    .button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0) {
      const listingLock = String(listing.id);
      const playerLock = player.name.toLowerCase();
      if (auctionLocks.has(listingLock) || auctionPlayerLocks.has(playerLock)) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cEsta operación ya se está procesando.");
        return;
      }
      auctionLocks.add(listingLock);
      auctionPlayerLocks.add(playerLock);
      try {
      if (String(listing.seller).toLowerCase() === player.name.toLowerCase()) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo puedes comprar tu propia publicación.");
        return;
      }

      if (getBalance(player) < listing.price) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo tienes saldo suficiente para comprar este objeto.");
        return;
      }

      // Re-verificar que la subasta siga disponible
      const db = loadSubastas();
      const matchIdx = db.findIndex(l => l.id === listing.id && isPurchasableListing(l));

      if (matchIdx === -1) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cEste objeto ya no está disponible en la subasta.");
        return;
      }

      const activeListing = db[matchIdx];
      if (activeListing.typeId !== listing.typeId || activeListing.amount !== listing.amount || activeListing.price !== listing.price || activeListing.seller !== listing.seller) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cLa publicación cambió. Abre nuevamente el mercado.");
        return;
      }
      if (!canFullyReceiveItem(player, activeListing.typeId, activeListing.amount, activeListing.nameTag, activeListing.lore, activeListing.potion, activeListing.legacyArrowData)) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo tienes espacio suficiente en tu inventario para recibir esta compra.");
        return;
      }

      const buyerBalance = getBalance(player);
      const sellerPlayer = world.getAllPlayers().find((candidate) => normalizedAuctionAccountName(candidate.name) === normalizedAuctionAccountName(activeListing.seller));
      const sellerBalance = sellerPlayer ? getBalance(sellerPlayer) : 0;
      const sellerProceeds = Math.floor(activeListing.price * (1 - SALE_FEE_RATE));
      if (sellerPlayer && (sellerBalance > MAX_MONEY - sellerProceeds || sellerBalance + sellerProceeds > MAX_OPERATIONAL_BALANCE)) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cEl vendedor no puede recibir el pago por límite de saldo.");
        return;
      }

      activeListing.status = "reserved";
      activeListing.transaction = {
        buyer: player.name,
        reservedAt: Date.now(),
        phase: "reserved",
        price: activeListing.price,
        sellerProceeds,
        buyerBalanceBefore: buyerBalance,
        sellerBalanceBefore: sellerBalance,
        buyerBalanceAfter: buyerBalance - activeListing.price,
        sellerBalanceAfter: sellerBalance + sellerProceeds
      };
      if (!saveSubastas(db)) {
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo reservar la publicación.");
        return;
      }

      const chargedBuyer = setBalance(player, buyerBalance - activeListing.price);
      if (!chargedBuyer) {
        activeListing.status = "active";
        delete activeListing.transaction;
        saveSubastas(db);
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo descontar tu saldo. Intenta de nuevo.");
        return;
      }
      activeListing.transaction.phase = "buyer_charged";
      if (!saveSubastas(db)) {
        setBalance(player, buyerBalance);
        activeListing.status = "active";
        delete activeListing.transaction;
        saveSubastas(db);
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo persistir el cobro. La compra fue revertida.");
        return;
      }

      const sellerPayment = creditAuctionSeller(activeListing.seller, sellerPlayer, sellerProceeds);
      if (!sellerPayment.ok) {
        setBalance(player, buyerBalance);
        activeListing.status = "active";
        delete activeListing.transaction;
        saveSubastas(db);
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo pagar al vendedor. La compra fue cancelada.");
        return;
      }
      activeListing.transaction.phase = "seller_paid";
      if (!saveSubastas(db)) {
        setBalance(player, buyerBalance);
        rollbackAuctionSellerCredit(sellerPayment);
        activeListing.status = "active";
        delete activeListing.transaction;
        saveSubastas(db);
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo persistir el pago. La compra fue revertida.");
        return;
      }

      // Entregar objeto
      const delivered = giveItemSafely(player, activeListing.typeId, activeListing.amount, activeListing.nameTag, activeListing.lore, activeListing.enchants, activeListing.potion, activeListing.legacyArrowData);
      if (!delivered) {
        setBalance(player, buyerBalance);
        rollbackAuctionSellerCredit(sellerPayment);
        activeListing.status = "active";
        delete activeListing.transaction;
        saveSubastas(db);
        player.sendMessage("§b§l[§3Subastas§b§l]§r §cNo se pudo entregar el objeto. La compra fue revertida.");
        return;
      }

      activeListing.transaction.phase = "delivered";
      if (!saveSubastas(db)) {
        console.warn(`[Subastas] Compra ${activeListing.id} entregada, pero no se pudo persistir la fase final. El anuncio permanece reservado.`);
        player.sendMessage("§b§l[§3Subastas§b§l]§r §eLa compra fue entregada, pero requiere revisión administrativa de persistencia.");
        return;
      }

      const saleFee = activeListing.price - sellerProceeds;
      if (saleFee > 0) {
        depositAuctionTaxToBank(saleFee, "Comisión Venta Subasta", player.name, `Comisión del 5% por compra de subasta a ${activeListing.seller}`);
      }

      // Quitar de la base de datos
      db.splice(matchIdx, 1);
      if (!saveSubastas(db)) {
        console.warn(`[Subastas] Compra ${activeListing.id} entregada, pero el cierre no pudo persistirse. El anuncio permanece reservado y no puede recomprarse.`);
      }

      player.sendMessage(`§b§l[§3Subastas§b§l]§r §a¡Compra exitosa! Has adquirido §e${activeListing.amount}x ${displayName}§a.`);
      
      // Intentar notificar al vendedor si está online
      const onlineSeller = world.getAllPlayers().find(p => p.name === activeListing.seller);
      if (onlineSeller) {
        onlineSeller.sendMessage(`§b§l[§3Subastas§b§l]§r §a¡Tu objeto §e${activeListing.amount}x ${displayName} §afue comprado por §b${player.name}§a! Recibiste §6$${sellerProceeds} §adespués de la comisión del 5%.`);
      }
      } finally {
        auctionLocks.delete(listingLock);
        auctionPlayerLocks.delete(playerLock);
      }
    } else {
      openSubastasMenu(player);
    }
  });
}
