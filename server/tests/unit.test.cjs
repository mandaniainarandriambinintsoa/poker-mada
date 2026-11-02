const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Deck } = require('../dist/game/Deck');
const { PokerTable } = require('../dist/game/Table');
const { socketContracts } = require('../dist/socket/contracts');
const { queueTable } = require('../dist/socket/tableQueue');
const { PotManager } = require('../dist/game/Pot');
const { Card } = require('../dist/game/Card');

const tiedBoard = ['10', 'J', 'Q', 'K', 'A'].map(rank => new Card('hearts', rank));
const tiedHand = { holeCards: [new Card('clubs', '2'), new Card('spades', '3')], communityCards: tiedBoard };

test('folded contributions and an odd chip are conserved at showdown', () => {
  const pot = new PotManager();
  pot.addBet('first', 10); pot.addBet('second', 10); pot.addBet('folded', 5); pot.collectBets();
  const payouts = pot.distributePot(new Map([['first', tiedHand], ['second', tiedHand]]));
  assert.equal(payouts.get('first'), 13); assert.equal(payouts.get('second'), 12);
  assert.equal(pot.getTotal(), 25);
  assert.equal([...payouts.values()].reduce((sum, amount) => sum + amount, 0), 25);
});

test('unequal all-ins preserve every layer including folded contributions', () => {
  const pot = new PotManager();
  pot.addBet('short', 50, true); pot.addBet('deep', 100); pot.addBet('folded', 100); pot.collectBets();
  const payouts = pot.distributePot(new Map([['short', tiedHand], ['deep', tiedHand]]));
  assert.equal(payouts.get('short'), 75); assert.equal(payouts.get('deep'), 175);
  assert.equal(pot.getTotal(), 250); assert.equal(pot.getSidePots().length, 1);
});

test('a completed hand exposes no turn and rejects further bets', () => {
  const table = new PokerTable(config); table.addPlayer('a', 'A', 0, 1000); table.addPlayer('b', 'B', 1, 1000);
  for (let i=0;i<20 && table.getState().phase !== 'showdown';i++) {
    const state=table.getState(); const actions=table.getAvailableActions(state.currentPlayerId);
    assert.equal(table.executeAction(state.currentPlayerId, actions.includes('check') ? 'check' : 'call'), true);
  }
  const result=table.getState('a'); assert.equal(result.phase,'showdown'); assert.equal(result.currentPlayerId,undefined);
  assert.deepEqual(result.availableActions,[]); assert.equal(table.executeAction('a','raise',100),false);
  assert.equal(result.players.reduce((sum,p)=>sum+p.chipStack,0),2000);
});

test('shuffling and dealing preserves all 52 distinct cards', () => {
  const deck = new Deck(); deck.shuffle(); const cards = deck.deal(52);
  assert.equal(new Set(cards.map(card => card.toJSON().code)).size, 52);
  assert.equal(deck.remaining(), 0); assert.throws(() => deck.dealOne());
});
test('socket contracts reject malformed, negative and fractional amounts', () => {
  for (const buyIn of [-1, 0, 1.5, '1000', null, Infinity]) assert.equal(socketContracts['table:join'].safeParse({ tableId: 'table-small', buyIn }).success, false);
  assert.equal(socketContracts['table:join'].safeParse({ tableId: 'table-small', buyIn: 1000 }).success, true);
  assert.equal(socketContracts['game:action'].safeParse({ tableId: 'table-small', action: 'raise', amount: -1 }).success, false);
  assert.equal(socketContracts['global:chat-send'].safeParse({ message: ' '.repeat(10) }).success, false);
  assert.equal(socketContracts['global:chat-send'].safeParse({ message: 'a'.repeat(201) }).success, false);
});
test('joins to the same table are serialized and a failed task releases the queue', async () => {
  const events = [];
  const results = await Promise.allSettled([
    queueTable('test', async () => { events.push(1); await new Promise(r => setTimeout(r, 10)); events.push(2); throw new Error('expected'); }),
    queueTable('test', async () => { events.push(3); }),
  ]);
  assert.deepEqual(events, [1, 2, 3]); assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled');
});
const config = { id: 'table-small', name: 'Test', smallBlind: 10, bigBlind: 20, minBuyIn: 1000, maxBuyIn: 5000, maxPlayers: 9, turnTimeout: 30 };
test('players joining mid-hand wait for the next deal', () => {
  const table = new PokerTable(config); table.addPlayer('a', 'A', 0, 1000); table.addPlayer('b', 'B', 1, 1000); table.addPlayer('c', 'C', 2, 1000);
  const joined = table.getState('c').players.find(p => p.odId === 'c'); assert.equal(joined.isFolded, true); assert.equal(joined.holeCards.length, 0);
  table.startNewHand(); const next = table.getState('c').players.find(p => p.odId === 'c'); assert.equal(next.isFolded, false); assert.equal(next.holeCards.length, 2);
});
test('invalid raise cannot mutate the pot or current bet', () => {
  const table = new PokerTable(config); table.addPlayer('a', 'A', 0, 1000); table.addPlayer('b', 'B', 1, 1000);
  const state = table.getState();
  for (const amount of [-1, 0, 1.5, 100000]) { assert.equal(table.executeAction(state.currentPlayerId, 'raise', amount), false); assert.equal(table.getState().mainPot, state.mainPot); assert.equal(table.getState().currentBet, state.currentBet); }
});
test('disconnecting during a heads-up hand awards the pot before returning chips', () => {
  const table = new PokerTable(config); table.addPlayer('a', 'A', 0, 1000); table.addPlayer('b', 'B', 1, 1000);
  const removed = table.removePlayer(0);
  assert.equal(removed.chipStack + table.getState().players[0].chipStack, 2000);
  assert.equal(table.getState().mainPot, 0);
});
test('a player never receives an opponent’s private cards before showdown', () => {
  const table = new PokerTable(config); table.addPlayer('a', 'A', 0, 1000); table.addPlayer('b', 'B', 1, 1000);
  const state = table.getState('a');
  assert.equal(state.players.find(p => p.odId === 'a').holeCards.length, 2);
  assert.equal(state.players.find(p => p.odId === 'b').holeCards, undefined);
});
