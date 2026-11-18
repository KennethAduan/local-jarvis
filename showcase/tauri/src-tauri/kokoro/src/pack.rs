use sha2::{Digest, Sha256};
use std::{
    fs::{File, OpenOptions},
    io::{Read, Seek, SeekFrom},
    path::Path,
};

const ASSETS: &[(&str, u64, &str)] = &[
    (
        "model.int8.onnx",
        114202993,
        "75635ea3b85a32d00094dcdd61a258aba87c160f7c264c304a7b3ae9d734195e",
    ),
    (
        "voices.bin",
        28200960,
        "1c5a5b983d3d50d8586d437a51f3faa2da7919ce76a013c081e65671a3447c29",
    ),
    (
        "lexicon-gb-en.txt",
        6366635,
        "c4cbb37316f62210dff52718a7afcaae24f50c032cc75ab47ae67b831d1049e7",
    ),
    (
        "tokens.txt",
        687,
        "6ebb6bb288f20f3ae8d004d3c2ca27697da27c037d75e81a60e2a6a663f95425",
    ),
    (
        "LICENSE",
        11358,
        "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
    ),
];

// Windows handles deny write and delete sharing until the engine is dropped.
pub fn verify(directory: &Path) -> Result<Vec<File>, String> {
    if !directory.is_absolute() {
        return Err("Model directory must be absolute".into());
    }
    verify_assets(directory, ASSETS)
}

fn verify_assets(directory: &Path, assets: &[(&str, u64, &str)]) -> Result<Vec<File>, String> {
    let mut handles = Vec::new();
    for &(name, size, digest) in assets {
        let mut options = OpenOptions::new();
        options.read(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(1);
        }
        let mut file = options
            .open(directory.join(name))
            .map_err(|_| format!("Voice pack missing or in use: {name}"))?;
        if !file
            .metadata()
            .map_err(|_| "Cannot inspect voice pack")?
            .is_file()
            || file
                .metadata()
                .map_err(|_| "Cannot inspect voice pack")?
                .len()
                != size
        {
            return Err(format!("Invalid voice pack asset: {name}"));
        }
        let mut hash = Sha256::new();
        let mut buf = [0u8; 65536];
        let mut total = 0u64;
        loop {
            let n = file.read(&mut buf).map_err(|_| "Cannot read voice pack")?;
            if n == 0 {
                break;
            }
            total += n as u64;
            if total > size {
                return Err(format!("Invalid voice pack asset: {name}"));
            }
            hash.update(&buf[..n]);
        }
        if total != size || format!("{:x}", hash.finalize()) != digest {
            return Err(format!("Invalid voice pack asset: {name}"));
        }
        file.seek(SeekFrom::Start(0))
            .map_err(|_| "Cannot read voice pack")?;
        handles.push(file);
    }
    Ok(handles)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_relative_and_missing_packs() {
        assert!(verify(Path::new("relative")).is_err());
        assert!(verify(&std::env::temp_dir().join("jarvis-nonexistent-pack-9f42")).is_err());
    }
    #[test]
    fn manifest_has_expected_public_pack_size() {
        assert_eq!(ASSETS.iter().map(|x| x.1).sum::<u64>(), 148782633);
    }
    #[test]
    fn rejects_truncated_and_tampered_assets() {
        let path = std::env::temp_dir().join(format!("jarvis-kokoro-test-{}", std::process::id()));
        std::fs::create_dir_all(&path).unwrap();
        let file = path.join("asset");
        let digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        std::fs::write(&file, b"abc").unwrap();
        assert!(verify_assets(&path, &[("asset", 3, digest)]).is_ok());
        assert!(verify_assets(&path, &[("asset", 4, digest)]).is_err());
        std::fs::write(&file, b"abd").unwrap();
        assert!(verify_assets(&path, &[("asset", 3, digest)]).is_err());
        std::fs::remove_dir_all(path).unwrap();
    }
}
