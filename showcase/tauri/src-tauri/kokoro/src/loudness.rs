/// Normalize each synthesized utterance, retaining its dynamics and reserving peak headroom.
/// Gain is bounded so silence and very quiet model artifacts are never amplified without limit.
pub fn normalize(samples: &[f32], volume: f32) -> Vec<f32> {
    let peak = samples.iter().fold(0.0_f32, |peak, s| peak.max(s.abs()));
    if peak < 0.0001 {
        return vec![0.; samples.len()];
    }
    let rms = (samples.iter().map(|s| f64::from(*s).powi(2)).sum::<f64>() / samples.len() as f64)
        .sqrt() as f32;
    let gain = ((0.12 / rms).clamp(0.25, 6.) * volume).min(0.95 / peak);
    samples.iter().map(|s| s * gain).collect()
}
/// Remove model padding between streaming phrases, retaining consonant/release margins.
pub fn speech_edges(samples: &[f32], rate: u32) -> &[f32] {
    let Some(first) = samples.iter().position(|s| s.abs() > 0.001) else {
        return samples;
    };
    let last = samples
        .iter()
        .rposition(|s| s.abs() > 0.001)
        .unwrap_or(first);
    let start = first.saturating_sub(rate as usize * 40 / 1000);
    let end = (last + 1 + rate as usize * 80 / 1000).min(samples.len());
    &samples[start..end]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn trims_only_outer_padding_and_keeps_speech_and_internal_pauses() {
        let mut samples = vec![0.; 24_000];
        samples[8_000..9_000].fill(0.1);
        samples[10_000..11_000].fill(-0.1);
        let trimmed = speech_edges(&samples, 24_000);
        assert_eq!(trimmed.len(), 3_000 + 960 + 1_920);
        assert_eq!(trimmed.iter().filter(|s| s.abs() > 0.01).count(), 2_000);
        assert_eq!(speech_edges(&[0.; 100], 24_000).len(), 100);
    }
    #[test]
    fn quiet_speech_is_louder_without_clipping_or_changing_dynamics() {
        let input = vec![0.02, -0.04, 0.01, 0.];
        let output = normalize(&input, 1.);
        assert!(output[0] > input[0] * 2.);
        assert_eq!(output[1] / output[0], -2.);
        let mut transient = vec![0.01; 1000];
        transient[0] = 0.9;
        let limited = normalize(&transient, 1.5);
        assert!(limited.iter().all(|s| s.abs() <= 0.95));
        assert!((limited[0] - 0.95).abs() < 0.00001);
        assert_eq!(normalize(&input, 0.), vec![0.; 4]);
        assert_eq!(normalize(&[0.; 12], 1.5), vec![0.; 12]);
        assert!(normalize(&input, 0.5)[0] < output[0]);
    }
}
