// CONFIGURAÇÃO DO SOCKET.IO (CLIENT-SIDE)
let socket;
try {
  socket = io(); 

  socket.on('connect_error', () => {
    const err = document.getElementById('online-error');
    if (err && gameMode === 'online') {
      err.innerText = "Falha ao conectar. Verifique se o servidor Node.js (server.js) está rodando.";
      err.classList.remove('hidden');
    }
  });

  socket.on('connect', () => {
    const err = document.getElementById('online-error');
    if (err) err.classList.add('hidden');
  });
} catch (e) {
  console.warn("Socket.io não inicializado. O script do CDN pode estar bloqueado.");
}

let onlineRoomId = null;
let onlinePlayerRole = null;
let onlineHostTeam = null;
let onlineGuestTeam = null;

// DADOS INICIAIS E OPONENTE IA
const defaultOpponent = {
  name: "Rivais FC",
  color: "#f75a68",
  formation: "4-4-2",
  logo: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%23f75a68'><circle cx='12' cy='12' r='10'/></svg>",
  players: ["Goleiro IA", "Zagueiro IA 1", "Zagueiro IA 2", "Lateral D IA", "Lateral E IA", "Volante IA", "Meia IA 1", "Meia IA 2", "Ponta D IA", "Ponta E IA", "Atacante IA"]
};

let team = {
  name: "Meu Time FC",
  color: "#00b37e",
  formation: "4-3-3",
  logo: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%2300b37e'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>",
  players: ["Goleiro", "Zagueiro 1", "Zagueiro 2", "Lateral D", "Lateral E", "Volante", "Meia 1", "Meia 2", "Ponta D", "Ponta E", "Atacante"]
};

let gameMode = 'ia'; // 'ia', 'penalties_only', 'online'
let isExtraAction = false;

let matchState = {
  half: 1, // 1, 2, 3 (1ª Prorr), 4 (2ª Prorr), 5 (Pênaltis)
  actionIndex: 1,
  scoreA: 0,
  scoreB: 0,
  currentAttacker: 'A',
  advanceLevel: 1,
  pendingAttackMove: null,
  pendingDefenseMove: null,
  isCorner: false,
  isFromCornerShort: false,
  penalties: {
    historyA: [],
    historyB: [],
    kicksA: 0,
    kicksB: 0,
    currentKicker: 'A'
  }
};

window.onload = () => {
  loadTeam();
  renderPlayerInputs();

  // Tratamento de Convite por Link via URL (Ex: ?room=SB2K6N)
  const urlParams = new URLSearchParams(window.location.search);
  const roomCodeFromUrl = urlParams.get('room');
  
  if (roomCodeFromUrl) {
      setTimeout(() => {
          openOnlineLobby();
          document.getElementById('joinRoomCode').value = roomCodeFromUrl.toUpperCase();
          // Limpa a URL visualmente para não travar em refresh futuro
          window.history.replaceState({}, document.title, window.location.pathname);
      }, 500);
  }
};

function renderPlayerInputs() {
  const container = document.getElementById("playersInput");
  if (!container) return;
  container.innerHTML = "";
  team.players.forEach((p, i) => {
    container.innerHTML += `<input type="text" class="p-name" value="${p}" style="width:48%;" placeholder="Jogador ${i+1}">`;
  });
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      team.logo = event.target.result;
      document.getElementById("menuLogoDisplay").src = team.logo;
    };
    reader.readAsDataURL(file);
  }
}

function saveTeam() {
  team.name = document.getElementById("teamName").value;
  team.color = document.getElementById("teamColor").value;
  team.formation = document.getElementById("teamFormation").value;
  const inputs = document.querySelectorAll(".p-name");
  team.players = [];
  inputs.forEach(input => team.players.push(input.value));
  localStorage.setItem("futrpg_v3_team", JSON.stringify(team));
  document.documentElement.style.setProperty('--home-color', team.color);
  alert("Time salvo no navegador com sucesso!");
}

function loadTeam() {
  const saved = localStorage.getItem("futrpg_v3_team");
  if (saved) {
    team = JSON.parse(saved);
    if (document.getElementById("teamName")) document.getElementById("teamName").value = team.name;
    if (document.getElementById("teamColor")) document.getElementById("teamColor").value = team.color;
    if (document.getElementById("teamFormation")) document.getElementById("teamFormation").value = team.formation;
    if (team.logo && document.getElementById("menuLogoDisplay")) document.getElementById("menuLogoDisplay").src = team.logo;
    document.documentElement.style.setProperty('--home-color', team.color);
  }
}

function exportSave() {
  saveTeam();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(team));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${team.name.replace(/\s+/g, '_')}_save.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importSave(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        team = JSON.parse(event.target.result);
        localStorage.setItem("futrpg_v3_team", JSON.stringify(team));
        loadTeam();
        renderPlayerInputs();
        alert("Save importado com sucesso!");
      } catch(err) {
        alert("Erro ao ler arquivo de save!");
      }
    };
    reader.readAsText(file);
  }
}

