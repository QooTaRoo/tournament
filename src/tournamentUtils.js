/**
 * チーム数 N から、トーナメント全体の枠数 P (N以上の最小の2の累乗) を計算します。
 */
export function getBracketSize(teamCount) {
  let p = 2;
  while (p < teamCount) {
    p *= 2;
  }
  return p;
}

/**
 * 指定サイズのビット反転順のインデックス配列を生成します。
 */
export function getBitReversalPermutation(size) {
  const result = [];
  const bits = Math.log2(size);
  for (let i = 0; i < size; i++) {
    let rev = 0;
    for (let b = 0; b < bits; b++) {
      if ((i & (1 << b)) !== 0) {
        rev |= (1 << (bits - 1 - b));
      }
    }
    result.push(rev);
  }
  return result;
}

/**
 * 1回戦マッチ M 個に対する、標準的なバイ配置（シード優先順）のインデックスリストを返します。
 */
export function getByePriorityList(M) {
  if (M === 1) return [0];

  const halfSize = M / 2;
  const br = getBitReversalPermutation(halfSize);
  const result = [];
  for (let i = 0; i < halfSize; i++) {
    const val = br[i] * 2;
    result.push(val);
    result.push(M - 1 - val);
  }
  return result;
}

/**
 * P/2 個の1回戦マッチに対して、B 個のシード（バイ）枠を均等に配分するインデックスを返します。
 */
export function getByeIndices(teamCount, bracketSize) {
  const M = bracketSize / 2;
  const B = bracketSize - teamCount;
  const byeIndices = new Set();
  if (B <= 0) return byeIndices;

  const priority = getByePriorityList(M);
  // 必要な B 個のバイを優先順に取り出します
  for (let i = 0; i < B && i < priority.length; i++) {
    byeIndices.add(priority[i]);
  }
  return byeIndices;
}

/**
 * 新規トーナメントデータを構築します。
 * 3位決定戦(thirdPlaceMatch)はデフォルトで null (非アクティブ) とします。
 */
export function createTournament(name, teamCount, hasThirdPlace = false) {
  const P = getBracketSize(teamCount);
  const M = P / 2;
  const B = P - teamCount;
  const byeIndices = getByeIndices(teamCount, P);

  const teams = new Array(P).fill(null);
  let currentTeamNum = 1;

  for (let m = 0; m < M; m++) {
    if (byeIndices.has(m)) {
      // シードマッチでは、チームは常に偶数インデックス（上）、バイは常に奇数インデックス（下）に配置します。
      // これにより、2回戦の対戦相手（1回戦の勝者）が内側に位置し、
      // シードチームが自動的にブロックの外側に位置することになります。
      teams[2 * m] = `Team ${currentTeamNum++}`;
      teams[2 * m + 1] = null;
    } else {
      teams[2 * m] = `Team ${currentTeamNum++}`;
      teams[2 * m + 1] = `Team ${currentTeamNum++}`;
    }
  }

  const R = Math.log2(P);
  const rounds = [];

  // 1回戦の構築
  rounds[0] = [];
  for (let m = 0; m < M; m++) {
    const p1 = teams[2 * m];
    const p2 = teams[2 * m + 1];
    const winner = (p1 === null || p2 === null) ? (p1 || p2) : null;
    const isReady = p1 !== null && p2 !== null;
    rounds[0].push({
      id: `r0-m${m}`,
      p1,
      p2,
      score1: null,
      score2: null,
      winner
    });
  }

  // 2回戦以降の構築
  for (let r = 1; r < R; r++) {
    rounds[r] = [];
    const matchesInRound = P / Math.pow(2, r + 1);
    for (let m = 0; m < matchesInRound; m++) {
      const prevMatch1 = rounds[r - 1][2 * m];
      const prevMatch2 = rounds[r - 1][2 * m + 1];
      rounds[r].push({
        id: `r${r}-m${m}`,
        p1: prevMatch1 ? prevMatch1.winner : null,
        p2: prevMatch2 ? prevMatch2.winner : null,
        score1: null,
        score2: null,
        winner: null
      });
    }
  }

  const tournament = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
    name: name || `${teamCount}チームのトーナメント`,
    createdAt: new Date().toISOString(),
    teamCount,
    teams,
    rounds,
    thirdPlaceMatch: null
  };

  if (hasThirdPlace && teamCount >= 4) {
    tournament.thirdPlaceMatch = {
      p1: null,
      p2: null,
      score1: null,
      score2: null,
      winner: null
    };
  }

  return tournament;
}

