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
let finishTimeout = null;

// DADOS INICIAIS E OPONENTE IA
const defaultOpponent = {
  name: "Rivais FC",
  color: "#f75a68",
  secondaryColor: "#18181b",
  formation: "4-4-2",
  logo: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%23f75a68'><circle cx='12' cy='12' r='10'/></svg>",
  players: ["Goleiro IA", "Zagueiro IA 1", "Zagueiro IA 2", "Lateral D IA", "Lateral E IA", "Volante IA", "Meia IA 1", "Meia IA 2", "Ponta D IA", "Ponta E IA", "Atacante IA"]
};

const leaguesStorageKey = 'futrpg_v1_leagues';
const principalTeamsVersionKey = 'futrpg_principal_teams_2026-09-final';
const principalTeamsVersion = '2026-09-final';
const shieldsStorageKey = 'futrpg_escudos';
let leagueData;
let managerLogoData = '';
let selectedOpponent = null;
let savedShields = loadSavedShields();

function loadSavedShields() {
  try {
    return JSON.parse(localStorage.getItem(shieldsStorageKey)) || {};
  } catch (error) {
    return {};
  }
}

function saveShield(teamId, logo) {
  if (!teamId || !logo) return;
  savedShields[teamId] = logo;
  localStorage.setItem(shieldsStorageKey, JSON.stringify(savedShields));
}

function applySavedShields(leagues) {
  leagues.forEach(league => league.teams.forEach(teamData => {
    if (savedShields[teamData.id]) teamData.logo = savedShields[teamData.id];
  }));
  return leagues;
}

