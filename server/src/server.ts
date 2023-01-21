import {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
    SocketParameterType,
    EVENTS,
} from '@paint-and-guess/lib/socket';
import express from 'express';
import cors from 'cors';
import * as http from 'http';
import { Message, Player } from '@paint-and-guess/lib/models';
import { Server, Socket } from 'socket.io';
import { Game } from './game';
import { InMemoryDatabase } from './in-memory-db';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import * as crypto from 'crypto';

export class AppServer {
    private app: express.Application;
    private server: http.Server;
    private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData<SocketParameterType>>;
    private serverPort: string | number;

    private drawingPlayerSocket: Socket<ClientToServerEvents, ServerToClientEvents>;

    private game: Game = new Game(this);

    private roomId: string;

    constructor() {
        this.createApp();
        this.config();
        this.createServer();
        this.sockets();
        this.listen();
        this.events();
        this.loadWords();
    }

    private loadWords() {
        const words: string[] = [
            'Strawberry',
            'Eclipse',
            'Chandelier',
            'Ketchup',
            'Toothpaste',
            'Rainbow',
            'Boardgame',
            'Beehive',
            'Lemon',
            'Wreath',
            'Waffles',
            'Bubble',
            'Whistle',
            'Snowball',
            'Bouquet',
            'Headphones',
            'Fireworks',
            'Igloo',
            'Lawnmower',
            'Summer',
            'Whisk',
            'Cupcake',
            'Bruise',
            'Fog',
            'Crust',
            'Battery',
            'Frog',
            'Monkey',
        ];

        InMemoryDatabase.client.SADD('words', words).then();
    }

    private createApp(): void {
        this.app = express();
        this.app.use(
            cors({
                origin: '*',
            })
        );
    }

    private config(): void {
        require('dotenv').config();

        this.serverPort = process.env.SERVER_PORT!;

        this.roomId = 'room:' + crypto.randomUUID();
    }

    private createServer(): void {
        this.server = http.createServer(this.app);
    }

