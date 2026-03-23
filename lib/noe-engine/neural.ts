/**
 * N.O.E — Neural Operational Engine
 * Core Neural Network Layer
 *
 * Architecture:
 *   Perception Input (5 signals)
 *     → Input Layer (5 nodes)
 *     → Hidden Layer A — Signal Integration (8 nodes)
 *     → Hidden Layer B — Temporal Compression (5 nodes)
 *     → Output Layer — NoeState vector (5 dimensions)
 *
 * Each layer uses weighted connections + sigmoid activation.
 * Weights evolve via a simplified Hebbian learning rule:
 *   Δw = η * pre * post
 * This means connections that fire together, wire together —
 * Noe literally learns from repeated patterns.
 */

import { NoeState, PerceptionEvent, PerceptionType } from "./types"

// Sigmoid activation
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

// Derivative of sigmoid (for weight updates)
function sigmoidPrime(x: number): number {
  const s = sigmoid(x)
  return s * (1 - s)
}

// Encode a PerceptionEvent into a 5-element input vector
export function encodeEvent(event: PerceptionEvent): number[] {
  const typeMap: Record<PerceptionType, number[]> = {
    BUY:        [1.0, 0.0, 0.0, 0.0],
    SELL:       [0.0, 1.0, 0.0, 0.0],
    HOLD:       [0.0, 0.0, 1.0, 0.0],
    WHALE_MOVE: [0.0, 0.0, 0.0, 1.0],
  }
  const typeVec = typeMap[event.type]
  return [
    ...typeVec,
    event.magnitude / 10,       // normalize magnitude 0-1
    event.walletScore / 100,    // normalize wallet score 0-1
  ]
}

// Initialize a weight matrix with small random values
function initWeights(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() - 0.5) * 0.5)
  )
}

export interface NeuralNetSnapshot {
  layerA: number[]
  layerB: number[]
  output: number[]
}

export class NoeNeuralNet {
  // Weight matrices
  private wAB: number[][] // Input(6) → Hidden A(8)
  private wBC: number[][] // Hidden A(8) → Hidden B(5)
  private wCD: number[][] // Hidden B(5) → Output(5)

  // Bias vectors
  private bA: number[]
  private bB: number[]
  private bC: number[]

  // Learning rate — low so Noe evolves slowly and deliberately
  private readonly lr = 0.008

  // Last activations (for Hebbian updates)
  private lastA: number[] = new Array(8).fill(0)
  private lastB: number[] = new Array(5).fill(0)
  private lastOut: number[] = new Array(5).fill(0.5)

  constructor() {
    this.wAB = initWeights(8, 6)
    this.wBC = initWeights(5, 8)
    this.wCD = initWeights(5, 5)
    this.bA = new Array(8).fill(0)
    this.bB = new Array(5).fill(0)
    this.bC = new Array(5).fill(0)
  }

  /**
   * Forward pass: input vector → NoeState vector
   * Returns activations at each layer for visualization
   */
  forward(input: number[]): { state: NoeState; snapshot: NeuralNetSnapshot } {
    // Layer A: Signal Integration
    const layerA = this.wAB.map((weights, i) => {
      const sum = weights.reduce((acc, w, j) => acc + w * (input[j] ?? 0), this.bA[i])
      return sigmoid(sum)
    })

    // Layer B: Temporal Compression
    const layerB = this.wBC.map((weights, i) => {
      const sum = weights.reduce((acc, w, j) => acc + w * layerA[j], this.bB[i])
      return sigmoid(sum)
    })

    // Output Layer: NoeState dimensions
    const output = this.wCD.map((weights, i) => {
      const sum = weights.reduce((acc, w, j) => acc + w * layerB[j], this.bC[i])
      return sigmoid(sum)
    })

    this.lastA = layerA
    this.lastB = layerB
    this.lastOut = output

    const state: NoeState = {
      stability:  output[0],
      trust:      output[1],
      energy:     output[2],
      volatility: output[3],
      growth:     output[4],
    }

    return { state, snapshot: { layerA, layerB, output } }
  }

  /**
   * Hebbian weight update: connections that activate together strengthen.
   * Called after each forward pass to let Noe learn from patterns.
   */
  hebbianUpdate(input: number[]) {
    // Update wAB
    for (let i = 0; i < this.wAB.length; i++) {
      for (let j = 0; j < this.wAB[i].length; j++) {
        this.wAB[i][j] += this.lr * this.lastA[i] * (input[j] ?? 0)
        this.wAB[i][j] = Math.max(-2, Math.min(2, this.wAB[i][j]))
      }
    }
    // Update wBC
    for (let i = 0; i < this.wBC.length; i++) {
      for (let j = 0; j < this.wBC[i].length; j++) {
        this.wBC[i][j] += this.lr * this.lastB[i] * this.lastA[j]
        this.wBC[i][j] = Math.max(-2, Math.min(2, this.wBC[i][j]))
      }
    }
    // Update wCD
    for (let i = 0; i < this.wCD.length; i++) {
      for (let j = 0; j < this.wCD[i].length; j++) {
        this.wCD[i][j] += this.lr * this.lastOut[i] * this.lastB[j]
        this.wCD[i][j] = Math.max(-2, Math.min(2, this.wCD[i][j]))
      }
    }
  }

  getWeightSnapshot() {
    return {
      wAB: this.wAB.map(r => [...r]),
      wBC: this.wBC.map(r => [...r]),
      wCD: this.wCD.map(r => [...r]),
    }
  }
}