const timesPrincipais2026 = [
  { id: 'fla', nome: 'Flamengo', nivelIa: 'Difícil', cor: '#e11d48', secundaria: '#111827', jogadores: [
    ['Agustín Rossi', 'Goleiro'], ['Andrew', 'Goleiro'], ['Léo Ortiz', 'Zagueiro'], ['Léo Pereira', 'Zagueiro'], ['Vitão', 'Zagueiro'], ['Danilo', 'Zagueiro'], ['Alex Sandro', 'Lateral'], ['Ayrton Lucas', 'Lateral'], ['Emerson Royal', 'Lateral'], ['Guillermo Varela', 'Lateral'], ['Evertton Araújo', 'Volante'], ['Jorginho', 'Volante'], ['Erick Pulgar', 'Volante'], ['Lucas Paquetá', 'Meia'], ['Giorgian de Arrascaeta', 'Meia'], ['Nicolás de la Cruz', 'Meia'], ['Saúl Ñíguez', 'Meia'], ['Jorge Carrascal', 'Meia'], ['Samuel Lino', 'Atacante'], ['Everton Cebolinha', 'Atacante'], ['Gonzalo Plata', 'Atacante'], ['Luiz Araújo', 'Atacante'], ['Pedro', 'Atacante'], ['Bruno Henrique', 'Atacante']
  ] },
  { id: 'pal', nome: 'Palmeiras', nivelIa: 'Difícil', cor: '#15803d', secundaria: '#f4f4f5', jogadores: [
    ['Carlos Miguel', 'Goleiro'], ['Weverton', 'Goleiro'], ['Marcelo Lomba', 'Goleiro'], ['Murilo', 'Zagueiro'], ['Gustavo Gómez', 'Zagueiro'], ['Alexander Barboza', 'Zagueiro'], ['Bruno Fuchs', 'Zagueiro'], ['Joaquín Piquerez', 'Lateral'], ['Jefté', 'Lateral'], ['Agustín Giay', 'Lateral'], ['Khellven', 'Lateral'], ['Marlon Freitas', 'Volante'], ['Emiliano Martínez', 'Volante'], ['Aníbal Moreno', 'Volante'], ['Andreas Pereira', 'Meia'], ['Lucas Evangelista', 'Meia'], ['Mauricio', 'Meia'], ['Felipe Anderson', 'Meia'], ['Jhon Arias', 'Atacante'], ['Paulinho', 'Atacante'], ['Ramón Sosa', 'Atacante'], ['Vitor Roque', 'Atacante'], ['Flaco López', 'Atacante']
  ] },
  { id: 'cru', nome: 'Cruzeiro', nivelIa: 'Difícil', cor: '#2563eb', secundaria: '#f4f4f5', jogadores: [
    ['Cássio', 'Goleiro'], ['Léo Aragão', 'Goleiro'], ['Otávio Costa', 'Goleiro'], ['Fabrício Bruno', 'Zagueiro'], ['Jonathan Jesus', 'Zagueiro'], ['João Marcelo', 'Zagueiro'], ['Lucas Villalba', 'Zagueiro'], ['Gabriel Rojas', 'Lateral'], ['William', 'Lateral'], ['Kauã Moraes', 'Lateral'], ['Zé Lucas', 'Volante'], ['Lucas Romero', 'Volante'], ['Lucas Silva', 'Volante'], ['Gerson', 'Meia'], ['Matheus Henrique', 'Meia'], ['Matheus Pereira', 'Meia'], ['Fabrizio Peralta', 'Meia'], ['Luis Sinisterra', 'Atacante'], ['Keny Arroyo', 'Atacante'], ['Gabriel Pec', 'Atacante'], ['Wanderson', 'Atacante'], ['Kaio Jorge', 'Atacante'], ['Luciano Rodríguez', 'Atacante'], ['Chico da Costa', 'Atacante']
  ] },
  { id: 'cor', nome: 'Corinthians', nivelIa: 'Médio', cor: '#f4f4f5', secundaria: '#111827', jogadores: [
    ['Hugo Souza', 'Goleiro'], ['Felipe Longo', 'Goleiro'], ['João Pedro Tchoca', 'Zagueiro'], ['André Ramalho', 'Zagueiro'], ['Gustavo Henrique', 'Zagueiro'], ['Gabriel Paulista', 'Zagueiro'], ['Matheus Bidu', 'Lateral'], ['Hugo', 'Lateral'], ['Matheuzinho', 'Lateral'], ['Pedro Milans', 'Lateral'], ['Raniele', 'Volante'], ['Allan', 'Volante'], ['Charles', 'Volante'], ['José Martínez', 'Volante'], ['Breno Bidon', 'Meia'], ['André', 'Meia'], ['André Carrillo', 'Meia'], ['Rodrigo Garro', 'Meia'], ['Jesse Lingard', 'Meia'], ['Igor Coronado', 'Meia'], ['Vitinho', 'Atacante'], ['Kaio César', 'Atacante'], ['Yuri Alberto', 'Atacante'], ['Memphis Depay', 'Atacante'], ['Gui Negão', 'Atacante'], ['Pedro Raul', 'Atacante']
  ] },
  { id: 'vas', nome: 'Vasco da Gama', nivelIa: 'Médio', cor: '#f4f4f5', secundaria: '#111827', jogadores: [
    ['Léo Jardim', 'Goleiro'], ['Daniel Fuzato', 'Goleiro'], ['Robert Renan', 'Zagueiro'], ['Carlos Cuesta', 'Zagueiro'], ['Alan Saldivia', 'Zagueiro'], ['Lucas Freitas', 'Zagueiro'], ['Cuiabano', 'Lateral'], ['Lucas Piton', 'Lateral'], ['Paulo Henrique', 'Lateral'], ['José Luis Rodríguez', 'Lateral'], ['Santiago Sosa', 'Volante'], ['Cauan Barros', 'Volante'], ['Thiago Mendes', 'Volante'], ['Mateus Carvalho', 'Volante'], ['Jair', 'Volante'], ['Tchê Tchê', 'Meia'], ['Johan Rojas', 'Meia'], ['Andrés Gómez', 'Atacante'], ['David', 'Atacante'], ['Nuno Moreira', 'Atacante'], ['Marino Hinestroza', 'Atacante'], ['Adson', 'Atacante'], ['Facundo Colidio', 'Atacante'], ['Bruno Duarte', 'Atacante'], ['Brenner', 'Atacante'], ['Claudio Spinelli', 'Atacante']
  ] },
  { id: 'bot', nome: 'Botafogo', nivelIa: 'Difícil', cor: '#111827', secundaria: '#f4f4f5', jogadores: [
    ['Gabriel Batista', 'Goleiro'], ['Warleson', 'Goleiro'], ['Cristhian Loor', 'Goleiro'], ['Nahuel Ferraresi', 'Zagueiro'], ['Kaio', 'Zagueiro'], ['Lucas Monzón', 'Zagueiro'], ['Gabriel Justino', 'Zagueiro'], ['Alex Telles', 'Lateral'], ['Marçal', 'Lateral'], ['Vitinho', 'Lateral'], ['Mateo Ponte', 'Lateral'], ['Domingos Andrade', 'Volante'], ['Allan', 'Volante'], ['Wallace Davi', 'Volante'], ['Danilo', 'Meia'], ['Cristian Medina', 'Meia'], ['Jordan Barrera', 'Meia'], ['Álvaro Montoro', 'Atacante'], ['Matheus Martins', 'Atacante'], ['Júnior Santos', 'Atacante'], ['Lucas Villalba', 'Atacante'], ['Arthur Cabral', 'Atacante'], ['Kadir Barría', 'Atacante'], ['Tiquinho Soares', 'Atacante']
  ] },
  { id: 'flu', nome: 'Fluminense', nivelIa: 'Médio', cor: '#15803d', secundaria: '#facc15', jogadores: [
    ['Fábio', 'Goleiro'], ['Vitor Eudes', 'Goleiro'], ['Marcelo Pitaluga', 'Goleiro'], ['Juan Pablo Freytes', 'Zagueiro'], ['Julián Millán', 'Zagueiro'], ['Jemmes', 'Zagueiro'], ['Ignácio', 'Zagueiro'], ['Igor Rabello', 'Zagueiro'], ['Thiago Silva', 'Zagueiro'], ['Guilherme Arana', 'Lateral'], ['Renê', 'Lateral'], ['Guga', 'Lateral'], ['Samuel Xavier', 'Lateral'], ['Martinelli', 'Volante'], ['Otávio', 'Volante'], ['Hércules', 'Meia'], ['Nonato', 'Meia'], ['Jefferson Savarino', 'Meia'], ['Luciano Acosta', 'Meia'], ['Ganso', 'Meia'], ['Yeferson Soteldo', 'Atacante'], ['Agustín Canobbio', 'Atacante'], ['Kevin Serna', 'Atacante'], ['John Kennedy', 'Atacante'], ['Rodrigo Castillo', 'Atacante'], ['Hulk', 'Atacante'], ['Germán Cano', 'Atacante']
  ] },
  { id: 'cam', nome: 'Atlético Mineiro', nivelIa: 'Médio', cor: '#111827', secundaria: '#facc15', jogadores: [
    ['Everson', 'Goleiro'], ['Pedro Cobra', 'Goleiro'], ['Gabriel Delfim', 'Goleiro'], ['Lyanco', 'Zagueiro'], ['Ruan Tressoldi', 'Zagueiro'], ['Léo Duarte', 'Zagueiro'], ['Vitor Hugo', 'Zagueiro'], ['Renan Lodi', 'Lateral'], ['Natanael', 'Lateral'], ['Angelo Preciado', 'Lateral'], ['Alexsander', 'Volante'], ['Kevin Castaño', 'Volante'], ['Tomás Pérez', 'Volante'], ['Patrick', 'Volante'], ['Victor Hugo', 'Meia'], ['Fred', 'Meia'], ['Alan Franco', 'Meia'], ['Maycon', 'Meia'], ['Gustavo Scarpa', 'Meia'], ['Igor Gomes', 'Meia'], ['Reinier', 'Meia'], ['Tomás Cuello', 'Atacante'], ['Dudu', 'Atacante'], ['Bernard', 'Atacante'], ['Alan Minda', 'Atacante'], ['Mateo Cassierra', 'Atacante'], ['Thiago Borbas', 'Atacante']
  ] },
  { id: 'sao', nome: 'São Paulo', nivelIa: 'Médio', cor: '#e11d48', secundaria: '#f4f4f5', jogadores: [
    ['Carlos Coronel', 'Goleiro'], ['Rafael', 'Goleiro'], ['Young', 'Goleiro'], ['Sabino', 'Zagueiro'], ['Rafael Tolói', 'Zagueiro'], ['Domingos Duarte', 'Zagueiro'], ['Robert Arboleda', 'Zagueiro'], ['Iago', 'Lateral'], ['Enzo Díaz', 'Lateral'], ['Wendell', 'Lateral'], ['Aurélio Buta', 'Lateral'], ['Maik', 'Lateral'], ['Cédric Soares', 'Lateral'], ['Pablo Maia', 'Volante'], ['Newton', 'Volante'], ['Marcos Antônio', 'Meia'], ['Damián Bobadilla', 'Meia'], ['Cauly', 'Meia'], ['Ferreirinha', 'Atacante'], ['Victor Sá', 'Atacante'], ['Artur', 'Atacante'], ['Lucas Moura', 'Atacante'], ['Ryan Francisco', 'Atacante'], ['André Silva', 'Atacante'], ['Jonathan Calleri', 'Atacante'], ['Luciano', 'Atacante']
  ] },
  { id: 'san', nome: 'Santos', nivelIa: 'Fácil', cor: '#f4f4f5', secundaria: '#111827', jogadores: [
    ['Gabriel Brazão', 'Goleiro'], ['João Paulo', 'Goleiro'], ['Diógenes', 'Goleiro'], ['Lucas Veríssimo', 'Zagueiro'], ['Alexis Duarte', 'Zagueiro'], ['Luan Peres', 'Zagueiro'], ['Vinicius Lira', 'Lateral'], ['Gonzalo Escobar', 'Lateral'], ['Gabriel Menino', 'Lateral'], ['Igor Vinícius', 'Lateral'], ['Rodinei', 'Lateral'], ['Arthur Melo', 'Volante'], ['Christian Oliva', 'Volante'], ['Willian Arão', 'Volante'], ['João Schmidt', 'Volante'], ['Gabriel Bontempo', 'Meia'], ['Neymar', 'Meia'], ['Miguelito', 'Meia'], ['Thaciano', 'Meia'], ['Álvaro Barreal', 'Atacante'], ['Moisés', 'Atacante'], ['Benjamín Rollheiser', 'Atacante'], ['Rony', 'Atacante'], ['Gabriel Barbosa', 'Atacante']
  ] },
  { id: 'bah', nome: 'Bahia', nivelIa: 'Médio', cor: '#2563eb', secundaria: '#f4f4f5', jogadores: [
    ['Ronaldo', 'Goleiro'], ['Guido Herrera', 'Goleiro'], ['Léo Vieira', 'Goleiro'], ['Santiago Ramos Mingo', 'Zagueiro'], ['Kanu', 'Zagueiro'], ['David Duarte', 'Zagueiro'], ['Marco Moreno', 'Zagueiro'], ['Luciano Juba', 'Lateral'], ['Román Gómez', 'Lateral'], ['Caio Alexandre', 'Volante'], ['Nicolás Acevedo', 'Volante'], ['Erick', 'Volante'], ['Jean Lucas', 'Meia'], ['Rodrigo Nestor', 'Meia'], ['Everton Ribeiro', 'Meia'], ['Erick Pulga', 'Atacante'], ['Ruan Pablo', 'Atacante'], ['Mateo Sanabria', 'Atacante'], ['Cristian Olivera', 'Atacante'], ['Michel Araújo', 'Atacante'], ['Ademir', 'Atacante'], ['Alejo Veliz', 'Atacante'], ['Dell', 'Atacante'], ['Willian José', 'Atacante'], ['Everaldo', 'Atacante']
  ] },
  { id: 'int', nome: 'Internacional', nivelIa: 'Médio', cor: '#dc2626', secundaria: '#f4f4f5', jogadores: [
    ['Sergio Rochet', 'Goleiro'], ['Anthoni', 'Goleiro'], ['Vitão', 'Zagueiro'], ['Agustín Rogel', 'Zagueiro'], ['Gabriel Mercado', 'Zagueiro'], ['Alexandro Bernabei', 'Lateral'], ['Renê', 'Lateral'], ['Bruno Gomes', 'Lateral'], ['Thiago Maia', 'Volante'], ['Fernando', 'Volante'], ['Rômulo', 'Volante'], ['Paulinho Paula', 'Meia'], ['Bruno Henrique', 'Meia'], ['Alan Patrick', 'Meia'], ['Gabriel Carvalho', 'Meia'], ['Hyoran', 'Meia'], ['Wesley', 'Atacante'], ['Wanderson', 'Atacante'], ['Rafael Borré', 'Atacante'], ['Enner Valencia', 'Atacante'], ['Lucas Alario', 'Atacante']
  ] },
  { id: 'rbb', nome: 'RB Bragantino', nivelIa: 'Médio', cor: '#dc2626', secundaria: '#f4f4f5', jogadores: [
    ['Cleiton', 'Goleiro'], ['Tiago Volpi', 'Goleiro'], ['Pedro Henrique', 'Zagueiro'], ['Gustavo Marques', 'Zagueiro'], ['Guzmán Rodríguez', 'Zagueiro'], ['Alix', 'Zagueiro'], ['Juninho Capixaba', 'Lateral'], ['Vanderlan', 'Lateral'], ["Agustín Sant'Anna", 'Lateral'], ['José Andrés Hurtado', 'Lateral'], ['Fabinho', 'Volante'], ['Matheus Fernandes', 'Volante'], ['Gabriel', 'Volante'], ['Ignacio Sosa', 'Meia'], ['Eric Ramires', 'Meia'], ['Rodriguinho', 'Meia'], ['Praxedes', 'Meia'], ['Henry Mosquera', 'Atacante'], ['Vinicinho', 'Atacante'], ['Lucas Barbosa', 'Atacante'], ['Isidro Pitta', 'Atacante'], ['Eduardo Sasha', 'Atacante'], ['Wallace Yan', 'Atacante']
  ] },
  { id: 'ath', nome: 'Athletico Paranaense', nivelIa: 'Médio', cor: '#e11d48', secundaria: '#111827', jogadores: [
    ['Mycael', 'Goleiro'], ['Santos', 'Goleiro'], ['Arthur Dias', 'Zagueiro'], ['Carlos Terán', 'Zagueiro'], ['Juan Felipe Aguirre', 'Zagueiro'], ['Léo', 'Zagueiro'], ['Lucas Esquivel', 'Lateral'], ['Léo Derik', 'Lateral'], ['Gastón Benavídez', 'Lateral'], ['Gilberto', 'Lateral'], ['Juan Portilla', 'Volante'], ['Felipinho', 'Volante'], ['Jádson', 'Volante'], ['João Cruz', 'Meia'], ['Bruno Zapelli', 'Meia'], ['Chiqueti', 'Meia'], ['Dudu', 'Meia'], ['Isaac', 'Atacante'], ['Stiven Mendoza', 'Atacante'], ['Kerwin Vargas', 'Atacante'], ['Kevin Viveros', 'Atacante'], ['Jorge Rivaldo', 'Atacante']
  ] },
  { id: 'gre', nome: 'Grêmio', nivelIa: 'Médio', cor: '#2563eb', secundaria: '#f4f4f5', jogadores: [
    ['Gabriel Grando', 'Goleiro'], ['Weverton', 'Goleiro'], ['Gustavo Martins', 'Zagueiro'], ['Wagner Leonardo', 'Zagueiro'], ['Fabián Balbuena', 'Zagueiro'], ['Walter Kannemann', 'Zagueiro'], ['Marlon', 'Lateral'], ['Caio Paulista', 'Lateral'], ['João Pedro', 'Lateral'], ['Marcos Rocha', 'Lateral'], ['Mathías Villasanti', 'Volante'], ['Erick Noriega', 'Volante'], ['Danilo Barbosa', 'Volante'], ['Juan Nardoni', 'Meia'], ['Filip Krovinovic', 'Meia'], ['Miguel Monsalve', 'Meia'], ['Francis Amuzu', 'Atacante'], ['Tetê', 'Atacante'], ['Jovane Cabral', 'Atacante'], ['Cristian Pavón', 'Atacante'], ['Carlos Vinícius', 'Atacante'], ['Martin Braithwaite', 'Atacante']
  ] },
  { id: 'vic', nome: 'EC Vitória', nivelIa: 'Fácil', cor: '#e11d48', secundaria: '#111827', jogadores: [
    ['Lucas Arcanjo', 'Goleiro'], ['Muriel', 'Goleiro'], ['Wagner Leonardo', 'Zagueiro'], ['Neris', 'Zagueiro'], ['Camutanga', 'Zagueiro'], ['Lucas Esteves', 'Lateral'], ['Raúl Cáceres', 'Lateral'], ['Willian Oliveira', 'Volante'], ['Luan Santos', 'Volante'], ['Matheusinho', 'Meia'], ['Jean Mota', 'Meia'], ['Osvaldo', 'Atacante'], ['Carlos Eduardo', 'Atacante'], ['Janderson', 'Atacante'], ['Alerrandro', 'Atacante']
  ] },
  { id: 'cfc', nome: 'Coritiba', nivelIa: 'Fácil', cor: '#16a34a', secundaria: '#f4f4f5', jogadores: [
    ['Pedro Morisco', 'Goleiro'], ['Marcelo Benevenuto', 'Zagueiro'], ['Maurício Antônio', 'Zagueiro'], ['Thalisson', 'Zagueiro'], ['Rodrigo Gelado', 'Lateral'], ['Natanael', 'Lateral'], ['Morelli', 'Volante'], ['Vini Paulista', 'Volante'], ['Matheus Frizzo', 'Meia'], ['Sebastian Gómez', 'Meia'], ['Robson', 'Atacante'], ['Lucas Ronier', 'Atacante'], ['Junior Brumado', 'Atacante']
  ] },
  { id: 'mir', nome: 'Mirassol', nivelIa: 'Fácil', cor: '#facc15', secundaria: '#111827', jogadores: [
    ['Alex Muralha', 'Goleiro'], ['João Victor', 'Zagueiro'], ['Luiz Otávio', 'Zagueiro'], ['Gazal', 'Zagueiro'], ['Zeca', 'Lateral'], ['Lucas Ramon', 'Lateral'], ['Neto Moura', 'Volante'], ['Danielzinho', 'Meia'], ['Gabriel', 'Meia'], ['Negueba', 'Atacante'], ['Chico Kim', 'Atacante'], ['Dellatorre', 'Atacante']
  ] },
  { id: 'rem', nome: 'Remo', nivelIa: 'Fácil', cor: '#2563eb', secundaria: '#facc15', jogadores: [
    ['Marcelo Rangel', 'Goleiro'], ['Ligger', 'Zagueiro'], ['Rafael Castro', 'Zagueiro'], ['Sávio', 'Lateral'], ['Vidal', 'Lateral'], ['Jaderson', 'Volante'], ['Giovanni Pavani', 'Meia'], ['Marco Antônio', 'Meia'], ['Pedro Vitor', 'Atacante'], ['Kelvin', 'Atacante'], ['Rodrigo Alves', 'Atacante'], ['Ytalo', 'Atacante']
  ] },
  { id: 'cha', nome: 'Chapecoense', nivelIa: 'Fácil', cor: '#16a34a', secundaria: '#f4f4f5', jogadores: [
    ['Léo Vieira', 'Goleiro'], ['Bruno Leonardo', 'Zagueiro'], ['Rodrigo Moledo', 'Zagueiro'], ['Mancha', 'Lateral'], ['Maílton', 'Lateral'], ['Foguinho', 'Volante'], ['Tarik', 'Volante'], ['Giovanni Augusto', 'Meia'], ['Marcinho', 'Atacante'], ['Ítalo', 'Atacante'], ['Mário Sérgio', 'Atacante'], ['Perotti', 'Atacante']
  ] }
];