    private sockets(): void {
        this.io = new Server<
            ClientToServerEvents,
            ServerToClientEvents,
            InterServerEvents,
            SocketData<SocketParameterType>
        >(this.server, {
            cors: {
                origin: '*',
            },
        });

        const pubClient = createClient({
            socket: {
                host: process.env.REDIS_HOST!,
                port: Number(process.env.REDIS_PORT!),
            },
            username: process.env.REDIS_USERNAME!,
            password: process.env.REDIS_PASSWORD!,
            legacyMode: false,
        });

        const subClient = pubClient.duplicate();

        Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
            this.io.adapter(createAdapter(pubClient, subClient));
        });
    }

    private listen(): void {
        this.server.listen(this.serverPort, () => {
            console.log('Running http server on port %s', this.serverPort);
        });
    }

    public revealWord(word: string): void {
        this.drawingPlayerSocket.to(this.roomId).emit(EVENTS.FROM_SERVER.WORD_REVEAL, word);
    }

    public emitTime(seconds: number): void {
        this.io.local.emit(EVENTS.FROM_SERVER.TIME, seconds);
        if (seconds === 0) {
            this.io.local.emit(EVENTS.FROM_SERVER.STOP);
        }
    }

    private events(): void {
        this.io.on(EVENTS.FROM_CLIENT.CONNECT, (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
            socket.join(this.roomId);

            this.io.local.emit(EVENTS.FROM_SERVER.ONLINE_PLAYERS, Array.from(this.game.players.values()));

            InMemoryDatabase.client.LRANGE('chat', 0, 10).then(messages => {
                const messageHistory: Message[] = messages.map(messageString => JSON.parse(messageString)).reverse();

                socket.emit(EVENTS.FROM_SERVER.MESSAGE_HISTORY, messageHistory);
            });

            socket.on(EVENTS.FROM_CLIENT.PLAYER_JOIN, async name => {
                console.log(`Player ${socket.id}: ${name} connected`);

                const score = await InMemoryDatabase.client.ZSCORE('players', name);

                const newPlayer: Player = {
                    id: socket.id,
                    name: name,
                    score: score ?? 0,
                };

                if (score === null) {
                    await InMemoryDatabase.client.ZADD('players', {
                        value: newPlayer.name,
                        score: newPlayer.score,
                    });
                }

                this.game.players.set(socket.id, newPlayer);

                const leaderBoard = await InMemoryDatabase.client.ZRANGE_WITHSCORES('players', 0, -1, { REV: true });

                this.io.local.emit(
                    EVENTS.FROM_SERVER.LEADERBOARD,
                    leaderBoard.map(results => {
                        return { score: results.score, name: results.value };
                    })
                );

                this.io.local.emit(EVENTS.FROM_SERVER.PLAYER_JOIN, newPlayer);

                socket.emit(EVENTS.FROM_SERVER.GAME_STATE, {
                    running: this.game.running,
                    drawingPlayerId: this.game.drawingPlayerId,
                    revealedWord: this.game.revealedWord,
                    timePassed: this.game.timePassed,
                });
            });

            socket.on(EVENTS.FROM_CLIENT.START, async () => {
                this.game.correctGuesses.clear();

                this.drawingPlayerSocket = socket;

                const word = (await InMemoryDatabase.client.SRANDMEMBER('words'))!;

                this.game.start(word, socket.id);

                // await InMemoryDatabase.client.del('players');

                await InMemoryDatabase.client.ZADD(
                    'players',
                    Array.from(this.game.players.values()).map(player => {
                        return {
                            value: player.name,
                            score: player.score,
                        };
                    })
                );

                socket.to(this.roomId).emit(EVENTS.FROM_CLIENT.START, '_'.repeat(word.length));

                socket.emit(EVENTS.FROM_SERVER.WORD_REVEAL, word); // emitted only to player who's drawing

                console.log(`Game started with word: ${word}`);
            });

            socket.on(EVENTS.FROM_CLIENT.MESSAGE, async (message: Message) => {
                console.log('[server](message): %s', JSON.stringify(message));

                if ((await InMemoryDatabase.client.LLEN('chat')) > 15) {
                    await InMemoryDatabase.client.LTRIM('chat', 0, 10);
                }

                if (
                    this.game.running &&
                    socket.id !== this.drawingPlayerSocket.id &&
                    message.text.trim().toLowerCase() === this.game.word.trim().toLowerCase()
                ) {
                    if (!this.game.correctGuesses.has(socket.id)) {
                        this.game.correctGuesses.add(socket.id);

                        const scoreAdded = await this.increasePlayerScore(socket);

                        socket.emit(EVENTS.FROM_SERVER.CORRECT_WORD, this.game.word);

                        const leaderBoard = await InMemoryDatabase.client.ZRANGE_WITHSCORES('players', 0, -1, {
                            REV: true,
                        });

                        this.io.local.emit(
                            EVENTS.FROM_SERVER.LEADERBOARD,
                            leaderBoard.map(results => {
                                return { score: results.score, name: results.value };
                            })
                        );

                        this.io.local.emit(EVENTS.FROM_SERVER.ONLINE_PLAYERS, Array.from(this.game.players.values()));

                        socket.broadcast.emit(EVENTS.FROM_CLIENT.MESSAGE, {
                            senderId: message.senderId,
                            senderName: message.senderName,
                            text: `has guessed the word! +${scoreAdded} points ✅`,
                        });

                        console.log(`${message.senderName} has guessed the word! +${scoreAdded} points ✅`);

                        setTimeout(() => {
                            if (this.game.correctGuesses.size === this.game.players.size - 1) {
                                this.game.stop();
                                this.io.local.emit(EVENTS.FROM_SERVER.STOP);
                            }
                        }, 3000);
                    }
                } else {
                    socket.broadcast.emit(EVENTS.FROM_CLIENT.MESSAGE, message);
                    await InMemoryDatabase.client.LPUSH('chat', JSON.stringify(message));
                }
            });

            socket.on(EVENTS.FROM_CLIENT.IMAGE, (imgBase64: string) => {
                if (socket.id === this.drawingPlayerSocket.id) {
                    this.io.local.emit(EVENTS.FROM_SERVER.IMAGE, imgBase64);
                }
            });

            socket.on(EVENTS.FROM_CLIENT.CLEAR_CANVAS, () => {
                if (socket.id === this.drawingPlayerSocket.id) {
                    this.io.local.emit(EVENTS.FROM_CLIENT.CLEAR_CANVAS);
                }
            });

            socket.on(EVENTS.FROM_SERVER.DISCONNECT, () => {
                console.log(`Player ${socket.id}: ${this.game.players.get(socket.id)?.name} disconnected`);
                this.game.players.delete(socket.id);
                if (this.game.running && socket.id === this.game.drawingPlayerId) {
                    this.game.stop();
                    this.io.local.emit(EVENTS.FROM_SERVER.STOP);
                }

                this.io.local.emit(EVENTS.FROM_SERVER.PLAYER_LEFT, socket.id);
            });
        });
    }

    private async increasePlayerScore(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<number> {
        const correctPlayer = this.game.players.get(socket.id)!;
        const drawingPlayer = this.game.getDrawingPlayer();

        const scoreToAdd = this.game.calculateScoreToAdd();

        correctPlayer.score += scoreToAdd;
        drawingPlayer.score += scoreToAdd / 5;

        await InMemoryDatabase.client.ZINCRBY('players', scoreToAdd, correctPlayer.name);

        await InMemoryDatabase.client.ZINCRBY('players', scoreToAdd / 5, drawingPlayer.name);

        return scoreToAdd;
    }

    public getApp(): express.Application {
        return this.app;
    }
}
