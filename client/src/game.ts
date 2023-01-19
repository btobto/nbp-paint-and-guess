import { map, tap } from 'rxjs/operators';
import { Player, GameState, CorrectAndDrawingPlayer } from '@paint-and-guess/lib/models';
import { BehaviorSubject, Subject } from 'rxjs';
import { SocketIO } from './socket';
import { EVENTS } from '@paint-and-guess/lib/socket';

export class Game {
    start$ = new Subject<string>();
    stop$ = new Subject<void>();
    revealedWord$ = new Subject<string>();
    correctWord$ = new Subject<string>();
    timePassed$ = new Subject<number>();
    correctGuess$ = new Subject<CorrectAndDrawingPlayer>();
    gameState$ = new Subject<GameState>();

    allPlayer$ = new Subject<Player[]>();
    playerJoin$ = new Subject<Player>();
    playerLeft$ = new Subject<Player>();

    players = new Map<string, Player>();

    canDraw$ = new BehaviorSubject<boolean>(false);

    constructor() {
        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.START).subscribe(word => this.start(word));
        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.STOP).subscribe(() => this.stop());
        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.WORD_REVEAL).subscribe(this.revealedWord$);
        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.TIME).subscribe(this.timePassed$);
        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.CORRECT_WORD).subscribe(this.correctWord$);

        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.GAME_STATE).subscribe(this.gameState$);

        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.PLAYER_JOIN)
            .pipe(
                tap(player => {
                    this.players.set(player.id, player);
                })
            )
            .subscribe(this.playerJoin$);

        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.ONLINE_PLAYERS)
            .pipe(
                tap(playersList => {
                    this.players.clear();
                    playersList.forEach(player => {
                        this.players.set(player.id, player);
                    });
                })
            )
            .subscribe(this.allPlayer$);

        SocketIO.listenOnSocket(EVENTS.FROM_SERVER.PLAYER_LEFT)
            .pipe(
                map((id: string) => {
                    const playerThatLeft = this.players.get(id)!;
                    this.players.delete(id);

                    return playerThatLeft;
                })
            )
            .subscribe(this.playerLeft$);

        this.canDraw$.next(true);
    }

    private start(word: string) {
        this.start$.next(word);
        this.revealedWord$.next('_ '.repeat(word.length));
        this.canDraw$.next(false);
    }

    private stop() {
        this.stop$.next();
        this.canDraw$.next(true);
    }
}