function createPrincipalTeam(teamData) {
  const roster = teamData.jogadores.map(([nome, posicao]) => ({ nome, posicao }));
  return {
    id: teamData.id,
    nome: teamData.nome,
    name: teamData.nome,
    liga: 'Brasileirão Série A',
    nivelIa: teamData.nivelIa,
    color: teamData.cor,
    secondaryColor: teamData.secundaria,
    formation: '4-3-3',
    logo: savedShields[teamData.id] || createTeamLogo(teamData.cor),
    jogadores: roster,
    roster,
    players: roster.map(player => player.nome),
    aiDifficulty: teamData.nivelIa
  };
}

function getDefaultLeagues() {
  return [{
    id: 'brasileirao-serie-a',
    name: 'Brasileirão Série A',
    teams: timesPrincipais2026.map(createPrincipalTeam)
  }];
}

function createManagedTeam(name, color, secondaryColor, formation) {
  const players = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Ponta', 'Atacante'];
  return {
    id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color,
    secondaryColor,
    formation,
    logo: createTeamLogo(color),
    players,
    roster: players.map((player, index) => ({ nome: player, posicao: index === 0 ? 'GOL' : 'LINHA' }))
  };
}

function createTeamLogo(color) {
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}'><path d='M12 2L3 6v5c0 5.5 3.8 9.8 9 11 5.2-1.2 9-5.5 9-11V6l-9-4z'/></svg>`;
}

