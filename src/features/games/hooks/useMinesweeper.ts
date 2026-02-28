import { useState, useEffect, useCallback, MouseEvent } from 'react';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number }> = {
  EASY: { rows: 9, cols: 9, mines: 10 },
  MEDIUM: { rows: 16, cols: 16, mines: 40 },
  HARD: { rows: 16, cols: 30, mines: 99 },
};

export interface CellData {
  row: number;
  col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

export const useMinesweeper = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [minesLeft, setMinesLeft] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isFirstClick, setIsFirstClick] = useState(true);

  // Initialize Game
  const initGame = useCallback((diff: Difficulty) => {
    const { rows, cols, mines } = DIFFICULTIES[diff];
    const newGrid: CellData[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        row: r,
        col: c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      }))
    );

    setGrid(newGrid);
    setIsGameOver(false);
    setIsVictory(false);
    setMinesLeft(mines);
    setTimeElapsed(0);
    setTimerActive(false);
    setIsFirstClick(true);
  }, []);

  useEffect(() => {
    initGame(difficulty);
  }, [difficulty, initGame]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && !isGameOver && !isVictory) {
      interval = setInterval(() => {
        setTimeElapsed(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, isGameOver, isVictory]);

  // Helpers
  const getNeighbors = (r: number, c: number, rows: number, cols: number) => {
    const neighbors: [number, number][] = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        const nr = r + i;
        const nc = c + j;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          neighbors.push([nr, nc]);
        }
      }
    }
    return neighbors;
  };

  const placeMines = (firstRow: number, firstCol: number) => {
    const { rows, cols, mines } = DIFFICULTIES[difficulty];
    const newGrid = [...grid.map(row => [...row])];

    // Use a flat approach for safer random placement
    const availableCells: { r: number; c: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Skip first click and its immediate neighbors to ensure a fair start
        if (Math.abs(firstRow - r) <= 1 && Math.abs(firstCol - c) <= 1) continue;
        availableCells.push({ r, c });
      }
    }

    // Shuffle and pick mines
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    const mineCells = availableCells.slice(0, mines);
    mineCells.forEach(({ r, c }) => {
      newGrid[r][c].isMine = true;
    });

    // Calculate neighbor mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          getNeighbors(r, c, rows, cols).forEach(([nr, nc]) => {
            if (newGrid[nr][nc].isMine) count++;
          });
          newGrid[r][c].neighborMines = count;
        }
      }
    }

    setGrid(newGrid);
    return newGrid;
  };

  const checkVictory = (currentGrid: CellData[][]) => {
    const { rows, cols, mines } = DIFFICULTIES[difficulty];
    let revealedCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (currentGrid[r][c].isRevealed) revealedCount++;
      }
    }
    if (revealedCount === rows * cols - mines) {
      setIsVictory(true);
      setTimerActive(false);
    }
  };

  const revealCell = (r: number, c: number, currentGrid: CellData[][]) => {
    if (currentGrid[r][c].isRevealed || currentGrid[r][c].isFlagged) return currentGrid;

    currentGrid[r][c].isRevealed = true;

    if (currentGrid[r][c].isMine) {
      setIsGameOver(true);
      setTimerActive(false);
      // Reveal all mines safely so the user sees them
      for (let row = 0; row < currentGrid.length; row++) {
        for (let col = 0; col < currentGrid[0].length; col++) {
          if (currentGrid[row][col].isMine) currentGrid[row][col].isRevealed = true;
        }
      }
      return currentGrid;
    }

    if (currentGrid[r][c].neighborMines === 0) {
      const { rows, cols } = DIFFICULTIES[difficulty];
      getNeighbors(r, c, rows, cols).forEach(([nr, nc]) => {
        revealCell(nr, nc, currentGrid);
      });
    }

    return currentGrid;
  };

  // Interactions
  const handleCellClick = (r: number, c: number) => {
    if (isGameOver || isVictory || grid[r][c].isRevealed || grid[r][c].isFlagged) return;

    let currentGrid = [...grid.map(row => [...row])];

    if (isFirstClick) {
      currentGrid = placeMines(r, c);
      setIsFirstClick(false);
      setTimerActive(true);
    }

    currentGrid = revealCell(r, c, currentGrid);
    setGrid(currentGrid);

    if (!isGameOver) {
      checkVictory(currentGrid);
    }
  };

  const handleCellRightClick = (e: MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (isGameOver || isVictory || grid[r][c].isRevealed) return;

    const newGrid = [...grid.map(row => [...row])];
    const isCurrentlyFlagged = newGrid[r][c].isFlagged;

    newGrid[r][c].isFlagged = !isCurrentlyFlagged;
    setGrid(newGrid);
    setMinesLeft(prev => prev + (isCurrentlyFlagged ? 1 : -1));
  };

  return {
    state: {
      difficulty,
      grid,
      isGameOver,
      isVictory,
      minesLeft,
      timeElapsed,
    },
    actions: {
      setDifficulty,
      initGame,
      handleCellClick,
      handleCellRightClick,
    },
  };
};
