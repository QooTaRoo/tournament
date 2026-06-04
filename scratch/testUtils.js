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
assert(byes5.has(0) && byes5.has(2) && byes5.has(3), 'Byes distributed to matches 0, 2, 3');

const byes6 = getByeIndices(6, 8); // 2 byes out of 4 matches
assert(byes6.size === 2, '6 teams -> 2 byes');
assert(byes6.has(0) && byes6.has(3), 'Byes distributed to matches 0, 3');

// 3. Tournament generation tests
console.log('Testing tournament generation...');
const t5 = createTournament('Test Cup', 5);
assert(t5.teams.length === 8, 'Teams array size matches P=8');
assert(t5.teams[0] === 'Team 1' && t5.teams[1] === null, 'Match 0 is a bye');
assert(t5.teams[2] === 'Team 2' && t5.teams[3] === 'Team 3', 'Match 1 is active');
assert(t5.teams[4] === 'Team 4' && t5.teams[5] === null, 'Match 2 is a bye');
assert(t5.teams[6] === 'Team 5' && t5.teams[7] === null, 'Match 3 is a bye');

// Round 1 check (R0)
assert(t5.rounds[0][0].p1 === 'Team 1' && t5.rounds[0][0].p2 === null, 'R0-M0 has team 1 and bye');
assert(t5.rounds[0][0].winner === 'Team 1', 'R0-M0 winner is auto-set to team 1');

// Round 2 check (R1)
assert(t5.rounds[1][0].p1 === 'Team 1' && t5.rounds[1][0].p2 === null, 'R1-M0 p2 starts as null (waiting for R0-M1 winner)');
assert(t5.rounds[1][1].p1 === 'Team 4' && t5.rounds[1][1].p2 === 'Team 5', 'R1-M1 players are Team 4 and Team 5');

// 4. Score editing & winner auto-determination tests
console.log('Testing score entry and auto-winner calculations...');
// Set score 3 - 1 for R0-M1 (Team 2 vs Team 3) -> Team 2 should win and propagate!
let rounds = setMatchScores(t5.rounds, 0, 1, 3, 1);
assert(rounds[0][1].score1 === 3 && rounds[0][1].score2 === 1, 'Scores saved');
assert(rounds[0][1].winner === 'Team 2', 'Winner is automatically determined as Team 2');
assert(rounds[1][0].p2 === 'Team 2', 'Team 2 propagated to next round');

// Set score 0 - 2 for R1-M0 (Team 1 vs Team 2) -> Team 2 should win and propagate to finals!
rounds = setMatchScores(rounds, 1, 0, 0, 2);
assert(rounds[1][0].winner === 'Team 2', 'Winner is automatically determined as Team 2');
assert(rounds[2][0].p1 === 'Team 2', 'Team 2 propagated to finals');

// Changing scores of R0-M1 to 1 - 2 -> Team 3 should now win, and Team 2 wins downstream should be reset!
rounds = setMatchScores(rounds, 0, 1, 1, 2);
assert(rounds[0][1].winner === 'Team 3', 'Winner changed to Team 3');
assert(rounds[1][0].p2 === 'Team 3', 'Team 3 propagated to next round');
assert(rounds[1][0].score1 === null && rounds[1][0].score2 === null, 'Scores reset in next round');
assert(rounds[1][0].winner === null, 'Winner reset in next round');
assert(rounds[2][0].p1 === null, 'Finals input reset');

// 5. Cleared scores resets winner test
console.log('Testing score clearing resets winner...');
rounds = setMatchScores(rounds, 0, 1, null, null);
assert(rounds[0][1].winner === null, 'Clearing scores sets winner to null');
assert(rounds[1][0].p2 === null, 'Winner propagation reset in downstream');

