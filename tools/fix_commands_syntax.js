const fs = require('fs');

// 1. Crates addon
let crates = fs.readFileSync('behavior_packs/crates_addon/scripts/main.js', 'utf8');
const cratesStart = crates.indexOf('function registerCustomCommands() {');
const cratesEnd = crates.indexOf('registerCustomCommands();', cratesStart);
const cratesReplacement = `function registerCustomCommands() {
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
      for (const name of ["fijarcaja", "establecercofre", "setcrate"]) {
        register({ name: \`\${COMMAND_NAMESPACE}:\${name}\`, description: "Registra una caja o cofre de recompensas", permissionLevel: ADMIN_PERMISSION }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          runAdminCrateCommand(sender, "setcrate", ["setcrate"]);
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["borrarcaja", "eliminarcaja", "eliminarcofre", "delcrate"]) {
        register({ name: \`\${COMMAND_NAMESPACE}:\${name}\`, description: "Elimina una caja o cofre de recompensas", permissionLevel: ADMIN_PERMISSION }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          runAdminCrateCommand(sender, "delcrate", ["delcrate"]);
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["darllave", "givekey"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Entrega llaves de caja/cofre a un jugador",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          optionalParameters: [{ name: "cantidad", type: CustomCommandParamType.Integer }],
        }, (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          runAdminCrateCommand(sender, "givekey", ["givekey", String(jugador), String(cantidad ?? 1)]);
          return commandOk(\`Procesando \${name}.\`);
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Crates Addon] Error registrando custom commands: " + e);
    }
  });
}

`;
crates = crates.slice(0, cratesStart) + cratesReplacement + crates.slice(cratesEnd);
fs.writeFileSync('behavior_packs/crates_addon/scripts/main.js', crates, 'utf8');

// 2. Warps addon
let warps = fs.readFileSync('behavior_packs/warps_addon/scripts/main.js', 'utf8');
const warpsStart = warps.indexOf('function registerCustomCommands() {');
const warpsEnd = warps.indexOf('registerCustomCommands();', warpsStart);
const warpsReplacement = `function registerCustomCommands() {
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
      for (const name of ["destinos", "puntos", "teletransportes", "warps", "destino", "punto", "teletransportar", "warp"]) {
        register({ name: \`\${COMMAND_NAMESPACE}:\${name}\`, description: "Abre el menú de destinos y puntos de teletransporte", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openWarpsMenu(sender));
          return commandOk(\`Abriendo \${name}.\`);
        });
      }

      for (const name of ["fijardestino", "creardestino", "establecerpunto", "setwarp"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Define o guarda un destino público",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
        }, (origin, nombre) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
          system.run(() => handleSetWarp(sender, String(nombre || "")));
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["borrardestino", "eliminardestino", "eliminarpunto", "delwarp"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Elimina un destino público",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
        }, (origin, nombre) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
          system.run(() => handleDelWarp(sender, String(nombre || "")));
          return commandOk(\`Procesando \${name}.\`);
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Warps] Error registrando custom commands: " + e);
    }
  });
}

`;
warps = warps.slice(0, warpsStart) + warpsReplacement + warps.slice(warpsEnd);
fs.writeFileSync('behavior_packs/warps_addon/scripts/main.js', warps, 'utf8');

// 3. Protection addon
let prot = fs.readFileSync('behavior_packs/protection_addon/scripts/main.js', 'utf8');
const searchProt1 = `          return commandOk(\`Procesando \${name}.\`);
        });
      }
      }

      register({`;
const searchProt2 = `          return commandOk(\`Procesando \${name}.\`);
        });
      }
\r\n      }

      register({`;

