const fs = require('fs');
const path = require('path');

const filePath = 'behavior_packs/trade_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add startTradeCountdown function before confirmPlayer
const countdownCode = `
function startTradeCountdown(tradeId) {
  const trade = activeTrades.get(tradeId);
  if (!trade || trade.status !== "confirming") return;
  trade.status = "countdown";

  let seconds = 3;
  const pA = world.getAllPlayers().find(p => p.name === trade.playerAName);
  const pB = world.getAllPlayers().find(p => p.name === trade.playerBName);

  if (!pA || !pB) {
    cancelTrade(tradeId, "Uno de los jugadores se desconectó.");
    return;
  }

  pA.sendMessage("§b§l[§3Intercambio§b§l]§r §a¡Ambos confirmaron! §eCuenta atrás de seguridad de 3 segundos iniciada...");
  pB.sendMessage("§b§l[§3Intercambio§b§l]§r §a¡Ambos confirmaron! §eCuenta atrás de seguridad de 3 segundos iniciada...");

  const intervalId = system.runInterval(() => {
    const curTrade = activeTrades.get(tradeId);
    if (!curTrade || curTrade.status !== "countdown") {
      system.clearRun(intervalId);
      return;
    }

    const curA = world.getAllPlayers().find(p => p.name === curTrade.playerAName);
    const curB = world.getAllPlayers().find(p => p.name === curTrade.playerBName);
    if (!curA || !curB) {
      system.clearRun(intervalId);
      cancelTrade(tradeId, "Uno de los jugadores se desconectó durante la cuenta atrás.");
      return;
    }

    if (seconds > 0) {
      curA.onScreenDisplay?.setActionBar(\`§e⚡ Completando intercambio en §c\${seconds}s§e... Revisa el inventario\`);
      curB.onScreenDisplay?.setActionBar(\`§e⚡ Completando intercambio en §c\${seconds}s§e... Revisa el inventario\`);
      try { curA.playSound("random.orb", { pitch: 1.0 + (3 - seconds) * 0.25 }); } catch (e) {}
      try { curB.playSound("random.orb", { pitch: 1.0 + (3 - seconds) * 0.25 }); } catch (e) {}
      seconds--;
    } else {
      system.clearRun(intervalId);
      curTrade.status = "confirming";
      executeTrade(tradeId);
    }
  }, 20);
}
`;

content = content.replace('function confirmPlayer(player, tradeId, expectedVersion) {', countdownCode + '\nfunction confirmPlayer(player, tradeId, expectedVersion) {');

// 2. Change confirmPlayer to call startTradeCountdown instead of executeTrade directly
content = content.replace(
  `  if (trade.confirmedA && trade.confirmedB) {
    executeTrade(tradeId);
  }`,
  `  if (trade.confirmedA && trade.confirmedB) {
    startTradeCountdown(tradeId);
  }`
);

// 3. Update openOfferMenu to add option for Mixed Offer (Item + Dinero)
const oldButtons = `    .button("⚔ Ofrecer objeto en mi mano")
    .button("💰 Ofrecer dinero ($)")
    .button("⚪ No ofrecer nada (Regalo)")
    .button("❌ Cancelar intercambio");`;

const newButtons = `    .button("⚔ Ofrecer objeto en mi mano")
    .button("💰 Ofrecer dinero ($)")
    .button("💎 Ofrecer objeto + dinero (Combinado)")
    .button("⚪ No ofrecer nada (Regalo)")
    .button("❌ Cancelar intercambio");`;

content = content.replace(oldButtons, newButtons);

// Update selection handling in openOfferMenu
const oldSelections = `    if (response.canceled || response.selection === 3) {
      cancelTrade(tradeId, \`\${player.name} canceló el intercambio.\`);
      return;
    }
    
    if (response.selection === 0) {`;

const newSelections = `    if (response.canceled || response.selection === 4) {
      cancelTrade(tradeId, \`\${player.name} canceló el intercambio.\`);
      return;
    }
    
    if (response.selection === 0) {`;

content = content.replace(oldSelections, newSelections);

const oldNothingSelection = `    } else if (response.selection === 2) {
      // Ofrecer nada
      setOffer(player, tradeId, {
        type: "none",
        amount: 0,
        displayName: "Nada"
      });
    }`;

