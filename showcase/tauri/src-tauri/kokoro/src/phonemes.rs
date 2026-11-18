pub fn spoken_text(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '\u{1f000}'..='\u{1faff}'
            | '\u{2600}'..='\u{27bf}'
            | '\u{fe0e}'
            | '\u{fe0f}'
            | '\u{200d}'
            | '\u{20e3}' => ' ',
            '‘' | '’' => '\'',
            '“' | '”' => '"',
            '—' | '–' => ',',
            _ => c,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

use misaki_rs::{fallback::FallbackError, Fallback, Language, G2P};
use std::{collections::HashMap, path::Path};

struct BritishFallback(HashMap<String, String>);
impl Fallback for BritishFallback {
    fn phonemize(&self, word: &str) -> Result<String, FallbackError> {
        if word.eq_ignore_ascii_case("jarvis") {
            return Ok("ʤˈɑːvɪs".into());
        }
        if let Some(phonemes) = self.0.get(&word.to_lowercase()) {
            return Ok(phonemes.clone());
        }
        // Spell unknown ASCII names/technical identifiers rather than silently dropping them.
        let mut phones = Vec::new();
        const LETTERS: [&str; 26] = [
            "ˈA",
            "bˈiː",
            "sˈiː",
            "dˈiː",
            "ˈiː",
            "ˈɛf",
            "ʤˈiː",
            "ˈAʧ",
            "ˈI",
            "ʤˈA",
            "kˈA",
            "ˈɛl",
            "ˈɛm",
            "ˈɛn",
            "ˈQ",
            "pˈiː",
            "kjˈuː",
            "ˈɑː",
            "ˈɛs",
            "tˈiː",
            "jˈuː",
            "vˈiː",
            "dˈʌbᵊljˌuː",
            "ˈɛks",
            "wˈI",
            "zˈɛd",
        ];
        for character in word.chars() {
            if character.is_ascii_alphabetic() {
                phones.push(LETTERS[(character.to_ascii_lowercase() as u8 - b'a') as usize]);
            } else if character != '-' && character != '\'' {
                return Err(FallbackError::NoPhonemes {
                    word: String::new(),
                });
            }
        }
        if phones.is_empty() {
            return Err(FallbackError::NoPhonemes {
                word: String::new(),
            });
        }
        Ok(phones.join(" "))
    }
}
pub struct BritishPhonemizer(G2P);
impl BritishPhonemizer {
    pub fn load(lexicon: &Path) -> Result<Self, String> {
        let text = std::fs::read_to_string(lexicon)
            .map_err(|_| "Could not read British pronunciation data")?;
        let words = text
            .lines()
            .filter_map(|line| {
                let mut columns = line.split_whitespace();
                let word = columns.next()?.to_owned();
                Some((word, columns.collect::<String>()))
            })
            .collect();
        Ok(Self(G2P::with_fallback(
            Language::EnglishGB,
            Some(Box::new(BritishFallback(words))),
        )))
    }
    pub fn phonemes(&self, text: &str) -> Result<Vec<i32>, String> {
        let (phonemes, _) = self
            .0
            .g2p(&pronunciation_overrides(&spoken_text(text)))
            .map_err(|_| "Could not prepare English pronunciation")?;
        if phonemes.contains('❓') {
            return Err("This voice supports English.".into());
        }
        let result: Vec<i32> = phonemes.chars().map(|c| c as i32).collect();
        if result.is_empty() || result.len() > 480 {
            return Err("This speech segment is too complex. Shorten it.".into());
        }
        Ok(result)
    }
}
fn pronunciation_overrides(text: &str) -> String {
    // Explicit Misaki phoneme markers also override all-caps acronym handling.
    let mut result = String::new();
    let mut word = String::new();
    let flush = |word: &mut String, result: &mut String| {
        let replacement = match word.to_ascii_lowercase().as_str() {
            "jarvis" => Some("[Jarvis](/ʤˈɑːvɪs/)"),
            "ultron" => Some("[Ultron](/ˈʌltrɒn/)"),
            _ => None,
        };
        result.push_str(replacement.unwrap_or(word));
        word.clear();
    };
    for c in text.chars() {
        if c.is_alphabetic() {
            word.push(c);
        } else {
            flush(&mut word, &mut result);
            result.push(c);
        }
    }
    flush(&mut word, &mut result);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn assistant_names_are_pronounced_as_words_even_when_capitalized() {
        let engine = BritishPhonemizer(G2P::with_fallback(Language::EnglishGB, None));
        let phones = engine.phonemes("JARVIS and ULTRON.").unwrap();
        let readable: String = phones
            .iter()
            .filter_map(|p| char::from_u32(*p as u32))
            .collect();
        assert!(readable.contains("ʤˈɑːvɪs"), "{readable}");
        assert!(readable.contains("ˈʌltrɒn"), "{readable}");
    }
    #[test]
    fn decorative_emoji_do_not_break_english_replies() {
        let engine = BritishPhonemizer(G2P::with_fallback(
            Language::EnglishGB,
            Some(Box::new(BritishFallback(HashMap::new()))),
        ));
        assert_eq!(
            engine
                .phonemes("Hey there! How can I assist you today, Ito? 😊")
                .unwrap(),
            engine
                .phonemes("Hey there! How can I assist you today, Ito?")
                .unwrap()
        );
        assert_eq!(spoken_text("Hello 👨‍👩‍👧‍👦 🇬🇧 👍🏽 1️⃣"), "Hello 1");
        assert_eq!(spoken_text("こんにちは"), "こんにちは");
    }
    #[test]
    fn british_pronunciation_handles_plurals_numbers_and_unknown_ascii_words() {
        let engine = BritishPhonemizer(G2P::with_fallback(
            Language::EnglishGB,
            Some(Box::new(BritishFallback(HashMap::new()))),
        ));
        let phones = engine
            .phonemes("All systems are ready. You have 3 tasks.")
            .unwrap();
        let readable: String = phones
            .iter()
            .filter_map(|p| char::from_u32(*p as u32))
            .collect();
        assert!(
            readable.contains('z'),
            "plural systems must remain speakable"
        );
        assert!(!readable.contains('3'));
        assert!(engine.phonemes("qzxwv").unwrap().len() > 5);
    }
}
