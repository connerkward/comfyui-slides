<script setup>
import { ref, onUnmounted } from 'vue'

const playing = ref(false)
let ctx = null
let nodes = []

function buildGraph() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3)
  master.connect(ctx.destination)

  // Low drone — two slightly detuned oscillators for beating
  const freqs = [55, 55.18, 110, 110.3]
  freqs.forEach(f => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sawtooth'
    o.frequency.value = f
    g.gain.value = 0.06
    o.connect(g)
    g.connect(master)
    o.start()
    nodes.push(o, g)
  })

  // Sub rumble
  const sub = ctx.createOscillator()
  const subG = ctx.createGain()
  sub.type = 'sine'
  sub.frequency.value = 27.5
  subG.gain.value = 0.28
  sub.connect(subG)
  subG.connect(master)
  sub.start()
  nodes.push(sub, subG)

  // Filtered noise — machinery texture
  const bufLen = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  noise.loop = true
  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.value = 280
  bpf.Q.value = 0.4
  const noiseG = ctx.createGain()
  noiseG.gain.value = 0.04
  noise.connect(bpf)
  bpf.connect(noiseG)
  noiseG.connect(master)
  noise.start()
  nodes.push(noise, bpf, noiseG, master)
}

function teardown() {
  nodes.forEach(n => { try { n.stop?.(); n.disconnect?.() } catch {} })
  nodes = []
  ctx?.close()
  ctx = null
}

function toggle() {
  if (!playing.value) {
    buildGraph()
    playing.value = true
  } else {
    const master = nodes[nodes.length - 1]
    if (master?.gain) {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5)
      setTimeout(teardown, 1600)
    } else {
      teardown()
    }
    playing.value = false
  }
}

onUnmounted(teardown)
</script>

<template>
  <button @click="toggle" class="music-btn" :class="{ active: playing }">
    <span class="music-icon">{{ playing ? '◼' : '▶' }}</span>
    <span class="music-label">{{ playing ? 'SND' : 'SND' }}</span>
  </button>
</template>

<style scoped>
.music-btn {
  position: fixed;
  bottom: 1.6rem;
  left: 2.4rem;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.4em;
  background: none;
  border: 1px solid #2a2e14;
  padding: 0.25em 0.6em;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #4a5028;
  transition: color 0.3s, border-color 0.3s;
}
.music-btn:hover {
  color: #888e58;
  border-color: #4a5028;
}
.music-btn.active {
  color: #c48a10;
  border-color: rgba(196,138,16,0.4);
}
.music-icon { font-size: 0.55rem; }
</style>
