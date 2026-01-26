"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONSTANTS = exports.TABLE_CONFIGS = void 0;
exports.TABLE_CONFIGS = [
    {
        id: 'table-small',
        name: 'Table Débutant',
        tier: 'SMALL',
        minBuyIn: 1000,
        maxBuyIn: 5000,
        smallBlind: 10,
        bigBlind: 20,
        maxPlayers: 9,
        minPlayers: 2,
        turnTimeout: 30,
    },
    {
        id: 'table-medium',
        name: 'Table Intermédiaire',
        tier: 'MEDIUM',
        minBuyIn: 5000,
        maxBuyIn: 25000,
        smallBlind: 50,
        bigBlind: 100,
        maxPlayers: 9,
        minPlayers: 2,
        turnTimeout: 30,
    },
    {
        id: 'table-high',
        name: 'Table High Roller',
        tier: 'HIGH',
        minBuyIn: 20000,
        maxBuyIn: 100000,
        smallBlind: 200,
        bigBlind: 400,
        maxPlayers: 9,
        minPlayers: 2,
        turnTimeout: 30,
    },
];
exports.GAME_CONSTANTS = {
    MIN_PLAYERS_TO_START: 2,
    MAX_PLAYERS_PER_TABLE: 9,
    DEFAULT_TURN_TIMEOUT: 30,
    TIME_BANK_INITIAL: 60,
    TIME_BANK_PER_HAND: 5,
};
//# sourceMappingURL=tables.js.map