const newNothingSelection = `    } else if (response.selection === 2) {
      // Ofrecer objeto en mano + dinero (Combinado)
      const container = getInventory(player);
      const offeredSlot = player.selectedSlotIndex;
      const item = container ? container.getItem(offeredSlot) : null;
      if (!item) {
        player.sendMessage("§b§l[§3Intercambio§b§l]§r §cDebes sostener un objeto en tu mano principal.");
        openOfferMenu(player, tradeId);
        return;
      }
      const maxBal = Math.min(getBalance(player), MAX_TRADE_MONEY);
      const formMixed = new ModalFormData()
        .title("Oferta Combinada")
        .slider(\`Cantidad de \${item.nameTag || item.typeId.replace("minecraft:", "")} (Tienes \${item.amount})\`, 1, item.amount, 1)
        .slider(\`Cantidad de dinero a añadir (Saldo: $\${maxBal})\`, 0, Math.max(1, maxBal), 1);

      safeOpenForm(player, formMixed, (resMixed) => {
        if (resMixed.canceled) {
          openOfferMenu(player, tradeId);
          return;
        }
        const qty = resMixed.formValues ? Math.floor(resMixed.formValues[0]) : 1;
        const moneyAmt = resMixed.formValues ? Math.floor(resMixed.formValues[1]) : 0;
        const currentItem = getInventory(player)?.getItem(offeredSlot);
        if (!currentItem || !itemsMatchForTrade(currentItem, item, getItemFingerprint(item)) || qty < 1 || qty > currentItem.amount) {
          cancelTrade(tradeId, \`\${player.name} cambió el objeto mientras definía su oferta.\`);
          return;
        }
        if (moneyAmt > getBalance(player) || moneyAmt > MAX_TRADE_MONEY) {
          player.sendMessage("§b§l[§3Intercambio§b§l]§r §cTu saldo cambió. Define nuevamente la oferta.");
          openOfferMenu(player, tradeId);
          return;
        }
        setOffer(player, tradeId, {
          type: "mixed",
          itemTypeId: item.typeId,
          amount: qty,
          moneyAmount: moneyAmt,
          displayName: \`\${item.nameTag || item.typeId.replace("minecraft:", "")} (x\${qty}) + $\${moneyAmt}\`,
          itemFingerprint: getItemFingerprint(item),
          itemSnapshot: cloneItemForTrade(item, qty),
          offeredSlot
        });
      });
    } else if (response.selection === 3) {
      // Ofrecer nada
      setOffer(player, tradeId, {
        type: "none",
        amount: 0,
        displayName: "Nada"
      });
    }`;

content = content.replace(oldNothingSelection, newNothingSelection);

// 4. Update executeTrade to support "mixed" type
const oldValidationA = `  if (trade.offerA.type === "item") {
    const currentItem = getInventory(pA)?.getItem(trade.offerA.offeredSlot);
    if (!currentItem || currentItem.amount < trade.offerA.amount || !itemsMatchForTrade(currentItem, trade.offerA.itemSnapshot, trade.offerA.itemFingerprint)) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pA.name} ya no sostiene el item ofrecido en su mano principal.\`);
      return;
    }
  } else if (trade.offerA.type === "money") {
    if (getBalance(pA) < trade.offerA.amount) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pA.name} ya no tiene saldo suficiente.\`);
      return;
    }
  }`;

const newValidationA = `  if (trade.offerA.type === "item" || trade.offerA.type === "mixed") {
    const currentItem = getInventory(pA)?.getItem(trade.offerA.offeredSlot);
    if (!currentItem || currentItem.amount < trade.offerA.amount || !itemsMatchForTrade(currentItem, trade.offerA.itemSnapshot, trade.offerA.itemFingerprint)) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pA.name} ya no sostiene el item ofrecido en su mano principal.\`);
      return;
    }
    if (trade.offerA.type === "mixed" && getBalance(pA) < (trade.offerA.moneyAmount || 0)) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pA.name} ya no tiene saldo suficiente.\`);
      return;
    }
  } else if (trade.offerA.type === "money") {
    if (getBalance(pA) < trade.offerA.amount) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pA.name} ya no tiene saldo suficiente.\`);
      return;
    }
  }`;

