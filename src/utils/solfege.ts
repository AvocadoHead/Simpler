const solfegeMap: Record<string, string> = {
  do: 'Do',
  doh: 'Do',
  doe: 'Do',
  though: 'Do',
  dough: 'Do',
  door: 'Do',
  go: 'Do',
  re: 'Re',
  ray: 'Re',
  rey: 'Re',
  rain: 'Re',
  way: 'Re',
  mi: 'Mi',
  me: 'Mi',
  mee: 'Mi',
  knee: 'Mi',
  fa: 'Fa',
  far: 'Fa',
  fah: 'Fa',
  for: 'Fa',
  four: 'Fa',
  sol: 'Sol',
  so: 'Sol',
  sew: 'Sol',
  soul: 'Sol',
  sole: 'Sol',
  saw: 'Sol',
  show: 'Sol',
  la: 'La',
  lah: 'La',
  law: 'La',
  ma: 'La',
  si: 'Si',
  ti: 'Si',
  tea: 'Si',
  tee: 'Si',
  see: 'Si',
  sea: 'Si',
  she: 'Si',
  key: 'Si',
  be: 'Si',
}

export function convertToSolfege(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token

      const match = token.match(/^([^a-z]*)([a-z']+)([^a-z]*)$/i)
      if (!match) return token

      const [, prefix, word, suffix] = match
      return `${prefix}${solfegeMap[word] ?? word}${suffix}`
    })
    .join('')
    .trim()
}

export function wordsFromTranscript(transcript: string): string[] {
  return transcript
    .trim()
    .split(/\s+/)
    .filter((word) => word && word !== 'Listening...')
}
