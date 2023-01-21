# Pokretanje

1. `npm run server:watch`
2. `npm run server:nodemon`
3. `npm run client:watch`

Aplikacija je na adresi `http://localhost:8080`.

## Napomena

Ukoliko naredba `npm run server:nodemon` prijavljuje permission error na Windows-u, izvrsenje sledecih naredbi (kao administrator) popravlja problem:

`net stop winnat`

`net start winnat`
