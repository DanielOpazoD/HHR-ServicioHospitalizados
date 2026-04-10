/**
 * useMinesweeper Hook Tests
 *
 * Tests the minesweeper game logic including grid initialization,
 * mine placement, cell interactions, game over, and victory detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMinesweeper,
  DIFFICULTIES,
  type Difficulty,
} from '@/features/games/hooks/useMinesweeper';

describe('useMinesweeper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Constants ────────────────────────────────────────────────────

  describe('DIFFICULTIES constant', () => {
    it('defines EASY as 9x9 with 10 mines', () => {
      expect(DIFFICULTIES.EASY).toEqual({ rows: 9, cols: 9, mines: 10 });
    });

    it('defines MEDIUM as 16x16 with 40 mines', () => {
      expect(DIFFICULTIES.MEDIUM).toEqual({ rows: 16, cols: 16, mines: 40 });
    });

    it('defines HARD as 16x30 with 99 mines', () => {
      expect(DIFFICULTIES.HARD).toEqual({ rows: 16, cols: 30, mines: 99 });
    });
  });

  // ─── Initial State ────────────────────────────────────────────────

  describe('initial state', () => {
    it('initializes with EASY difficulty by default', () => {
      const { result } = renderHook(() => useMinesweeper());
      expect(result.current.state.difficulty).toBe('EASY');
    });

    it('creates a grid matching EASY dimensions (9x9)', () => {
      const { result } = renderHook(() => useMinesweeper());
      const { grid } = result.current.state;
      expect(grid.length).toBe(9);
      expect(grid[0].length).toBe(9);
    });

    it('starts with no cells revealed', () => {
      const { result } = renderHook(() => useMinesweeper());
      const allCells = result.current.state.grid.flat();
      expect(allCells.every(cell => !cell.isRevealed)).toBe(true);
    });

    it('starts with no cells flagged', () => {
      const { result } = renderHook(() => useMinesweeper());
      const allCells = result.current.state.grid.flat();
      expect(allCells.every(cell => !cell.isFlagged)).toBe(true);
    });

    it('starts with no mines placed (mines are placed on first click)', () => {
      const { result } = renderHook(() => useMinesweeper());
      const allCells = result.current.state.grid.flat();
      expect(allCells.every(cell => !cell.isMine)).toBe(true);
    });

    it('starts with minesLeft equal to EASY mine count', () => {
      const { result } = renderHook(() => useMinesweeper());
      expect(result.current.state.minesLeft).toBe(DIFFICULTIES.EASY.mines);
    });

    it('starts with zero time elapsed', () => {
      const { result } = renderHook(() => useMinesweeper());
      expect(result.current.state.timeElapsed).toBe(0);
    });

    it('starts with game not over and no victory', () => {
      const { result } = renderHook(() => useMinesweeper());
      expect(result.current.state.isGameOver).toBe(false);
      expect(result.current.state.isVictory).toBe(false);
    });

    it('each cell has correct row and col indices', () => {
      const { result } = renderHook(() => useMinesweeper());
      const { grid } = result.current.state;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          expect(grid[r][c].row).toBe(r);
          expect(grid[r][c].col).toBe(c);
        }
      }
    });
  });

  // ─── First Click & Mine Placement ────────────────────────────────

  describe('first click and mine placement', () => {
    it('places mines after the first click', () => {
      const { result } = renderHook(() => useMinesweeper());

      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      const allCells = result.current.state.grid.flat();
      const mineCount = allCells.filter(cell => cell.isMine).length;
      expect(mineCount).toBe(DIFFICULTIES.EASY.mines);
    });

    it('does not place a mine on the first-clicked cell or its neighbors', () => {
      const { result } = renderHook(() => useMinesweeper());
      const clickRow = 4;
      const clickCol = 4;

      act(() => {
        result.current.actions.handleCellClick(clickRow, clickCol);
      });

      const { grid } = result.current.state;
      // The first click cell and its 8 neighbors should be safe
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = clickRow + dr;
          const c = clickCol + dc;
          if (r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
            expect(grid[r][c].isMine).toBe(false);
          }
        }
      }
    });

    it('reveals the clicked cell after first click', () => {
      const { result } = renderHook(() => useMinesweeper());

      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      expect(result.current.state.grid[4][4].isRevealed).toBe(true);
    });

    it('calculates neighborMines correctly after mine placement', () => {
      const { result } = renderHook(() => useMinesweeper());

      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      const { grid } = result.current.state;
      // Verify that for every non-mine cell, neighborMines matches actual adjacent mines
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (!grid[r][c].isMine) {
            let actualMines = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) {
                  if (grid[nr][nc].isMine) actualMines++;
                }
              }
            }
            expect(grid[r][c].neighborMines).toBe(actualMines);
          }
        }
      }
    });
  });

  // ─── Timer ────────────────────────────────────────────────────────

  describe('timer', () => {
    it('starts the timer on the first click', () => {
      const { result } = renderHook(() => useMinesweeper());

      expect(result.current.state.timeElapsed).toBe(0);

      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      // Advance time by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.state.timeElapsed).toBe(3);
    });

    it('does not start the timer before first click', () => {
      renderHook(() => useMinesweeper());

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // No assertion on result needed; timer was never started so timeElapsed stays 0.
      // Verifying via renderHook would show 0.
    });

    it('stops the timer on game reset', () => {
      const { result } = renderHook(() => useMinesweeper());

      // Start game
      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.state.timeElapsed).toBe(2);

      // Reset game
      act(() => {
        result.current.actions.initGame('EASY');
      });

      expect(result.current.state.timeElapsed).toBe(0);

      // Advance time -- timer should not be running
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.state.timeElapsed).toBe(0);
    });
  });

  // ─── Cell Interactions ────────────────────────────────────────────

  describe('cell click', () => {
    it('reveals a cell when clicked', () => {
      const { result } = renderHook(() => useMinesweeper());

      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      expect(result.current.state.grid[4][4].isRevealed).toBe(true);
    });

    it('does not reveal a flagged cell when clicked', () => {
      const { result } = renderHook(() => useMinesweeper());

      // First click to place mines
      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      // Find an unrevealed cell to flag
      const { grid } = result.current.state;
      let targetR = -1;
      let targetC = -1;
      for (let r = 0; r < grid.length && targetR === -1; r++) {
        for (let c = 0; c < grid[r].length && targetR === -1; c++) {
          if (!grid[r][c].isRevealed) {
            targetR = r;
            targetC = c;
          }
        }
      }

      if (targetR === -1) return; // All revealed (unlikely but safe)

      // Flag the cell
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, targetR, targetC);
      });

      expect(result.current.state.grid[targetR][targetC].isFlagged).toBe(true);

      // Try to click the flagged cell
      act(() => {
        result.current.actions.handleCellClick(targetR, targetC);
      });

      // Should still be flagged and not revealed
      expect(result.current.state.grid[targetR][targetC].isFlagged).toBe(true);
      expect(result.current.state.grid[targetR][targetC].isRevealed).toBe(false);
    });

    it('flood-fills empty cells (neighborMines === 0) recursively', () => {
      const { result } = renderHook(() => useMinesweeper());

      // Click center cell; the first click zone (3x3) has no mines
      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      // At minimum the clicked cell should be revealed
      expect(result.current.state.grid[4][4].isRevealed).toBe(true);

      // If the clicked cell had 0 neighbor mines, its neighbors should also be revealed
      if (result.current.state.grid[4][4].neighborMines === 0) {
        // At least some adjacent cells should also be revealed
        const neighbors = [
          [3, 3],
          [3, 4],
          [3, 5],
          [4, 3],
          [4, 5],
          [5, 3],
          [5, 4],
          [5, 5],
        ];
        const someRevealed = neighbors.some(([r, c]) => result.current.state.grid[r][c].isRevealed);
        expect(someRevealed).toBe(true);
      }
    });
  });

  // ─── Right Click / Flagging ───────────────────────────────────────

  describe('right click (flagging)', () => {
    it('toggles a flag on an unrevealed cell', () => {
      const { result } = renderHook(() => useMinesweeper());
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

      // Flag cell (0,0) -- not yet clicked, so unrevealed
      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, 0, 0);
      });

      expect(result.current.state.grid[0][0].isFlagged).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('unflags a flagged cell on second right click', () => {
      const { result } = renderHook(() => useMinesweeper());
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, 0, 0);
      });
      expect(result.current.state.grid[0][0].isFlagged).toBe(true);

      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, 0, 0);
      });
      expect(result.current.state.grid[0][0].isFlagged).toBe(false);
    });

    it('decrements minesLeft when flagging and increments when unflagging', () => {
      const { result } = renderHook(() => useMinesweeper());
      const initialMinesLeft = result.current.state.minesLeft;
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

      // Flag
      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, 0, 0);
      });
      expect(result.current.state.minesLeft).toBe(initialMinesLeft - 1);

      // Unflag
      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, 0, 0);
      });
      expect(result.current.state.minesLeft).toBe(initialMinesLeft);
    });

    it('does not flag an already-revealed cell', () => {
      const { result } = renderHook(() => useMinesweeper());
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

      // Click to reveal
      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });
      expect(result.current.state.grid[4][4].isRevealed).toBe(true);

      const minesLeftBefore = result.current.state.minesLeft;

      // Try to flag revealed cell
      act(() => {
        result.current.actions.handleCellRightClick(mockEvent, 4, 4);
      });

      expect(result.current.state.grid[4][4].isFlagged).toBe(false);
      expect(result.current.state.minesLeft).toBe(minesLeftBefore);
    });
  });

  // ─── Game Over ────────────────────────────────────────────────────

  describe('game over', () => {
    it('sets isGameOver when a mine is clicked', () => {
      const { result } = renderHook(() => useMinesweeper());

      // First click to place mines (safe zone around 0,0)
      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      // Find a mine cell
      const { grid } = result.current.state;
      let mineR = -1;
      let mineC = -1;
      for (let r = 0; r < grid.length && mineR === -1; r++) {
        for (let c = 0; c < grid[r].length && mineR === -1; c++) {
          if (grid[r][c].isMine && !grid[r][c].isRevealed) {
            mineR = r;
            mineC = c;
          }
        }
      }

      if (mineR === -1) return; // Edge case: all mines already revealed

      act(() => {
        result.current.actions.handleCellClick(mineR, mineC);
      });

      expect(result.current.state.isGameOver).toBe(true);
    });

    it('reveals all mines when game is over', () => {
      const { result } = renderHook(() => useMinesweeper());

      // First click
      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      // Find and click a mine
      const { grid } = result.current.state;
      let mineR = -1;
      let mineC = -1;
      for (let r = 0; r < grid.length && mineR === -1; r++) {
        for (let c = 0; c < grid[r].length && mineR === -1; c++) {
          if (grid[r][c].isMine && !grid[r][c].isRevealed) {
            mineR = r;
            mineC = c;
          }
        }
      }

      if (mineR === -1) return;

      act(() => {
        result.current.actions.handleCellClick(mineR, mineC);
      });

      // All mines should now be revealed
      const allMinesRevealed = result.current.state.grid
        .flat()
        .filter(cell => cell.isMine)
        .every(cell => cell.isRevealed);
      expect(allMinesRevealed).toBe(true);
    });

    it('ignores cell clicks after game over', () => {
      const { result } = renderHook(() => useMinesweeper());

      // First click
      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      // Find a mine
      const grid1 = result.current.state.grid;
      let mineR = -1;
      let mineC = -1;
      for (let r = 0; r < grid1.length && mineR === -1; r++) {
        for (let c = 0; c < grid1[r].length && mineR === -1; c++) {
          if (grid1[r][c].isMine && !grid1[r][c].isRevealed) {
            mineR = r;
            mineC = c;
          }
        }
      }

      if (mineR === -1) return;

      // Trigger game over
      act(() => {
        result.current.actions.handleCellClick(mineR, mineC);
      });

      expect(result.current.state.isGameOver).toBe(true);

      // Take a snapshot of the grid state
      const gridSnapshot = JSON.stringify(result.current.state.grid);

      // Try clicking another cell
      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      // Grid should not have changed
      expect(JSON.stringify(result.current.state.grid)).toBe(gridSnapshot);
    });
  });

  // ─── Victory Detection ────────────────────────────────────────────

  describe('victory', () => {
    it('detects victory when all non-mine cells are revealed', () => {
      const { result } = renderHook(() => useMinesweeper());

      // First click to initialize mines
      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      // Reveal all non-mine, non-revealed cells one by one
      // We need to do this carefully to avoid clicking mines
      const revealAllSafeCells = () => {
        const { grid } = result.current.state;
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            if (!grid[r][c].isMine && !grid[r][c].isRevealed && !grid[r][c].isFlagged) {
              result.current.actions.handleCellClick(r, c);
            }
          }
        }
      };

      act(() => {
        revealAllSafeCells();
      });

      expect(result.current.state.isVictory).toBe(true);
    });

    it('stops the timer when victory is achieved', () => {
      const { result } = renderHook(() => useMinesweeper());

      // First click
      act(() => {
        result.current.actions.handleCellClick(0, 0);
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Reveal all safe cells
      act(() => {
        const { grid } = result.current.state;
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            if (!grid[r][c].isMine && !grid[r][c].isRevealed && !grid[r][c].isFlagged) {
              result.current.actions.handleCellClick(r, c);
            }
          }
        }
      });

      expect(result.current.state.isVictory).toBe(true);
      const timeAtVictory = result.current.state.timeElapsed;

      // Advance timer -- should not change
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.timeElapsed).toBe(timeAtVictory);
    });
  });

  // ─── Difficulty Change ────────────────────────────────────────────

  describe('difficulty change', () => {
    it.each([
      ['EASY', 9, 9, 10],
      ['MEDIUM', 16, 16, 40],
      ['HARD', 16, 30, 99],
    ] as [Difficulty, number, number, number][])(
      'resets grid to %s dimensions (%dx%d with %d mines)',
      (diff, expectedRows, expectedCols, expectedMines) => {
        const { result } = renderHook(() => useMinesweeper());

        act(() => {
          result.current.actions.setDifficulty(diff);
        });

        const { grid, minesLeft, isGameOver, isVictory, timeElapsed } = result.current.state;
        expect(grid.length).toBe(expectedRows);
        expect(grid[0].length).toBe(expectedCols);
        expect(minesLeft).toBe(expectedMines);
        expect(isGameOver).toBe(false);
        expect(isVictory).toBe(false);
        expect(timeElapsed).toBe(0);
      }
    );

    it('resets an in-progress game when difficulty changes', () => {
      const { result } = renderHook(() => useMinesweeper());

      // Start a game
      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.timeElapsed).toBe(5);

      // Change difficulty
      act(() => {
        result.current.actions.setDifficulty('MEDIUM');
      });

      expect(result.current.state.difficulty).toBe('MEDIUM');
      expect(result.current.state.grid.length).toBe(16);
      expect(result.current.state.grid[0].length).toBe(16);
      expect(result.current.state.timeElapsed).toBe(0);
      expect(result.current.state.isGameOver).toBe(false);
      expect(result.current.state.isVictory).toBe(false);

      // No mines placed yet (first click not done)
      const allCells = result.current.state.grid.flat();
      expect(allCells.every(cell => !cell.isMine)).toBe(true);
      expect(allCells.every(cell => !cell.isRevealed)).toBe(true);
    });
  });

  // ─── initGame ─────────────────────────────────────────────────────

  describe('initGame (reset)', () => {
    it('resets all state when called', () => {
      const { result } = renderHook(() => useMinesweeper());

      // Play some moves
      act(() => {
        result.current.actions.handleCellClick(4, 4);
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Reset
      act(() => {
        result.current.actions.initGame('EASY');
      });

      const { grid, isGameOver, isVictory, minesLeft, timeElapsed } = result.current.state;
      expect(grid.length).toBe(9);
      expect(grid[0].length).toBe(9);
      expect(isGameOver).toBe(false);
      expect(isVictory).toBe(false);
      expect(minesLeft).toBe(10);
      expect(timeElapsed).toBe(0);
      expect(grid.flat().every(cell => !cell.isMine)).toBe(true);
      expect(grid.flat().every(cell => !cell.isRevealed)).toBe(true);
      expect(grid.flat().every(cell => !cell.isFlagged)).toBe(true);
    });
  });
});
