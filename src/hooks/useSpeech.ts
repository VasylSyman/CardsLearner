import { useCallback, useEffect, useMemo, useState } from 'react'

const SPANISH_LANG_PREFIX = 'es'

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!supported) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  const spanishVoices = useMemo(
    () => voices.filter((v) => v.lang.toLowerCase().startsWith(SPANISH_LANG_PREFIX)),
    [voices],
  )

  const speak = useCallback(
    (text: string, opts?: { voiceUri?: string; rate?: number }) => {
      if (!supported || !text.trim()) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'es-ES'
      utter.rate = opts?.rate ?? 0.9
      const chosen =
        (opts?.voiceUri && voices.find((v) => v.voiceURI === opts.voiceUri)) ||
        spanishVoices.find((v) => v.default) ||
        spanishVoices[0]
      if (chosen) utter.voice = chosen
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
    },
    [supported, voices, spanishVoices],
  )

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  return { supported, speaking, speak, stop, voices: spanishVoices }
}
