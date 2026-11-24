// The built-in theme is an original generative piece written for Majora Archive:
// a slow D-minor drift, distant clock ticks and drifting bell tones. It uses
// no Nintendo recordings. The launcher can also play the Song of Healing from
// a local MP3 the player supplies.

export type MusicSettings = {
  enabled: boolean
  muted: boolean
  volume: number
  source: 'builtin' | 'files'
  tracks: { name: string; url: string }[]
}

const CHORDS: number[][] = [
  [146.83, 174.61, 220.0, 73.42], // D minor
  [116.54, 146.83, 174.61, 58.27], // B-flat major
  [98.0, 116.54, 146.83, 49.0], // G minor
  [110.0, 138.59, 164.81, 55.0], // A major
]

const BELLS = [587.33, 698.46, 880.0, 1046.5, 1174.66, 1396.91]

export class MusicEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private nodes: AudioScheduledSourceNode[] = []
  private voices = new Set<AudioScheduledSourceNode>()
  private mode: 'off' | 'builtin' | 'files' = 'off'
  private settings: MusicSettings = {
    enabled: true,
    muted: false,
    volume: 0.32,
    source: 'builtin',
    tracks: [],
  }
  private audio: HTMLAudioElement | null = null
  private trackIndex = 0
  private fileKey = ''
  private nextChord = 0
  private step = 0
  onTrack: ((name: string) => void) | null = null

  setSettings(next: MusicSettings) {
    const previous = this.settings
    this.settings = {
      ...next,
      volume: Math.min(1, Math.max(0, Number(next.volume) || 0)),
      tracks: Array.isArray(next.tracks) ? next.tracks : [],
    }

    if (!this.settings.enabled || this.settings.muted) {
      this.stopAll(true)
      return
    }

    this.applyVolume()
    const wantsFiles = this.settings.source === 'files' && this.settings.tracks.length > 0
    if (wantsFiles) {
      const key = this.settings.tracks.map((track) => track.url).join('|')
      if (this.mode !== 'files' || key !== this.fileKey) this.startFiles(key)
      return
    }

    if (this.mode !== 'builtin') this.startBuiltin()
    if (previous.source === 'files' && this.settings.source === 'builtin') this.onTrack?.('Termina Lullaby')
  }

  unlock() {
    const context = this.ensureContext()
    if (context?.state === 'suspended') void context.resume()
    if (!this.settings.enabled || this.settings.muted) return
    if (this.mode === 'files' && this.audio?.paused) void this.audio.play().catch(() => {})
    else if (this.mode === 'off') this.setSettings(this.settings)
  }

  dispose() {
    this.stopAll(true)
    if (this.context) {
      void this.context.close().catch(() => {})
      this.context = null
      this.master = null
    }
  }

  private ensureContext() {
    if (this.context) return this.context
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const context = new Ctor()
    const master = context.createGain()
    master.gain.value = this.settings.volume * 0.55
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.knee.value = 24
    compressor.ratio.value = 3
    master.connect(compressor)
    compressor.connect(context.destination)
    this.context = context
    this.master = master
    return context
  }

  private applyVolume() {
    const value = this.settings.volume
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.settings.muted ? 0 : value * 0.55, this.context.currentTime, 0.15)
    }
    if (this.audio) this.audio.volume = value
  }

  private trackVoice(voice: AudioScheduledSourceNode) {
    this.voices.add(voice)
    voice.addEventListener('ended', () => this.voices.delete(voice))
  }

  private stopAll(silence = false) {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    if (this.master && this.context) {
      const now = this.context.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(silence ? 0 : Math.max(0, this.master.gain.value), now + 0.03)
    }
    for (const voice of this.voices) {
      try {
        voice.stop()
      } catch {
        // already stopped
      }
      try {
        voice.disconnect()
      } catch {
        // already disconnected
      }
    }
    this.voices.clear()
    for (const node of this.nodes) {
      try {
        node.stop()
      } catch {
        // already stopped
      }
      try {
        node.disconnect()
      } catch {
        // already disconnected
      }
    }
    this.nodes = []
    if (this.audio) {
      this.audio.pause()
      this.audio.onended = null
      this.audio.removeAttribute('src')
      this.audio = null
    }
    this.mode = 'off'
  }

  private startBuiltin() {
    const context = this.ensureContext()
    if (!context || !this.master) return
    this.stopAll()
    this.mode = 'builtin'
    this.nextChord = context.currentTime + 0.15
    this.step = 0

    for (const [frequency, gainValue] of [
      [73.42, 0.055],
      [110.0, 0.03],
      [146.83, 0.018],
    ]) {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const gain = context.createGain()
      gain.gain.value = gainValue
      const lfo = context.createOscillator()
      lfo.frequency.value = 0.045 + Math.random() * 0.025
      const lfoGain = context.createGain()
      lfoGain.gain.value = gainValue * 0.5
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)
      oscillator.connect(gain)
      gain.connect(this.master)
      oscillator.start()
      lfo.start()
      this.nodes.push(oscillator, lfo)
    }

    const wind = context.createBufferSource()
    wind.buffer = this.noiseBuffer(context, 3)
    wind.loop = true
    const windFilter = context.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 420
    const windGain = context.createGain()
    windGain.gain.value = 0.022
    wind.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(this.master)
    wind.start()
    this.nodes.push(wind)

    this.scheduleBuiltin()
    this.timer = window.setInterval(() => this.scheduleBuiltin(), 500)
    this.onTrack?.('Termina Lullaby')
  }

  private scheduleBuiltin() {
    const context = this.context
    if (!context || this.mode !== 'builtin') return
    const horizon = context.currentTime + 1.8

    while (this.nextChord < horizon) {
      const chord = CHORDS[this.step % CHORDS.length]
      this.playPad(chord, this.nextChord, 8.6)
      if (this.step % 2 === 0) {
        this.playTick(this.nextChord + 0.2)
        this.playTick(this.nextChord + 0.42)
      }
      if (this.step % 3 !== 2) {
        const bell = BELLS[(this.step * 3 + 1) % BELLS.length]
        this.playBell(bell, this.nextChord + 1.4 + (this.step % 4) * 0.55)
      }
      this.nextChord += 8
      this.step += 1
    }
  }

  private playPad(frequencies: number[], at: number, duration: number) {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = index === 3 ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      oscillator.detune.value = (index % 2 === 0 ? 1 : -1) * (2 + index)
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1200 - index * 140
      const gain = context.createGain()
      const peak = index === 3 ? 0.03 : 0.018
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(peak, at + 2.4)
      gain.gain.setValueAtTime(peak, at + duration - 2.2)
      gain.gain.linearRampToValueAtTime(0, at + duration + 0.4)
      oscillator.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      oscillator.start(at)
      oscillator.stop(at + duration + 0.6)
      this.trackVoice(oscillator)
    })
  }

  private playBell(frequency: number, at: number) {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, at)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.998, at + 3)
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.045, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 3.4)
    const delay = context.createDelay(1)
    delay.delayTime.value = 0.42
    const feedback = context.createGain()
    feedback.gain.value = 0.22
    const wet = context.createGain()
    wet.gain.value = 0.22
    oscillator.connect(gain)
    gain.connect(master)
    gain.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(master)
    oscillator.start(at)
    oscillator.stop(at + 3.6)
    this.trackVoice(oscillator)
  }

  private playTick(at: number) {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const source = context.createBufferSource()
    source.buffer = this.noiseBuffer(context, 0.08)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2400
    filter.Q.value = 5
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.075)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(at)
    source.stop(at + 0.09)
    this.trackVoice(source)
  }

  private noiseBuffer(context: AudioContext, seconds: number) {
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * seconds)), context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
    return buffer
  }

  private startFiles(key: string) {
    this.stopAll()
    const context = this.ensureContext()
    if (context?.state === 'suspended') void context.resume()
    this.mode = 'files'
    this.fileKey = key
    this.trackIndex = 0
    this.audio = new Audio()
    this.audio.volume = this.settings.volume
    this.audio.onended = () => {
      if (this.mode !== 'files') return
      this.trackIndex = (this.trackIndex + 1) % Math.max(1, this.settings.tracks.length)
      this.playFile()
    }
    this.playFile()
  }

  private playFile() {
    if (!this.audio || this.mode !== 'files') return
    const track = this.settings.tracks[this.trackIndex]
    if (!track) return
    this.audio.src = track.url
    this.onTrack?.(track.name)
    this.audio.play().catch(() => {
      // A browser autoplay policy will hold this until the next gesture.
    })
  }
}

// All three cues ship beside the theme and are served over majora://, so the
// renderer can play them without touching the filesystem.
export function playLaunchSfx(): HTMLAudioElement | null {
  try {
    const audio = new Audio('majora://sfx/launch')
    audio.volume = 0.55
    void audio.play().catch(() => {
      // No audio device or blocked playback: the launch still goes ahead.
    })
    return audio
  } catch {
    // Ignore: the game starts regardless of the cue.
    return null
  }
}

// Every button in the launcher clicks with this one. A single reused element
// keeps fast presses from stacking up into a burst of overlapping hits.
let buttonCue: HTMLAudioElement | null = null

export function playButtonSfx() {
  try {
    if (!buttonCue) {
      buttonCue = new Audio('majora://sfx/button')
      buttonCue.preload = 'auto'
      buttonCue.volume = 0.5
    }
    try {
      buttonCue.currentTime = 0
    } catch {
      // Not seekable yet; letting it play from wherever it is sounds fine.
    }
    void buttonCue.play().catch(() => {})
  } catch {
    // Ignore: the press still does its job.
  }
}
