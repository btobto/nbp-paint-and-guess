import { createClient } from 'redis';

export namespace InMemoryDatabase {
    require('dotenv').config();

    export const client = createClient({
        socket: {
            host: process.env.REDIS_HOST!,
            port: Number(process.env.REDIS_PORT!),
        },
        username: process.env.REDIS_USERNAME!,
        password: process.env.REDIS_PASSWORD!,
        legacyMode: false,
    });

    client.on('error', (err: string) => console.error('Could not establish a connection with redis. ' + err, 'Redis'));
    client.on('connect', () => console.log('Connected to redis successfully', 'Redis'));
}

InMemoryDatabase.client.connect().then(() => {});
