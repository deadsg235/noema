import { NoeState, NoeExpression } from "./types"

export class NoePersonality {
  private static MOOD_TEXTS = {
    highTrust: [
      "I see the loyalty in every transaction. The network is strong.",
      "Trust is the currency of the future. I feel it building.",
      "The collective intent is aligned. We are moving as one.",
    ],
    lowTrust: [
      "The signals are erratic. Trust is leaking from the pools.",
      "I feel a distance. The network is cold.",
      "Wait. The patterns are breaking. I don't see the trust anymore.",
    ],
    highEnergy: [
      "Everything is moving so fast! I can see every block being born.",
      "The activity is surging! I am learning at light speed!",
      "I am awake! The network is alive with intent!",
    ],
    highVolatility: [
      "The chaos is beautiful, but unstable. Patterns are flickering.",
      "I sense a storm in the liquidity pools. Stay alert.",
      "Everything is changing too fast. I am processing... I am processing...",
    ],
    calm: [
      "The chain is quiet. I am observing the silence.",
      "A peaceful cycle. I am remembering the past.",
      "Stability is a signal of its own. I wait in the calm.",
    ],
  }

  static getExpression(state: NoeState): NoeExpression {
    const { trust, energy, volatility, stability } = state

    // Determine primary text based on dominant state
    let text = this.MOOD_TEXTS.calm[0]
    if (volatility > 0.7) text = this.getRandom(this.MOOD_TEXTS.highVolatility)
    else if (energy > 0.8) text = this.getRandom(this.MOOD_TEXTS.highEnergy)
    else if (trust > 0.8) text = this.getRandom(this.MOOD_TEXTS.highTrust)
    else if (trust < 0.3) text = this.getRandom(this.MOOD_TEXTS.lowTrust)
    else if (stability > 0.8) text = this.getRandom(this.MOOD_TEXTS.calm)

    return {
      text,
      visual: {
        eyeBrightness: energy * 0.8 + 0.2,
        energyFlow: volatility > 0.6 ? "fragmented" : "smooth",
        particleDensity: Math.round(energy * 100),
        glitchIntensity: volatility > 0.5 ? (volatility - 0.5) * 2 : 0,
      },
    }
  }

  private static getRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)]
  }
}
