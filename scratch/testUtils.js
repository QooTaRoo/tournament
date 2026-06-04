// tournamentUtils.js のロジックテスト
import {
  getBracketSize,
  getByeIndices,
  createTournament,
  setMatchScores,
  renameTeam,
  getLeafIndex,
  swapInitialSlots,
  calculateLayoutCoords
} from '/Users/nabe/Documents/tournament/src/tournamentUtils.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Tournament Logic Tests Starting ---');

// 1. Bracket size calculation tests
console.log('Testing bracket size calculations...');
assert(getBracketSize(2) === 2, '2 teams -> size 2');
assert(getBracketSize(3) === 4, '3 teams -> size 4');
assert(getBracketSize(5) === 8, '5 teams -> size 8');
assert(getBracketSize(8) === 8, '8 teams -> size 8');
assert(getBracketSize(9) === 16, '9 teams -> size 16');

// 2. Bye indices distribution tests
console.log('Testing bye distribution...');
const byes5 = getByeIndices(5, 8); // 3 byes out of 4 matches
assert(byes5.size === 3, '5 teams -> 3 byes');
assert(byes5.has(0) && byes5.has(1) && byes5.has(2), 'Byes distributed to matches 0, 1, 2');

const byes6 = getByeIndices(6, 8); // 2 byes out of 4 matches
assert(byes6.size === 2, '6 teams -> 2 byes');
assert(byes6.has(0) && byes6.has(2), 'Byes distributed to matches 0, 2');

// 3. Tournament generation tests
console.log('Testing tournament generation...');
const t5 = createTournament('Test Cup', 5);
assert(t5.teams.length === 8, 'Teams array size matches P=8');
assert(t5.teams[0] === 'Team 1' && t5.teams[1] === null, 'Match 0 is a bye');
assert(t5.teams[2] === 'Team 2' && t5.teams[3] === null, 'Match 1 is a bye');
assert(t5.teams[4] === 'Team 3' && t5.teams[5] === null, 'Match 2 is a bye');
assert(t5.teams[6] === 'Team 4' && t5.teams[7] === 'Team 5', 'Match 3 is active');

// Round 1 check (R0)
assert(t5.rounds[0][0].p1 === 'Team 1' && t5.rounds[0][0].p2 === null, 'R0-M0 has team 1 and bye');
assert(t5.rounds[0][0].winner === 'Team 1', 'R0-M0 winner is auto-set to team 1');

// Round 2 check (R1)
assert(t5.rounds[1][0].p1 === 'Team 1' && t5.rounds[1][0].p2 === 'Team 2', 'R1-M0 players are Team 1 and Team 2');
assert(t5.rounds[1][1].p1 === 'Team 3' && t5.rounds[1][1].p2 === null, 'R1-M1 p2 starts as null (waiting for R0-M3 winner)');

// 4. Score editing & winner auto-determination tests
console.log('Testing score entry and auto-winner calculations...');
// Set score 3 - 1 for R0-M3 (Team 4 vs Team 5) -> Team 4 should win and propagate!
let rounds = setMatchScores(t5.rounds, 0, 3, 3, 1);
assert(rounds[0][3].score1 === 3 && rounds[0][3].score2 === 1, 'Scores saved');
assert(rounds[0][3].winner === 'Team 4', 'Winner is automatically determined as Team 4');
assert(rounds[1][1].p2 === 'Team 4', 'Team 4 propagated to next round');

// Set score 0 - 2 for R1-M1 (Team 3 vs Team 4) -> Team 4 should win and propagate to finals!
rounds = setMatchScores(rounds, 1, 1, 0, 2);
assert(rounds[1][1].winner === 'Team 4', 'Winner is automatically determined as Team 4');
assert(rounds[2][0].p2 === 'Team 4', 'Team 4 propagated to finals');

// Changing scores of R0-M3 to 1 - 2 -> Team 5 should now win, and Team 4 wins downstream should be reset!
rounds = setMatchScores(rounds, 0, 3, 1, 2);
assert(rounds[0][3].winner === 'Team 5', 'Winner changed to Team 5');
assert(rounds[1][1].p2 === 'Team 5', 'Team 5 propagated to next round');
assert(rounds[1][1].score1 === null && rounds[1][1].score2 === null, 'Scores reset in next round');
assert(rounds[1][1].winner === null, 'Winner reset in next round');
assert(rounds[2][0].p2 === null, 'Finals input reset');

// 5. Cleared scores resets winner test
console.log('Testing score clearing resets winner...');
rounds = setMatchScores(rounds, 0, 3, null, null);
assert(rounds[0][3].winner === null, 'Clearing scores sets winner to null');
assert(rounds[1][1].p2 === null, 'Winner propagation reset in downstream');

// 6. Leaf index resolution tests
console.log('Testing leaf index resolution...');
assert(getLeafIndex(t5.rounds, 0, 3, 'p1') === 6, 'R0-M3 p1 leaf index is 6');
assert(getLeafIndex(t5.rounds, 0, 3, 'p2') === 7, 'R0-M3 p2 leaf index is 7');
assert(getLeafIndex(t5.rounds, 1, 0, 'p1') === 0, 'R1-M0 p1 leaf index is 0 (bye from R0-M0)');
assert(getLeafIndex(t5.rounds, 1, 0, 'p2') === 2, 'R1-M0 p2 leaf index is 2 (bye from R0-M0)');
assert(getLeafIndex(t5.rounds, 1, 1, 'p2') === null, 'R1-M1 p2 is NOT a leaf (comes from R0-M3)');

// 7. Slot swapping tests
console.log('Testing slot swapping...');
let tSwap = swapInitialSlots(t5, 0, 6); // Swap Team 1 (index 0) with Team 4 (index 6)
assert(tSwap.teams[0] === 'Team 4', 'Teams[0] is now Team 4');
assert(tSwap.teams[6] === 'Team 1', 'Teams[6] is now Team 1');
// R0-M0 (now contains Team 4 and bye)
assert(tSwap.rounds[0][0].p1 === 'Team 4' && tSwap.rounds[0][0].p2 === null, 'R0-M0 is now Team 4 with bye');
assert(tSwap.rounds[0][0].winner === 'Team 4', 'Team 4 auto-wins');
// R0-M3 (now contains Team 1 vs Team 5)
assert(tSwap.rounds[0][3].p1 === 'Team 1' && tSwap.rounds[0][3].p2 === 'Team 5', 'R0-M3 is now Team 1 vs Team 5');

// 8. Renaming tests
console.log('Testing renaming...');
let tRenamed = renameTeam(t5, 6, '最強チーム'); // Rename Team 4 (index 6)
assert(tRenamed.teams[6] === '最強チーム', 'Team name in array is updated');
assert(tRenamed.rounds[0][3].p1 === '最強チーム', 'Team name in R0-M3 updated');

console.log('--- All Tests Passed Successfully! ---');
