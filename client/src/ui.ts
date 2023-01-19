import { Message, Player } from '@paint-and-guess/lib/models';

export const timeSpan = document.getElementById('time')!;
export const currentWordHeader = document.getElementById('current-word-header')!;
export const messageInputDiv = document.getElementById('message-input-div')!;
export const messageInput = document.getElementById('message-input')! as HTMLInputElement;
export const timeHeader = document.getElementById('time-header')!;

export namespace UI {
    const messageList = document.getElementById('message-list')!;
    const playersUl = document.getElementById('players')!;
    const leaderboardUl = document.getElementById('leaderboard')!;

    export function appendMessageToChat(message: Message) {
        const li = document.createElement('li');
        li.innerHTML = message.senderName + ': ' + message.text;

        messageList.appendChild(li);
    }

    export function renderOnlinePlayers(players: Map<string, Player>) {
        playersUl.innerHTML = '';

        players.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `${player.name} (${player.score} points)`;
            playersUl.appendChild(li);
        });
    }

    export function renderLeaderboard(leaderboard: Pick<Player, 'name' | 'score'>[]) {
        leaderboardUl.innerHTML = '';

        leaderboard.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `${player.name} (${player.score} points)`;
            leaderboardUl.appendChild(li);
        });
    }

    export function show(el: HTMLElement) {
        el.style.display = 'block';
    }

    export function hide(el: HTMLElement) {
        el.style.display = 'none';
    }
}
