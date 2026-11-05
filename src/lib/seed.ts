import { db, repo } from '@/db'
import type { CardInput } from '@/db/types'

type SeedCard = Omit<CardInput, 'deckId'>

const SEED_CARDS: SeedCard[] = [
  { front: 'hola', context: '¡Hola! ¿Cómo estás?', translationEn: 'hello', translationUk: 'привіт', partOfSpeech: 'interjection', tags: ['basics', 'greetings'] },
  { front: 'gracias', context: 'Muchas gracias por tu ayuda.', translationEn: 'thank you', translationUk: 'дякую', partOfSpeech: 'interjection', tags: ['basics'] },
  { front: 'por favor', context: 'Un café, por favor.', translationEn: 'please', translationUk: 'будь ласка', partOfSpeech: 'phrase', tags: ['basics'] },
  { front: 'la casa', context: 'Mi casa es pequeña pero acogedora.', translationEn: 'house', translationUk: 'дім, будинок', partOfSpeech: 'noun', notes: 'Feminine noun.', tags: ['nouns', 'home'] },
  { front: 'el perro', context: 'El perro duerme en el jardín.', translationEn: 'dog', translationUk: 'собака', partOfSpeech: 'noun', tags: ['nouns', 'animals'] },
  { front: 'comer', context: 'Me gusta comer paella los domingos.', translationEn: 'to eat', translationUk: 'їсти', partOfSpeech: 'verb', notes: 'Regular -er verb.', tags: ['verbs', 'food'] },
  { front: 'beber', context: 'Quiero beber agua.', translationEn: 'to drink', translationUk: 'пити', partOfSpeech: 'verb', tags: ['verbs', 'food'] },
  { front: 'hablar', context: 'Ella habla tres idiomas.', translationEn: 'to speak', translationUk: 'говорити, розмовляти', partOfSpeech: 'verb', notes: 'Regular -ar verb.', tags: ['verbs'] },
  { front: 'bonito', context: 'Qué bonito está el cielo hoy.', translationEn: 'pretty, nice', translationUk: 'гарний', partOfSpeech: 'adjective', tags: ['adjectives'] },
  { front: 'rápido', context: 'El tren es muy rápido.', translationEn: 'fast, quick', translationUk: 'швидкий', partOfSpeech: 'adjective', tags: ['adjectives'] },
  { front: 'siempre', context: 'Siempre llego temprano.', translationEn: 'always', translationUk: 'завжди', partOfSpeech: 'adverb', tags: ['adverbs', 'time'] },
  { front: 'nunca', context: 'Nunca he estado en México.', translationEn: 'never', translationUk: 'ніколи', partOfSpeech: 'adverb', tags: ['adverbs', 'time'] },
  { front: '¿Dónde está el baño?', translationEn: 'Where is the bathroom?', translationUk: 'Де туалет?', partOfSpeech: 'phrase', tags: ['phrases', 'travel'] },
  { front: 'tener hambre', context: 'Tengo mucha hambre.', translationEn: 'to be hungry', translationUk: 'бути голодним', partOfSpeech: 'phrase', notes: 'Literally "to have hunger".', tags: ['phrases', 'food', 'idioms'] },
  { front: 'la mañana', context: 'Por la mañana tomo café.', translationEn: 'morning', translationUk: 'ранок', partOfSpeech: 'noun', tags: ['nouns', 'time'] },
  { front: 'el trabajo', context: 'Voy al trabajo en bicicleta.', translationEn: 'work, job', translationUk: 'робота', partOfSpeech: 'noun', tags: ['nouns'] },
  { front: 'pero', context: 'Quiero ir, pero no puedo.', translationEn: 'but', translationUk: 'але', partOfSpeech: 'conjunction', tags: ['grammar'] },
  { front: 'con', context: 'Voy con mis amigos.', translationEn: 'with', translationUk: 'з', partOfSpeech: 'preposition', tags: ['grammar'] },
  { front: 'entender', context: 'No entiendo la pregunta.', translationEn: 'to understand', translationUk: 'розуміти', partOfSpeech: 'verb', notes: 'Stem-changing e→ie.', tags: ['verbs'] },
  { front: 'la ciudad', context: 'Madrid es una ciudad grande.', translationEn: 'city', translationUk: 'місто', partOfSpeech: 'noun', tags: ['nouns', 'travel'] },
]

let seedPromise: Promise<boolean> | null = null

export function seedIfEmpty(): Promise<boolean> {
  seedPromise ??= db.transaction('rw', db.decks, db.cards, db.settings, async () => {
    if ((await db.decks.count()) > 0) return false
    const deck = await repo.createDeck({
      name: 'Spanish Essentials',
      description: 'Starter vocabulary: greetings, verbs, nouns and useful phrases.',
    })
    await repo.createCards(SEED_CARDS.map((c) => ({ ...c, deckId: deck.id })))
    await repo.updateSettings({ lastDeckId: deck.id })
    return true
  })
  return seedPromise
}