function loadLeagueData() {
  try {
    const saved = JSON.parse(localStorage.getItem(leaguesStorageKey));
    if (Array.isArray(saved) && saved.length) {
      if (localStorage.getItem(principalTeamsVersionKey) !== principalTeamsVersion) {
        const principalLeague = getDefaultLeagues()[0];
        const customLeagues = saved.filter(league => league.id !== principalLeague.id && league.name !== 'Brasileirão Série A');
        const legacyLeague = saved.find(league => league.id === principalLeague.id || league.name === 'Brasileirão Série A');
        const legacyCustomTeams = legacyLeague?.teams?.filter(teamData => !['fla', 'pal', 'cru', 'cor', 'vas', 'bot', 'flu', 'cam', 'sao', 'san', 'bah', 'int', 'fortaleza'].includes(teamData.id)) || [];
        principalLeague.teams.push(...legacyCustomTeams.filter(teamData => !principalLeague.teams.some(current => current.id === teamData.id)));
        localStorage.setItem(principalTeamsVersionKey, principalTeamsVersion);
        const migrated = applySavedShields([principalLeague, ...customLeagues]);
        localStorage.setItem(leaguesStorageKey, JSON.stringify(migrated));
        return migrated;
      }
      return applySavedShields(saved);
    }
  } catch (error) {
    console.warn('Não foi possível carregar as ligas salvas.', error);
  }
  const defaults = getDefaultLeagues();
  localStorage.setItem(leaguesStorageKey, JSON.stringify(defaults));
  localStorage.setItem(principalTeamsVersionKey, principalTeamsVersion);
  return applySavedShields(defaults);
}

