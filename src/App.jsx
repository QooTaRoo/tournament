import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Plus, Trash2, ChevronLeft, ZoomIn, ZoomOut, 
  RotateCcw, Edit2, Move, Check, X, Save, Upload, Download,
  Users, Edit3, HelpCircle, FileText
} from 'lucide-react';
import {
  createTournament,
  setMatchScores,
  renameTeam,
  getLeafIndex,
  swapInitialSlots,
  calculateLayoutCoords,
  getBracketSize,
  updateThirdPlaceMatch,
  setThirdPlaceScores,
  swapInitialMatches
} from './tournamentUtils';

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'setup', 'bracket'
  const [savedTournaments, setSavedTournaments] = useState([]);
  const [currentTournament, setCurrentTournament] = useState(null);
  
  // セットアップ用ステート
  const [setupTeamCount, setSetupTeamCount] = useState(8);
  const [setupName, setSetupName] = useState('');
  const [setupThirdPlace, setSetupThirdPlace] = useState(false);
  const [setupLayoutStyle, setSetupLayoutStyle] = useState('single-sided'); // 'single-sided', 'double-sided'

  // ズーム・パン用ステート
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const viewportRef = useRef(null);
  const touchStartDistRef = useRef(null);
  const touchStartZoomRef = useRef(1);
  const isPinchingRef = useRef(false);
  const touchStartContentCenterRef = useRef({ x: 0, y: 0 });

  // 編集・スワップ用ステート
  const [editingLeafIndex, setEditingLeafIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [swapSourceMatchIndex, setSwapSourceMatchIndex] = useState(null);
  
  // 得点（スコア）編集ポップオーバー用ステート
  const [activeScoreEdit, setActiveScoreEdit] = useState(null); // { roundIndex, matchIndex, x, y, isThirdPlace }
  const [popoverScore1, setPopoverScore1] = useState('');
  const [popoverScore2, setPopoverScore2] = useState('');
  const [popoverMaxSets, setPopoverMaxSets] = useState(1);
  const [popoverSets, setPopoverSets] = useState([{ score1: '', score2: '' }]);

  // 一括編集モーダル用ステート
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTeamsText, setBulkTeamsText] = useState('');

  // ローカルストレージからロード
  useEffect(() => {
    const list = localStorage.getItem('tournaments');
    if (list) {
      try {
        setSavedTournaments(JSON.parse(list));
      } catch (e) {
        console.error('Failed to parse saved tournaments:', e);
      }
    }
  }, []);

  const saveTournamentList = (newList) => {
    setSavedTournaments(newList);
    localStorage.setItem('tournaments', JSON.stringify(newList));
  };

  const handleSaveCurrent = (updatedTournament = currentTournament) => {
    if (!updatedTournament) return;
    const filtered = savedTournaments.filter(t => t.id !== updatedTournament.id);
    const newList = [updatedTournament, ...filtered];
    saveTournamentList(newList);
    setCurrentTournament(updatedTournament);
  };

  const handleCreate = () => {
    const name = setupName.trim() || `${setupTeamCount}チームのトーナメント`;
    const newTournament = createTournament(name, setupTeamCount, setupThirdPlace, setupLayoutStyle);
    setCurrentTournament(newTournament);
    
    const newList = [newTournament, ...savedTournaments];
    saveTournamentList(newList);
    
    setView('bracket');
    setZoom(1);
    setSwapSourceMatchIndex(null);
    setEditingLeafIndex(null);
    setActiveScoreEdit(null);
    setSetupName('');
    setSetupThirdPlace(false);
    setSetupLayoutStyle('single-sided');
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('このトーナメントを削除してもよろしいですか？')) {
      const newList = savedTournaments.filter(t => t.id !== id);
      saveTournamentList(newList);
      if (currentTournament && currentTournament.id === id) {
        setCurrentTournament(null);
        setView('dashboard');
      }
    }
  };

  const handleTitleChange = (newName) => {
    if (!currentTournament) return;
    const updated = { ...currentTournament, name: newName };
    handleSaveCurrent(updated);
  };

  // インライン名前編集
  const startEditingName = (leafIdx, e) => {
    e.stopPropagation();
    setEditingLeafIndex(leafIdx);
    setEditingValue(currentTournament.teams[leafIdx] || '');
  };

  const submitNameChange = (leafIdx) => {
    if (editingValue.trim() === '') return;
    let updated = renameTeam(currentTournament, leafIdx, editingValue.trim());
    updated = updateThirdPlaceMatch(updated); // 3位決定戦の名前も同期
    handleSaveCurrent(updated);
    setEditingLeafIndex(null);
  };

  // 対戦（マッチ）単位のスワップ
  const startMatchSwap = (matchIndex) => {
    if (swapSourceMatchIndex === matchIndex) {
      setSwapSourceMatchIndex(null);
    } else {
      setSwapSourceMatchIndex(matchIndex);
    }
  };

  const handleMatchSwapSelect = (targetMatchIndex) => {
    if (swapSourceMatchIndex === null || swapSourceMatchIndex === targetMatchIndex) {
      setSwapSourceMatchIndex(null);
      return;
    }
    const updated = swapInitialMatches(currentTournament, swapSourceMatchIndex, targetMatchIndex);
    handleSaveCurrent(updated);
    setSwapSourceMatchIndex(null);
  };

  // 3位決定戦の動的トグルON/OFF（対戦表画面から設定変更）
  const toggleThirdPlace = () => {
    if (!currentTournament) return;
    let updated;
    if (currentTournament.thirdPlaceMatch) {
      updated = { ...currentTournament, thirdPlaceMatch: null };
    } else {
      updated = {
        ...currentTournament,
        thirdPlaceMatch: {
          p1: null,
          p2: null,
          score1: null,
          score2: null,
          winner: null
        }
      };
      updated = updateThirdPlaceMatch(updated); // 準決勝結果から自動配分
    }
    handleSaveCurrent(updated);
  };

  // スコアポップオーバーを開く
  const openScoreEdit = (roundIndex, matchIndex, x, y, isThirdPlace = false) => {
    const loadMatchData = (match) => {
      setPopoverScore1(match.score1 !== null ? String(match.score1) : '');
      setPopoverScore2(match.score2 !== null ? String(match.score2) : '');
      
      const maxSets = match.maxSets || 1;
      setPopoverMaxSets(maxSets);
      
      if (match.sets && match.sets.length > 0) {
        setPopoverSets(match.sets.map(s => ({
          score1: s.score1 !== null ? String(s.score1) : '',
          score2: s.score2 !== null ? String(s.score2) : ''
        })));
      } else {
        setPopoverSets([
          {
            score1: match.score1 !== null ? String(match.score1) : '',
            score2: match.score2 !== null ? String(match.score2) : ''
          }
        ]);
      }
    };

    if (isThirdPlace) {
      const tp = currentTournament.thirdPlaceMatch;
      if (!tp || tp.p1 === null || tp.p2 === null) return;
      setActiveScoreEdit({ roundIndex: -1, matchIndex: -1, x, y, isThirdPlace: true });
      loadMatchData(tp);
    } else {
      const match = currentTournament.rounds[roundIndex][matchIndex];
      if (match.p1 === null || match.p2 === null) return;
      setActiveScoreEdit({ roundIndex, matchIndex, x, y, isThirdPlace: false });
      loadMatchData(match);
    }
  };

  // スコアポップオーバーの保存 (勝者はスコアから自動算出)
  const saveMatchScoresAndWinner = () => {
    if (!activeScoreEdit || !currentTournament) return;
    const { roundIndex, matchIndex, isThirdPlace } = activeScoreEdit;

    let updated = { ...currentTournament };
    
    // popoverSetsを数値に変換
    const finalSets = popoverMaxSets > 1 
      ? popoverSets.map(s => ({
          score1: s.score1 === '' ? null : Number(s.score1),
          score2: s.score2 === '' ? null : Number(s.score2)
        }))
      : null;

    if (isThirdPlace) {
      // 3位決定戦スコア更新
      updated = setThirdPlaceScores(updated, popoverScore1, popoverScore2, finalSets, popoverMaxSets);
    } else {
      // 本戦スコア更新
      const newRounds = setMatchScores(
        currentTournament.rounds,
        roundIndex,
        matchIndex,
        popoverScore1,
        popoverScore2,
        finalSets,
        popoverMaxSets
      );
      updated.rounds = newRounds;
      // 3位決定戦への敗者伝播を同期
      updated = updateThirdPlaceMatch(updated);
    }

    handleSaveCurrent(updated);
    setActiveScoreEdit(null);
  };

  // マッチ形式（セット数）変更時の処理
  const handleMaxSetsChange = (newMaxSets) => {
    setPopoverMaxSets(newMaxSets);
    
    let newSets = [...popoverSets];
    if (newSets.length < newMaxSets) {
      while (newSets.length < newMaxSets) {
        newSets.push({ score1: '', score2: '' });
      }
    } else if (newSets.length > newMaxSets) {
      newSets = newSets.slice(0, newMaxSets);
    }
    setPopoverSets(newSets);

    // 獲得セット数を再計算
    recalcSetCount(newSets);
  };

  // 各セット得点の変更時の処理
  const handleSetScoreChange = (index, teamKey, value) => {
    const newSets = popoverSets.map((set, i) => {
      if (i === index) {
        return { ...set, [teamKey]: value };
      }
      return set;
    });
    setPopoverSets(newSets);
    recalcSetCount(newSets);
  };

  // セットスコアから獲得セット数を計算してpopoverScoreステートを更新
  const recalcSetCount = (setsList) => {
    let p1Sets = 0;
    let p2Sets = 0;
    let hasValidScore = false;

    setsList.forEach(set => {
      const s1 = set.score1 !== '' ? Number(set.score1) : null;
      const s2 = set.score2 !== '' ? Number(set.score2) : null;
      if (s1 !== null && s2 !== null) {
        hasValidScore = true;
        if (s1 > s2) p1Sets++;
        else if (s2 > s1) p2Sets++;
      }
    });

    if (hasValidScore) {
      setPopoverScore1(String(p1Sets));
      setPopoverScore2(String(p2Sets));
    } else {
      setPopoverScore1('');
      setPopoverScore2('');
    }
  };

  // 一括名前編集
  const openBulkModal = () => {
    if (!currentTournament) return;
    const teamNames = currentTournament.teams.filter(t => t !== null);
    setBulkTeamsText(teamNames.join('\n'));
    setIsBulkModalOpen(true);
  };

  const saveBulkNames = () => {
    if (!currentTournament) return;
    const lines = bulkTeamsText.split('\n').map(l => l.trim()).filter(l => l !== '');
    let updated = { ...currentTournament };
    
    let nameIdx = 0;
    const newTeams = currentTournament.teams.map((t) => {
      if (t === null) return null;
      return nameIdx < lines.length ? lines[nameIdx++] : `Team ${nameIdx + 1}`;
    });

    const P = newTeams.length;
    const R = Math.log2(P);
    const newRounds = [];

    newRounds[0] = [];
    for (let m = 0; m < P / 2; m++) {
      const p1 = newTeams[2 * m];
      const p2 = newTeams[2 * m + 1];
      const oldMatch = currentTournament.rounds[0][m];
      
      let winner = null;
      if (p1 === null || p2 === null) {
        winner = p1 || p2;
      } else if (oldMatch && oldMatch.winner) {
        const wasP1Winner = oldMatch.winner === oldMatch.p1;
        winner = wasP1Winner ? p1 : p2;
      }

      newRounds[0].push({
        id: `r0-m${m}`,
        p1,
        p2,
        score1: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? oldMatch.score1 : null,
        score2: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? oldMatch.score2 : null,
        sets: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? (oldMatch.sets || null) : null,
        maxSets: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? (oldMatch.maxSets || 1) : 1,
        winner
      });
    }

    for (let r = 1; r < R; r++) {
      newRounds[r] = [];
      const matchesInRound = P / Math.pow(2, r + 1);
      for (let m = 0; m < matchesInRound; m++) {
        const prevMatch1 = newRounds[r - 1][2 * m];
        const prevMatch2 = newRounds[r - 1][2 * m + 1];
        const p1 = prevMatch1 ? prevMatch1.winner : null;
        const p2 = prevMatch2 ? prevMatch2.winner : null;
        
        const oldMatch = currentTournament.rounds[r][m];
        let winner = null;
        if (oldMatch && oldMatch.winner) {
          const wasP1Winner = oldMatch.winner === oldMatch.p1;
          winner = wasP1Winner ? p1 : p2;
        }

        newRounds[r].push({
          id: `r${r}-m${m}`,
          p1,
          p2,
          score1: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? oldMatch.score1 : null,
          score2: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? oldMatch.score2 : null,
          sets: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? (oldMatch.sets || null) : null,
          maxSets: (oldMatch && oldMatch.p1 === p1 && oldMatch.p2 === p2) ? (oldMatch.maxSets || 1) : 1,
          winner
        });
      }
    }

    updated.teams = newTeams;
    updated.rounds = newRounds;
    
    // 敗者伝播を再計算
    updated = updateThirdPlaceMatch(updated);
    
    handleSaveCurrent(updated);
    setIsBulkModalOpen(false);
  };

  // インポート / エクスポート
  const handleExport = () => {
    if (!currentTournament) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentTournament, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentTournament.name}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.id && imported.name && Array.isArray(imported.rounds)) {
          const newList = [imported, ...savedTournaments.filter(t => t.id !== imported.id)];
          saveTournamentList(newList);
          setCurrentTournament(imported);
          setView('bracket');
          setZoom(1);
          alert('トーナメントを読み込みました！');
        } else {
          alert('無効なファイル形式です。');
        }
      } catch (err) {
        alert('JSONファイルの解析に失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ズーム
  const handleZoom = (direction) => {
    if (direction === 'in') {
      setZoom(z => Math.min(1.5, z + 0.1));
    } else if (direction === 'out') {
      setZoom(z => Math.max(0.4, z - 0.1));
    } else {
      setZoom(1);
    }
  };

  // パン
  const handleMouseDown = (e) => {
    if (e.target.closest('.team-row-card') || e.target.closest('.controls-overlay') || e.target.closest('.score-popover') || e.target.closest('button') || e.target.closest('input')) return;
    setIsDragging(true);
    setDragStart({
      x: e.pageX - viewportRef.current.offsetLeft,
      y: e.pageY - viewportRef.current.offsetTop,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - viewportRef.current.offsetLeft;
    const y = e.pageY - viewportRef.current.offsetTop;
    const walkX = (x - dragStart.x) * 1.2;
    const walkY = (y - dragStart.y) * 1.2;
    viewportRef.current.scrollLeft = dragStart.scrollLeft - walkX;
    viewportRef.current.scrollTop = dragStart.scrollTop - walkY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // タッチによるパンおよびピンチズーム（スマホ対応）
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;

      const rect = viewportRef.current.getBoundingClientRect();
      const clientX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const clientY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      touchStartContentCenterRef.current = {
        x: (viewportRef.current.scrollLeft + clientX) / zoom,
        y: (viewportRef.current.scrollTop + clientY) / zoom
      };
      return;
    }

    if (e.touches.length > 1) return;
    isPinchingRef.current = false;
    const touch = e.touches[0];
    if (
      touch.target.closest('.team-row-card') || 
      touch.target.closest('.controls-overlay') || 
      touch.target.closest('.score-popover') || 
      touch.target.closest('button') || 
      touch.target.closest('input')
    ) return;
    setIsDragging(true);
    setDragStart({
      x: touch.pageX - viewportRef.current.offsetLeft,
      y: touch.pageY - viewportRef.current.offsetTop,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop
    });
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && isPinchingRef.current && touchStartDistRef.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDistRef.current;
      const newZoom = Math.max(0.4, Math.min(1.5, touchStartZoomRef.current * factor));
      
      const rect = viewportRef.current.getBoundingClientRect();
      const clientX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const clientY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      
      const newScrollLeft = touchStartContentCenterRef.current.x * newZoom - clientX;
      const newScrollTop = touchStartContentCenterRef.current.y * newZoom - clientY;
      
      setZoom(newZoom);
      viewportRef.current.scrollLeft = newScrollLeft;
      viewportRef.current.scrollTop = newScrollTop;
      return;
    }

    if (!isDragging || isPinchingRef.current) return;
    if (e.touches.length > 1) return;
    const touch = e.touches[0];
    const x = touch.pageX - viewportRef.current.offsetLeft;
    const y = touch.pageY - viewportRef.current.offsetTop;
    const walkX = (x - dragStart.x) * 1.5;
    const walkY = (y - dragStart.y) * 1.5;
    viewportRef.current.scrollLeft = dragStart.scrollLeft - walkX;
    viewportRef.current.scrollTop = dragStart.scrollTop - walkY;
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      isPinchingRef.current = false;
      touchStartDistRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  // タッチハンドラーの最新参照を保持するRef
  const touchStartRef = useRef(handleTouchStart);
  const touchMoveRef = useRef(handleTouchMove);
  const touchEndRef = useRef(handleTouchEnd);

  useEffect(() => {
    touchStartRef.current = handleTouchStart;
    touchMoveRef.current = handleTouchMove;
    touchEndRef.current = handleTouchEnd;
  });

  const viewportRefCallback = React.useCallback((node) => {
    if (node) {
      const onTouchStart = (e) => touchStartRef.current(e);
      const onTouchMove = (e) => touchMoveRef.current(e);
      const onTouchEnd = (e) => touchEndRef.current(e);

      node.addEventListener('touchstart', onTouchStart, { passive: true });
      node.addEventListener('touchmove', onTouchMove, { passive: false });
      node.addEventListener('touchend', onTouchEnd, { passive: true });

      node._touchCleanups = () => {
        node.removeEventListener('touchstart', onTouchStart);
        node.removeEventListener('touchmove', onTouchMove);
        node.removeEventListener('touchend', onTouchEnd);
      };
      viewportRef.current = node;
    } else {
      if (viewportRef.current && viewportRef.current._touchCleanups) {
        viewportRef.current._touchCleanups();
      }
      viewportRef.current = null;
    }
  }, []);



  // 定数
  const COL_WIDTH = 140;
  const ROW_HEIGHT = 64;
  const PAD_X = 220;
  const isBracketView = view === 'bracket' && currentTournament;
  const P = isBracketView ? currentTournament.teams.length : 8;
  const R = Math.log2(P);
  const N = isBracketView ? currentTournament.teamCount : 8;
  const layoutStyle = isBracketView ? (currentTournament.layoutStyle || 'single-sided') : 'single-sided';
  const isDoubleSided = layoutStyle === 'double-sided';
  const PAD_Y = (isDoubleSided && N <= 8) ? 140 : 100;
  
  // 座標マップ
  const coords = isBracketView ? calculateLayoutCoords(currentTournament.rounds, currentTournament.teams, COL_WIDTH, ROW_HEIGHT, PAD_X, PAD_Y, layoutStyle) : {};
  
  // 3位決定戦がある場合は高さを拡張
  const hasTPMatch = isBracketView && currentTournament.thirdPlaceMatch != null;
  const svgWidth = isBracketView 
    ? (isDoubleSided ? 2 * R * COL_WIDTH + 2 * PAD_X : R * COL_WIDTH + 2 * PAD_X) 
    : 800;
  const effectiveN = isDoubleSided ? Math.max(Math.ceil(N / 2), 2) : N;
  const svgHeight = isBracketView ? Math.max(500, effectiveN * ROW_HEIGHT + 2 * PAD_Y + (hasTPMatch ? 220 : 0)) : 600;

  const getRoundLabel = (r) => {
    const diff = R - 1 - r;
    if (diff === 0) return '決勝';
    if (diff === 1) return '準決勝';
    if (diff === 2) return '準々決勝';
    return `${r + 1}回戦`;
  };

  // アクティブチームリスト
  const activeTeamsList = [];
  if (isBracketView) {
    currentTournament.teams.forEach((name, idx) => {
      if (name !== null) {
        activeTeamsList.push({ name, leafIdx: idx });
      }
    });
  }

  return (
    <div className="app-container">
      {/* 共通ヘッダー */}
      <header className="header">
        <div className="header-title-container">
          <Trophy className="header-logo" size={28} />
          {view === 'bracket' && currentTournament ? (
            <input
              type="text"
              className="tournament-title-input"
              value={currentTournament.name}
              onChange={(e) => handleTitleChange(e.target.value)}
              title="クリックしてタイトルを編集"
            />
          ) : (
            <h1>トーナメント表作成</h1>
          )}
        </div>
        <div className="header-actions">
          {view === 'bracket' && currentTournament && currentTournament.teamCount >= 4 && (
            <label className="toggle-container" title="3位決定戦をON/OFF">
              <input
                type="checkbox"
                className="toggle-input"
                checked={currentTournament.thirdPlaceMatch !== null}
                onChange={toggleThirdPlace}
              />
              <span>3位決定戦を行う</span>
            </label>
          )}
          {view !== 'dashboard' && (
            <button className="btn" onClick={() => { setView('dashboard'); setSwapSourceMatchIndex(null); setActiveScoreEdit(null); }}>
              <ChevronLeft size={18} /> 一覧に戻る
            </button>
          )}
          {view === 'dashboard' && (
            <>
              <label className="btn" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                <Upload size={18} /> インポート
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
              <button className="btn btn-primary" onClick={() => setView('setup')}>
                <Plus size={18} /> 新規作成
              </button>
            </>
          )}
          {view === 'bracket' && (
            <>
              <button className="btn" onClick={openBulkModal}>
                <Edit3 size={18} /> 名前一括編集
              </button>
              <button className="btn" onClick={handleExport}>
                <Download size={18} /> エクスポート
              </button>
            </>
          )}
        </div>
      </header>

      {/* メインエリア */}
      <main className="main-content">
        {/* 1. ダッシュボード */}
        {view === 'dashboard' && (
          <div className="dashboard">
            <div className="dashboard-header">
              <h2>保存済みのトーナメント</h2>
            </div>
            {savedTournaments.length === 0 ? (
              <div className="empty-state">
                <Trophy className="empty-state-icon" size={64} />
                <p style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 8px 0' }}>トーナメントがありません</p>
                <p style={{ margin: '0 0 20px 0' }}>新しく作成するか、既存のJSONファイルをインポートしてください。</p>
                <button className="btn btn-primary" onClick={() => setView('setup')}>
                  <Plus size={18} /> 最初のトーナメントを作成
                </button>
              </div>
            ) : (
              <div className="tournament-grid">
                {savedTournaments.map((t) => (
                  <div 
                    key={t.id} 
                    className="tournament-card"
                    onClick={() => { setCurrentTournament(t); setView('bracket'); setZoom(1); setSwapSourceMatchIndex(null); setActiveScoreEdit(null); }}
                  >
                    <div className="tournament-card-title">{t.name}</div>
                    <div className="tournament-card-meta">
                      <span>形式: {t.layoutStyle === 'double-sided' ? '両側表示' : '片側表示'}</span>
                      <span>チーム数: {t.teamCount}</span>
                      <span>3位決定戦: {t.thirdPlaceMatch ? 'あり' : 'なし'}</span>
                      <span>作成: {new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button 
                      className="delete-card-btn" 
                      onClick={(e) => handleDelete(t.id, e)}
                      title="トーナメントを削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. セットアップ画面 */}
        {view === 'setup' && (
          <div className="setup-container">
            <h2 className="setup-title">トーナメントの新規作成</h2>
            
            <div className="form-group">
              <label>トーナメント名</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: サマーカップ 2026"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>チーム数</label>
              <input
                type="number"
                min="2"
                max="64"
                className="form-input"
                value={setupTeamCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setSetupTeamCount('');
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setSetupTeamCount(parsed);
                    }
                  }
                }}
                onBlur={() => {
                  const val = parseInt(setupTeamCount, 10);
                  if (isNaN(val) || val < 2) {
                    setSetupTeamCount(2);
                  } else if (val > 64) {
                    setSetupTeamCount(64);
                  } else {
                    setSetupTeamCount(val);
                  }
                }}
              />
            </div>

             {setupTeamCount >= 4 && (
              <div className="form-group">
                <label className="toggle-container" style={{ fontSize: '0.95rem' }}>
                  <input
                    type="checkbox"
                    className="toggle-input"
                    checked={setupThirdPlace}
                    onChange={(e) => setSetupThirdPlace(e.target.checked)}
                  />
                  <span>3位決定戦を行う (準決勝敗者同士)</span>
                </label>
              </div>
            )}

            <div className="form-group">
              <label>レイアウト形式</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <label className="toggle-container" style={{ fontSize: '0.95rem' }}>
                  <input
                    type="radio"
                    name="layoutStyle"
                    className="toggle-input"
                    checked={setupLayoutStyle === 'single-sided'}
                    onChange={() => setSetupLayoutStyle('single-sided')}
                  />
                  <span>片側形式 (標準)</span>
                </label>
                <label className="toggle-container" style={{ fontSize: '0.95rem' }}>
                  <input
                    type="radio"
                    name="layoutStyle"
                    className="toggle-input"
                    checked={setupLayoutStyle === 'double-sided'}
                    onChange={() => setSetupLayoutStyle('double-sided')}
                  />
                  <span>両側形式 (左右対称)</span>
                </label>
              </div>
            </div>

            {/* シード情報プレビュー */}
            {(() => {
              const P = getBracketSize(setupTeamCount);
              const byes = P - setupTeamCount;
              if (byes > 0) {
                return (
                  <div className="info-box">
                    <Users size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--accent-primary)' }} />
                    チーム数が2の累乗でないため、<span className="info-box-highlight">{byes}チーム</span>がシード（不戦勝）となり、直接2回戦からスタートします。<span className="info-box-highlight">{setupTeamCount - byes}チーム</span>は1回戦から対戦します。
                  </div>
                );
              } else {
                return (
                  <div className="info-box" style={{ borderLeftColor: 'var(--accent-success)' }}>
                    <Users size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--accent-success)' }} />
                    すべてのチームが1回戦から均等に対戦します（シードはありません）。
                  </div>
                );
              }
            })()}

            <button className="btn btn-primary" onClick={handleCreate} style={{ width: '100%', padding: '12px' }}>
              トーナメント表を生成
            </button>
          </div>
        )}

        {/* 3. トーナメント表描画画面 */}
        {view === 'bracket' && currentTournament && (
          <div className="bracket-wrapper">
            {/* スワップ案内バー */}
            {swapSourceMatchIndex !== null && (
              <div style={{
                position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--accent-secondary)', color: '#fff', padding: '8px 16px',
                borderRadius: '20px', zIndex: 100, display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.9rem', fontWeight: 600
              }}>
                <span>入れ替え元の対戦: 1回戦 第{swapSourceMatchIndex + 1}試合 ➡️ 入れ替え先を選択してください</span>
                <button 
                  onClick={() => setSwapSourceMatchIndex(null)}
                  style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifySelf: 'center' }}
                >
                  <X size={14} style={{ margin: 'auto' }} />
                </button>
              </div>
            )}

            <div 
              className="bracket-viewport" 
              ref={viewportRefCallback}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >

            <div 
              className="bracket-container"
              style={{
                width: `${svgWidth * zoom}px`,
                height: `${svgHeight * zoom}px`,
                position: 'relative'
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: `${svgWidth}px`,
                  height: `${svgHeight}px`,
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}
              >
              {/* コラムヘッダー */}
              <div className="round-label-container">
                {(() => {
                  const headers = [];
                  if (isDoubleSided) {
                    for (let r = 0; r < R - 1; r++) {
                      headers.push({
                        key: `label-left-${r}`,
                        left: PAD_X + (r + 1) * COL_WIDTH,
                        label: getRoundLabel(r)
                      });
                      headers.push({
                        key: `label-right-${r}`,
                        left: PAD_X + (2 * R - 1 - r) * COL_WIDTH,
                        label: getRoundLabel(r)
                      });
                    }
                    headers.push({
                      key: `label-finals`,
                      left: PAD_X + R * COL_WIDTH,
                      label: getRoundLabel(R - 1)
                    });
                  } else {
                    for (let r = 0; r < R; r++) {
                      headers.push({
                        key: `label-${r}`,
                        left: PAD_X + (r + 1) * COL_WIDTH,
                        label: getRoundLabel(r)
                      });
                    }
                  }
                  return headers.map(h => (
                    <div 
                      key={h.key} 
                      className="round-label"
                      style={{ left: `${h.left}px` }}
                    >
                      {h.label}
                    </div>
                  ));
                })()}
              </div>

              {/* チームリスト (HTML) */}
              {(() => {
                let leftCount = 0;
                let rightCount = 0;
                const halfP = P / 2;

                return activeTeamsList.map((team, rowIdx) => {
                  const isRightTeam = isDoubleSided && team.leafIdx >= halfP;
                  let yCoord, leftX, displayNum;

                  const matchIdx = Math.floor(team.leafIdx / 2);
                  const isUpper = team.leafIdx % 2 === 0;
                  const c = coords[`0-${matchIdx}`];

                  if (isRightTeam) {
                    if (c) {
                      yCoord = isUpper ? c.y1 : c.y2;
                      leftX = c.x1 - 18;
                    } else {
                      yCoord = PAD_Y + rightCount * ROW_HEIGHT;
                      leftX = PAD_X + 2 * R * COL_WIDTH - 18;
                    }
                    displayNum = rightCount + 1;
                    rightCount++;
                  } else {
                    if (c) {
                      yCoord = isUpper ? c.y1 : c.y2;
                      leftX = c.x1 - 192;
                    } else {
                      yCoord = PAD_Y + leftCount * ROW_HEIGHT;
                      leftX = PAD_X - 192;
                    }
                    displayNum = leftCount + 1;
                    leftCount++;
                  }

                  return (
                    <div 
                      key={`team-row-${team.leafIdx}`}
                      className={`team-row-container ${isRightTeam ? 'right-side' : ''}`}
                      style={{ 
                        top: `${yCoord}px`,
                        left: `${leftX}px`,
                        flexDirection: isRightTeam ? 'row-reverse' : 'row'
                      }}
                    >
                      <div className="team-row-number">{displayNum}</div>
                      
                      <div className="team-row-card">
                        {editingLeafIndex === team.leafIdx ? (
                          <input
                            type="text"
                            className="inline-edit-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitNameChange(team.leafIdx);
                              if (e.key === 'Escape') setEditingLeafIndex(null);
                            }}
                            onBlur={() => submitNameChange(team.leafIdx)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span className="team-name-text" title={team.name}>
                              {team.name}
                            </span>
                            <div className="slot-actions">
                              <button 
                                className="slot-btn" 
                                onClick={(e) => startEditingName(team.leafIdx, e)}
                                title="チーム名を編集"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* スコア編集用の丸型トリガーボタン (結果を入れられるアクティブ戦のみ表示) */}
              {currentTournament.rounds.map((round, r) => {
                return round.map((match, m) => {
                  if (match.p1 === null || match.p2 === null) return null;
                  const c = coords[`${r}-${m}`];
                  if (!c) return null;

                  const btnX = (r === 0) ? (c.isRight ? c.x - 16 : c.x + 16) : c.x;

                  return (
                    <button
                      key={`btn-edit-${r}-${m}`}
                      className="score-edit-trigger"
                      style={{ left: `${btnX}px`, top: `${c.y}px` }}
                      onClick={() => openScoreEdit(r, m, btnX, c.y, false)}
                      title="スコアを入力する"
                    >
                      <FileText size={13} />
                    </button>
                  );
                });
              })}

              {/* 1回戦の位置変更（対戦スワップ）用トリガーボタン */}
              {currentTournament.rounds[0].map((match, m) => {
                const c = coords[`0-${m}`];
                if (!c) return null;

                const hasScoreBtn = (match.p1 !== null && match.p2 !== null);
                const btnX = hasScoreBtn ? (c.isRight ? c.x + 16 : c.x - 16) : c.x;

                return (
                  <button
                    key={`btn-swap-${m}`}
                    className="match-swap-trigger"
                    style={{ left: `${btnX}px`, top: `${c.y}px` }}
                    onClick={() => startMatchSwap(m)}
                    title="この対戦位置を変更する"
                  >
                    <Move size={13} />
                  </button>
                );
              })}

              {/* 3位決定戦スコア編集用トリガーボタン */}
              {hasTPMatch && currentTournament.thirdPlaceMatch.p1 !== null && currentTournament.thirdPlaceMatch.p2 !== null && (() => {
                const c = coords['third-place'];
                if (!c) return null;
                return (
                  <button
                    className="score-edit-trigger"
                    style={{ left: `${c.x}px`, top: `${c.y}px` }}
                    onClick={() => openScoreEdit(-1, -1, c.x, c.y, true)}
                    title="3位決定戦のスコアを入力する"
                  >
                    <FileText size={13} />
                  </button>
                );
              })()}

              {/* 対戦スワップ時の配置先選択トリガー (樹形図上の1回戦各マッチ中央に配置) */}
              {swapSourceMatchIndex !== null && currentTournament.rounds[0].map((match, m) => {
                if (m === swapSourceMatchIndex) return null;
                const c = coords[`0-${m}`];
                if (!c) return null;

                const team1 = match.p1 || '（空き）';
                const team2 = match.p2 || '（バイ）';

                return (
                  <button
                    key={`swap-target-match-${m}`}
                    className="swap-target-trigger"
                    style={{ left: `${c.x}px`, top: `${c.y}px` }}
                    onClick={() => handleMatchSwapSelect(m)}
                    title={`第${m + 1}試合（${team1} vs ${team2}）の位置と入れ替える`}
                  >
                    <Check size={14} />
                  </button>
                );
              })}

              {/* SVG 樹形図 */}
              <svg className="bracket-svg" width={svgWidth} height={svgHeight}>
                {/* 本戦対戦ライン（勝敗確定による赤線判定） */}
                {currentTournament.rounds.map((round, r) => {
                  return round.map((match, m) => {
                    if (r === 0 && (match.p1 === null || match.p2 === null)) return null;

                    const c = coords[`${r}-${m}`];
                    if (!c) return null;

                    // 赤線判定ルール:
                    // 1) 上部水平線:
                    const child1 = r > 0 ? currentTournament.rounds[r - 1][2 * m] : null;
                    const child1IsBye = child1 && (child1.p1 === null || child1.p2 === null);
                    const isTopActive = match.p1 !== null && (
                      (isDoubleSided && r === R - 1)
                        ? (match.winner !== null && match.winner === match.p1)
                        : ((match.winner !== null && match.winner === match.p1) ||
                           (r > 0 && !child1IsBye && child1 && child1.winner === match.p1))
                    );
                    
                    // 2) 下部水平線:
                    const child2 = r > 0 ? currentTournament.rounds[r - 1][2 * m + 1] : null;
                    const child2IsBye = child2 && (child2.p1 === null || child2.p2 === null);
                    const isBottomActive = match.p2 !== null && (
                      (isDoubleSided && r === R - 1)
                        ? (match.winner !== null && match.winner === match.p2)
                        : ((match.winner !== null && match.winner === match.p2) ||
                           (r > 0 && !child2IsBye && child2 && child2.winner === match.p2))
                    );

                    // 3) 垂直線上半分: p1がこのマッチの勝者であるか
                    const isTopVerticalActive = match.winner !== null && match.winner === match.p1;

                    // 4) 垂直線下半分: p2がこのマッチの勝者であるか
                    const isBottomVerticalActive = match.winner !== null && match.winner === match.p2;

                    // 5) 次へ進む出力線: このマッチの勝者が決定しているか
                    const isOutputActive = match.winner !== null;

                    return (
                      <g key={`lines-${r}-${m}`}>
                        <line
                          className={`connector-line ${isTopActive ? 'active' : ''}`}
                          x1={c.x1} y1={c.y1} x2={c.x} y2={c.y1}
                        />
                        <line
                          className={`connector-line ${isBottomActive ? 'active' : ''}`}
                          x1={c.x2} y1={c.y2} x2={c.x} y2={c.y2}
                        />
                        <line
                          className={`connector-line ${isTopVerticalActive ? 'active' : ''}`}
                          x1={c.x} y1={c.y1} x2={c.x} y2={c.y}
                        />
                        <line
                          className={`connector-line ${isBottomVerticalActive ? 'active' : ''}`}
                          x1={c.x} y1={c.y2} x2={c.x} y2={c.y}
                        />
                        {r < R - 1 && (() => {
                          let isLineActive = isOutputActive;
                          if (isDoubleSided && r === R - 2) {
                            const finalMatch = currentTournament.rounds[R - 1][0];
                            isLineActive = finalMatch.winner !== null && finalMatch.winner === match.winner;
                          }
                          return (
                            <line
                              className={`connector-line ${isLineActive ? 'active' : ''}`}
                              x1={c.x} y1={c.y} x2={c.isRight ? c.x - COL_WIDTH : c.x + COL_WIDTH} y2={c.y}
                            />
                          );
                        })()}
                      </g>
                    );
                  });
                })}

                {/* 4. 3位決定戦対戦ライン */}
                {hasTPMatch && (() => {
                  const c = coords['third-place'];
                  const tp = currentTournament.thirdPlaceMatch;
                  if (!c) return null;

                  const isTopActive = tp.p1 !== null && tp.winner === tp.p1;
                  const isBottomActive = tp.p2 !== null && tp.winner === tp.p2;
                  const isOutputActive = tp.winner !== null;

                  const outputX = isDoubleSided ? c.x : coords['third-place-winner'].x - 130 / 2;
                  const outputY = isDoubleSided ? coords['third-place-winner'].y + 64 / 2 : c.y;

                  if (isDoubleSided) {
                    return (
                      <g key="lines-third-place">
                        <line
                          className={`connector-line ${isTopActive ? 'active' : ''}`}
                          x1={c.x1 + 60} y1={c.y1} x2={c.x1 + 60} y2={c.y}
                        />
                        <line
                          className={`connector-line ${isBottomActive ? 'active' : ''}`}
                          x1={c.x2 - 60} y1={c.y2} x2={c.x2 - 60} y2={c.y}
                        />
                        <line
                          className={`connector-line ${isTopActive ? 'active' : ''}`}
                          x1={c.x1 + 60} y1={c.y} x2={c.x} y2={c.y}
                        />
                        <line
                          className={`connector-line ${isBottomActive ? 'active' : ''}`}
                          x1={c.x2 - 60} y1={c.y} x2={c.x} y2={c.y}
                        />
                        <line
                          className={`connector-line ${isOutputActive ? 'active' : ''}`}
                          x1={c.x} y1={c.y} x2={outputX} y2={outputY}
                        />
                      </g>
                    );
                  }

                  return (
                    <g key="lines-third-place">
                      <line
                        className={`connector-line ${isTopActive ? 'active' : ''}`}
                        x1={c.x1} y1={c.y1} x2={c.x} y2={c.y1}
                      />
                      <line
                        className={`connector-line ${isBottomActive ? 'active' : ''}`}
                        x1={c.x2} y1={c.y2} x2={c.x} y2={c.y2}
                      />
                      <line
                        className={`connector-line ${isTopActive ? 'active' : ''}`}
                        x1={c.x} y1={c.y1} x2={c.x} y2={c.y}
                      />
                      <line
                        className={`connector-line ${isBottomActive ? 'active' : ''}`}
                        x1={c.x} y1={c.y2} x2={c.x} y2={c.y}
                      />
                      <line
                        className={`connector-line ${isOutputActive ? 'active' : ''}`}
                        x1={c.x} y1={c.y} x2={outputX} y2={outputY}
                      />
                    </g>
                  );
                })()}

                {/* 決勝戦から優勝カップへの接続線 */}
                {(() => {
                  const finalsCoord = coords[`${R - 1}-0`];
                  const champCoord = coords['champion'];
                  if (!finalsCoord || !champCoord) return null;

                  const isActive = currentTournament.rounds[R - 1][0].winner !== null;
                  const outputX = isDoubleSided ? finalsCoord.x : champCoord.x - 130 / 2;
                  const outputY = isDoubleSided ? champCoord.y + 64 / 2 : champCoord.y;

                  return (
                    <line
                      className={`connector-line ${isActive ? 'active' : ''}`}
                      x1={finalsCoord.x} y1={finalsCoord.y}
                      x2={outputX} y2={outputY}
                    />
                  );
                })()}

                {/* スコア数値テキスト表示 (本戦) */}
                {currentTournament.rounds.map((round, r) => {
                  return round.map((match, m) => {
                    if (r === 0 && (match.p1 === null || match.p2 === null)) return null;
                    
                    const c = coords[`${r}-${m}`];
                    if (!c) return null;

                    const elements = [];

                    const isFinalDoubleSided = isDoubleSided && r === R - 1;

                    if (match.score1 !== null) {
                      const isWinner = match.winner !== null && match.winner === match.p1;
                      elements.push(
                        <text
                          key={`score1-${r}-${m}`}
                          x={isFinalDoubleSided ? c.x - 50 : c.x - 15}
                          y={isFinalDoubleSided ? c.y + 25 : c.y1 - 6}
                          className={`score-text ${isWinner ? 'winner' : ''}`}
                          onClick={() => openScoreEdit(r, m, c.x, c.y, false)}
                        >
                          {match.score1}
                        </text>
                      );
                    }

                    if (match.score2 !== null) {
                      const isWinner = match.winner !== null && match.winner === match.p2;
                      elements.push(
                        <text
                          key={`score2-${r}-${m}`}
                          x={isFinalDoubleSided ? c.x + 50 : c.x - 15}
                          y={isFinalDoubleSided ? c.y + 25 : c.y2 + 16}
                          className={`score-text ${isWinner ? 'winner' : ''}`}
                          onClick={() => openScoreEdit(r, m, c.x, c.y, false)}
                        >
                          {match.score2}
                        </text>
                      );
                    }

                    return elements;
                  });
                })}

                {/* 3位決定戦のスコア数値テキスト表示 */}
                {hasTPMatch && (() => {
                  const c = coords['third-place'];
                  const tp = currentTournament.thirdPlaceMatch;
                  if (!c) return null;

                  const elements = [];
                  if (tp.score1 !== null) {
                    const isWinner = tp.winner !== null && tp.winner === tp.p1;
                    elements.push(
                      <text
                        key="score1-third-place"
                        x={isDoubleSided ? c.x - 50 : c.x - 15}
                        y={isDoubleSided ? c.y + 30 : c.y1 - 6}
                        className={`score-text ${isWinner ? 'winner' : ''}`}
                        onClick={() => openScoreEdit(-1, -1, c.x, c.y, true)}
                      >
                        {tp.score1}
                      </text>
                    );
                  }
                  if (tp.score2 !== null) {
                    const isWinner = tp.winner !== null && tp.winner === tp.p2;
                    elements.push(
                      <text
                        key="score2-third-place"
                        x={isDoubleSided ? c.x + 50 : c.x - 15}
                        y={isDoubleSided ? c.y + 30 : c.y2 + 16}
                        className={`score-text ${isWinner ? 'winner' : ''}`}
                        onClick={() => openScoreEdit(-1, -1, c.x, c.y, true)}
                      >
                        {tp.score2}
                      </text>
                    );
                  }
                  return elements;
                })()}
              </svg>

              {/* 山の中のセットスコア表示 (HTML絶対配置) */}
              {currentTournament.rounds.map((round, r) => {
                return round.map((match, m) => {
                  if (match.p1 === null || match.p2 === null) return null;

                  const validSets = match.sets && match.sets.length > 0
                    ? match.sets.filter(s => s.score1 !== null && s.score2 !== null)
                    : (match.score1 !== null && match.score2 !== null ? [{ score1: match.score1, score2: match.score2 }] : []);

                  if (validSets.length === 0) return null;

                  const c = coords[`${r}-${m}`];
                  if (!c) return null;

                  const isFinalDoubleSided = isDoubleSided && r === R - 1;
                  const setsOffset = 65;
                  const setsX = isFinalDoubleSided ? c.x : (c.isRight ? c.x + setsOffset : c.x - setsOffset);
                  const setsY = isFinalDoubleSided ? c.y + 18 : c.y;
                  const K = validSets.length;
                  const bracketFontSize = K === 1 ? '16px' : K <= 3 ? '38px' : '65px';

                  return (
                    <div
                      key={`sets-disp-${r}-${m}`}
                      className={`sets-bracket-display ${isFinalDoubleSided ? 'top-aligned' : ''}`}
                      style={{ left: `${setsX}px`, top: `${setsY}px` }}
                      onClick={() => openScoreEdit(r, m, setsX, c.y, false)}
                    >
                      <div className="bracket-left" style={{ fontSize: bracketFontSize }}>(</div>
                      <div className="sets-list-table">
                        {validSets.map((s, idx) => (
                          <div key={idx} className="set-score-row">
                            <span className={`set-score-val p1 ${Number(s.score1) > Number(s.score2) ? 'winner' : ''}`}>
                              {s.score1}
                            </span>
                            <span className="set-score-divider">-</span>
                            <span className={`set-score-val p2 ${Number(s.score2) > Number(s.score1) ? 'winner' : ''}`}>
                              {s.score2}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="bracket-right" style={{ fontSize: bracketFontSize }}>)</div>
                    </div>
                  );
                });
              })}

              {/* 3位決定戦の山の中のセットスコア表示 (HTML絶対配置) */}
              {hasTPMatch && currentTournament.thirdPlaceMatch.p1 !== null && currentTournament.thirdPlaceMatch.p2 !== null && (() => {
                const tp = currentTournament.thirdPlaceMatch;
                const validSets = tp.sets && tp.sets.length > 0
                  ? tp.sets.filter(s => s.score1 !== null && s.score2 !== null)
                  : (tp.score1 !== null && tp.score2 !== null ? [{ score1: tp.score1, score2: tp.score2 }] : []);

                if (validSets.length === 0) return null;

                const c = coords['third-place'];
                if (!c) return null;

                const setsOffset = 65;
                const setsX = isDoubleSided ? c.x : c.x - setsOffset;
                const K = validSets.length;
                const bracketFontSize = K === 1 ? '16px' : K <= 3 ? '38px' : '65px';

                return (
                  <div
                    className={`sets-bracket-display ${isDoubleSided ? 'top-aligned' : ''}`}
                    style={{ left: `${setsX}px`, top: `${isDoubleSided ? c.y + 18 : c.y}px` }}
                    onClick={() => openScoreEdit(-1, -1, setsX, c.y, true)}
                  >
                    <div className="bracket-left" style={{ fontSize: bracketFontSize }}>(</div>
                    <div className="sets-list-table">
                      {validSets.map((s, idx) => (
                        <div key={idx} className="set-score-row">
                          <span className={`set-score-val p1 ${Number(s.score1) > Number(s.score2) ? 'winner' : ''}`}>
                            {s.score1}
                          </span>
                          <span className="set-score-divider">-</span>
                          <span className={`set-score-val p2 ${Number(s.score2) > Number(s.score1) ? 'winner' : ''}`}>
                            {s.score2}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="bracket-right" style={{ fontSize: bracketFontSize }}>)</div>
                  </div>
                );
              })()}

              {/* 5. 得点入力ポップオーバー (HTML絶対配置) */}
              {activeScoreEdit && (() => {
                const { roundIndex, matchIndex, x, y, isThirdPlace } = activeScoreEdit;
                
                const match = isThirdPlace 
                  ? currentTournament.thirdPlaceMatch 
                  : currentTournament.rounds[roundIndex][matchIndex];
                
                if (!match) return null;

                const matchTitle = isThirdPlace 
                  ? '3位決定戦' 
                  : `${getRoundLabel(roundIndex)} 第${matchIndex + 1}試合`;

                // バリデーション条件の計算
                let isSaveDisabled = false;
                let isTieFound = false;
                let warningMessage = '';

                if (popoverMaxSets === 1) {
                  const s1 = popoverScore1;
                  const s2 = popoverScore2;
                  const isTie = s1 !== '' && s2 !== '' && Number(s1) === Number(s2);
                  isSaveDisabled = s1 === '' || s2 === '' || isTie;
                  if (isTie) {
                    warningMessage = '※同点では登録できません';
                  }
                } else {
                  // 複数セットの場合のバリデーション
                  let p1Sets = 0;
                  let p2Sets = 0;
                  
                  popoverSets.forEach((set) => {
                    const s1 = set.score1;
                    const s2 = set.score2;
                    
                    if (s1 !== '' && s2 !== '') {
                      const num1 = Number(s1);
                      const num2 = Number(s2);
                      if (num1 === num2) {
                        isTieFound = true;
                      } else {
                        if (num1 > num2) p1Sets++;
                        else p2Sets++;
                      }
                    }
                  });

                  const neededToWin = Math.ceil(popoverMaxSets / 2);
                  const isWinnerDetermined = p1Sets >= neededToWin || p2Sets >= neededToWin;

                  if (isTieFound) {
                    warningMessage = '※セット内で同点（引き分け）の入力があります';
                    isSaveDisabled = true;
                  } else if (!isWinnerDetermined) {
                    warningMessage = `※勝敗が未確定です（どちらかが${neededToWin}セット先取する必要があります）`;
                    isSaveDisabled = true;
                  }
                }

                return (
                  <div 
                    className="score-popover" 
                    style={{ left: `${x}px`, top: `${y}px` }}
                  >
                    <div className="score-popover-title">{matchTitle}</div>
                    
                    {/* マッチ形式（最大セット数）選択肢 */}
                    <div className="match-type-selector">
                      <div className="selector-label">試合形式:</div>
                      <div className="selector-buttons">
                        {[1, 3, 5].map((s) => (
                          <button
                            key={`sets-btn-${s}`}
                            type="button"
                            className={`selector-btn ${popoverMaxSets === s ? 'active' : ''}`}
                            onClick={() => handleMaxSetsChange(s)}
                          >
                            {s === 1 ? '1セット' : `${s}セット`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {popoverMaxSets === 1 ? (
                      // 1セットマッチ（通常）
                      <>
                        <div className="score-popover-row">
                          <span className="score-popover-team" title={match.p1 || 'Semifinalist 1'}>{match.p1 || '準決勝敗者1'}</span>
                          <input
                            type="number"
                            min="0"
                            className="score-popover-input"
                            value={popoverScore1}
                            onChange={(e) => setPopoverScore1(e.target.value)}
                            placeholder="0"
                            autoFocus
                          />
                        </div>
                        
                        <div className="score-popover-row">
                          <span className="score-popover-team" title={match.p2 || 'Semifinalist 2'}>{match.p2 || '準決勝敗者2'}</span>
                          <input
                            type="number"
                            min="0"
                            className="score-popover-input"
                            value={popoverScore2}
                            onChange={(e) => setPopoverScore2(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </>
                    ) : (
                      // 複数セットマッチ
                      <div className="sets-container">
                        {/* プレビュー表示 */}
                        <div className="sets-preview-header">
                          <div className="preview-label">セットカウント:</div>
                          <div className="preview-values">
                            <span className={Number(popoverScore1) > Number(popoverScore2) ? 'winner' : ''}>{popoverScore1 || 0}</span>
                            <span> - </span>
                            <span className={Number(popoverScore2) > Number(popoverScore1) ? 'winner' : ''}>{popoverScore2 || 0}</span>
                          </div>
                        </div>
                        
                        <div className="sets-input-scroll">
                          {popoverSets.map((set, idx) => (
                            <div key={`set-row-${idx}`} className="set-input-row">
                              <div className="set-row-label">セット {idx + 1}</div>
                              <div className="set-inputs">
                                <input
                                  type="number"
                                  min="0"
                                  className="score-popover-input mini"
                                  value={set.score1}
                                  onChange={(e) => handleSetScoreChange(idx, 'score1', e.target.value)}
                                  placeholder="0"
                                  title={`${match.p1 || 'チーム1'}の得点`}
                                />
                                <span className="set-vs">vs</span>
                                <input
                                  type="number"
                                  min="0"
                                  className="score-popover-input mini"
                                  value={set.score2}
                                  onChange={(e) => handleSetScoreChange(idx, 'score2', e.target.value)}
                                  placeholder="0"
                                  title={`${match.p2 || 'チーム2'}の得点`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {warningMessage && (
                      <div className="score-popover-warning" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '2px', textAlign: 'center', fontWeight: 'bold' }}>
                        {warningMessage}
                      </div>
                    )}

                    <div className="score-popover-actions">
                      <button className="score-popover-btn" onClick={() => setActiveScoreEdit(null)}>キャンセル</button>
                      <button 
                        className="score-popover-btn score-popover-btn-primary" 
                        onClick={saveMatchScoresAndWinner}
                        disabled={isSaveDisabled}
                        style={isSaveDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        保存する
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 6. 優勝者 (Winner) 表示カード */}
              {(() => {
                const champCoord = coords['champion'];
                if (!champCoord) return null;

                const winner = currentTournament.rounds[R - 1][0].winner;

                return (
                  <div className="champion-card" style={{ left: `${champCoord.x}px`, top: `${champCoord.y}px` }}>
                    <div className="champion-card-label">
                      <Trophy size={12} /> Winner
                    </div>
                    <div className={`champion-card-name ${!winner ? 'empty' : ''}`} title={winner || '決着未済'}>
                      {winner || '未決着'}
                    </div>
                  </div>
                );
              })()}

              {/* 3位決定戦の対戦相手（準決勝敗者）表示カード */}
              {hasTPMatch && (() => {
                const c = coords['third-place'];
                if (!c) return null;
                const tp = currentTournament.thirdPlaceMatch;
                const cardWidth = 120;
                
                const p1X = isDoubleSided ? c.x1 : c.x1 - cardWidth;
                const p2X = isDoubleSided ? c.x2 - cardWidth : c.x2 - cardWidth;

                return (
                  <>
                    <div 
                      className="team-row-card tp-team-card" 
                      style={{ 
                        left: `${p1X}px`, 
                        top: `${c.y1}px`
                      }}
                      title={tp.p1 || '準決勝敗者1'}
                    >
                      <span className="team-name-text" style={{ textAlign: 'center' }}>
                        {tp.p1 || '準決勝敗者1'}
                      </span>
                    </div>
                    <div 
                      className="team-row-card tp-team-card" 
                      style={{ 
                        left: `${p2X}px`, 
                        top: `${c.y2}px`
                      }}
                      title={tp.p2 || '準決勝敗者2'}
                    >
                      <span className="team-name-text" style={{ textAlign: 'center' }}>
                        {tp.p2 || '準決勝敗者2'}
                      </span>
                    </div>
                  </>
                );
              })()}

              {/* 7. 3位決定戦の勝者 (3rd Place) 表示カード */}
              {hasTPMatch && (() => {
                const tpCoord = coords['third-place-winner'];
                if (!tpCoord) return null;

                const winner = currentTournament.thirdPlaceMatch.winner;

                return (
                  <div className="champion-card bronze-card" style={{ left: `${tpCoord.x}px`, top: `${tpCoord.y}px` }}>
                    <div className="champion-card-label bronze-card-label">
                      <Trophy size={12} /> 3位
                    </div>
                    <div className={`champion-card-name ${!winner ? 'empty' : ''}`} title={winner || '決着未済'}>
                      {winner || '未決着'}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ズーム／パンコントロールパネル */}
        <div className="controls-overlay">
          <button className="btn-icon" onClick={() => handleZoom('in')} title="拡大">
            <ZoomIn size={18} />
          </button>
          <button className="btn-icon" onClick={() => handleZoom('out')} title="縮小">
            <ZoomOut size={18} />
          </button>
          <button className="btn-icon" onClick={() => handleZoom('reset')} title="ズームをリセット">
            <RotateCcw size={18} />
          </button>

          <div style={{ width: 1, background: 'var(--border-color)', margin: '4px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 4px', gap: 4 }}>
            <HelpCircle size={12} />
            <span>アイコンをタップしてスコア入力 / ドラッグで移動</span>
          </div>
        </div>
      </div>
    )}
      </main>

      {/* 一括名前編集モーダル */}
      {isBulkModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBulkModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>チーム名の一括編集</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              1行に1チーム名を入力してください。上から順番にトーナメントの枠に割り当てられます。
            </p>
            <textarea
              className="modal-textarea"
              value={bulkTeamsText}
              onChange={(e) => setBulkTeamsText(e.target.value)}
              placeholder="TeamA&#10;TeamB&#10;TeamC..."
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setIsBulkModalOpen(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={saveBulkNames}>保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
