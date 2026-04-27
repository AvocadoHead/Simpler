import { describe, expect, it } from 'vitest'
import { convertToSolfege, wordsFromTranscript } from './solfege'

describe('convertToSolfege', () => {
  it('normalizes common speech-recognition variants to solfege syllables', () => {
    expect(convertToSolfege('dough ray me far soul law tea')).toBe('Do Re Mi Fa Sol La Si')
  })

  it('keeps punctuation and unknown words readable', () => {
    expect(convertToSolfege('hello, do!')).toBe('hello, Do!')
  })
})

describe('wordsFromTranscript', () => {
  it('removes empty text and the recording placeholder', () => {
    expect(wordsFromTranscript(' Listening...  Do   Re ')).toEqual(['Do', 'Re'])
  })
})