leagueData = loadLeagueData();

function saveLeagueData() {
  localStorage.setItem(leaguesStorageKey, JSON.stringify(leagueData));
}

function getTeamRoster(teamData) {
  if (Array.isArray(teamData.roster) && teamData.roster.length) {
    return teamData.roster.map(player => ({
      nome: player.nome || player.name || '',
      posicao: player.posicao || player.position || 'LINHA'
    }));
  }
  return (teamData.players || []).map(nome => ({ nome, posicao: 'LINHA' }));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

let team = {
  name: "Meu Time FC",
  color: "#00b37e",
  formation: "4-3-3",
  logo: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%2300b37e'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>",
  players: ["Goleiro", "Zagueiro 1", "Zagueiro 2", "Lateral D", "Lateral E", "Volante", "Meia 1", "Meia 2", "Ponta D", "Ponta E", "Atacante"]
};

let gameMode = 'ia'; // 'ia', 'penalties_only', 'online'
let aiDifficulty = 'medium';
let isExtraAction = false;

const aiDifficultySettings = {
  easy: {
    attackWeights: { PASSE: 0.45, DRIBLE: 0.45, CHUTE: 0.10 },
    defenseWeights: { DIVIDIDA: 0.45, INTERCEPTAÇÃO: 0.45, BLOQUEIO: 0.10 },
    cornerWeights: { OLIMPICO: 0.25, MUVUCA: 0.35, CURTO: 0.40 },
    directionWeights: { ESQUERDA: 0.25, MEIO: 0.50, DIREITA: 0.25 }
  },
  medium: {
    attackWeights: { PASSE: 0.35, DRIBLE: 0.35, CHUTE: 0.30 },
    defenseWeights: { DIVIDIDA: 0.35, INTERCEPTAÇÃO: 0.35, BLOQUEIO: 0.30 },
    cornerWeights: { OLIMPICO: 0.34, MUVUCA: 0.33, CURTO: 0.33 },
    directionWeights: { ESQUERDA: 0.34, MEIO: 0.32, DIREITA: 0.34 }
  },
  hard: {
    attackWeights: { PASSE: 0.30, DRIBLE: 0.30, CHUTE: 0.40 },
    defenseWeights: { DIVIDIDA: 0.30, INTERCEPTAÇÃO: 0.30, BLOQUEIO: 0.40 },
    cornerWeights: { OLIMPICO: 0.40, MUVUCA: 0.35, CURTO: 0.25 },
    directionWeights: { ESQUERDA: 0.40, MEIO: 0.20, DIREITA: 0.40 }
  }
};

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
  },
  goalsA: [],
  goalsB: [],
  playerHistory: { attack: [], defense: [], direction: [], corner: [] },
  aiHistory: { attack: [], defense: [], direction: [], corner: [] }
};