/**
 * 試合の得点を登録し、自動的に勝者を判定して以降のラウンドに再帰伝播させます。
 */
export function setMatchScores(rounds, roundIndex, matchIndex, score1, score2) {
  const newRounds = JSON.parse(JSON.stringify(rounds));
  const match = newRounds[roundIndex][matchIndex];

  const s1 = (score1 === '' || score1 === null || score1 === undefined) ? null : Number(score1);
  const s2 = (score2 === '' || score2 === null || score2 === undefined) ? null : Number(score2);

  match.score1 = s1;
  match.score2 = s2;

  // 得点に基づいて勝者を自動判定
  if (s1 !== null && s2 !== null) {
    if (s1 > s2) {
      match.winner = match.p1;
    } else if (s2 > s1) {
      match.winner = match.p2;
    } else {
      match.winner = null; // 同点の場合はクリア
    }
  } else {
    match.winner = null;
  }

  propagateWinner(newRounds, roundIndex, matchIndex);
  return newRounds;
}

function propagateWinner(rounds, roundIndex, matchIndex) {
  const currentMatch = rounds[roundIndex][matchIndex];
  const winner = currentMatch.winner;

  const nextRoundIndex = roundIndex + 1;
  if (nextRoundIndex >= rounds.length) return;

  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextMatch = rounds[nextRoundIndex][nextMatchIndex];
  const isP1 = (matchIndex % 2 === 0);

  const oldParticipant = isP1 ? nextMatch.p1 : nextMatch.p2;
  const newParticipant = winner;

  if (isP1) {
    nextMatch.p1 = newParticipant;
  } else {
    nextMatch.p2 = newParticipant;
  }

  if (oldParticipant !== newParticipant) {
    nextMatch.winner = null;
    nextMatch.score1 = null;
    nextMatch.score2 = null;
    propagateWinner(rounds, nextRoundIndex, nextMatchIndex);
  }
}

/**
 * 準決勝の敗者を検出し、3位決定戦の対戦相手を自動更新します。
 */
export function updateThirdPlaceMatch(tournament) {
  if (!tournament.thirdPlaceMatch) return tournament;
  
  const R = tournament.rounds.length;
  if (R < 2) return tournament; // 準決勝が存在しないチーム数

  const sem1 = tournament.rounds[R - 2][0];
  const sem2 = tournament.rounds[R - 2][1];

  let loser1 = null;
  if (sem1 && sem1.winner) {
    loser1 = sem1.winner === sem1.p1 ? sem1.p2 : sem1.p1;
  }

  let loser2 = null;
  if (sem2 && sem2.winner) {
    loser2 = sem2.winner === sem2.p1 ? sem2.p2 : sem2.p1;
  }

  const current = tournament.thirdPlaceMatch;
  const changed1 = current.p1 !== loser1;
  const changed2 = current.p2 !== loser2;

  if (changed1 || changed2) {
    return {
      ...tournament,
      thirdPlaceMatch: {
        ...current,
        p1: loser1,
        p2: loser2,
        score1: null,
        score2: null,
        winner: null
      }
    };
  }

  return tournament;
}

/**
 * 3位決定戦のスコアを入力します。
 */
