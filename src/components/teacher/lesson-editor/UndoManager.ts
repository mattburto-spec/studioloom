/**
 * UndoManager — framework-agnostic undo/redo stack for content editing
 * Pure logic class, no React dependencies
 * Max depth: 30 snapshots
 */

export class UndoManager<T> {
  private stack: T[] = [];
  private pointer: number = -1;
  private readonly maxDepth = 30;

  /**
   * Push a new state onto the undo stack.
   * Clears any "future" states if we're not at the top of the stack.
   */
  push(state: T): void {
    // Trim any states after the current pointer
    this.stack = this.stack.slice(0, this.pointer + 1);

    // Deep clone the state to prevent mutations
    this.stack.push(structuredClone(state));

    // Enforce max depth by removing oldest
    if (this.stack.length > this.maxDepth) {
      this.stack.shift();
    } else {
      this.pointer++;
    }
  }

  /**
   * Undo to the previous state.
   * Returns a cloned copy of that state, or null if at the beginning.
   */
  undo(): T | null {
    if (this.pointer <= 0) return null;
    this.pointer--;
    return structuredClone(this.stack[this.pointer]);
  }

  /**
   * Redo to the next state.
   * Returns a cloned copy of that state, or null if at the top.
   */
  redo(): T | null {
    if (this.pointer >= this.stack.length - 1) return null;
    this.pointer++;
    return structuredClone(this.stack[this.pointer]);
  }

  /**
   * Whether undo is available
   */
  get canUndo(): boolean {
    return this.pointer > 0;
  }

  /**
   * Whether redo is available
   */
  get canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.stack = [];
    this.pointer = -1;
  }

  /**
   * Get the current stack depth (for testing)
   */
  get depth(): number {
    return this.stack.length;
  }

  /**
   * Get the current pointer position (for testing)
   */
  get position(): number {
    return this.pointer;
  }
}