window.onload = () => {
  loadTeam();
  renderPlayerInputs();
  populateLeagueSelectors();

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

function openLeagueManager() {
  showScreen('screen-leagues');
  renderLeagueManager();
}

function renderLeagueManager() {
  renderLeagueList();
  populateManagerLeagueSelector();
  renderTeamCatalog();
  if (!document.getElementById('rosterEditor').children.length) resetTeamForm();
}

function renderLeagueList() {
  const list = document.getElementById('leagueList');
  if (!list) return;
  list.innerHTML = leagueData.map(league => `
    <button class="${league.id === document.getElementById('managerLeagueSelect')?.value ? 'active' : ''}" onclick="selectManagerLeague('${league.id}')">
      ${escapeHtml(league.name)} <span>(${league.teams.length})</span>
    </button>
    <button class="btn-danger compact-button" onclick="deleteLeague('${league.id}')">Excluir liga</button>
  `).join('');
}

function populateManagerLeagueSelector(selectedId) {
  const select = document.getElementById('managerLeagueSelect');
  if (!select) return;
  const currentId = selectedId || select.value || leagueData[0]?.id;
  select.innerHTML = leagueData.map(league => `<option value="${league.id}">${escapeHtml(league.name)}</option>`).join('');
  if (leagueData.some(league => league.id === currentId)) select.value = currentId;
}

function populateLeagueSelectors() {
  const select = document.getElementById('aiLeagueSelect');
  if (!select) return;
  const currentId = select.value || leagueData[0]?.id;
  select.innerHTML = leagueData.map(league => `<option value="${league.id}">${escapeHtml(league.name)}</option>`).join('');
  if (leagueData.some(league => league.id === currentId)) select.value = currentId;
  updateOpponentSelector();
}

function updateOpponentSelector() {
  const leagueSelect = document.getElementById('aiLeagueSelect');
  const opponentSelect = document.getElementById('aiOpponentSelect');
  if (!leagueSelect || !opponentSelect) return;
  const league = leagueData.find(item => item.id === leagueSelect.value) || leagueData[0];
  opponentSelect.innerHTML = (league?.teams || []).map(teamData => `<option value="${teamData.id}">${escapeHtml(teamData.name)}</option>`).join('');
  selectedOpponent = league?.teams[0] || null;
}

function selectOpponent() {
  const league = leagueData.find(item => item.id === document.getElementById('aiLeagueSelect')?.value);
  selectedOpponent = league?.teams.find(teamData => teamData.id === document.getElementById('aiOpponentSelect')?.value) || league?.teams[0] || null;
}

function createLeague() {
  const input = document.getElementById('leagueNameInput');
  const name = input.value.trim();
  if (!name) return;
  const league = { id: `league-${Date.now()}`, name, teams: [] };
  leagueData.push(league);
  saveLeagueData();
  input.value = '';
  renderLeagueManager();
  populateLeagueSelectors();
  document.getElementById('managerLeagueSelect').value = league.id;
}

function selectManagerLeague(leagueId) {
  populateManagerLeagueSelector(leagueId);
  renderLeagueList();
  resetTeamForm();
}

function deleteLeague(leagueId) {
  if (leagueData.length === 1) {
    alert('Mantenha pelo menos uma liga cadastrada.');
    return;
  }
  const league = leagueData.find(item => item.id === leagueId);
  if (!league || !confirm(`Excluir a liga ${league.name} e seus times?`)) return;
  leagueData = leagueData.filter(item => item.id !== leagueId);
  saveLeagueData();
  renderLeagueManager();
  populateLeagueSelectors();
}

function renderTeamCatalog() {
  const catalog = document.getElementById('teamCatalog');
  const count = document.getElementById('teamCatalogCount');
  if (!catalog) return;
  const teams = leagueData.flatMap(league => league.teams.map(teamData => ({ ...teamData, leagueName: league.name })));
  count.innerText = `${teams.length} time${teams.length === 1 ? '' : 's'}`;
  catalog.innerHTML = teams.map(teamData => `
    <div class="team-catalog-item" style="--team-primary:${escapeHtml(teamData.color)}">
      <img src="${escapeHtml(teamData.logo)}" alt="Escudo de ${escapeHtml(teamData.name)}" />
      <div class="team-catalog-info"><strong>${escapeHtml(teamData.name)}</strong><small>${escapeHtml(teamData.leagueName)} · ${getTeamRoster(teamData).length} jogadores</small></div>
      <div class="team-catalog-actions">
        <button class="btn-secondary" onclick="editManagedTeam('${teamData.id}')">Editar</button>
        <button class="btn-danger" onclick="deleteManagedTeam('${teamData.id}')">Excluir</button>
      </div>
    </div>
  `).join('') || '<p class="subtitle">Nenhum time cadastrado ainda.</p>';
}

function addRosterRow(player = {}) {
  const editor = document.getElementById('rosterEditor');
  const row = document.createElement('div');
  row.className = 'roster-row';
  row.innerHTML = `<input class="roster-name" type="text" placeholder="Nome" value="${escapeHtml(player.nome || player.name)}"><input class="roster-position" type="text" placeholder="Posição" value="${escapeHtml(player.posicao || player.position)}"><button type="button" onclick="this.parentElement.remove()">Remover</button>`;
  editor.appendChild(row);
}

function resetTeamForm() {
  document.getElementById('editingTeamId').value = '';
  document.getElementById('teamFormTitle').innerText = 'Novo time';
  document.getElementById('managerTeamName').value = '';
  document.getElementById('managerPrimaryColor').value = '#00b37e';
  document.getElementById('managerSecondaryColor').value = '#f4f4f5';
  document.getElementById('managerLogoUrl').value = '';
  managerLogoData = '';
  document.getElementById('managerLogoPreview').src = createTeamLogo('#00b37e');
  const editor = document.getElementById('rosterEditor');
  editor.innerHTML = '';
  ['Goleiro', 'Defensor', 'Meia', 'Atacante'].forEach((nome, index) => addRosterRow({ nome, posicao: index === 0 ? 'GOL' : 'LINHA' }));
}

function editManagedTeam(teamId) {
  const league = leagueData.find(item => item.teams.some(teamData => teamData.id === teamId));
  const teamData = league?.teams.find(item => item.id === teamId);
  if (!teamData) return;
  document.getElementById('editingTeamId').value = teamId;
  document.getElementById('teamFormTitle').innerText = 'Editar time';
  document.getElementById('managerLeagueSelect').value = league.id;
  document.getElementById('managerTeamName').value = teamData.name;
  document.getElementById('managerPrimaryColor').value = teamData.color;
  document.getElementById('managerSecondaryColor').value = teamData.secondaryColor || '#f4f4f5';
  document.getElementById('managerLogoUrl').value = teamData.logo.startsWith('data:') ? '' : teamData.logo;
  managerLogoData = teamData.logo.startsWith('data:') ? teamData.logo : '';
  document.getElementById('managerLogoPreview').src = teamData.logo;
  document.getElementById('rosterEditor').innerHTML = '';
  getTeamRoster(teamData).forEach(addRosterRow);
  document.getElementById('managerTeamName').focus();
}

function saveManagedTeam() {
  const league = leagueData.find(item => item.id === document.getElementById('managerLeagueSelect').value);
  const name = document.getElementById('managerTeamName').value.trim();
  const rows = [...document.querySelectorAll('#rosterEditor .roster-row')];
  const roster = rows.map(row => ({
    nome: row.querySelector('.roster-name').value.trim(),
    posicao: row.querySelector('.roster-position').value.trim() || 'LINHA'
  })).filter(player => player.nome);
  if (!league || !name || !roster.length) {
    alert('Informe o nome do time e pelo menos um jogador.');
    return;
  }
  const editingId = document.getElementById('editingTeamId').value;
  const logo = document.getElementById('managerLogoUrl').value.trim() || managerLogoData || createTeamLogo(document.getElementById('managerPrimaryColor').value);
  const teamData = { id: editingId || `team-${Date.now()}`, name, color: document.getElementById('managerPrimaryColor').value, secondaryColor: document.getElementById('managerSecondaryColor').value, formation: '4-4-2', logo, roster, players: roster.map(player => player.nome) };
  const previousLeague = leagueData.find(item => item.teams.some(itemTeam => itemTeam.id === teamData.id));
  if (previousLeague) previousLeague.teams = previousLeague.teams.filter(itemTeam => itemTeam.id !== teamData.id);
  league.teams.push(teamData);
  saveShield(teamData.id, logo);
  saveLeagueData();
  renderLeagueManager();
  populateLeagueSelectors();
  resetTeamForm();
}

function deleteManagedTeam(teamId) {
  const league = leagueData.find(item => item.teams.some(teamData => teamData.id === teamId));
  if (!league || !confirm('Excluir este time?')) return;
  league.teams = league.teams.filter(teamData => teamData.id !== teamId);
  saveLeagueData();
  renderLeagueManager();
  populateLeagueSelectors();
}

function handleManagerLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    managerLogoData = reader.result;
    const editingId = document.getElementById('editingTeamId').value;
    if (editingId) saveShield(editingId, managerLogoData);
    document.getElementById('managerLogoPreview').src = managerLogoData;
  };
  reader.readAsDataURL(file);
}