export function setThirdPlaceScores(tournament, score1, score2) {
  if (!tournament.thirdPlaceMatch) return tournament;

  const s1 = (score1 === '' || score1 === null || score1 === undefined) ? null : Number(score1);
  const s2 = (score2 === '' || score2 === null || score2 === undefined) ? null : Number(score2);

  let winner = null;
  if (s1 !== null && s2 !== null) {
    if (s1 > s2) {
      winner = tournament.thirdPlaceMatch.p1;
    } else if (s2 > s1) {
      winner = tournament.thirdPlaceMatch.p2;
    }
  }

  return {
    ...tournament,
    thirdPlaceMatch: {
      ...tournament.thirdPlaceMatch,
      score1: s1,
      score2: s2,
      winner
    }
  };
}

/**
 * チーム名をインライン編集で変更した際、トーナメント全体（3位決定戦含む）でその名前を置換します。
 */
export function renameTeam(tournament, leafIndex, newName) {
  const oldName = tournament.teams[leafIndex];
  if (oldName === newName) return tournament;

  const newTeams = [...tournament.teams];
  newTeams[leafIndex] = newName;

  const newRounds = tournament.rounds.map((round) =>
    round.map((match) => {
      const p1 = match.p1 === oldName ? newName : match.p1;
      const p2 = match.p2 === oldName ? newName : match.p2;
      const winner = match.winner === oldName ? newName : match.winner;
      return { ...match, p1, p2, winner };
    })
  );

  let updated = {
    ...tournament,
    teams: newTeams,
    rounds: newRounds
  };

  // 3位決定戦の名前も置換
  if (updated.thirdPlaceMatch) {
    const tp = updated.thirdPlaceMatch;
    updated.thirdPlaceMatch = {
      ...tp,
      p1: tp.p1 === oldName ? newName : tp.p1,
      p2: tp.p2 === oldName ? newName : tp.p2,
      winner: tp.winner === oldName ? newName : tp.winner
    };
  }

  return updated;
}

/**
 * 指定したスロットが初期スロットかどうか判定します。
 */
export function getLeafIndex(rounds, r, m, slotKey) {
  if (r === 0) {
    return slotKey === 'p1' ? 2 * m : 2 * m + 1;
  }
  const childMatchIndex = 2 * m + (slotKey === 'p2' ? 1 : 0);
  const childMatch = rounds[r - 1][childMatchIndex];
  
  if (childMatch && childMatch.p2 === null) {
    return getLeafIndex(rounds, r - 1, childMatchIndex, 'p1');
  }
  return null;
}

/**
 * 初期スロット間でチームの位置をスワップし、既存のスコアや結果を極力維持します。
 */
export function swapInitialSlots(tournament, idx1, idx2) {
  const newTeams = [...tournament.teams];
  const t1 = newTeams[idx1];
  const t2 = newTeams[idx2];
  newTeams[idx1] = t2;
  newTeams[idx2] = t1;

  const P = newTeams.length;
  const R = Math.log2(P);
  const newRounds = [];

  // 1回戦の再構築
  newRounds[0] = [];
  for (let m = 0; m < P / 2; m++) {
    const p1 = newTeams[2 * m];
    const p2 = newTeams[2 * m + 1];
    
    const oldMatch = tournament.rounds[0][m];
    let winner = null;
    let score1 = null;
    let score2 = null;

    if (p1 === null || p2 === null) {
      winner = p1 || p2;
    } else if (oldMatch) {
      if (oldMatch.p1 === p1 && oldMatch.p2 === p2) {
        score1 = oldMatch.score1;
        score2 = oldMatch.score2;
        winner = oldMatch.winner;
      } else if (oldMatch.p1 === p2 && oldMatch.p2 === p1) {
        score1 = oldMatch.score2;
        score2 = oldMatch.score1;
        if (oldMatch.winner) {
          winner = oldMatch.winner;
        }
      }
    }

    newRounds[0].push({
      id: `r0-m${m}`,
      p1,
      p2,
      score1,
      score2,
      winner
    });
  }

  // 2回戦以降の再構築と勝者の維持判定
  for (let r = 1; r < R; r++) {
    newRounds[r] = [];
    const matchesInRound = P / Math.pow(2, r + 1);
    for (let m = 0; m < matchesInRound; m++) {
      const prevMatch1 = newRounds[r - 1][2 * m];
      const prevMatch2 = newRounds[r - 1][2 * m + 1];
      const p1 = prevMatch1 ? prevMatch1.winner : null;
      const p2 = prevMatch2 ? prevMatch2.winner : null;

      const oldMatch = tournament.rounds[r][m];
      let winner = null;
      let score1 = null;
      let score2 = null;

      if (oldMatch) {
        if (oldMatch.p1 === p1 && oldMatch.p2 === p2) {
          score1 = oldMatch.score1;
          score2 = oldMatch.score2;
          winner = oldMatch.winner;
        } else if (oldMatch.p1 === p2 && oldMatch.p2 === p1) {
          score1 = oldMatch.score2;
          score2 = oldMatch.score1;
          if (oldMatch.winner) {
            winner = oldMatch.winner;
          }
        }
      }

      newRounds[r].push({
        id: `r${r}-m${m}`,
        p1,
        p2,
        score1,
        score2,
        winner
      });
    }
  }

  let updated = {
    ...tournament,
    teams: newTeams,
    rounds: newRounds
  };

  // 3位決定戦も同期更新する
  updated = updateThirdPlaceMatch(updated);

  return updated;
}