// 6. Leaf index resolution tests
console.log('Testing leaf index resolution...');
assert(getLeafIndex(t5.rounds, 0, 1, 'p1') === 2, 'R0-M1 p1 leaf index is 2');
assert(getLeafIndex(t5.rounds, 0, 1, 'p2') === 3, 'R0-M1 p2 leaf index is 3');
assert(getLeafIndex(t5.rounds, 1, 0, 'p1') === 0, 'R1-M0 p1 leaf index is 0 (bye from R0-M0)');
assert(getLeafIndex(t5.rounds, 1, 0, 'p2') === null, 'R1-M0 p2 is NOT a leaf (comes from R0-M1)');
assert(getLeafIndex(t5.rounds, 1, 1, 'p1') === 4, 'R1-M1 p1 leaf index is 4 (bye from R0-M2)');

// 7. Slot swapping tests
console.log('Testing slot swapping...');
let tSwap = swapInitialSlots(t5, 0, 2); // Swap Team 1 (index 0) with Team 2 (index 2)
assert(tSwap.teams[0] === 'Team 2', 'Teams[0] is now Team 2');
assert(tSwap.teams[2] === 'Team 1', 'Teams[2] is now Team 1');
// R0-M0 (now contains Team 2 and bye)
assert(tSwap.rounds[0][0].p1 === 'Team 2' && tSwap.rounds[0][0].p2 === null, 'R0-M0 is now Team 2 with bye');
assert(tSwap.rounds[0][0].winner === 'Team 2', 'Team 2 auto-wins');

// 8. Renaming tests
console.log('Testing renaming...');
let tRenamed = renameTeam(t5, 2, '最強チーム'); // Rename Team 2 (index 2)
assert(tRenamed.teams[2] === '最強チーム', 'Team name in array is updated');
assert(tRenamed.rounds[0][1].p1 === '最強チーム', 'Team name in R0-M1 updated');

// 9. Symmetric Layout (double-sided) coordinates tests
console.log('Testing symmetric coordinates calculation...');
const tSymmetric = createTournament('Symmetric Cup', 20, false, 'double-sided');
const coordsSym = calculateLayoutCoords(tSymmetric.rounds, tSymmetric.teams, 140, 64, 220, 100, 'double-sided');

const finalsCoord = coordsSym[`${tSymmetric.rounds.length - 1}-0`];
assert(finalsCoord !== undefined, 'Finals coord should exist');
assert(finalsCoord.x === 220 + tSymmetric.rounds.length * 140, 'Finals should be centered');

const r0m0 = coordsSym['0-0'];
const r0m8 = coordsSym['0-8'];
assert(r0m0.x === 360, 'Left wing R0-M0 should be at X=360');
assert(r0m8.x === 1480, 'Right wing R0-M8 should be at X=1480');
assert(r0m0.isRight === false, 'R0-M0 is left wing');
assert(r0m8.isRight === true, 'R0-M8 is right wing');

// 1回戦の線の長さが colWidth と同じになっているか
assert(r0m8.x1 === 1620, 'R0-M8 (right wing card connector right side) should be at X=1620');
assert(r0m8.x1 - r0m8.x === 140, 'Right wing R0-M8 line length should be 140');

// 10. 左右非対称なチーム数における垂直アライメントのテスト
console.log('Testing vertical alignment shift for asymmetric bracket (18 teams)...');
const tAsymmetric = createTournament('Asymmetric Cup', 18, false, 'double-sided');
const coordsAsym = calculateLayoutCoords(tAsymmetric.rounds, tAsymmetric.teams, 140, 64, 220, 100, 'double-sided');

const R_asym = tAsymmetric.rounds.length;
const leftSemi = coordsAsym[`${R_asym - 2}-0`];
const rightSemi = coordsAsym[`${R_asym - 2}-1`];

assert(leftSemi !== undefined, 'Left semifinal should exist');
assert(rightSemi !== undefined, 'Right semifinal should exist');
assert(leftSemi.y === rightSemi.y, `Semifinal Y coordinates should align: left=${leftSemi.y}, right=${rightSemi.y}`);

console.log('--- All Tests Passed Successfully! ---');