if (prot.includes(searchProt1)) {
  prot = prot.replace(searchProt1, `          return commandOk(\`Procesando \${name}.\`);
        });
      }

      register({`);
} else if (prot.includes(searchProt2)) {
  prot = prot.replace(searchProt2, `          return commandOk(\`Procesando \${name}.\`);
        });
      }

      register({`);
} else {
  // Regex fallback
  prot = prot.replace(/return\s+commandOk\(`Procesando \$\{name\}\.`\);\s*\}\);\s*\}\s*\}\s*register\(\{\s*name:\s*`\$\{COMMAND_NAMESPACE\}:zona`/m,
    `return commandOk(\`Procesando \${name}.\`);
        });
      }

      register({
        name: \`\${COMMAND_NAMESPACE}:zona\``
  );
}
fs.writeFileSync('behavior_packs/protection_addon/scripts/main.js', prot, 'utf8');

// 4. Home Spawn addon
let home = fs.readFileSync('behavior_packs/home_spawn_addon/scripts/main.js', 'utf8');
const homeStart = home.indexOf('function registerCustomCommands() {');
const homeEnd = home.indexOf('registerCustomCommands();', homeStart);
const homeReplacement = `function registerCustomCommands() {
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
      for (const name of [
        "home", "casa",
        "sethome", "guardarcasa", "fijarcasa", "establecercasa",
        "delhome", "borrarcasa", "eliminarcasa",
        "spawn", "aparicion", "origen", "reaparicion",
        "setspawn", "fijaraparicion", "estableceraparicion", "fijarorigen",
        "tpaccept", "tpaaceptar", "aceptartp",
        "tpdeny", "tparechazar", "rechazartp",
        "guias", "reglas", "tumba", "tumbatp"
      ]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: \`Comando \${name}\`,
          permissionLevel: (name === "setspawn" || name === "estableceraparicion" || name === "fijaraparicion" || name === "fijarorigen") ? ADMIN_PERMISSION : CommandPermissionLevel.Any,
          ...(name === "home" || name === "casa" || name === "sethome" || name === "guardarcasa" || name === "fijarcasa" || name === "establecercasa" || name === "delhome" || name === "borrarcasa" || name === "eliminarcasa"
            ? { optionalParameters: [{ name: "numero", type: CustomCommandParamType.Integer }] }
            : {}),
        }, (origin, numero) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if ((name === "setspawn" || name === "estableceraparicion" || name === "fijaraparicion" || name === "fijarorigen") && !isPlayerOp(sender)) {
            return commandError("Solo para operadores.");
          }
          let internalName = name;
          if (["casa"].includes(name)) internalName = "home";
          if (["guardarcasa", "fijarcasa", "establecercasa"].includes(name)) internalName = "sethome";
          if (["borrarcasa", "eliminarcasa"].includes(name)) internalName = "delhome";
          if (["aparicion", "origen", "reaparicion"].includes(name)) internalName = "spawn";
          if (["fijaraparicion", "fijarorigen", "estableceraparicion"].includes(name)) internalName = "setspawn";
          if (["tpaaceptar", "aceptartp"].includes(name)) internalName = "tpaccept";
          if (["tparechazar", "rechazartp"].includes(name)) internalName = "tpdeny";
          system.run(async () => {
            const args = [internalName];
            if (numero !== undefined && numero !== null) args.push(String(numero));
            await handleCommand(sender, internalName, args);
          });
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["tpa", "pedirtp"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Solicita teletransporte a un jugador",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
        }, (origin, jugador) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(async () => {
            await handleCommand(sender, "tpa", ["tpa", String(jugador)]);
          });
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      if (LEGACY_MODERATION_MODE === "ENABLED") {
        for (const name of ["vetar", "ban"]) {
          register({
            name: \`\${COMMAND_NAMESPACE}:\${name}\`,
            description: "Veta permanentemente a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
            optionalParameters: [{ name: "motivo", type: CustomCommandParamType.String }],
          }, (origin, jugador, motivo) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            const args = ["ban", String(jugador)];
            if (motivo !== undefined && motivo !== null && String(motivo).trim()) args.push(String(motivo));
            system.run(async () => {
              await handleCommand(sender, "ban", args);
            });
            return commandOk(\`Procesando \${name}.\`);
          });
        }

        for (const name of ["vetartemporal", "tempban"]) {
          register({
            name: \`\${COMMAND_NAMESPACE}:\${name}\`,
            description: "Veta temporalmente a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [
              { name: "jugador", type: CustomCommandParamType.String },
              { name: "minutos", type: CustomCommandParamType.Integer },
            ],
            optionalParameters: [{ name: "motivo", type: CustomCommandParamType.String }],
          }, (origin, jugador, minutos, motivo) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            const args = ["tempban", String(jugador), String(minutos)];
            if (motivo !== undefined && motivo !== null && String(motivo).trim()) args.push(String(motivo));
            system.run(async () => {
              await handleCommand(sender, "tempban", args);
            });
            return commandOk(\`Procesando \${name}.\`);
          });
        }

        for (const name of ["desvetar", "unban"]) {
          register({
            name: \`\${COMMAND_NAMESPACE}:\${name}\`,
            description: "Retira el veto a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          }, (origin, jugador) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            system.run(async () => {
              await handleCommand(sender, "unban", ["unban", String(jugador)]);
            });
            return commandOk(\`Procesando \${name}.\`);
          });
        }

        for (const name of ["silenciar", "mute"]) {
          register({
            name: \`\${COMMAND_NAMESPACE}:\${name}\`,
            description: "Silencia temporalmente a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [
              { name: "jugador", type: CustomCommandParamType.String },
              { name: "minutos", type: CustomCommandParamType.Integer },
            ],
            optionalParameters: [{ name: "motivo", type: CustomCommandParamType.String }],
          }, (origin, jugador, minutos, motivo) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            const args = ["mute", String(jugador), String(minutos)];
            if (motivo !== undefined && motivo !== null && String(motivo).trim()) args.push(String(motivo));
            system.run(async () => {
              await handleCommand(sender, "mute", args);
            });
            return commandOk(\`Procesando \${name}.\`);
          });
        }

        for (const name of ["dessilenciar", "unmute"]) {
          register({
            name: \`\${COMMAND_NAMESPACE}:\${name}\`,
            description: "Retira el silencio a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          }, (origin, jugador) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            system.run(async () => {
              await handleCommand(sender, "unmute", ["unmute", String(jugador)]);
            });
            return commandOk(\`Procesando \${name}.\`);
          });
        }
      } else if (LEGACY_MODERATION_MODE === "SHADOWED") {
        for (const name of ["desvetar", "unban", "dessilenciar", "unmute"]) {
          register({
            name: \`\${COMMAND_NAMESPACE}:\${name}\`,
            description: \`Redirección FCX para \${name}\`,
            permissionLevel: CommandPermissionLevel.Any,
            optionalParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          }, (origin) => {
            const sender = origin?.sourceEntity;
            if (sender) system.run(() => sender.sendMessage("§e[FCX Admin] La moderación heredada está desactivada. Usa §f/s:admin§e."));
            return commandError("Usa /s:admin.");
          });
        }
      }

      for (const name of ["borrarnpcs", "removernpcs"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Remueve NPCs cercanos de soporte",
          permissionLevel: ADMIN_PERMISSION,
          optionalParameters: [{ name: "radio", type: CustomCommandParamType.Integer }],
        }, (origin, radio) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
          const args = ["removernpcs"];
          if (radio !== undefined && radio !== null) args.push(String(radio));
          system.run(async () => {
            await handleCommand(sender, "removernpcs", args);
          });
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["listastaff", "adminlist"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Lista histórica de jugadores y XUID",
          permissionLevel: ADMIN_PERMISSION,
          optionalParameters: [{ name: "filtro", type: CustomCommandParamType.String }],
        }, (origin, filtro) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          const args = ["adminlist"];
          if (filtro !== undefined && filtro !== null && String(filtro).trim()) args.push(String(filtro));
          system.run(async () => {
            await handleCommand(sender, "adminlist", args);
          });
          return commandOk(\`Procesando \${name}.\`);
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Home and Spawn Addon] Error registrando custom commands: " + e);
    }
  });
}

`;
home = home.slice(0, homeStart) + homeReplacement + home.slice(homeEnd);
fs.writeFileSync('behavior_packs/home_spawn_addon/scripts/main.js', home, 'utf8');

console.log('✓ Successfully fixed syntax in all 4 files.');