function renderPlayerInputs() {
  const container = document.getElementById("playersInput");
  if (!container) return;
  container.innerHTML = "";
  team.players.forEach((p, i) => {
    container.innerHTML += `<input type="text" class="p-name" value="${p}" placeholder="Jogador ${i+1}">`;
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
  if (mode === 'ia' || mode === 'penalties_only') {
    aiDifficulty = document.getElementById('aiDifficulty')?.value || 'medium';
    selectOpponent();
  }
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
      alert("ATENÇÃO: Você está acessando o jogo por um arquivo local. Para o multiplayer funcionar entre dois PCs, AMBOS precisam acessar a mesma URL do Render.");
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
  if (finishTimeout) clearTimeout(finishTimeout);
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
      B: selectedOpponent || defaultOpponent
    };
  }
}

function narrate(type, atkTeamName, defTeamName, dir) {
  const box = document.getElementById("narratorLog");
  const min = getMatchMinute();
  let text = "";
  let cssClass = "narrator-line";
  
  const teams = getActiveTeams();
  document.documentElement.style.setProperty('--home-color', teams.A.color || '#00b37e');
  document.documentElement.style.setProperty('--home-secondary-color', teams.A.secondaryColor || '#18181b');
  document.documentElement.style.setProperty('--away-color', teams.B.color || '#f75a68');
  document.documentElement.style.setProperty('--away-secondary-color', teams.B.secondaryColor || '#18181b');
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
      if (isHomeAtk) matchState.goalsA.push({ player: pAtk, time: min + "'" });
      else matchState.goalsB.push({ player: pAtk, time: min + "'" });
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
      if (isHomeAtk) matchState.goalsA.push({ player: pAtk, time: "Pênalti" });
      else matchState.goalsB.push({ player: pAtk, time: "Pênalti" });
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
  if (finishTimeout) clearTimeout(finishTimeout);
  
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
    penalties: { historyA: [], historyB: [], kicksA: 0, kicksB: 0, currentKicker: 'A' },
    goalsA: [],
    goalsB: [],
    playerHistory: { attack: [], defense: [], direction: [], corner: [] },
    aiHistory: { attack: [], defense: [], direction: [], corner: [] }
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
    const isUserAttacking = (matchState.currentAttacker === 'A');
    recordPlayerChoice(context, move);
    
    if (context === 'ADVANCE') {
      if (isUserAttacking) {
        matchState.pendingAttackMove = move;
      } else {
        matchState.pendingDefenseMove = move;
      }
    } else if (context === 'CORNER') {
      if (isUserAttacking) {
        matchState.pendingAttackMove = move;
      } else {
        matchState.pendingDefenseMove = move;
      }
    } else if (context === 'DIRECTION') {
      if (isUserAttacking || (matchState.half === 5 && matchState.penalties.currentKicker === 'A')) {
        matchState.pendingAttackMove = move;
      } else {
        matchState.pendingDefenseMove = move;
      }
    }

    if (context === 'ADVANCE') resolveAdvance();
    else if (context === 'CORNER') resolveCorner();
    else if (matchState.half === 5) resolvePenaltyKick();
    else resolveDirection();
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
    if (gameMode === 'ia') {
      matchState.pendingDefenseMove = getIARandomDefense();
      recordAIChoice('defense', matchState.pendingDefenseMove);
    }
    showAttackPanel();
  } else {
    if (gameMode === 'ia') {
      matchState.pendingAttackMove = getIARandomAttack();
      recordAIChoice('attack', matchState.pendingAttackMove);
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
    if (gameMode === 'ia') {
      const opts = ["OLIMPICO", "MUVUCA", "CURTO"];
      matchState.pendingDefenseMove = getAIAction(opts, 'cornerWeights', matchState.aiHistory.corner, matchState.playerHistory.corner, {
        OLIMPICO: 'OLIMPICO',
        MUVUCA: 'MUVUCA',
        CURTO: 'CURTO'
      });
      recordAIChoice('corner', matchState.pendingDefenseMove);
    }
    document.getElementById("panel-corner-attack").classList.remove("hidden");
  } else {
    document.getElementById("panel-corner-defense").classList.remove("hidden");
    if (gameMode === 'ia') {
      const opts = ["OLIMPICO", "MUVUCA", "CURTO"];
      matchState.pendingAttackMove = getAIAction(opts, 'cornerWeights', matchState.aiHistory.corner, matchState.playerHistory.corner, {
        OLIMPICO: 'MUVUCA',
        MUVUCA: 'CURTO',
        CURTO: 'OLIMPICO'
      });
      recordAIChoice('corner', matchState.pendingAttackMove);
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
  const move = getAIAction(opts, 'attackWeights', matchState.aiHistory.attack, matchState.playerHistory.defense, {
    DIVIDIDA: 'PASSE',
    INTERCEPTAÇÃO: 'DRIBLE',
    BLOQUEIO: 'PASSE'
  });
  return move;
}

function getIARandomDefense() {
  const opts = matchState.advanceLevel === 1 ? ["DIVIDIDA", "INTERCEPTAÇÃO"] : ["DIVIDIDA", "INTERCEPTAÇÃO", "BLOQUEIO"];
  return getAIAction(opts, 'defenseWeights', matchState.aiHistory.defense, matchState.playerHistory.attack, {
    DRIBLE: 'DIVIDIDA',
    PASSE: 'INTERCEPTAÇÃO',
    CHUTE: 'BLOQUEIO'
  });
}

function getAIChoice(options, weightKey) {
  const settings = aiDifficultySettings[aiDifficulty] || aiDifficultySettings.medium;
  const weights = settings[weightKey];
  const availableOptions = options.filter(option => weights[option] !== undefined);
  const totalWeight = availableOptions.reduce((total, option) => total + weights[option], 0);
  let randomValue = Math.random() * totalWeight;

  for (const option of availableOptions) {
    randomValue -= weights[option];
    if (randomValue < 0) return option;
  }

  return options[Math.floor(Math.random() * options.length)];
}

function getAIAction(options, weightKey, ownHistory, playerHistory, counterMoves) {
  const recentOwnMove = ownHistory[ownHistory.length - 1];
  const settings = aiDifficultySettings[aiDifficulty] || aiDifficultySettings.medium;

  if (aiDifficulty === 'easy' && options.includes(recentOwnMove) && Math.random() < 0.65) {
    return recentOwnMove;
  }

  if (aiDifficulty === 'hard' && playerHistory.length > 0) {
    const recentPlayerMoves = playerHistory.slice(-5);
    const counts = recentPlayerMoves.reduce((result, move) => {
      result[move] = (result[move] || 0) + 1;
      return result;
    }, {});
    const predictedMove = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const counterMove = counterMoves[predictedMove];

    if (options.includes(counterMove) && Math.random() < 0.75) {
      return counterMove;
    }
  }

  if (aiDifficulty === 'medium' && options.length > 1 && options.includes(recentOwnMove) && Math.random() < 0.35) {
    const alternatives = options.filter(option => option !== recentOwnMove);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  return getAIChoice(options, weightKey);
}

function recordHistory(history, move) {
  history.push(move);
  if (history.length > 10) history.shift();
}

function recordAIChoice(type, move) {
  recordHistory(matchState.aiHistory[type], move);
}

function recordPlayerChoice(context, move) {
  if (context === 'ADVANCE') {
    const type = matchState.currentAttacker === 'A' ? 'attack' : 'defense';
    recordHistory(matchState.playerHistory[type], move);
  } else if (context === 'DIRECTION') {
    recordHistory(matchState.playerHistory.direction, move);
  } else if (context === 'CORNER') {
    recordHistory(matchState.playerHistory.corner, move);
  }
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

  const directions = ["ESQUERDA", "MEIO", "DIREITA"];
  if (gameMode === 'ia' && isMyTurnToAttack) {
    matchState.pendingDefenseMove = getAIAction(directions, 'directionWeights', matchState.aiHistory.direction, matchState.playerHistory.direction, {
      ESQUERDA: 'ESQUERDA',
      MEIO: 'MEIO',
      DIREITA: 'DIREITA'
    });
    recordAIChoice('direction', matchState.pendingDefenseMove);
  } else if (gameMode === 'ia') {
    matchState.pendingAttackMove = getAIAction(directions, 'directionWeights', matchState.aiHistory.direction, matchState.playerHistory.direction, {
      ESQUERDA: 'DIREITA',
      MEIO: 'ESQUERDA',
      DIREITA: 'MEIO'
    });
    recordAIChoice('direction', matchState.pendingAttackMove);
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
    const directions = ["ESQUERDA", "MEIO", "DIREITA"];
    matchState.pendingAttackMove = getAIAction(directions, 'directionWeights', matchState.aiHistory.direction, matchState.playerHistory.direction, {
      ESQUERDA: 'DIREITA',
      MEIO: 'ESQUERDA',
      DIREITA: 'MEIO'
    });
    recordAIChoice('direction', matchState.pendingAttackMove);
  } else if ((gameMode === 'ia' || gameMode === 'penalties_only') && p.currentKicker === 'A') {
    const directions = ["ESQUERDA", "MEIO", "DIREITA"];
    matchState.pendingDefenseMove = getAIAction(directions, 'directionWeights', matchState.aiHistory.direction, matchState.playerHistory.direction, {
      ESQUERDA: 'ESQUERDA',
      MEIO: 'MEIO',
      DIREITA: 'DIREITA'
    });
    recordAIChoice('direction', matchState.pendingDefenseMove);
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

  // Espera 3.5 segundos para o jogador ler a narração final antes de mostrar o resumo
  finishTimeout = setTimeout(() => {
    showSummaryScreen();
  }, 3500);
}

function showSummaryScreen() {
  showScreen('screen-summary');
  const teams = getActiveTeams();
  
  document.getElementById('sumTeamA_Name').innerText = teams.A.name;
  document.getElementById('sumTeamA_Logo').src = teams.A.logo;
  document.getElementById('sumScoreA').innerText = matchState.scoreA;
  
  document.getElementById('sumTeamB_Name').innerText = teams.B.name;
  document.getElementById('sumTeamB_Logo').src = teams.B.logo;
  document.getElementById('sumScoreB').innerText = matchState.scoreB;
  
  const goalsA_HTML = matchState.goalsA.map(g => `<div>⚽ ${g.player} <span style="color:var(--gold); font-size:0.85rem;">(${g.time})</span></div>`).join('');
  document.getElementById('sumGoalsA').innerHTML = goalsA_HTML || '<div style="color:#71717a; text-align:center;">Nenhum gol</div>';
  
  const goalsB_HTML = matchState.goalsB.map(g => `<div>⚽ ${g.player} <span style="color:var(--gold); font-size:0.85rem;">(${g.time})</span></div>`).join('');
  document.getElementById('sumGoalsB').innerHTML = goalsB_HTML || '<div style="color:#71717a; text-align:center;">Nenhum gol</div>';

  if (gameMode === 'online') {
      if (onlinePlayerRole === 'A') {
          document.getElementById('btn-play-again').classList.remove('hidden');
          document.getElementById('sum-waiting-host').classList.add('hidden');
      } else {
          document.getElementById('btn-play-again').classList.add('hidden');
          document.getElementById('sum-waiting-host').classList.remove('hidden');
      }
  } else {
      document.getElementById('btn-play-again').classList.remove('hidden');
      document.getElementById('sum-waiting-host').classList.add('hidden');
  }
}

function playAgain() {
    if (gameMode === 'online') {
        if (!socket || !socket.connected) return;
        document.getElementById('btn-play-again').classList.add('hidden');
        document.getElementById('sum-waiting-host').innerText = "Reiniciando a partida...";
        document.getElementById('sum-waiting-host').classList.remove('hidden');
        socket.emit('playAgain', onlineRoomId);
    } else {
        startMode(gameMode);
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
  if (confirm("Tem certeza que deseja sair e voltar ao menu?")) {
    if (gameMode === 'online') {
      leaveOnlineLobby();
    } else {
      if (finishTimeout) clearTimeout(finishTimeout);
      showScreen("screen-setup");
    }
  }
}