content = content.replace(oldValidationA, newValidationA);

const oldValidationB = `  if (trade.offerB.type === "item") {
    const currentItem = getInventory(pB)?.getItem(trade.offerB.offeredSlot);
    if (!currentItem || currentItem.amount < trade.offerB.amount || !itemsMatchForTrade(currentItem, trade.offerB.itemSnapshot, trade.offerB.itemFingerprint)) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pB.name} ya no sostiene el item ofrecido en su mano principal.\`);
      return;
    }
  } else if (trade.offerB.type === "money") {
    if (getBalance(pB) < trade.offerB.amount) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pB.name} ya no tiene saldo suficiente.\`);
      return;
    }
  }`;

const newValidationB = `  if (trade.offerB.type === "item" || trade.offerB.type === "mixed") {
    const currentItem = getInventory(pB)?.getItem(trade.offerB.offeredSlot);
    if (!currentItem || currentItem.amount < trade.offerB.amount || !itemsMatchForTrade(currentItem, trade.offerB.itemSnapshot, trade.offerB.itemFingerprint)) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pB.name} ya no sostiene el item ofrecido en su mano principal.\`);
      return;
    }
    if (trade.offerB.type === "mixed" && getBalance(pB) < (trade.offerB.moneyAmount || 0)) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pB.name} ya no tiene saldo suficiente.\`);
      return;
    }
  } else if (trade.offerB.type === "money") {
    if (getBalance(pB) < trade.offerB.amount) {
      cancelTrade(tradeId, \`Intercambio fallido: \${pB.name} ya no tiene saldo suficiente.\`);
      return;
    }
  }`;

content = content.replace(oldValidationB, newValidationB);

// Update capacity check
content = content.replace(
  'if (trade.offerA.type === "item" && !canFullyReceiveItem(pB, trade.offerA.itemSnapshot)) {',
  'if ((trade.offerA.type === "item" || trade.offerA.type === "mixed") && !canFullyReceiveItem(pB, trade.offerA.itemSnapshot)) {'
);
content = content.replace(
  'if (trade.offerB.type === "item" && !canFullyReceiveItem(pA, trade.offerB.itemSnapshot)) {',
  'if ((trade.offerB.type === "item" || trade.offerB.type === "mixed") && !canFullyReceiveItem(pA, trade.offerB.itemSnapshot)) {'
);

// Update finalBalance calculation
const oldBalanceCalc = `  const balanceA = getBalance(pA);
  const balanceB = getBalance(pB);
  const finalBalanceA = balanceA - (trade.offerA.type === "money" ? trade.offerA.amount : 0) + (trade.offerB.type === "money" ? trade.offerB.amount : 0);
  const finalBalanceB = balanceB - (trade.offerB.type === "money" ? trade.offerB.amount : 0) + (trade.offerA.type === "money" ? trade.offerA.amount : 0);`;

const newBalanceCalc = `  const balanceA = getBalance(pA);
  const balanceB = getBalance(pB);
  const moneyFromA = trade.offerA.type === "money" ? trade.offerA.amount : (trade.offerA.type === "mixed" ? (trade.offerA.moneyAmount || 0) : 0);
  const moneyFromB = trade.offerB.type === "money" ? trade.offerB.amount : (trade.offerB.type === "mixed" ? (trade.offerB.moneyAmount || 0) : 0);
  const finalBalanceA = balanceA - moneyFromA + moneyFromB;
  const finalBalanceB = balanceB - moneyFromB + moneyFromA;`;

content = content.replace(oldBalanceCalc, newBalanceCalc);

// Update item removal
content = content.replace(
  'if (trade.offerA.type === "item") {',
  'if (trade.offerA.type === "item" || trade.offerA.type === "mixed") {'
);
content = content.replace(
  'if (trade.offerB.type === "item") {',
  'if (trade.offerB.type === "item" || trade.offerB.type === "mixed") {'
);

// Update item delivery
content = content.replace(
  'if (trade.offerB.type === "item") {',
  'if (trade.offerB.type === "item" || trade.offerB.type === "mixed") {'
);
content = content.replace(
  'if (trade.offerA.type === "item") {',
  'if (trade.offerA.type === "item" || trade.offerA.type === "mixed") {'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched trade_addon');