function showScreen(screenId) {
  document.querySelectorAll('.container > div.card').forEach(div => div.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

function showOverlay(message) {
  document.getElementById("waiting-text").innerText = message;
  document.getElementById("waiting-overlay").classList.remove("hidden");
}

function hideOverlay() {
  document.getElementById("waiting-overlay").classList.add("hidden");
}

// === CENTRALIZAÇÃO DE FLUXO INICIAL === //
function startMode(mode) {
  gameMode = mode;
  if (mode === 'online') {
    openOnlineLobby();
    return;
  }
  startEngine(false);
}

// === SISTEMA ONLINE VIA SOCKET.IO === //

function openOnlineLobby() {
  gameMode = 'online';
  
  if (window.location.protocol === 'file:') {
      alert("ATENÇÃO: Você está acessando o jogo por um arquivo local. Para o multiplayer funcionar entre dois PCs, AMBOS precisam acessar a mesma URL do Render (ex: https://futrpg.onrender.com).");
  }

  showScreen('screen-online');
  document.getElementById('online-setup-controls').classList.remove('hidden');
  document.getElementById('online-lobby-room').classList.add('hidden');
  document.getElementById('online-error').classList.add('hidden');

  if (!socket || !socket.connected) {
    const err = document.getElementById('online-error');
    err.innerText = "Conectando ao servidor multiplayer... Certifique-se de estar usando o link do Render.";
    err.classList.remove('hidden');
  }
}

function createOnlineRoom() {
  if (!socket || !socket.connected) {
    const err = document.getElementById('online-error');
    err.innerText = "Servidor offline. Não é possível criar a sala. Acesse o link oficial.";
    err.classList.remove('hidden');
    return;
  }
  socket.emit('createRoom', team);
}

function joinOnlineRoom() {
  if (!socket || !socket.connected) {
    const err = document.getElementById('online-error');
    err.innerText = "Servidor offline. Não é possível entrar na sala. Acesse o link oficial.";
    err.classList.remove('hidden');
    return;
  }
  const code = document.getElementById('joinRoomCode').value.trim();
  if (code.length !== 6) {
    const err = document.getElementById('online-error');
    err.innerText = "O código deve ter exatamente 6 caracteres.";
    err.classList.remove('hidden');
    return;
  }
  socket.emit('joinRoom', { roomId: code, teamData: team });
}

function startOnlineMatch() {
  if (onlinePlayerRole === 'A') {
    socket.emit('startGame', onlineRoomId);
  }
}

function copyInviteLink() {
  if (!onlineRoomId) return;
  const link = window.location.origin + window.location.pathname + '?room=' + onlineRoomId;
  navigator.clipboard.writeText(link).then(() => {
      alert("Link copiado! Envie este link para o seu amigo.");
  }).catch(() => {
      alert("Erro ao copiar o link. Você pode copiar manualmente: " + link);
  });
}

function leaveOnlineLobby() {
  onlineRoomId = null;
  onlinePlayerRole = null;
  if (socket) {
    socket.disconnect(); 
    socket.connect(); 
  }
  document.getElementById('btn-copy-link').classList.add('hidden');
  showScreen('screen-setup');
}

// Eventos de Socket (Lobby)
if (socket) {
  socket.on('roomCreated', (data) => {
    onlineRoomId = data.roomId;
    onlinePlayerRole = data.playerRole;
    onlineHostTeam = data.hostTeam;
    
    document.getElementById('online-setup-controls').classList.add('hidden');
    document.getElementById('online-lobby-room').classList.remove('hidden');
    document.getElementById('lobby-room-code-display').innerText = onlineRoomId;
    
    document.getElementById('lobbyHostName').innerText = onlineHostTeam.name;
    document.getElementById('lobbyHostLogo').src = onlineHostTeam.logo;
    
    document.getElementById('btn-copy-link').classList.remove('hidden');
    document.getElementById('lobby-status-text').innerText = "Aguardando o adversário (Guest) se conectar...";
  });

  socket.on('guestJoined', (data) => {
    onlineGuestTeam = data.guestTeam;
    document.getElementById('lobbyGuestName').innerText = onlineGuestTeam.name;
    document.getElementById('lobbyGuestName').style.color = "#f4f4f5";
    document.getElementById('lobbyGuestLogo').src = onlineGuestTeam.logo;
    document.getElementById('lobbyGuestLogo').classList.remove('hidden');
    document.getElementById('lobbyGuestBadge').classList.remove('hidden');
    
    document.getElementById('lobby-status-text').innerText = "Adversário conectado! O Host já pode iniciar a partida.";
    document.getElementById('btn-start-online').classList.remove('hidden');
  });

  socket.on('roomJoined', (data) => {
    onlineRoomId = data.roomId;
    onlinePlayerRole = data.playerRole;
    onlineHostTeam = data.hostTeam;
    onlineGuestTeam = data.guestTeam;
    
    document.getElementById('online-setup-controls').classList.add('hidden');
    document.getElementById('online-lobby-room').classList.remove('hidden');
    document.getElementById('lobby-room-code-display').innerText = onlineRoomId;
    
    document.getElementById('lobbyHostName').innerText = onlineHostTeam.name;
    document.getElementById('lobbyHostLogo').src = onlineHostTeam.logo;
    
    document.getElementById('btn-copy-link').classList.add('hidden');
    
    document.getElementById('lobbyGuestName').innerText = onlineGuestTeam.name;
    document.getElementById('lobbyGuestName').style.color = "#f4f4f5";
    document.getElementById('lobbyGuestLogo').src = onlineGuestTeam.logo;
    document.getElementById('lobbyGuestLogo').classList.remove('hidden');
    document.getElementById('lobbyGuestBadge').classList.remove('hidden');
    
    document.getElementById('lobby-status-text').innerText = "Conectado com sucesso! Aguardando o Host iniciar a partida...";
  });

  socket.on('roomError', (msg) => {
    const err = document.getElementById('online-error');
    err.innerText = msg;
    err.classList.remove('hidden');
  });

  socket.on('gameStarted', () => {
    startEngine(true);
  });

  socket.on('opponentLeft', (data) => {
    alert(data.message);
    leaveOnlineLobby();
  });

  // Eventos de Socket (Motor Autoritativo Durante o Jogo)
  socket.on('turnResolved', (data) => {
    hideOverlay();
    
    const atkRole = matchState.currentAttacker;
    const defRole = atkRole === 'A' ? 'B' : 'A';
    
    matchState.pendingAttackMove = (atkRole === 'A') ? data.moveA : data.moveB;
    matchState.pendingDefenseMove = (defRole === 'A') ? data.moveA : data.moveB;

    if (matchState.half === 5) {
      resolvePenaltyKick();
    } else if (!document.getElementById("panel-cantos").classList.contains("hidden")) {
      resolveDirection();
    } else if (matchState.isCorner) {
      resolveCorner();
    } else {
      resolveAdvance();
    }
  });

  socket.on('syncTiebreaker', (data) => {
    hideOverlay();
    resolveTie(data.choice);
  });
}

// === NÚCLEO DO SIMULADOR (OFFLINE & ONLINE) === //

function getMatchMinute() {
  if (matchState.half === 1) return Math.min(45, Math.floor((matchState.actionIndex - 1) * 9 + (matchState.advanceLevel * 2)));
  if (matchState.half === 2) return Math.min(90, 45 + Math.floor((matchState.actionIndex - 1) * 9 + (matchState.advanceLevel * 2)));
  if (matchState.half === 3) return Math.min(105, 90 + Math.floor((matchState.actionIndex - 1) * 5 + (matchState.advanceLevel)));
  if (matchState.half === 4) return Math.min(120, 105 + Math.floor((matchState.actionIndex - 1) * 5 + (matchState.advanceLevel)));
  return 120;
}

function getActiveTeams() {
  if (gameMode === 'online') {
    return {
      A: onlineHostTeam,
      B: onlineGuestTeam
    };
  } else {
    return {
      A: team,
      B: defaultOpponent
    };
  }
}

function narrate(type, atkTeamName, defTeamName, dir) {
  const box = document.getElementById("narratorLog");
  const min = getMatchMinute();
  let text = "";
  let cssClass = "narrator-line";
  
  const teams = getActiveTeams();
  const isHomeAtk = (matchState.half === 5) ? (matchState.penalties.currentKicker === 'A') : (matchState.currentAttacker === 'A');
  
  const atkPlayers = isHomeAtk ? teams.A.players : teams.B.players;
  const defPlayers = isHomeAtk ? teams.B.players : teams.A.players;
  
  const pAtk = atkPlayers[Math.floor(Math.random() * (atkPlayers.length - 1)) + 1];
  const pDef = defPlayers[Math.floor(Math.random() * (defPlayers.length - 1)) + 1];
  const pGk = defPlayers[0];
  
  const cantoTexto = dir ? `na ${dir.toUpperCase()}` : "";

  switch(type) {
    case 'START':
      text = `⏱️ [0'] O árbitro olha o cronômetro, apita e autoriza! Bola rolando!`;
      break;
    case 'DRIBLE_SUCCESS':
      text = `⚡ [${min}'] 🔥 DRIBLE DE ${atkTeamName.toUpperCase()}! ${pAtk} usa a ginga de corpo, supera a marcação de ${pDef} e avança livre!`;
      cssClass += " atk";
      break;
    case 'PASSE_SUCCESS':
      text = `🎯 [${min}'] 👟 PASSE DE ${atkTeamName.toUpperCase()}! ${pAtk} lança em profundidade e encontra o companheiro livre para avançar!`;
      cssClass += " atk";
      break;
    case 'DIVIDIDA_WIN':
      text = `🧱 [${min}'] 🛑 DESARME DE ${defTeamName.toUpperCase()}! ${pDef} chega certeiro na dividida, toma a bola de ${pAtk} e encerra o ataque!`;
      cssClass += " def";
      break;
    case 'INTERCEPT_WIN':
      text = `👀 [${min}'] 🦅 INTERCEPTAÇÃO DE ${defTeamName.toUpperCase()}! ${pDef} lê a jogada de ${pAtk}, estica a perna e corta o passe!`;
      cssClass += " def";
      break;
    case 'BLOCK_WIN':
      text = `🛡️ [${min}'] 🧱 BLOQUEIO DE ${defTeamName.toUpperCase()}! ${pAtk} tenta o chute, mas ${pDef} se atira na bola e trava a finalização!`;
      cssClass += " def";
      break;
    case 'CANTOS':
      text = `⚠️ [${min}'] 🚨 OPORTUNIDADE CLARA DE ${atkTeamName.toUpperCase()}! ${pAtk} fica cara a cara com o goleiro ${pGk}! Vai pro chute!`;
      cssClass += " atk";
      break;
    case 'GOAL':
      text = `⚽ [${min}'] 🎉 GOOOOOOOOOOOOL DO ${atkTeamName.toUpperCase()}! ${pAtk} solta a bomba ${cantoTexto}, sem chances para o goleiro ${pGk}!`;
      cssClass += " goal";
      break;
    case 'SAVE_CORNER':
      text = `🧤 [${min}'] ✈️ DEFESAÇA DE ${defTeamName.toUpperCase()}! ${pGk} espalma a bola na ${dir.toUpperCase()} e cede ESCANTEIO!`;
      cssClass += " def";
      break;
    case 'SAVE_MIDDLE':
      text = `👐 [${min}'] 🛑 DEFESA FIRME DE ${defTeamName.toUpperCase()}! ${pGk} segura a bola e impede o tento!`;
      cssClass += " def";
      break;
    case 'CORNER_ANULLED':
      text = `🛑 [${min}'] 🛡️ DEFESA ATENTA! ${defTeamName.toUpperCase()} adivinha a jogada de escanteio e afasta o perigo!`;
      cssClass += " def";
      break;
    case 'CORNER_CURTO_WIN':
      text = `👟 [${min}'] 🏃 ESCANTEIO CURTO! ${atkTeamName.toUpperCase()} cobra curto e parte para o último avanço!`;
      cssClass += " atk";
      break;
    case 'PENALTY_GOAL':
      text = `⚽ GOOOOOOOOOOOL NO PÊNALTI DO ${atkTeamName.toUpperCase()}! Cobrança perfeita na ${dir.toUpperCase()}, bola de um lado, goleiro do outro!`;
      cssClass += " goal";
      break;
    case 'PENALTY_SAVE':
      text = `🧤 DEEEEEFEESA NO PÊNALTI! O goleiro do ${defTeamName.toUpperCase()} voa na ${dir.toUpperCase()} e faz a defesa!`;
      cssClass += " def";
      break;
  }
  box.innerHTML += `<div class="${cssClass}">${text}</div>`;
  box.scrollTop = box.scrollHeight;
}

function startEngine(isOnlineReady) {
  showScreen('screen-game');
  document.getElementById("narratorLog").innerHTML = "";
  
  const teams = getActiveTeams();
  
  document.getElementById("hudHomeName").innerText = teams.A.name;
  document.getElementById("hudHomeForm").innerText = teams.A.formation;
  document.getElementById("hudHomeLogo").src = teams.A.logo;
  
  document.getElementById("hudAwayName").innerText = teams.B.name;
  document.getElementById("hudAwayForm").innerText = teams.B.formation;
  document.getElementById("hudAwayLogo").src = teams.B.logo;
  
  document.getElementById("penHomeName").innerText = teams.A.name;
  document.getElementById("penHomeLogo").src = teams.A.logo;
  document.getElementById("penAwayName").innerText = teams.B.name;
  document.getElementById("penAwayLogo").src = teams.B.logo;
  
  isExtraAction = false;
  matchState = {
    half: 1, actionIndex: 1, scoreA: 0, scoreB: 0, currentAttacker: 'A', advanceLevel: 1,
    isCorner: false, isFromCornerShort: false,
    penalties: { historyA: [], historyB: [], kicksA: 0, kicksB: 0, currentKicker: 'A' }
  };
  
  if (gameMode === 'penalties_only') {
    startPenalties();
    return;
  }
  
  narrate('START');
  
  // No online, Time A sempre começa para manter determinismo inicial.
  matchState.currentAttacker = (gameMode === 'online') ? 'A' : (Math.random() < 0.5 ? 'A' : 'B');
  initTurn();
}

// === FLUXO DE AÇÕES E ENVIOS VIA SOCKET OU IA === //

function submitGameAction(context, move) {
  if (gameMode === 'online') {
    if (!socket || !socket.connected) {
       alert("Erro de conexão com o servidor. A jogada não pôde ser enviada.");
       return;
    }
    showOverlay("Aguardando decisão do adversário...");
    socket.emit('submitMove', { roomId: onlineRoomId, role: onlinePlayerRole, move: move });
  } else {
    // Modo IA
    matchState.pendingAttackMove = null;
    matchState.pendingDefenseMove = null;
    
    const isUserAttacking = (matchState.currentAttacker === 'A');
    
    if (context === 'ADVANCE') {
      if (isUserAttacking) {
        matchState.pendingAttackMove = move;
        matchState.pendingDefenseMove = getIARandomDefense();
      } else {
        matchState.pendingDefenseMove = move;
      }
      resolveAdvance();
    } else if (context === 'CORNER') {
      if (isUserAttacking) {
        matchState.pendingAttackMove = move;
        matchState.pendingDefenseMove = ["OLIMPICO", "MUVUCA", "CURTO"][Math.floor(Math.random() * 3)];
      } else {
        matchState.pendingDefenseMove = move;
      }
      resolveCorner();
    } else if (context === 'DIRECTION') {
      if (isUserAttacking || (matchState.half === 5 && matchState.penalties.currentKicker === 'A')) {
        matchState.pendingAttackMove = move;
        matchState.pendingDefenseMove = ["ESQUERDA", "MEIO", "DIREITA"][Math.floor(Math.random() * 3)];
      } else {
        matchState.pendingDefenseMove = move;
      }
      
      if (matchState.half === 5) {
        resolvePenaltyKick();
      } else {
        resolveDirection();
      }
    }
  }
}

// Funções Helpers para Botões de UI
function submitAttackMove(move) { submitGameAction('ADVANCE', move); }
function submitDefenseMove(move) { submitGameAction('ADVANCE', move); }


function initTurn() {
  updateUI();
  matchState.pendingAttackMove = null;
  matchState.pendingDefenseMove = null;
  hideAllPanels();
  
  if (matchState.half === 5) {
    setupPenaltyKick();
    return;
  }
  
  if (matchState.isCorner) {
    setupCornerTurn();
    return;
  }
  
  if (matchState.advanceLevel === 4) {
    triggerCantos();
    return;
  }
  
  const isMyTurnToAttack = (gameMode === 'online') 
    ? (matchState.currentAttacker === onlinePlayerRole)
    : (matchState.currentAttacker === 'A');

  if (isMyTurnToAttack) {
    showAttackPanel();
  } else {
    if (gameMode === 'ia') {
      matchState.pendingAttackMove = getIARandomAttack();
      showDefensePanel();
    } else if (gameMode === 'online') {
      showDefensePanel();
    }
  }
}

function hideAllPanels() {
  document.getElementById("panel-attack").classList.add("hidden");
  document.getElementById("panel-defense").classList.add("hidden");
  document.getElementById("panel-cantos").classList.add("hidden");
  document.getElementById("panel-corner-attack").classList.add("hidden");
  document.getElementById("panel-corner-defense").classList.add("hidden");
  document.getElementById("panel-tiebreaker").classList.add("hidden");
}

function showAttackPanel() {
  const panel = document.getElementById("panel-attack");
  const btnContainer = document.getElementById("attack-buttons");
  panel.classList.remove("hidden");
  btnContainer.innerHTML = "";
  let options = ["PASSE", "DRIBLE"];
  if (matchState.advanceLevel >= 2) options.push("CHUTE");
  options.forEach(opt => {
    btnContainer.innerHTML += `<button class="action-btn" onclick="submitAttackMove('${opt}')">${opt}</button>`;
  });
}

function showDefensePanel() {
  const panel = document.getElementById("panel-defense");
  const btnContainer = document.getElementById("defense-buttons");
  panel.classList.remove("hidden");
  btnContainer.innerHTML = "";
  let options = ["DIVIDIDA", "INTERCEPTAÇÃO"];
  if (matchState.advanceLevel >= 2) options.push("BLOQUEIO");
  options.forEach(opt => {
    btnContainer.innerHTML += `<button class="action-btn" onclick="submitDefenseMove('${opt}')">${opt}</button>`;
  });
}

function setupCornerTurn() {
  hideAllPanels();
  const isMyTurnToAttack = (gameMode === 'online') 
    ? (matchState.currentAttacker === onlinePlayerRole)
    : (matchState.currentAttacker === 'A');

  if (isMyTurnToAttack) {
    document.getElementById("panel-corner-attack").classList.remove("hidden");
  } else {
    document.getElementById("panel-corner-defense").classList.remove("hidden");
    if (gameMode === 'ia') {
      const opts = ["OLIMPICO", "MUVUCA", "CURTO"];
      matchState.pendingAttackMove = opts[Math.floor(Math.random() * opts.length)];
    }
  }
}

function resolveCorner() {
  const atk = matchState.pendingAttackMove;
  const def = matchState.pendingDefenseMove;
  
  const teams = getActiveTeams();
  const atkName = matchState.currentAttacker === 'A' ? teams.A.name : teams.B.name;
  const defName = matchState.currentAttacker === 'A' ? teams.B.name : teams.A.name;
  
  matchState.isCorner = false;
  matchState.isFromCornerShort = true;
  
  if (atk === def) {
    narrate('CORNER_ANULLED', atkName, defName);
    matchState.isFromCornerShort = false;
    isExtraAction = false;
    nextAction();
  } else {
    if (atk === "OLIMPICO" || atk === "MUVUCA") {
      triggerCantos();
    } else if (atk === "CURTO") {
      narrate('CORNER_CURTO_WIN', atkName, defName);
      matchState.advanceLevel = 3;
      initTurn();
    }
  }
}

function getIARandomAttack() {
  const opts = matchState.advanceLevel === 1 ? ["PASSE", "DRIBLE"] : ["PASSE", "DRIBLE", "CHUTE"];
  return opts[Math.floor(Math.random() * opts.length)];
}

function getIARandomDefense() {
  const opts = matchState.advanceLevel === 1 ? ["DIVIDIDA", "INTERCEPTAÇÃO"] : ["DIVIDIDA", "INTERCEPTAÇÃO", "BLOQUEIO"];
  return opts[Math.floor(Math.random() * opts.length)];
}

function resolveAdvance() {
  const atk = matchState.pendingAttackMove;
  const def = matchState.pendingDefenseMove;
  
  const teams = getActiveTeams();
  const atkName = matchState.currentAttacker === 'A' ? teams.A.name : teams.B.name;
  const defName = matchState.currentAttacker === 'A' ? teams.B.name : teams.A.name;
  
  let defWins = false;
  
  if (def === "DIVIDIDA" && atk === "DRIBLE") { defWins = true; narrate('DIVIDIDA_WIN', atkName, defName); }
  if (def === "INTERCEPTAÇÃO" && atk === "PASSE") { defWins = true; narrate('INTERCEPT_WIN', atkName, defName); }
  if (def === "BLOQUEIO" && atk === "CHUTE") { defWins = true; narrate('BLOCK_WIN', atkName, defName); }
  
  if (defWins) {
    const isLastAction = (matchState.actionIndex === 5);
    const isFirstAdvance = (matchState.advanceLevel === 1);
    matchState.isFromCornerShort = false;
    
    if (isLastAction && isFirstAdvance && !isExtraAction && (matchState.half === 1 || matchState.half === 2)) {
      isExtraAction = true;
      logNarrator(`⚡ CONTRA-ATAQUE EXTRA! ${defName.toUpperCase()} recuperou a bola no último ataque e tem a chance do EXTRA!`);
      
      matchState.currentAttacker = matchState.currentAttacker === 'A' ? 'B' : 'A';
      matchState.advanceLevel = 1;
      initTurn();
    } else {
      isExtraAction = false;
      nextAction();
    }
  } else {
    if (atk === "DRIBLE") narrate('DRIBLE_SUCCESS', atkName, defName);
    else if (atk === "PASSE") narrate('PASSE_SUCCESS', atkName, defName);
    
    if (atk === "CHUTE") {
      triggerCantos();
    } else {
      matchState.advanceLevel++;
      if (matchState.advanceLevel > 3) {
        triggerCantos();
      } else {
        initTurn();
      }
    }
  }
}

function triggerCantos() {
  const teams = getActiveTeams();
  const atkName = matchState.currentAttacker === 'A' ? teams.A.name : teams.B.name;
  const defName = matchState.currentAttacker === 'A' ? teams.B.name : teams.A.name;
  
  if (matchState.half !== 5) {
    narrate('CANTOS', atkName, defName);
  }
  
  document.getElementById("cantosTitle").innerText = "🎯 HORA DO CHUTE! DEFINA O CANTO!";
  
  hideAllPanels();
  document.getElementById("panel-cantos").classList.remove("hidden");
  
  const isMyTurnToAttack = (gameMode === 'online') 
    ? (matchState.currentAttacker === onlinePlayerRole)
    : (matchState.currentAttacker === 'A');

  document.getElementById("cantosSubtitle").innerText = isMyTurnToAttack 
    ? "Escolha a direção da bola no gol:" 
    : "Escolha para onde seu goleiro vai pular:";

  if (gameMode === 'ia' && !isMyTurnToAttack) {
    matchState.pendingAttackMove = ["ESQUERDA", "MEIO", "DIREITA"][Math.floor(Math.random() * 3)];
  }
}

function setupPenaltyKick() {
  const p = matchState.penalties;
  const teams = getActiveTeams();
  const kickerName = p.currentKicker === 'A' ? teams.A.name : teams.B.name;
  const numKick = (p.currentKicker === 'A' ? p.kicksA : p.kicksB) + 1;
  
  document.getElementById("cantosTitle").innerText = `🥅 PÊNALTI DA RODADA ${numKick}: ${kickerName.toUpperCase()}`;
  
  hideAllPanels();
  document.getElementById("panel-cantos").classList.remove("hidden");

  const isMyTurnToAttack = (gameMode === 'online') 
    ? (p.currentKicker === onlinePlayerRole)
    : (p.currentKicker === 'A');

  document.getElementById("cantosSubtitle").innerText = isMyTurnToAttack 
    ? "Escolha onde vai chutar:" 
    : "Escolha onde o seu goleiro vai pular:";

  if ((gameMode === 'ia' || gameMode === 'penalties_only') && p.currentKicker === 'B') {
    matchState.pendingAttackMove = ["ESQUERDA", "MEIO", "DIREITA"][Math.floor(Math.random() * 3)];
  }
}

function resolveDirection() {
  const atkDir = matchState.pendingAttackMove;
  const defDir = matchState.pendingDefenseMove;
  
  const teams = getActiveTeams();
  const atkName = matchState.currentAttacker === 'A' ? teams.A.name : teams.B.name;
  const defName = matchState.currentAttacker === 'A' ? teams.B.name : teams.A.name;
  
  if (atkDir === defDir) {
    if (atkDir === 'MEIO' || matchState.isFromCornerShort) {
      narrate('SAVE_MIDDLE', atkName, defName, atkDir);
      matchState.isFromCornerShort = false;
      isExtraAction = false;
      nextAction();
    } else {
      narrate('SAVE_CORNER', atkName, defName, atkDir);
      matchState.isCorner = true;
      initTurn();
    }
  } else {
    narrate('GOAL', atkName, defName, atkDir);
    if (matchState.currentAttacker === 'A') matchState.scoreA++;
    else matchState.scoreB++;
    
    matchState.isFromCornerShort = false;
    isExtraAction = false;
    nextAction();
  }
}

function resolvePenaltyKick() {
  const p = matchState.penalties;
  const atkDir = matchState.pendingAttackMove;
  const defDir = matchState.pendingDefenseMove;
  
  const teams = getActiveTeams();
  const atkName = p.currentKicker === 'A' ? teams.A.name : teams.B.name;
  const defName = p.currentKicker === 'A' ? teams.B.name : teams.A.name;
  
  const isGoal = (atkDir !== defDir);
  
  if (p.currentKicker === 'A') {
    p.kicksA++;
    p.historyA.push(isGoal);
    if (isGoal) { matchState.scoreA++; narrate('PENALTY_GOAL', atkName, defName, atkDir); }
    else { narrate('PENALTY_SAVE', atkName, defName, atkDir); }
    p.currentKicker = 'B';
  } else {
    p.kicksB++;
    p.historyB.push(isGoal);
    if (isGoal) { matchState.scoreB++; narrate('PENALTY_GOAL', atkName, defName, atkDir); }
    else { narrate('PENALTY_SAVE', atkName, defName, atkDir); }
    p.currentKicker = 'A';
  }
  checkPenaltyWinner();
}

function checkPenaltyWinner() {
  const p = matchState.penalties;
  const kA = p.kicksA;
  const kB = p.kicksB;
  const sA = matchState.scoreA;
  const sB = matchState.scoreB;
  
  if (kA <= 5 && kB <= 5) {
    const remA = 5 - kA;
    const remB = 5 - kB;
    if (sA > sB + remB) { finishMatch(); return; }
    if (sB > sA + remA) { finishMatch(); return; }
  } else if (kA >= 5 && kB >= 5 && kA === kB) {
    if (sA !== sB) {
      finishMatch();
      return;
    }
  }
  initTurn();
}

function nextAction() {
  isExtraAction = false;
  matchState.advanceLevel = 1;
  matchState.isCorner = false;
  matchState.isFromCornerShort = false;
  matchState.actionIndex++;
  
  const maxActions = (matchState.half > 2) ? 3 : 5;
  
  if (matchState.half <= 4) {
    matchState.currentAttacker = (matchState.actionIndex % 2 !== 0) ? (matchState.half % 2 !== 0 ? 'A' : 'B') : (matchState.half % 2 !== 0 ? 'B' : 'A');
  }
  
  if (matchState.actionIndex > maxActions) {
    if (matchState.half === 1) {
      matchState.half = 2;
      matchState.actionIndex = 1;
      matchState.currentAttacker = 'B';
      logNarrator("--- ⏱️ INTERVALO DO JOGO (45') ---");
    } else if (matchState.half === 2) {
      if (matchState.scoreA === matchState.scoreB) {
        hideAllPanels();
        showTiebreakerModal();
        return;
      } else {
        finishMatch();
        return;
      }
    } else if (matchState.half === 3) {
      matchState.half = 4;
      matchState.actionIndex = 1;
      logNarrator("--- ⏱️ FIM DO 1º TEMPO DA PRORROGAÇÃO (105') ---");
    } else if (matchState.half === 4) {
      if (matchState.scoreA === matchState.scoreB) {
        startPenalties();
        return;
      } else {
        finishMatch();
        return;
      }
    }
  }
  initTurn();
}

function showTiebreakerModal() {
  document.getElementById("panel-tiebreaker").classList.remove("hidden");
  if (gameMode === 'online') {
    if (onlinePlayerRole === 'A') {
      document.getElementById("tiebreaker-buttons").classList.remove("hidden");
      document.getElementById("tiebreaker-waiting").classList.add("hidden");
    } else {
      document.getElementById("tiebreaker-buttons").classList.add("hidden");
      document.getElementById("tiebreaker-waiting").classList.remove("hidden");
    }
  } else {
    document.getElementById("tiebreaker-buttons").classList.remove("hidden");
    document.getElementById("tiebreaker-waiting").classList.add("hidden");
  }
}

function handleTiebreakerChoice(choice) {
  if (gameMode === 'online') {
    if (!socket || !socket.connected) {
       alert("Erro de conexão com o servidor. A jogada não pôde ser enviada.");
       return;
    }
    showOverlay("Enviando decisão de desempate...");
    socket.emit('submitTiebreaker', { roomId: onlineRoomId, choice: choice });
  } else {
    resolveTie(choice);
  }
}

function resolveTie(choice) {
  if (choice === 'end') {
    finishMatch();
  } else if (choice === 'extra') {
    matchState.half = 3;
    matchState.actionIndex = 1;
    logNarrator("⏱️ INÍCIO DA PRORROGAÇÃO (90')!");
    initTurn();
  } else if (choice === 'penalties') {
    startPenalties();
  }
}

function startPenalties() {
  matchState.half = 5;
  matchState.scoreA = 0;
  matchState.scoreB = 0;
  matchState.penalties = { historyA: [], historyB: [], kicksA: 0, kicksB: 0, currentKicker: 'A' };
  logNarrator("🚨 FIM DA PARTIDA! VAMOS PARA A DISPUTA DE PÊNALTIS!");
  initTurn();
}

function logNarrator(msg) {
  const box = document.getElementById("narratorLog");
  box.innerHTML += `<div class="narrator-line goal">${msg}</div>`;
  box.scrollTop = box.scrollHeight;
}

function finishMatch() {
  hideAllPanels();
  updateUI();
  if (matchState.half === 5) {
    logNarrator(`🏁 FIM DA DISPUTA DE PÊNALTIS! Placar Final nos Pênaltis: ${matchState.scoreA} x ${matchState.scoreB}`);
  } else {
    logNarrator(`🏁 FIM DE JOGO! Placar Final: ${matchState.scoreA} x ${matchState.scoreB}`);
  }
}

function updateUI() {
  const maxActions = (matchState.half > 2) ? 3 : 5;
  const remainingActions = maxActions - matchState.actionIndex;
  const teams = getActiveTeams();
  
  if (matchState.half === 5) {
    document.getElementById("regularScoreboard").classList.add("hidden");
    document.getElementById("penaltiesScoreboard").classList.remove("hidden");
    document.getElementById("possessionContainer").classList.add("hidden");
    
    document.getElementById("penScoreA").innerText = matchState.scoreA;
    document.getElementById("penScoreB").innerText = matchState.scoreB;
    
    renderPenaltyDots("penHomeDots", matchState.penalties.historyA);
    renderPenaltyDots("penAwayDots", matchState.penalties.historyB);
    return;
  }
  
  document.getElementById("regularScoreboard").classList.remove("hidden");
  document.getElementById("penaltiesScoreboard").classList.add("hidden");
  document.getElementById("possessionContainer").classList.remove("hidden");
  
  document.getElementById("scoreA").innerText = matchState.scoreA;
  document.getElementById("scoreB").innerText = matchState.scoreB;
  document.getElementById("hudMatchTime").innerText = `${getMatchMinute()}'`;
  document.getElementById("actionCounterText").innerText = `Ação ${matchState.actionIndex} de ${maxActions} (${remainingActions} ${remainingActions === 1 ? 'ação restante' : 'ações restantes'} neste tempo)`;
  
  const phases = { 1: "1º Tempo", 2: "2º Tempo", 3: "Prorrogação (1º T)", 4: "Prorrogação (2º T)" };
  document.getElementById("hudMatchPhase").innerText = phases[matchState.half] || "Fim de Jogo";
  
  const homeCard = document.getElementById("hudHomeCard");
  const awayCard = document.getElementById("hudAwayCard");
  const badgeHome = document.getElementById("badgeHomeRole");
  const badgeAway = document.getElementById("badgeAwayRole");
  
  if (matchState.currentAttacker === 'A') {
    homeCard.className = "team-display home attacking";
    awayCard.className = "team-display away defending";
    badgeHome.classList.remove("hidden");
    badgeAway.classList.add("hidden");
    document.getElementById("possessionText").innerText = `Posse de Bola: ${teams.A.name} (Atacando)`;
  } else {
    homeCard.className = "team-display home defending";
    awayCard.className = "team-display away attacking";
    badgeHome.classList.add("hidden");
    badgeAway.classList.remove("hidden");
    document.getElementById("possessionText").innerText = `Posse de Bola: ${teams.B.name} (Atacando)`;
  }
  
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`step${i}`);
    if (stepEl) {
      if (i === matchState.advanceLevel) stepEl.classList.add("active");
      else stepEl.classList.remove("active");
    }
  }
}

function renderPenaltyDots(containerId, history) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const totalDots = Math.max(5, history.length);
  for (let i = 0; i < totalDots; i++) {
    if (i < history.length) {
      const isGoal = history[i];
      container.innerHTML += `<span class="dot ${isGoal ? 'success' : 'fail'}"></span>`;
    } else {
      container.innerHTML += `<span class="dot"></span>`;
    }
  }
}

function quitMatch() {
  if (confirm("Tem certeza que deseja sair da partida e voltar ao menu?")) {
    if (gameMode === 'online') {
      leaveOnlineLobby();
    } else {
      showScreen("screen-setup");
    }
  }
}
