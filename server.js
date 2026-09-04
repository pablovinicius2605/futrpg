// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(express.static(__dirname)); // <-- LINHA ADICIONADA AQUI

const io = new Server(server, { 
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    } 
});

const rooms = {};

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log(`[Socket Conectado] ID: ${socket.id}`);

    // 1. Criar Sala (Host)
    socket.on('createRoom', (teamData) => {
        let roomId = generateRoomCode();
        while (rooms[roomId]) {
            roomId = generateRoomCode();
        }

        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            guestId: null,
            hostTeam: teamData,
            guestTeam: null,
            status: 'LOBBY',
            pendingMoves: { A: null, B: null }
        };

        socket.join(roomId);
        socket.emit('roomCreated', { roomId: roomId, playerRole: 'A', hostTeam: teamData });
        console.log(`[Sala Criada] Código: ${roomId} por Host: ${socket.id}`);
    });

    // 2. Entrar na Sala (Guest)
    socket.on('joinRoom', ({ roomId, teamData }) => {
        const roomCode = roomId.toUpperCase();
        const room = rooms[roomCode];

        if (!room) {
            socket.emit('roomError', 'Sala não encontrada ou código inválido.');
            return;
        }

        if (room.status !== 'LOBBY' || room.guestId !== null) {
            socket.emit('roomError', 'Esta sala já está cheia ou a partida já começou.');
            return;
        }

        room.guestId = socket.id;
        room.guestTeam = teamData;
        socket.join(roomCode);

        // Notifica o Guest (Time B)
        socket.emit('roomJoined', { 
            roomId: roomCode, 
            playerRole: 'B', 
            hostTeam: room.hostTeam,
            guestTeam: room.guestTeam
        });

        // Notifica o Host (Time A) que o Guest entrou
        io.to(room.hostId).emit('guestJoined', {
            guestTeam: room.guestTeam
        });

        console.log(`[Sala Atualizada] Guest: ${socket.id} entrou na sala: ${roomCode}`);
    });

    // 3. Iniciar Partida (Apenas Host)
    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id && room.guestId !== null) {
            room.status = 'PLAYING';
            io.to(roomId).emit('gameStarted');
            console.log(`[Partida Iniciada] Sala: ${roomId}`);
        }
    });

    // 4. Receber e Sincronizar Jogadas (Motor Autoritativo)
    socket.on('submitMove', ({ roomId, role, move }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'PLAYING') return;

        // Armazena a escolha blindada do jogador
        room.pendingMoves[role] = move;

        // Verifica se ambos os jogadores já enviaram suas ações do turno
        if (room.pendingMoves.A !== null && room.pendingMoves.B !== null) {
            const moveA = room.pendingMoves.A;
            const moveB = room.pendingMoves.B;
            
            // Empacota e faz o broadcast simultâneo para resolução no cliente
            io.to(roomId).emit('turnResolved', { moveA, moveB });
            
            // Limpa o estado para o próximo turno
            room.pendingMoves = { A: null, B: null };
            console.log(`[Turno Resolvido] Sala: ${roomId} | A: ${moveA} | B: ${moveB}`);
        }
    });

    // 5. Sincronizar Decisão de Empate (Tiebreaker)
    socket.on('submitTiebreaker', ({ roomId, choice }) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id) {
            io.to(roomId).emit('syncTiebreaker', { choice });
            console.log(`[Desempate Definido] Sala: ${roomId} | Escolha: ${choice}`);
        }
    });

    // 6. Resiliência e Desconexões (Drop-out)
    socket.on('disconnect', () => {
        console.log(`[Socket Desconectado] ID: ${socket.id}`);
        
        // Procura se o jogador estava em alguma sala ativa
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.hostId === socket.id || room.guestId === socket.id) {
                // Emite evento de W.O. para quem ficou na sala
                io.to(roomId).emit('opponentLeft', { 
                    message: 'O adversário perdeu a conexão. Fim de jogo por W.O.!' 
                });
                // Destrói a sala para liberar memória
                delete rooms[roomId];
                console.log(`[Sala Destruída] Código: ${roomId} devido à desconexão.`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Game Engine Autoritativa rodando na porta ${PORT}`);
});