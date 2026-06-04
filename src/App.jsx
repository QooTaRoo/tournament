import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Plus, Trash2, ChevronLeft, ZoomIn, ZoomOut, 
  RotateCcw, Edit2, Move, Check, X, Save, Upload, Download,
  Users, Edit3, HelpCircle, FileText, Maximize2
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
    const newTournament = createTournament(name, setupTeamCount, setupThirdPlace);
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
    if (isThirdPlace) {
      const tp = currentTournament.thirdPlaceMatch;
      if (!tp || tp.p1 === null || tp.p2 === null) return;
      setActiveScoreEdit({ roundIndex: -1, matchIndex: -1, x, y, isThirdPlace: true });
      setPopoverScore1(tp.score1 !== null ? String(tp.score1) : '');
      setPopoverScore2(tp.score2 !== null ? String(tp.score2) : '');
    } else {
      const match = currentTournament.rounds[roundIndex][matchIndex];
      if (match.p1 === null || match.p2 === null) return;
      setActiveScoreEdit({ roundIndex, matchIndex, x, y, isThirdPlace: false });
      setPopoverScore1(match.score1 !== null ? String(match.score1) : '');
      setPopoverScore2(match.score2 !== null ? String(match.score2) : '');
    }
  };

  // スコアポップオーバーの保存 (勝者はスコアから自動算出)
  const saveMatchScoresAndWinner = () => {
    if (!activeScoreEdit || !currentTournament) return;
    const { roundIndex, matchIndex, isThirdPlace } = activeScoreEdit;

    let updated = { ...currentTournament };

    if (isThirdPlace) {
      // 3位決定戦スコア更新
      updated = setThirdPlaceScores(updated, popoverScore1, popoverScore2);
    } else {
      // 本戦スコア更新
      const newRounds = setMatchScores(
        currentTournament.rounds,
        roundIndex,
        matchIndex,
        popoverScore1,
        popoverScore2
      );
      updated.rounds = newRounds;
      // 3位決定戦への敗者伝播を同期
      updated = updateThirdPlaceMatch(updated);
    }

    handleSaveCurrent(updated);
    setActiveScoreEdit(null);
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

  // 全体を画面に収める
  const handleFitToPage = () => {
    if (!viewportRef.current || !currentTournament) return;
    const vWidth = viewportRef.current.clientWidth;
    const vHeight = viewportRef.current.clientHeight;

    const P_val = currentTournament.teams.length;
    const R_val = Math.log2(P_val);
    const hasTPMatch_val = currentTournament.thirdPlaceMatch !== null;
    const currentSvgWidth = R_val * COL_WIDTH + 2 * PAD_X;
    const currentSvgHeight = Math.max(500, (P_val / 2) * ROW_HEIGHT + 2 * PAD_Y + (hasTPMatch_val ? 150 : 0));

    const zoomX = (vWidth - 32) / currentSvgWidth;
    const zoomY = (vHeight - 32) / currentSvgHeight;
    const calculatedZoom = Math.min(zoomX, zoomY);

    const finalZoom = Math.max(0.3, Math.min(1.5, calculatedZoom));
    setZoom(finalZoom);

    viewportRef.current.scrollLeft = 0;
    viewportRef.current.scrollTop = 0;
  };

  // 定数
  const COL_WIDTH = 200;
  const ROW_HEIGHT = 64;
  const PAD_X = 220;
  const PAD_Y = 100;

  const isBracketView = view === 'bracket' && currentTournament;
  const P = isBracketView ? currentTournament.teams.length : 8;
  const R = Math.log2(P);
  
  // 座標マップ
  const coords = isBracketView ? calculateLayoutCoords(currentTournament.rounds, currentTournament.teams, COL_WIDTH, ROW_HEIGHT, PAD_X, PAD_Y) : {};
  
  // 3位決定戦がある場合は高さを拡張
  const hasTPMatch = isBracketView && currentTournament.thirdPlaceMatch != null;
  const svgWidth = isBracketView ? (R * COL_WIDTH + 2 * PAD_X) : 800;
  const svgHeight = isBracketView ? Math.max(500, P * ROW_HEIGHT + 2 * PAD_Y + (hasTPMatch ? 150 : 0)) : 600;

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
            <h1>トーナメント表作成 PWA</h1>
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
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    setSetupTeamCount(Math.max(2, Math.min(64, val)));
                  } else {
                    setSetupTeamCount('');
                  }
                }}
                onBlur={() => {
                  if (setupTeamCount === '' || isNaN(setupTeamCount) || setupTeamCount < 2) {
                    setSetupTeamCount(2);
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
                {Array.from({ length: R }).map((_, r) => {
                  const labelX = PAD_X + (r + 1) * COL_WIDTH;
                  return (
                    <div 
                      key={`label-${r}`} 
                      className="round-label"
                      style={{ left: `${labelX}px` }}
                    >
                      {getRoundLabel(r)}
                    </div>
                  );
                })}
              </div>

              {/* 左端チームリスト (HTML) */}
              {activeTeamsList.map((team, rowIdx) => {
                const yCoord = PAD_Y + rowIdx * ROW_HEIGHT;

                return (
                  <div 
                    key={`team-row-${team.leafIdx}`}
                    className="team-row-container"
                    style={{ top: `${yCoord}px` }}
                  >
                    <div className="team-row-number">{rowIdx + 1}</div>
                    
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
              })}

              {/* スコア編集用の丸型トリガーボタン (結果を入れられるアクティブ戦のみ表示) */}
              {currentTournament.rounds.map((round, r) => {
                return round.map((match, m) => {
                  if (match.p1 === null || match.p2 === null) return null;
                  const c = coords[`${r}-${m}`];
                  if (!c) return null;

                  const btnX = (r === 0) ? c.x + 16 : c.x;

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
                const btnX = hasScoreBtn ? c.x - 16 : c.x;

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
                      (match.winner !== null && match.winner === match.p1) ||
                      (r > 0 && !child1IsBye && child1 && child1.winner === match.p1)
                    );
                    
                    // 2) 下部水平線:
                    const child2 = r > 0 ? currentTournament.rounds[r - 1][2 * m + 1] : null;
                    const child2IsBye = child2 && (child2.p1 === null || child2.p2 === null);
                    const isBottomActive = match.p2 !== null && (
                      (match.winner !== null && match.winner === match.p2) ||
                      (r > 0 && !child2IsBye && child2 && child2.winner === match.p2)
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
                        {r < R - 1 && (
                          <line
                            className={`connector-line ${isOutputActive ? 'active' : ''}`}
                            x1={c.x} y1={c.y} x2={c.x + COL_WIDTH} y2={c.y}
                          />
                        )}
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
                        x1={c.x} y1={c.y} x2={coords['third-place-winner'].x - 130 / 2} y2={c.y}
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
                  return (
                    <line
                      className={`connector-line ${isActive ? 'active' : ''}`}
                      x1={finalsCoord.x} y1={finalsCoord.y}
                      x2={champCoord.x - 130 / 2} y2={champCoord.y}
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

                    if (match.score1 !== null) {
                      const isWinner = match.winner !== null && match.winner === match.p1;
                      elements.push(
                        <text
                          key={`score1-${r}-${m}`}
                          x={c.x - 15}
                          y={c.y1 - 6}
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
                          x={c.x - 15}
                          y={c.y2 + 16}
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
                        x={c.x - 15}
                        y={c.y1 - 6}
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
                        x={c.x - 15}
                        y={c.y2 + 16}
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

                const isTie = popoverScore1 !== '' && popoverScore2 !== '' && Number(popoverScore1) === Number(popoverScore2);
                const isSaveDisabled = popoverScore1 === '' || popoverScore2 === '' || isTie;

                return (
                  <div 
                    className="score-popover" 
                    style={{ left: `${x}px`, top: `${y}px` }}
                  >
                    <div className="score-popover-title">{matchTitle}</div>
                    
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
                    
                    {isTie && (
                      <div className="score-popover-warning" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '2px', textAlign: 'center', fontWeight: 'bold' }}>
                        ※同点では登録できません
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
          <button className="btn-icon" onClick={handleFitToPage} title="画面に収める">
            <Maximize2 size={18} />
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
