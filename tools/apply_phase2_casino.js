const fs = require('fs');

const filePath = 'behavior_packs/casino_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

const gamesCode = `
// ============================================================================
// NUEVOS JUEGOS: CARA O CRUZ Y BLACKJACK 21 (FASE 2)
// ============================================================================

// 1. CARA O CRUZ (COIN FLIP)
function openCoinFlipBetMenu(player) {
  const balance = getBalance(player);
  const maxBet = getMaximumBet(balance);
  const bets = [100, 250, 500, 1000, 2500, 5000].filter(b => b <= maxBet);

  const form = new ActionFormData()
    .title("🪙 Cara o Cruz (Coin Flip)")
    .body(\`Tu saldo: §a$\${balance}§r\\nApuesta máxima permitida: §e$\${maxBet}§r\\n\\nSelecciona el monto a apostar:\`);

  bets.forEach(b => form.button(\`🪙 Apostar $\${b}\`));
  form.button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined || idx === bets.length) {
      openCasinoMenu(player);
      return;
    }
    openCoinFlipSideSelect(player, bets[idx]);
  });
}

function openCoinFlipSideSelect(player, bet) {
  const form = new ActionFormData()
    .title("🪙 Elige tu lado")
    .body(\`Monto de apuesta: §a$\${bet}§r\\nPremio si aciertas: §e$\${bet * 2}§r\\n\\n¿Por cuál lado apuestas?\`)
    .button("🟡 Cara")
    .button("⚪ Cruz")
    .button("🔙 Cancelar");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0 || response.selection === 1) {
      const choice = response.selection === 0 ? "Cara" : "Cruz";
      executeCoinFlip(player, bet, choice);
    } else {
      openCoinFlipBetMenu(player);
    }
  });
}

function executeCoinFlip(player, bet, playerChoice) {
  const reservation = reserveCasinoWager(player, bet, 2);
  if (!reservation.ok) {
    player.sendMessage(\`§b§l[Casino]§r \${reservation.message}\`);
    return;
  }

  try { player.playSound("random.orb", { pitch: 1.2 }); } catch (e) {}
  player.sendMessage("§e🪙 Lanzando la moneda al aire...");

  system.runTimeout(() => {
    if (!player || !player.isValid) return;
    const isCara = Math.random() < 0.5;
    const result = isCara ? "Cara" : "Cruz";
    const won = result === playerChoice;

    if (won) {
      const payout = bet * 2;
      settleCasinoPayout(player, bet, payout, "coinflip");
      player.sendMessage(\`§a§l[¡VICTORIA!] §eCayó \${result}. §a¡Has ganado $\${payout}! (Tu saldo: $\${getBalance(player)})\`);
      try { player.playSound("random.levelup", { pitch: 1.2 }); } catch (e) {}
    } else {
      settleCasinoPayout(player, bet, 0, "coinflip");
      player.sendMessage(\`§c§l[DERROTA] §7Cayó \${result}. Perdiste tu apuesta de $\${bet}. (Tu saldo: $\${getBalance(player)})\`);
      try { player.playSound("note.bass", { pitch: 0.8 }); } catch (e) {}
    }

    const formResult = new ActionFormData()
      .title(won ? "§a¡Moneda Ganadora!" : "§cMoneda Perdedora")
      .body(\`Resultado: §e\${result}§r\\nTu elección fue: §b\${playerChoice}§r\\n\\n\${won ? \`§a¡Ganaste $\${bet * 2}!\` : \`§cPerdiste $\${bet}\`}\`)
      .button("🪙 Jugar de nuevo")
      .button("🎰 Volver al Casino");

    safeOpenForm(player, formResult, (res) => {
      if (res.selection === 0) openCoinFlipBetMenu(player);
      else openCasinoMenu(player);
    });
  }, 30);
}

// 2. BLACKJACK 21
const BJ_SUITS = ["♠", "♥", "♦", "♣"];
const BJ_VALUES = [
  { label: "2", val: 2 }, { label: "3", val: 3 }, { label: "4", val: 4 },
  { label: "5", val: 5 }, { label: "6", val: 6 }, { label: "7", val: 7 },
  { label: "8", val: 8 }, { label: "9", val: 9 }, { label: "10", val: 10 },
  { label: "J", val: 10 }, { label: "Q", val: 10 }, { label: "K", val: 10 },
  { label: "A", val: 11 }
];

function drawCard() {
  const suit = BJ_SUITS[Math.floor(Math.random() * BJ_SUITS.length)];
  const item = BJ_VALUES[Math.floor(Math.random() * BJ_VALUES.length)];
  return { label: \`\${item.label}\${suit}\`, val: item.val, isAce: item.label === "A" };
}

function calculateHand(cards) {
  let total = cards.reduce((sum, c) => sum + c.val, 0);
  let aces = cards.filter(c => c.isAce).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function openBlackjackBetMenu(player) {
  const balance = getBalance(player);
  const maxBet = getMaximumBet(balance);
  const bets = [100, 250, 500, 1000, 2500, 5000].filter(b => b <= maxBet);

  const form = new ActionFormData()
    .title("🃏 Blackjack 21")
    .body(\`Tu saldo: §a$\${balance}§r\\nApuesta máxima permitida: §e$\${maxBet}§r\\n\\nSelecciona tu apuesta:\`);

  bets.forEach(b => form.button(\`🃏 Apostar $\${b}\`));
  form.button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined || idx === bets.length) {
      openCasinoMenu(player);
      return;
    }
    startBlackjackGame(player, bets[idx]);
  });
}

function startBlackjackGame(player, bet) {
  const reservation = reserveCasinoWager(player, bet, 2);
  if (!reservation.ok) {
    player.sendMessage(\`§b§l[Casino]§r \${reservation.message}\`);
    return;
  }

  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];

  openBlackjackTurn(player, bet, playerCards, dealerCards);
}

function openBlackjackTurn(player, bet, playerCards, dealerCards) {
  const playerTotal = calculateHand(playerCards);
  const dealerVisible = dealerCards[0].label;
  const playerHandText = playerCards.map(c => c.label).join(" ");

  if (playerTotal === 21 && playerCards.length === 2) {
    // Natural Blackjack!
    const payout = Math.floor(bet * 2.5);
    settleCasinoPayout(player, bet, payout, "blackjack");
    player.sendMessage(\`§a§l[¡BLACKJACK NATURAL!] §eTus cartas: \${playerHandText} (21). §a¡Cobras $\${payout}!\`);
    try { player.playSound("random.levelup", { pitch: 1.5 }); } catch (e) {}
    openCasinoMenu(player);
    return;
  }

  if (playerTotal > 21) {
    settleCasinoPayout(player, bet, 0, "blackjack");
    player.sendMessage(\`§c§l[TE PASASTE] §7Tus cartas: \${playerHandText} (\${playerTotal}). ¡Perdiste $\${bet}!\`);
    try { player.playSound("note.bass", { pitch: 0.7 }); } catch (e) {}
    openCasinoMenu(player);
    return;
  }

  const form = new ActionFormData()
    .title("🃏 Blackjack 21")
    .body(\`Apuesta: §e$\${bet}§r\\n\\n§fTus cartas: §a\${playerHandText} §7(Total: §e\${playerTotal}§7)\\n§fCrupier: §c\${dealerVisible} [?]\\n\\n¿Deseas pedir carta o plantarte?\`)
    .button("🃏 Pedir Carta (Hit)")
    .button("✋ Plantarse (Stand)");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0) {
      playerCards.push(drawCard());
      openBlackjackTurn(player, bet, playerCards, dealerCards);
    } else if (response.selection === 1) {
      finishBlackjackDealer(player, bet, playerCards, dealerCards);
    } else {
      // Si cierra la ventana se considera Plantado
      finishBlackjackDealer(player, bet, playerCards, dealerCards);
    }
  });
}

function finishBlackjackDealer(player, bet, playerCards, dealerCards) {
  const playerTotal = calculateHand(playerCards);

  // Crupier saca cartas hasta tener 17 o más
  while (calculateHand(dealerCards) < 17) {
    dealerCards.push(drawCard());
  }

  const dealerTotal = calculateHand(dealerCards);
  const playerHandText = playerCards.map(c => c.label).join(" ");
  const dealerHandText = dealerCards.map(c => c.label).join(" ");

  let won = false;
  let tie = false;

  if (dealerTotal > 21 || playerTotal > dealerTotal) {
    won = true;
  } else if (playerTotal === dealerTotal) {
    tie = true;
  }

  if (won) {
    const payout = bet * 2;
    settleCasinoPayout(player, bet, payout, "blackjack");
    player.sendMessage(\`§a§l[¡GANASTE EN BLACKJACK!] §7Tú: §a\${playerTotal} §7vs Crupier: §c\${dealerTotal}. §a¡Ganaste $\${payout}!\`);
    try { player.playSound("random.levelup", { pitch: 1.2 }); } catch (e) {}
  } else if (tie) {
    settleCasinoPayout(player, bet, bet, "blackjack");
    player.sendMessage(\`§e§l[EMPATE] §7Ambos tienen \${playerTotal}. Se te reembolsa tu apuesta de $\${bet}.\`);
  } else {
    settleCasinoPayout(player, bet, 0, "blackjack");
    player.sendMessage(\`§c§l[GANA EL CRUPIER] §7Crupier: §c\${dealerTotal} §7vs Tú: §a\${playerTotal}. Perdiste $\${bet}.\`);
    try { player.playSound("note.bass", { pitch: 0.7 }); } catch (e) {}
  }

  const formResult = new ActionFormData()
    .title(won ? "§a¡Victoria en Blackjack!" : tie ? "§eEmpate" : "§cGana la Casa")
    .body(\`Tus cartas: §a\${playerHandText} §7(\${playerTotal})\\nCartas Crupier: §c\${dealerHandText} §7(\${dealerTotal})\\n\\n\${won ? \`§a¡Cobras $\${bet * 2}!\` : tie ? "§eApuesta devuelta." : \`§cPerdiste $\${bet}\`}\`)
    .button("🃏 Jugar otra ronda")
    .button("🎰 Volver al Casino");

  safeOpenForm(player, formResult, (res) => {
    if (res.selection === 0) openBlackjackBetMenu(player);
    else openCasinoMenu(player);
  });
}
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + gamesCode);

// Add buttons to openCasinoMenu
const oldMenuButtons = `    .button("🎰 Tragamonedas (Slots)\\n§7¡Gana hasta x10 de tu apuesta!", "textures/ui/slot_icon")
    .button("🎡 Ruleta Imperial\\n§7Apuesta al Rojo, Negro o Verde", "textures/ui/roulette_icon")
    .button("❔ ¿Cómo jugar? / Guía", "textures/ui/help_icon");`;

const newMenuButtons = `    .button("🎰 Tragamonedas (Slots)\\n§7¡Gana hasta x10 de tu apuesta!", "textures/ui/slot_icon")
    .button("🎡 Ruleta Imperial\\n§7Apuesta al Rojo, Negro o Verde", "textures/ui/roulette_icon")
    .button("🃏 Blackjack 21 (Nuevo)\\n§7Supera al crupier sin pasarte de 21", "textures/ui/cards_icon")
    .button("🪙 Cara o Cruz (Coin Flip)\\n§750% de probabilidad, x2 de ganancia", "textures/ui/coin_icon")
    .button("❔ ¿Cómo jugar? / Guía", "textures/ui/help_icon");`;

content = content.replace(oldMenuButtons, newMenuButtons);

// Update openCasinoMenu selection logic
const oldMenuLogic = `    if (response.selection === 0) {
      openSlotsMenu(player);
    } else if (response.selection === 1) {
      openRouletteMenu(player);
    } else if (response.selection === 2) {
      openCasinoTutorial(player);
    }`;

const newMenuLogic = `    if (response.selection === 0) {
      openSlotsMenu(player);
    } else if (response.selection === 1) {
      openRouletteMenu(player);
    } else if (response.selection === 2) {
      openBlackjackBetMenu(player);
    } else if (response.selection === 3) {
      openCoinFlipBetMenu(player);
    } else if (response.selection === 4) {
      openCasinoTutorial(player);
    }`;

content = content.replace(oldMenuLogic, newMenuLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched casino_addon');