/**
 * 日本のトーナメント表（左側にチームリスト、右に樹形図）に合わせた座標 (X, Y) を計算します。
 */
export function calculateLayoutCoords(rounds, teams, colWidth = 180, rowHeight = 60, padX = 220, padY = 80) {
  const coords = {}; // key: 'r-m' -> { x, y, y1, y2, x1, x2 }
  const R = rounds.length;

  const activeTeamIndices = [];
  for (let i = 0; i < teams.length; i++) {
    if (teams[i] !== null) {
      activeTeamIndices.push(i);
    }
  }
  const leafToRowMap = {};
  activeTeamIndices.forEach((leafIdx, rowIdx) => {
    leafToRowMap[leafIdx] = rowIdx;
  });

  const getLeafY = (leafIdx) => {
    const row = leafToRowMap[leafIdx];
    return padY + row * rowHeight;
  };

  const isByeMatch = (roundIdx, matchIdx) => {
    if (roundIdx !== 0) return false; // バイ（シード不戦勝）は1回戦のみ
    const match = rounds[0][matchIdx];
    return match && (match.p1 === null || match.p2 === null);
  };

  // 樹形図座標の計算
  for (let r = 0; r < R; r++) {
    const x = padX + (r + 1) * colWidth;
    for (let m = 0; m < rounds[r].length; m++) {
      const match = rounds[r][m];
      let y1, y2, x1, x2, y;

      if (r === 0) {
        const leaf1 = 2 * m;
        const leaf2 = 2 * m + 1;

        if (match.p1 === null || match.p2 === null) {
          const activeLeaf = match.p1 === null ? leaf2 : leaf1;
          y = getLeafY(activeLeaf);
          y1 = y;
          y2 = y;
          x1 = padX;
          x2 = padX;
        } else {
          y1 = getLeafY(leaf1);
          y2 = getLeafY(leaf2);
          y = (y1 + y2) / 2;
          x1 = padX;
          x2 = padX;
        }
      } else {
        const child1Coord = coords[`${r - 1}-${2 * m}`];
        const child2Coord = coords[`${r - 1}-${2 * m + 1}`];

        y1 = child1Coord.y;
        y2 = child2Coord.y;
        y = (y1 + y2) / 2;

        const child1IsBye = isByeMatch(r - 1, 2 * m);
        const child2IsBye = isByeMatch(r - 1, 2 * m + 1);

        x1 = child1IsBye ? padX : padX + r * colWidth;
        x2 = child2IsBye ? padX : padX + r * colWidth;
      }

      coords[`${r}-${m}`] = { x, y, y1, y2, x1, x2 };
    }
  }

  // 決勝の勝者（優勝カップ）
  const lastRoundIdx = R - 1;
  const finalsCoord = coords[`${lastRoundIdx}-0`];
  coords['champion'] = {
    x: finalsCoord.x + 80,
    y: finalsCoord.y
  };

  // 3位決定戦用のレイアウト座標（決勝の 120px 下に配置、横位置は決勝と同じ）
  const gap = 120;
  const tpY = finalsCoord.y + gap;
  coords['third-place'] = {
    x: finalsCoord.x,
    y: tpY,
    y1: tpY - 20,
    y2: tpY + 20,
    x1: finalsCoord.x - 60,
    x2: finalsCoord.x - 60
  };
  coords['third-place-winner'] = {
    x: finalsCoord.x + 80,
    y: tpY
  };

  return coords;
}

