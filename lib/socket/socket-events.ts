import { CorrectAndDrawingPlayer } from '../models/correct-guess-data';
import { Player } from '../models/player';
import { Message } from '../models/message';
import { seconds, GameState } from '../models/game-state';

export namespace EVENTS {
    export enum FROM_SERVER {
        DISCONNECT = 'disconnect',
        ERROR = 'error',
        START = 'start',
        PLAYER_JOIN = 'playerJoin',
        PLAYER_LEFT = 'playerLeft',
        ONLINE_PLAYERS = 'onlinePlayers',
        MESSAGE_HISTORY = 'messageHistory',
        LEADERBOARD = 'leaderboard',
        WORD_REVEAL = 'wordReveal',
        CORRECT_GUESS = 'correctGuess',
        CORRECT_WORD = 'correctWord',
        TIME = 'time',
        GAME_STATE = 'gameState',
        IMAGE = 'image',
        STOP = 'stop',
    }

    export enum FROM_CLIENT {
        CONNECT = 'connect',
        START = 'start',
        MESSAGE = 'message',
        IMAGE = 'image',
        PLAYER_JOIN = 'playerJoin',
        CLEAR_CANVAS = 'clearCanvas',
    }
}

export interface ServerToClientEvents {
    disconnect: () => void;
    error: (err: Error) => void;
    playerLeft: (socketId: string) => void;
    message: (msg: Message) => void;
    image: (imgBase64: string) => void;
    playerJoin: (player: Player) => void;
    onlinePlayers: (players: Player[]) => void;
    messageHistory: (messages: Message[]) => void;
    leaderboard: (players: Pick<Player, 'name' | 'score'>[]) => void;
    start: (word: string) => void;
    wordReveal: (word: string) => void;
    correctGuess: (correctAndDrawingPlayer: CorrectAndDrawingPlayer) => void;
    correctWord: (word: string) => void;
    time: (time: seconds) => void;
    clearCanvas: () => void;
    gameState: (state: GameState) => void;
    stop: () => void;

    withAck: (d: string, callback: (e: number) => void) => void;
}

export interface ClientToServerEvents {
    connect: () => void;
    message: (msg: Message) => void;
    image: (imgBase64: string) => void;
    playerJoin: (name: string) => void;
    start: () => void;
    clearCanvas: () => void;
}

export interface InterServerEvents {}

export interface SocketData<T> {
    data: T;
}