/**
 * 初期スロット間で「対戦（マッチ）単位」で位置をスワップし、既存のスコアや結果を極力維持します。
 */
export function swapInitialMatches(tournament, m1, m2) {
  const newTeams = [...tournament.teams];
  
  // マッチ m1 のペアと マッチ m2 のペアをスワップする
  const t1_p1 = newTeams[2 * m1];
  const t1_p2 = newTeams[2 * m1 + 1];
  const t2_p1 = newTeams[2 * m2];
  const t2_p2 = newTeams[2 * m2 + 1];

  newTeams[2 * m1] = t2_p1;
  newTeams[2 * m1 + 1] = t2_p2;
  newTeams[2 * m2] = t1_p1;
  newTeams[2 * m2 + 1] = t1_p2;

  const P = newTeams.length;
  const R = Math.log2(P);
  const newRounds = [];

  // 1回戦の再構築
  newRounds[0] = [];
  for (let m = 0; m < P / 2; m++) {
    const p1 = newTeams[2 * m];
    const p2 = newTeams[2 * m + 1];
    
    let oldMatchSourceIdx = m;
    if (m === m1) oldMatchSourceIdx = m2;
    else if (m === m2) oldMatchSourceIdx = m1;

    const oldMatch = tournament.rounds[0][oldMatchSourceIdx];
    let winner = null;
    let score1 = null;
    let score2 = null;

    if (p1 === null || p2 === null) {
      winner = p1 || p2;
    } else if (oldMatch) {
      if (oldMatch.p1 === p1 && oldMatch.p2 === p2) {
        score1 = oldMatch.score1;
        score2 = oldMatch.score2;
        winner = oldMatch.winner;
      } else if (oldMatch.p1 === p2 && oldMatch.p2 === p1) {
        score1 = oldMatch.score2;
        score2 = oldMatch.score1;
        if (oldMatch.winner) {
          winner = oldMatch.winner;
        }
      }
    }

    newRounds[0].push({
      id: `r0-m${m}`,
      p1,
      p2,
      score1,
      score2,
      winner
    });
  }

  // 2回戦以降の再構築と勝者の維持判定
  for (let r = 1; r < R; r++) {
    newRounds[r] = [];
    const matchesInRound = P / Math.pow(2, r + 1);
    for (let m = 0; m < matchesInRound; m++) {
      const prevMatch1 = newRounds[r - 1][2 * m];
      const prevMatch2 = newRounds[r - 1][2 * m + 1];
      const p1 = prevMatch1 ? prevMatch1.winner : null;
      const p2 = prevMatch2 ? prevMatch2.winner : null;

      const oldMatch = tournament.rounds[r][m];
      let winner = null;
      let score1 = null;
      let score2 = null;

      if (oldMatch) {
        if (oldMatch.p1 === p1 && oldMatch.p2 === p2) {
          score1 = oldMatch.score1;
          score2 = oldMatch.score2;
          winner = oldMatch.winner;
        } else if (oldMatch.p1 === p2 && oldMatch.p2 === p1) {
          score1 = oldMatch.score2;
          score2 = oldMatch.score1;
          if (oldMatch.winner) {
            winner = oldMatch.winner;
          }
        }
      }

      newRounds[r].push({
        id: `r${r}-m${m}`,
        p1,
        p2,
        score1,
        score2,
        winner
      });
    }
  }

  let updated = {
    ...tournament,
    teams: newTeams,
    rounds: newRounds
  };

  updated = updateThirdPlaceMatch(updated);

  return updated;
}
